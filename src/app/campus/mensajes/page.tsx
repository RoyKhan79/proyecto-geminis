import type { Metadata } from "next";
import Link from "next/link";
import { MessageSquare } from "lucide-react";
import { requireAcademy } from "@/lib/auth/context";
import { markThreadReadAction } from "@/server/messaging/actions";
import { Badge, Card, EmptyState } from "@/components/ui/primitives";
import { NewThread } from "@/components/messaging/new-thread";
import { ThreadView } from "@/components/messaging/thread-view";
import { formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Mensajes" };

export default async function MensajesCampusPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await requireAcademy();
  const params = await searchParams;
  const abierto = typeof params.hilo === "string" ? params.hilo : null;

  const [hilos, profesores] = await Promise.all([
    ctx.db.messageThread.findMany({
      where: { studentId: ctx.membershipId, deletedAt: null },
      orderBy: { lastMessageAt: "desc" },
      select: {
        id: true,
        subject: true,
        status: true,
        lastMessageAt: true,
        unreadForStudent: true,
        messages: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            body: true,
            createdAt: true,
            authorId: true,
            author: { select: { user: { select: { firstName: true, lastName: true } } } },
          },
        },
      },
    }),
    ctx.db.membership.findMany({
      where: { deletedAt: null, teacherProfile: { isNot: null } },
      select: { id: true, user: { select: { firstName: true, lastName: true } } },
    }),
  ]);

  const hilo = abierto ? hilos.find((h) => h.id === abierto) : null;
  if (hilo?.unreadForStudent) await markThreadReadAction(hilo.id);

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold tracking-tight text-ink">Mensajes</h1>
        <NewThread
          profesores={profesores.map((p) => ({
            id: p.id,
            nombre: `${p.user.firstName} ${p.user.lastName ?? ""}`.trim(),
          }))}
        />
      </div>

      {hilo ? (
        <>
          <Link
            href="/campus/mensajes"
            className="text-xs text-ink-muted hover:text-ink"
          >
            ← Todas las conversaciones
          </Link>
          <h2 className="font-medium text-ink">{hilo.subject}</h2>
          <ThreadView
            threadId={hilo.id}
            mensajes={hilo.messages.map((m) => ({
              id: m.id,
              body: m.body,
              autor: `${m.author.user.firstName} ${m.author.user.lastName ?? ""}`.trim(),
              esPropio: m.authorId === ctx.membershipId,
              createdAt: m.createdAt.toISOString(),
            }))}
          />
        </>
      ) : hilos.length === 0 ? (
        <Card>
          <EmptyState
            icon={<MessageSquare className="size-5" />}
            title="No tienes conversaciones"
            description="Escribe a tu academia cuando tengas una duda. Queda registrado y te responden desde aquí."
          />
        </Card>
      ) : (
        <Card className="divide-y divide-[var(--border-subtle)]">
          {hilos.map((h) => (
            <Link
              key={h.id}
              href={`/campus/mensajes?hilo=${h.id}`}
              className="flex items-center gap-3 px-4 py-3 hover:bg-surface-muted"
            >
              <div className="min-w-0 flex-1">
                <p
                  className={
                    h.unreadForStudent
                      ? "font-semibold text-ink"
                      : "font-medium text-ink"
                  }
                >
                  {h.subject}
                </p>
                <p className="truncate text-xs text-ink-muted">
                  {h.messages.at(-1)?.body.slice(0, 80)}
                </p>
                <p className="text-xs text-ink-muted">
                  {formatDateTime(h.lastMessageAt)}
                </p>
              </div>
              {h.unreadForStudent ? <Badge tone="accent">Nuevo</Badge> : null}
              {h.status === "CLOSED" ? <Badge>Cerrada</Badge> : null}
            </Link>
          ))}
        </Card>
      )}
    </>
  );
}
