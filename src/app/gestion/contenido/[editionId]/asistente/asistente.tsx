"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  CheckCircle2,
  FileText,
  Loader2,
  TriangleAlert,
  Undo2,
  Upload,
} from "lucide-react";
import {
  aplicarAsistenteAction,
  deshacerImportacionAction,
  type AsistenteState,
} from "@/server/content/asistente";
import {
  avisosDeLaPropuesta,
  proponerTemario,
  type PropuestaDeTema,
} from "@/lib/content/nombres";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  Field,
  Input,
  Select,
} from "@/components/ui/primitives";

/**
 * ASISTENTE DE TEMARIO · la pantalla
 *
 * Cuatro pasos y ninguno de sorpresa: elegir dónde va, soltar los archivos,
 * **revisar lo que se va a crear** y confirmar. El tercero es el que justifica
 * todo lo demás. Un asistente que crea sesenta temas y luego enseña el
 * resultado obliga a deshacerlo a mano; este enseña la lista antes, con sus
 * avisos —números repetidos, huecos, temas sin título— y deja cambiar cada
 * etiqueta.
 *
 * Los archivos se envían en el ORDEN REVISADO, no en el que los eligió el
 * navegador. Por eso se construye el envío a mano en lugar de dejar que lo haga
 * el formulario: el orden de la pantalla es el que la academia ha aprobado.
 */

type Bandera = "heredar" | "si" | "no";

/**
 * El asistente para subir un temario entero de una vez.
 */
