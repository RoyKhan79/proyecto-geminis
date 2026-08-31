"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Pencil, RotateCcw, X } from "lucide-react";
import { MODULOS, type CodigoModulo } from "@/lib/modules/catalogo";
import { pactarPrecioAction } from "@/server/platform/module-actions";
import { formatCents } from "@/lib/utils";

/**
 * EL PRECIO DE UN MÓDULO PARA ESTA ACADEMIA
 *
 * Enseña lo que paga y deja cambiarlo ahí mismo. Los precios se negocian —una
 * academia grande, un acuerdo de lanzamiento, un favor a quien te trajo tres
 * clientes— y un sistema que no lo admita obliga a llevar la contabilidad real
 * en otro sitio.
 *
 * Cuando hay precio pactado se ve el de catálogo tachado encima. No es adorno:
 * seis meses después, quien mire esta pantalla tiene que poder saber de un
 * vistazo que ahí hubo un acuerdo, sin ir a buscar el contrato.
 */
export function PrecioDelModulo({
  academyId,
  codigo,
  precioActual,
  contratado,
}: {
  academyId: string;
  codigo: CodigoModulo;
  /** Lo pactado, o `null` si se cobra el de catálogo. */
  precioActual: number | null;
  /** Si el módulo no está contratado, el precio se enseña pero no se toca. */
  contratado: boolean;
}) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState(
    precioActual === null ? "" : (precioActual / 100).toFixed(2).replace(".", ","),
  );
  const [fallo, setFallo] = useState<string | null>(null);

  const catalogo = MODULOS[codigo].precioCents;
  const efectivo = precioActual ?? catalogo;
  const hayPacto = precioActual !== null && precioActual !== catalogo;

  function guardar(nuevo: string) {
    setFallo(null);
    const datos = new FormData();
    datos.set("academyId", academyId);
    datos.set("modulo", codigo);
    datos.set("precio", nuevo);

    iniciar(async () => {
      const respuesta = await pactarPrecioAction(undefined, datos);
      if (respuesta?.error) {
        setFallo(respuesta.error);
        return;
      }
      setEditando(false);
      router.refresh();
    });
  }

  if (!editando) {
    return (
      <div className="flex shrink-0 flex-col items-end gap-0.5">
        <div className="flex items-center gap-1.5">
          {hayPacto ? (
            <span className="text-[0.7rem] text-ink-muted line-through">
              {formatCents(catalogo)}
            </span>
          ) : null}
          <span className="font-semibold tabular-nums text-ink">
            {formatCents(efectivo)}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[0.7rem] text-ink-muted">
            {hayPacto ? "precio pactado" : "al mes"}
          </span>
          {contratado ? (
            <button
              type="button"
              onClick={() => setEditando(true)}
              className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[0.7rem] font-medium text-accent transition-colors hover:bg-accent-soft focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring"
            >
              <Pencil className="size-3" aria-hidden />
              Editar
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="flex shrink-0 flex-col items-end gap-1">
      <div className="flex items-center gap-1">
        <div className="relative">
          <input
            autoFocus
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                guardar(valor);
              }
              if (e.key === "Escape") setEditando(false);
            }}
            inputMode="decimal"
            aria-label={`Precio mensual de ${MODULOS[codigo].nombre}`}
            placeholder={(catalogo / 100).toFixed(2).replace(".", ",")}
            className="h-8 w-24 rounded-[var(--radius-control)] border border-line-strong bg-surface pl-2 pr-6 text-right text-sm tabular-nums text-ink focus-visible:outline-2 focus-visible:outline-offset-[-1px] focus-visible:outline-ring"
          />
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-xs text-ink-muted"
          >
            €
          </span>
        </div>

        <button
          type="button"
          onClick={() => guardar(valor)}
          disabled={pendiente}
          aria-label="Guardar el precio"
          className="flex size-8 items-center justify-center rounded-[var(--radius-control)] bg-accent text-accent-contrast disabled:opacity-50"
        >
          <Check className="size-4" aria-hidden />
        </button>

        <button
          type="button"
          onClick={() => setEditando(false)}
          aria-label="Cancelar"
          className="flex size-8 items-center justify-center rounded-[var(--radius-control)] border border-line text-ink-muted hover:text-ink"
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>

      {hayPacto ? (
        <button
          type="button"
          onClick={() => {
            setValor("");
            guardar("");
          }}
          disabled={pendiente}
          className="inline-flex items-center gap-1 text-[0.7rem] text-ink-muted hover:text-ink"
        >
          <RotateCcw className="size-3" aria-hidden />
          Volver al de catálogo ({formatCents(catalogo)})
        </button>
      ) : (
        <span className="text-[0.7rem] text-ink-muted">
          Vacío = precio de catálogo
        </span>
      )}

      {fallo ? (
        <span role="alert" className="text-[0.7rem] text-critical">
          {fallo}
        </span>
      ) : null}
    </div>
  );
}
