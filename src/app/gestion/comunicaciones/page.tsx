import type { Metadata } from "next";
import { MessageSquare } from "lucide-react";
import { requirePagePermission } from "@/lib/auth/context";
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  PageHeader,
} from "@/components/ui/primitives";
import { formatDateTime } from "@/lib/utils";
import { CommunicationForm } from "./communication-form";

export const metadata: Metadata = { title: "Comunicaciones" };

export default async function ComunicacionesPage() {
  const ctx = await requirePagePermission("communications.send");

  const [cursos, grupos, oposiciones, enviadas] = await Promise.all([
    ctx.db.course.findMany({
      where: { deletedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    ctx.db.group.findMany({
      where: { deletedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true, course: { select: { name: true } } },
    }),
    ctx.db.opposition.findMany({
      where: { deletedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    // Agrupamos por asunto y momento: un envío masivo son muchas filas, pero
    // para la academia es un solo mensaje.
    ctx.db.notification.findMany({
      where: { type: "academy.message", channel: "IN_APP" },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: { id: true, title: true, body: true, createdAt: true, readAt: true },
    }),
  ]);

  const porEnvio = new Map<
    string,
    { titulo: string; cuerpo: string | null; cuando: Date; total: number; leidas: number }
  >();

  for (const aviso of enviadas) {
    // Mismo asunto dentro del mismo minuto = mismo envío.
    const clave = `${aviso.title}|${aviso.createdAt.toISOString().slice(0, 16)}`;
    const actual = porEnvio.get(clave) ?? {
      titulo: aviso.title,
      cuerpo: aviso.body,
      cuando: aviso.createdAt,
      total: 0,
      leidas: 0,
    };
    actual.total += 1;
    if (aviso.readAt) actual.leidas += 1;
    porEnvio.set(clave, actual);
  }

  const historial = [...porEnvio.values()].slice(0, 20);

  return (
    <>
      <PageHeader
        title="Comunicaciones"
        description="Avisa a un alumno, a un grupo, a un curso o a toda la academia."
      />

      <CommunicationForm
        cursos={cursos}
        grupos={grupos.map((g) => ({
          id: g.id,
          name: `${g.course.name} · ${g.name}`,
        }))}
        oposiciones={oposiciones}
      />

      <Card>
        <CardHeader>
          <CardTitle>Enviadas</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {historial.length === 0 ? (
            <EmptyState
              icon={<MessageSquare className="size-5" />}
              title="Todavía no has enviado nada"
              description="Los avisos aparecen en el Campus del alumnado al instante."
            />
          ) : (
            <ul className="divide-y divide-[var(--border-subtle)]">
              {historial.map((envio) => (
                <li key={`${envio.titulo}-${envio.cuando.toISOString()}`} className="px-5 py-3.5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="font-medium text-ink">{envio.titulo}</p>
                    <Badge tone={envio.leidas === envio.total ? "positive" : "neutral"}>
                      {envio.leidas}/{envio.total} leídos
                    </Badge>
                  </div>
                  {envio.cuerpo ? (
                    <p className="line-clamp-2 text-sm text-ink-muted">{envio.cuerpo}</p>
                  ) : null}
                  <p className="mt-1 text-xs text-ink-muted">
                    {formatDateTime(envio.cuando)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </>
  );
}
