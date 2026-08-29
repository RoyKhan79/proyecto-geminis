"use client";

import { useState } from "react";
import { MapPin, Video, X } from "lucide-react";
import { cancelarClaseAction } from "@/server/schedule/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ClaseDelDia = {
  id: string;
  title: string;
  hora: string;
  fin: string;
  cancelada: boolean;
  grupo: string | null;
  profesor: string | null;
  tema: string | null;
  location: string | null;
  online: boolean;
};

/**
 * Un día de la rejilla.
 *
 * Es cliente solo por una razón: al pulsar una clase se abre su detalle sin
 * recargar la página. La rejilla entera la pinta el servidor.
 */
export function DiaConClases({
  fecha,
  numero,
  delMes,
  esHoy,
  expandido,
  clases,
  puedeEscribir,
}: {
  fecha: string;
  numero: number;
  delMes: boolean;
  esHoy: boolean;
  expandido: boolean;
  clases: ClaseDelDia[];
  puedeEscribir: boolean;
}) {
  const [abierta, setAbierta] = useState<string | null>(null);
  const visibles = expandido ? clases : clases.slice(0, 3);
  const ocultas = clases.length - visibles.length;

  return (
    <div
      className={cn(
        "min-h-24 border-b border-r border-line p-1.5 last:border-r-0",
        expandido && "min-h-[28rem]",
        !delMes && "bg-surface-sunken/60",
      )}
    >
      <div className="mb-1 flex items-center justify-between px-1">
        <span
          className={cn(
            "flex size-6 items-center justify-center rounded-full text-xs tabular-nums",
            esHoy
              ? "bg-accent font-bold text-accent-contrast"
              : delMes
                ? "font-medium text-ink"
                : "text-ink-muted",
          )}
        >
          {numero}
        </span>
        {clases.length > 0 ? (
          <span className="text-[0.625rem] tabular-nums text-ink-muted">
            {clases.length}
          </span>
        ) : null}
      </div>

      <ul className="space-y-1">
        {visibles.map((clase) => (
          <li key={clase.id}>
            <button
              type="button"
              onClick={() => setAbierta(abierta === clase.id ? null : clase.id)}
              className={cn(
                "w-full rounded-md px-1.5 py-1 text-left text-[0.6875rem] leading-tight transition-colors",
                clase.cancelada
                  ? "bg-critical-soft text-critical line-through"
                  : "bg-accent-soft text-accent hover:brightness-95",
              )}
            >
              <span className="block truncate font-semibold tabular-nums">
                {clase.hora}
              </span>
              <span className="block truncate">{clase.title}</span>
            </button>

            {abierta === clase.id ? (
              <div className="mt-1 space-y-1.5 rounded-md border border-line bg-surface p-2 text-[0.6875rem]">
                <p className="font-semibold text-ink">{clase.title}</p>
                <p className="tabular-nums text-ink-soft">
                  {clase.hora} – {clase.fin}
                </p>
                {clase.grupo ? <p className="text-ink-soft">{clase.grupo}</p> : null}
                {clase.profesor ? (
                  <p className="text-ink-muted">{clase.profesor}</p>
                ) : null}
                {clase.tema ? <p className="text-ink-muted">{clase.tema}</p> : null}
                {clase.location ? (
                  <p className="flex items-center gap-1 text-ink-muted">
                    <MapPin className="size-3" aria-hidden />
                    {clase.location}
                  </p>
                ) : null}
                {clase.online ? (
                  <p className="flex items-center gap-1 text-ink-muted">
                    <Video className="size-3" aria-hidden />
                    En línea
                  </p>
                ) : null}

                {puedeEscribir ? (
                  <form action={cancelarClaseAction}>
                    <input type="hidden" name="classId" value={clase.id} />
                    <Button
                      type="submit"
                      variant="ghost"
                      size="sm"
                      className="h-6 px-1.5 text-[0.6875rem]"
                    >
                      <X aria-hidden />
                      {clase.cancelada ? "Reactivar" : "Anular"}
                    </Button>
                  </form>
                ) : null}
              </div>
            ) : null}
          </li>
        ))}

        {ocultas > 0 ? (
          <li className="px-1.5 text-[0.625rem] text-ink-muted">
            +{ocultas} más
          </li>
        ) : null}
      </ul>

      <span className="sr-only">{fecha}</span>
    </div>
  );
}
