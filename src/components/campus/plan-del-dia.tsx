import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import type { Propuesta } from "@/server/ai/insights";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

/**
 * Lo que Geminis propone hoy.
 *
 * Se pinta arriba del todo porque es lo primero que debería leer el alumno al
 * entrar. Cada propuesta lleva su motivo visible: si no puede justificar por
 * qué lo dice, no lo dice.
 */
export function PlanDelDia({ propuestas }: { propuestas: Propuesta[] }) {
  if (propuestas.length === 0) return null;

  const BORDE: Record<Propuesta["tono"], string> = {
    critical: "border-l-critical",
    caution: "border-l-caution",
    positive: "border-l-positive",
    neutral: "border-l-accent",
  };

  return (
    <section className="space-y-2">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
        <Sparkles className="size-4 text-accent" aria-hidden />
        Geminis te propone
      </h2>

      <div className="space-y-2">
        {propuestas.map((propuesta) => (
          <Card
            key={propuesta.clave}
            className={cn("border-l-2", BORDE[propuesta.tono])}
          >
            <CardContent className="space-y-2 p-4 pt-4">
              <p className="text-sm font-medium text-ink">{propuesta.titulo}</p>
              <p className="text-xs leading-relaxed text-ink-muted">
                {propuesta.motivo}
              </p>
              <Button asChild variant="secondary" size="sm">
                <Link href={propuesta.accion.href}>
                  {propuesta.accion.texto}
                  <ArrowRight aria-hidden />
                </Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
