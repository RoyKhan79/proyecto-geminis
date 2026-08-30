"use client";

import { useEffect, useState } from "react";
import { Timer } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Cuenta atrás de un simulacro.
 *
 * La hora límite viene del servidor, que es quien manda: el reloj del navegador
 * se puede cambiar. Esto solo lo muestra. Al llegar a cero se entrega sola,
 * porque un examen que se queda colgado sin entregar pierde el trabajo del
 * alumno, y eso es peor que entregar tarde.
 */
export function ExamTimer({
  expiraISO,
  onExpirar,
}: {
  expiraISO: string;
  onExpirar?: () => void;
}) {
  const [restante, setRestante] = useState<number | null>(null);

  useEffect(() => {
    const limite = new Date(expiraISO).getTime();

    const tic = () => {
      const segundos = Math.max(0, Math.round((limite - Date.now()) / 1000));
      setRestante(segundos);
      if (segundos === 0 && onExpirar) onExpirar();
    };

    tic();
    const id = setInterval(tic, 1000);
    return () => clearInterval(id);
  }, [expiraISO, onExpirar]);

  if (restante === null) return null;

  const horas = Math.floor(restante / 3600);
  const minutos = Math.floor((restante % 3600) / 60);
  const segundos = restante % 60;
  const apurado = restante < 300;
  const critico = restante < 60;

  // Un examen de desarrollo puede durar dos horas; «135:12» no se lee. Con
  // horas por delante se lee de un vistazo, que es para lo que sirve un reloj.
  const texto =
    horas > 0
      ? `${horas}:${String(minutos).padStart(2, "0")}:${String(segundos).padStart(2, "0")}`
      : `${minutos}:${String(segundos).padStart(2, "0")}`;

  return (
    <div
      role="timer"
      aria-live={apurado ? "polite" : "off"}
      className={cn(
        "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold tabular-nums",
        critico
          ? "bg-critical text-white"
          : apurado
            ? "bg-caution-soft text-caution"
            : "bg-surface-muted text-ink",
      )}
    >
      <Timer className="size-4" aria-hidden />
      {texto}
      <span className="sr-only">restantes</span>
    </div>
  );
}
