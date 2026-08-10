import type { Metadata } from "next";
import { requirePagePermission } from "@/lib/auth/context";
import { PERMISSIONS, PERMISSION_GROUPS, type Permission } from "@/lib/auth/permissions";
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  PageHeader,
} from "@/components/ui/primitives";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Configuración" };

export default async function ConfiguracionPage() {
  // El personal administrativo no ve la configuración ni los permisos de la
  // academia: no forma parte de su trabajo y expone cómo está montado el acceso.
  const ctx = await requirePagePermission("settings.read");

  const [academia, roles] = await Promise.all([
    ctx.db.membership.count({ where: { deletedAt: null } }).then(async (personas) => ({
      personas,
      detalle: await (
        await import("@/lib/db/client")
      ).prismaBase.academy.findUnique({
        where: { id: ctx.academy.id },
        select: {
          name: true,
          slug: true,
          legalName: true,
          email: true,
          status: true,
          createdAt: true,
          timezone: true,
          locale: true,
          plan: {
            select: {
              name: true,
              maxStudents: true,
              maxTeachers: true,
              storageGb: true,
              aiTokensPerMonth: true,
            },
          },
        },
      }),
    })),
    ctx.db.role.findMany({
      orderBy: { key: "asc" },
      select: {
        id: true,
        key: true,
        name: true,
        description: true,
        isSystem: true,
        permissions: { select: { permission: true } },
        _count: { select: { members: true } },
      },
    }),
  ]);

  const detalle = academia.detalle;

  return (
    <>
      <PageHeader
        title="Configuración"
        description="Datos de la academia, plan contratado y roles."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Academia</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
            <Dato label="Nombre" value={detalle?.name ?? "—"} />
            <Dato label="Identificador" value={`/${detalle?.slug ?? ""}`} />
            <Dato label="Razón social" value={detalle?.legalName ?? "—"} />
            <Dato label="Correo" value={detalle?.email ?? "—"} />
            <Dato label="Zona horaria" value={detalle?.timezone ?? "—"} />
            <Dato label="Alta" value={formatDate(detalle?.createdAt)} />
            <Dato label="Personas" value={String(academia.personas)} />
            <Dato label="Estado" value={detalle?.status ?? "—"} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Plan</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {detalle?.plan ? (
              <>
                <p className="font-medium text-ink">{detalle.plan.name}</p>
                <ul className="space-y-1 text-ink-muted">
                  <li>Alumnos: {detalle.plan.maxStudents ?? "sin límite"}</li>
                  <li>Profesores: {detalle.plan.maxTeachers ?? "sin límite"}</li>
                  <li>Almacenamiento: {detalle.plan.storageGb ?? "sin límite"} GB</li>
                  <li>
                    IA:{" "}
                    {detalle.plan.aiTokensPerMonth
                      ? `${(detalle.plan.aiTokensPerMonth / 1_000_000).toFixed(1)} M tokens/mes`
                      : "sin límite"}
                  </li>
                </ul>
                <p className="text-xs text-ink-muted">
                  El control de límites y la facturación llegan con el módulo de
                  plataforma.
                </p>
              </>
            ) : (
              <p className="text-ink-muted">Sin plan asignado.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Roles y permisos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-ink-muted">
            Los permisos se comprueban siempre en el servidor. La edición de roles
            personalizados llegará en una fase posterior; el modelo de datos ya lo
            admite.
          </p>

          {roles.map((rol) => {
            const porGrupo = new Map<string, string[]>();
            for (const { permission } of rol.permissions) {
              const definicion = PERMISSIONS[permission as Permission];
              if (!definicion) continue;
              const grupo = PERMISSION_GROUPS[definicion.group];
              porGrupo.set(grupo, [...(porGrupo.get(grupo) ?? []), definicion.label]);
            }

            return (
              <div
                key={rol.id}
                className="space-y-2 rounded-[var(--radius-control)] border border-line p-4"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-medium text-ink">{rol.name}</h3>
                  {rol.isSystem ? <Badge>Del sistema</Badge> : null}
                  <Badge tone="accent">
                    {rol._count.members}{" "}
                    {rol._count.members === 1 ? "persona" : "personas"}
                  </Badge>
                  <span className="text-xs text-ink-muted">
                    {rol.permissions.length} permisos
                  </span>
                </div>
                {rol.description ? (
                  <p className="text-sm text-ink-muted">{rol.description}</p>
                ) : null}
                <details className="text-sm">
                  <summary className="cursor-pointer text-xs font-medium text-accent">
                    Ver permisos
                  </summary>
                  <div className="mt-2 grid gap-3 sm:grid-cols-2">
                    {[...porGrupo.entries()].map(([grupo, etiquetas]) => (
                      <div key={grupo}>
                        <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                          {grupo}
                        </p>
                        <ul className="mt-1 space-y-0.5 text-xs text-ink-soft">
                          {etiquetas.map((etiqueta) => (
                            <li key={etiqueta}>{etiqueta}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </details>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </>
  );
}

function Dato({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-ink-muted">{label}</dt>
      <dd className="text-ink">{value}</dd>
    </div>
  );
}
