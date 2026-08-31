"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Pencil, RotateCcw, X } from "lucide-react";
import { guardarDescuentoAction } from "@/server/platform/module-actions";

/**
 * EL DESCUENTO DE ESTA ACADEMIA
 *
 * Por defecto sale del número de módulos: cuantos más, más barato cada uno. Un
 * acuerdo puntual lo sustituye.
 *
 * Se distingue en pantalla de dónde viene el porcentaje, y no es un detalle: no
 * es lo mismo decirle a una academia «te sale el 15% porque llevas siete
 * módulos» que «te hicimos un 25% en su día». La segunda frase cambia la
 * conversación cuando quiera negociar otra vez.
 */
export function DescuentoPactado({
  academyId,
  porcentaje,
  origen,
}: {
  academyId: string;
  /** El que se está aplicando ahora. */
  porcentaje: number;
  origen: "volumen" | "pactado";
}) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState(origen === "pactado" ? String(porcentaje) : "");
  const [fallo, setFallo] = useState<string | null>(null);

  function guardar(nuevo: string) {
    setFallo(null);
    const datos = new FormData();
    datos.set("academyId", academyId);
    datos.set("descuento", nuevo);

    iniciar(async () => {
      const respuesta = await guardarDescuentoAction(undefined, datos);
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
      <div className="flex items-baseline justify-between gap-2">
        <dt className="flex items-center gap-2 text-positive">
          Descuento {porcentaje}%
          <span className="text-[0.7rem] font-normal text-ink-muted">
            {origen === "pactado" ? "pactado" : "por volumen"}
          </span>
          <button
            type="button"
            onClick={() => setEditando(true)}
            className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[0.7rem] font-medium text-accent transition-colors hover:bg-accent-soft focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring"
          >
            <Pencil className="size-3" aria-hidden />
            Editar
          </button>
        </dt>
      </div>
    );
  }

  return (
    <div className="space-y-1.5 rounded-[var(--radius-control)] bg-surface-muted p-2.5">
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
            inputMode="numeric"
            aria-label="Descuento en porcentaje"
            placeholder="por volumen"
            className="h-8 w-28 rounded-[var(--radius-control)] border border-line-strong bg-surface pl-2 pr-6 text-right text-sm tabular-nums text-ink focus-visible:outline-2 focus-visible:outline-offset-[-1px] focus-visible:outline-ring"
          />
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-xs text-ink-muted"
          >
            %
          </span>
        </div>

        <button
          type="button"
          onClick={() => guardar(valor)}
          disabled={pendiente}
          aria-label="Guardar el descuento"
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

      {origen === "pactado" ? (
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
          Volver al automático por volumen
        </button>
      ) : (
        <p className="text-[0.7rem] leading-relaxed text-ink-muted">
          Vacío = por volumen. Un <strong className="text-ink">0</strong> también
          es un acuerdo: sin descuento porque los precios ya se negociaron.
        </p>
      )}

      {fallo ? (
        <p role="alert" className="text-[0.7rem] text-critical">
          {fallo}
        </p>
      ) : null}
    </div>
  );
}