export function AsistenteDeTemario({
  secciones,
}: {
  secciones: { id: string; label: string }[];
}) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();

  const [parentId, setParentId] = useState(secciones[0]?.id ?? "");
  const [archivos, setArchivos] = useState<File[]>([]);
  const [etiquetas, setEtiquetas] = useState<Record<string, string>>({});
  const [publicar, setPublicar] = useState(false);
  const [descargable, setDescargable] = useState<Bandera>("heredar");
  const [ia, setIa] = useState<Bandera>("heredar");
  const [resultado, setResultado] = useState<AsistenteState>(undefined);

  const propuesta = useMemo(
    () => proponerTemario(archivos.map((a) => a.name)),
    [archivos],
  );
  const avisos = useMemo(() => avisosDeLaPropuesta(propuesta), [propuesta]);

  const etiquetaDe = (fila: PropuestaDeTema) =>
    etiquetas[fila.nombreArchivo] ?? fila.etiqueta;

  const totalBytes = archivos.reduce((suma, a) => suma + a.size, 0);

  function elegirArchivos(lista: FileList | null) {
    setArchivos([...(lista ?? [])]);
    setEtiquetas({});
    setResultado(undefined);
  }

  function aplicar() {
    const porNombre = new Map(archivos.map((a) => [a.name, a]));
    const datos = new FormData();
    datos.set("parentId", parentId);
    if (publicar) datos.set("publicar", "on");
    datos.set("descargable", descargable);
    datos.set("ia", ia);

    // El orden importa: se recorre la propuesta ya ordenada, no la lista del
    // navegador. Los dos campos van en paralelo, archivo y etiqueta.
    for (const fila of propuesta) {
      const archivo = porNombre.get(fila.nombreArchivo);
      if (!archivo) continue;
      datos.append("archivos", archivo);
      datos.append("etiquetas", etiquetaDe(fila));
    }

    iniciar(async () => {
      const respuesta = await aplicarAsistenteAction(undefined, datos);
      setResultado(respuesta);
      if (respuesta?.ok) {
        setArchivos([]);
        setEtiquetas({});
        router.refresh();
      }
    });
  }

  function deshacer(batchId: string) {
    const datos = new FormData();
    datos.set("batchId", batchId);
    iniciar(async () => {
      const respuesta = await deshacerImportacionAction(undefined, datos);
      setResultado(respuesta);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {/* ── 1 · Dónde va ─────────────────────────────────────────────────── */}
      <Card>
        <CardContent className="space-y-4 p-5 pt-5">
          <Paso numero={1} titulo="¿Dónde va este temario?" />

          {secciones.length === 0 ? (
            <p className="text-sm text-caution">
              Esta convocatoria todavía no tiene ningún apartado. Crea antes uno
              —«Temario», «Supuestos», el nombre que uséis— y vuelve aquí.
            </p>
          ) : (
            <Field label="Apartado de destino" htmlFor="parentId" required>
              <Select
                name="parentId"
                value={parentId}
                onChange={(e) => setParentId(e.target.value)}
              >
                {secciones.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </Select>
            </Field>
          )}
        </CardContent>
      </Card>

      {/* ── 2 · Los archivos ─────────────────────────────────────────────── */}
      <Card>
        <CardContent className="space-y-4 p-5 pt-5">
          <Paso
            numero={2}
            titulo="Suelta aquí los archivos"
            ayuda="Selecciona toda la carpeta de golpe. Leemos el número y el título del nombre de cada archivo."
          />

          <label className="flex cursor-pointer flex-col items-center gap-2 rounded-[var(--radius-card)] border border-dashed border-line px-6 py-10 text-center hover:border-accent">
            <Upload className="size-6 text-ink-muted" aria-hidden />
            <span className="text-sm font-medium text-ink">
              {archivos.length > 0
                ? `${archivos.length} archivos · ${(totalBytes / 1024 / 1024).toFixed(1)} MB`
                : "Elegir archivos"}
            </span>
            <span className="text-xs text-ink-muted">
              PDF, Word, PowerPoint… hasta 200 MB cada uno
            </span>
            <input
              type="file"
              multiple
              className="sr-only"
              onChange={(e) => elegirArchivos(e.target.files)}
            />
          </label>
        </CardContent>
      </Card>

      {/* ── 3 · Revisar ──────────────────────────────────────────────────── */}
      {propuesta.length > 0 ? (
        <Card>
          <CardContent className="space-y-4 p-5 pt-5">
            <Paso
              numero={3}
              titulo="Revisa antes de crear nada"
              ayuda="Esto es lo que se va a crear, con el nombre que verá tu alumnado. Cámbialo si no te encaja: mandas tú."
            />

            {avisos.length > 0 ? (
              <ul className="space-y-2">
                {avisos.map((aviso) => (
                  <li
                    key={aviso}
                    className="flex items-start gap-2 rounded-[var(--radius-control)] bg-caution-soft px-3 py-2 text-sm text-caution"
                  >
                    <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                    {aviso}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="flex items-center gap-2 rounded-[var(--radius-control)] bg-positive-soft px-3 py-2 text-sm text-positive">
                <CheckCircle2 className="size-4 shrink-0" aria-hidden />
                Los {propuesta.length} archivos se han leído sin problemas.
              </p>
            )}

            <ul className="divide-y divide-[var(--border-subtle)]">
              {propuesta.map((fila) => (
                <li
                  key={fila.nombreArchivo}
                  className="flex flex-wrap items-center gap-3 py-2"
                >
                  <span className="w-6 shrink-0 text-right text-xs tabular-nums text-ink-muted">
                    {fila.posicion}
                  </span>

                  <Input
                    value={etiquetaDe(fila)}
                    onChange={(e) =>
                      setEtiquetas((previo) => ({
                        ...previo,
                        [fila.nombreArchivo]: e.target.value,
                      }))
                    }
                    aria-label={`Nombre del tema para ${fila.nombreArchivo}`}
                    className="min-w-0 flex-1"
                  />

                  <span
                    className="flex min-w-0 shrink items-center gap-1 text-xs text-ink-muted"
                    title={fila.nombreArchivo}
                  >
                    <FileText className="size-3 shrink-0" aria-hidden />
                    <span className="truncate">{fila.nombreArchivo}</span>
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      {/* ── 4 · Cómo entran ──────────────────────────────────────────────── */}
      {propuesta.length > 0 ? (
        <Card>
          <CardContent className="space-y-4 p-5 pt-5">
            <Paso
              numero={4}
              titulo="Cómo entran"
              ayuda="Se aplica a toda la tanda. Después puedes cambiar cada tema por separado."
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="¿Se puede descargar?"
                htmlFor="descargable"
                hint="«Heredar» usa lo que tenga el apartado padre."
              >
                <Select
                  value={descargable}
                  onChange={(e) => setDescargable(e.target.value as Bandera)}
                >
                  <option value="heredar">Heredar del apartado</option>
                  <option value="si">Sí, se puede descargar</option>
                  <option value="no">No, solo consulta en línea</option>
                </Select>
              </Field>

              <Field
                label="¿Puede usarlo Geminis IA?"
                htmlFor="ia"
                hint="Si lo desactivas, la IA no citará este material."
              >
                <Select value={ia} onChange={(e) => setIa(e.target.value as Bandera)}>
                  <option value="heredar">Heredar del apartado</option>
                  <option value="si">Sí</option>
                  <option value="no">No</option>
                </Select>
              </Field>
            </div>

            <label className="flex items-start gap-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={publicar}
                onChange={(e) => setPublicar(e.target.checked)}
                className="mt-0.5 size-4"
              />
              <span>
                Publicarlos ya para el alumnado.
                <span className="block text-xs text-ink-muted">
                  Sin marcar entran en borrador, que es lo recomendable: los
                  revisas con calma y los publicas cuando estén. Publicar sesenta
                  temas de golpe sin mirarlos es difícil de deshacer en la cabeza
                  de tu alumnado, aunque aquí se pueda deshacer en un clic.
                </span>
              </span>
            </label>
          </CardContent>
        </Card>
      ) : null}

      {resultado?.error ? (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-[var(--radius-control)] bg-critical-soft px-3 py-2 text-sm text-critical"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          {resultado.error}
        </p>
      ) : null}

      {resultado?.ok ? (
        <Card>
          <CardContent className="space-y-3 p-5 pt-5">
            <p className="flex items-start gap-2 text-sm text-positive">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
              {resultado.ok}
            </p>

            {resultado.batchId ? (
              <div className="space-y-1 border-t border-line pt-3">
                <p className="text-xs text-ink-muted">
                  ¿No era esto? Se retira la tanda entera, con lo que hayas
                  añadido dentro después.
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => deshacer(resultado.batchId!)}
                  disabled={pendiente}
                >
                  <Undo2 aria-hidden />
                  Deshacer esta importación
                </Button>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {propuesta.length > 0 ? (
        <Button
          onClick={aplicar}
          disabled={pendiente || !parentId}
          className="w-full"
          size="lg"
        >
          {pendiente ? <Loader2 className="animate-spin" aria-hidden /> : null}
          {pendiente
            ? "Creando el temario…"
            : `Crear ${propuesta.length} temas${publicar ? " y publicarlos" : " en borrador"}`}
        </Button>
      ) : null}
    </div>
  );
}

function Paso({
  numero,
  titulo,
  ayuda,
}: {
  numero: number;
  titulo: string;
  ayuda?: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold text-accent">
        {numero}
      </span>
      <div className="space-y-0.5">
        <h2 className="text-sm font-semibold text-ink">{titulo}</h2>
        {ayuda ? <p className="text-xs text-ink-muted">{ayuda}</p> : null}
      </div>
    </div>
  );
}
