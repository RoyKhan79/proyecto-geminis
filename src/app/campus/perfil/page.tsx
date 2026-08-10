import type { Metadata } from "next";
import { signOutAction } from "@/lib/auth/actions";
import { requireAcademy } from "@/lib/auth/context";
import { loadGrants, loadStudentEditions } from "@/server/campus/queries";
import { Button } from "@/components/ui/button";
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/primitives";
import { formatDate, initials } from "@/lib/utils";

export const metadata: Metadata = { title: "Perfil" };

export default async function PerfilPage() {
  const ctx = await requireAcademy();

  const [matriculas, grants] = await Promise.all([
    loadStudentEditions(ctx.db, ctx.membershipId),
    loadGrants(ctx.academy.id, ctx.membershipId),
  ]);

  const derechos = await ctx.db.entitlement.findMany({
    where: { studentId: ctx.membershipId, status: "ACTIVE" },
    select: {
      id: true,
      endsAt: true,
      product: { select: { name: true } },
    },
  });

  return (
    <>
      <h1 className="text-xl font-semibold tracking-tight text-ink">Perfil</h1>

      <Card>
        <CardContent className="flex items-center gap-4 p-4 pt-4">
          <span className="flex size-12 items-center justify-center rounded-full bg-accent-soft text-base font-semibold text-accent">
            {initials(ctx.user.firstName, ctx.user.lastName)}
          </span>
          <div className="min-w-0">
            <p className="truncate font-medium text-ink">
              {ctx.user.firstName} {ctx.user.lastName ?? ""}
            </p>
            <p className="truncate text-sm text-ink-muted">{ctx.user.email}</p>
            <p className="text-xs text-ink-muted">{ctx.academy.name}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Mis matrículas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 p-4 pt-0">
          {matriculas.length === 0 ? (
            <p className="text-sm text-ink-muted">Sin matrículas activas.</p>
          ) : (
            matriculas.map((matricula) => (
              <div key={matricula.id} className="text-sm">
                <p className="font-medium text-ink">
                  {matricula.course.oppositionEdition.opposition.name}
                </p>
                <p className="text-ink-muted">
                  {matricula.course.name}
                  {matricula.group ? ` · ${matricula.group.name}` : ""}
                </p>
                {matricula.group?.schedule ? (
                  <p className="text-xs text-ink-muted">{matricula.group.schedule}</p>
                ) : null}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Qué incluye tu acceso</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 p-4 pt-0">
          {derechos.length === 0 ? (
            <p className="text-sm text-ink-muted">
              Solo tienes acceso al contenido de muestra.
            </p>
          ) : (
            derechos.map((derecho) => (
              <div
                key={derecho.id}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <span className="text-ink">
                  {derecho.product?.name ?? "Acceso concedido por la academia"}
                </span>
                {derecho.endsAt ? (
                  <Badge tone="neutral">Hasta {formatDate(derecho.endsAt)}</Badge>
                ) : (
                  <Badge tone="positive">Activo</Badge>
                )}
              </div>
            ))
          )}
          <p className="pt-1 text-xs text-ink-muted">
            {grants.prefixes.length > 0
              ? `${grants.prefixes.length} apartados desbloqueados.`
              : "Consulta con tu academia para ampliar tu acceso."}
          </p>
        </CardContent>
      </Card>

      <form action={signOutAction}>
        <Button type="submit" variant="secondary" className="w-full">
          Cerrar sesión
        </Button>
      </form>
    </>
  );
}
