import { Laptop, ShieldCheck } from "lucide-react";
import { revokeOtherSessionsAction } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@/components/ui/primitives";
import { formatDateTime } from "@/lib/utils";

/**
 * Dónde está abierta esta cuenta.
 *
 * Se enseña al alumno por dos motivos, y el segundo importa más que el primero:
 * para que pueda cerrar una sesión que se dejó abierta en un ordenador ajeno, y
 * para que vea que la academia sabe desde cuántos sitios se entra. Lo segundo
 * disuade de prestar la cuenta mejor que cualquier aviso.
 */
export function SesionesAbiertas({
  sesiones,
  actual,
  limite,
}: {
  sesiones: {
    id: string;
    deviceLabel: string | null;
    ipAddress: string | null;
    createdAt: Date;
    lastSeenAt: Date;
    impersonatedById: string | null;
  }[];
  actual: string;
  limite: number;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="size-4 text-ink-muted" aria-hidden />
          Dónde tienes la sesión abierta
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-3 p-5 pt-0">
        <ul className="space-y-2">
          {sesiones.map((sesion) => (
            <li
              key={sesion.id}
              className="flex flex-wrap items-center gap-2 rounded-[var(--radius-control)] border border-line px-3 py-2"
            >
              <Laptop className="size-4 shrink-0 text-ink-muted" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-ink">
                  {sesion.deviceLabel ?? "Dispositivo desconocido"}
                </p>
                <p className="text-xs text-ink-muted">
                  Última vez, {formatDateTime(sesion.lastSeenAt)}
                  {sesion.ipAddress ? ` · ${sesion.ipAddress}` : ""}
                </p>
              </div>
              {sesion.id === actual ? <Badge tone="positive">Este</Badge> : null}
              {sesion.impersonatedById ? <Badge tone="caution">Soporte</Badge> : null}
            </li>
          ))}
        </ul>

        {limite > 0 ? (
          <p className="text-xs text-ink-muted">
            Tu academia permite {limite}{" "}
            {limite === 1 ? "sesión abierta" : "sesiones abiertas a la vez"}. Si
            entras desde un sitio más, se cierra la más antigua. Tu cuenta es
            personal.
          </p>
        ) : null}

        {sesiones.length > 1 ? (
          <form action={revokeOtherSessionsAction}>
            <Button type="submit" variant="secondary" size="sm">
              Cerrar las demás sesiones
            </Button>
          </form>
        ) : null}
      </CardContent>
    </Card>
  );
}
