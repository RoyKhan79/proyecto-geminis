"use client";

import { useActionState } from "react";
import { AlertCircle, CheckCircle2, Upload } from "lucide-react";
import {
  analizarExtractoAction,
  confirmarConciliacionAction,
  type ConciliacionState,
  type ConfirmacionState,
} from "@/server/billing/conciliar-actions";
import { Button } from "@/components/ui/button";
import { Badge, Card, CardContent, Table, Td, Th } from "@/components/ui/primitives";
import { formatCents } from "@/lib/utils";

/**
 * SUBIR EL EXTRACTO Y REVISAR LO QUE PROPONE
 *
 * Dos pasos, y son dos a propósito: primero se lee y se propone, y solo después
 * alguien confirma. Marcar el recibo del alumno equivocado no lo detecta nadie,
 * así que la máquina propone y la persona decide.
 *
 * Lo que el sistema ve claro viene ya marcado; lo dudoso viene desmarcado y con
 * el motivo escrito al lado. Nunca al revés: si hay que desmarcar cosas a mano
 * para no equivocarse, alguien acabará confirmando sin mirar.
 */
export function ConciliarForm() {
  const [analisis, analizar, analizando] = useActionState<ConciliacionState, FormData>(
    analizarExtractoAction,
    undefined,
  );
  const [confirmacion, confirmar, confirmando] = useActionState<
    ConfirmacionState,
    FormData
  >(confirmarConciliacionAction, undefined);

  const propuestas = analisis?.propuestas ?? [];
  const casables = propuestas.filter((p) => p.reciboId);

  return (
    <div className="space-y-5">
      <Card>
        <CardContent className="space-y-4 p-5 pt-5">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-ink">1 · Sube el extracto</p>
            <p className="text-xs leading-relaxed text-ink-muted">
              El fichero de Norma 43 que descargas de tu banca electrónica. Suele
              llamarse «cuaderno 43» y no se sube a ningún sitio: se lee aquí y
              no se guarda.
            </p>
          </div>

          {analisis?.error ? (
            <p
              role="alert"
              className="flex items-start gap-2 rounded-[var(--radius-control)] bg-critical-soft px-3 py-2 text-sm text-critical"
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
              {analisis.error}
            </p>
          ) : null}

          <form action={analizar} className="flex flex-wrap items-center gap-3">
            <input
              type="file"
              name="extracto"
              accept=".n43,.txt,.q43,text/plain"
              required
              className="block w-full max-w-sm text-sm text-ink-soft file:mr-3 file:rounded-[var(--radius-control)] file:border-0 file:bg-surface-muted file:px-3 file:py-2 file:text-sm file:font-medium file:text-ink hover:file:bg-surface-sunken"
            />
            <Button type="submit" disabled={analizando}>
              <Upload aria-hidden />
              {analizando ? "Leyendo…" : "Leer el extracto"}
            </Button>
          </form>

          {analisis?.avisos && analisis.avisos.length > 0 ? (
            <div className="rounded-[var(--radius-control)] bg-caution-soft px-3 py-2 text-xs leading-relaxed text-caution">
              <p className="font-medium">Hay líneas que no he podido leer:</p>
              <ul className="mt-1 list-disc pl-4">
                {analisis.avisos.slice(0, 5).map((aviso) => (
                  <li key={aviso}>{aviso}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {propuestas.length > 0 ? (
        <form action={confirmar}>
          <Card>
            <CardContent className="space-y-4 p-5 pt-5">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-ink">
                  2 · Revisa y confirma
                </p>
                <p className="text-xs leading-relaxed text-ink-muted">
                  {casables.length} de {propuestas.length} ingresos encajan con
                  un recibo. Lo dudoso viene sin marcar: mira el motivo antes de
                  marcarlo tú.
                </p>
              </div>

              {confirmacion?.error ? (
                <p
                  role="alert"
                  className="flex items-start gap-2 rounded-[var(--radius-control)] bg-critical-soft px-3 py-2 text-sm text-critical"
                >
                  <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
                  {confirmacion.error}
                </p>
              ) : null}

              {confirmacion?.ok ? (
                <p
                  role="status"
                  className="flex items-start gap-2 rounded-[var(--radius-control)] bg-positive-soft px-3 py-2 text-sm text-positive"
                >
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
                  {confirmacion.mensaje}
                </p>
              ) : null}

              <Table>
                <thead>
                  <tr>
                    <Th className="w-10" />
                    <Th>Fecha</Th>
                    <Th className="text-right">Importe</Th>
                    <Th>Concepto del banco</Th>
                    <Th>Recibo</Th>
                    <Th>Por qué</Th>
                  </tr>
                </thead>
                <tbody>
                  {propuestas.map((p, i) => (
                    <tr key={`${p.fecha}-${i}`}>
                      <Td>
                        {p.reciboId ? (
                          <input
                            type="checkbox"
                            name="reciboIds"
                            value={p.reciboId}
                            defaultChecked={p.seguro}
                            className="size-4 accent-[var(--accent)]"
                            aria-label={`Marcar como cobrado ${p.reciboEtiqueta}`}
                          />
                        ) : null}
                      </Td>
                      <Td className="whitespace-nowrap tabular-nums text-ink-soft">
                        {p.fecha}
                      </Td>
                      <Td className="text-right font-medium tabular-nums text-ink">
                        {formatCents(p.importeCents)}
                      </Td>
                      <Td className="max-w-xs truncate text-xs text-ink-muted">
                        {p.concepto || "—"}
                      </Td>
                      <Td className="text-sm text-ink">
                        {p.reciboEtiqueta ?? (
                          <Badge tone="neutral">Sin casar</Badge>
                        )}
                      </Td>
                      <Td className="text-xs leading-snug text-ink-soft">
                        {p.motivo}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>

              <Button type="submit" disabled={confirmando || casables.length === 0}>
                {confirmando ? "Marcando…" : "Marcar como cobrados los marcados"}
              </Button>
            </CardContent>
          </Card>
        </form>
      ) : null}
    </div>
  );
}
