import type { Metadata } from "next";
import Link from "next/link";
import { MessageSquare } from "lucide-react";
import { requirePagePermission } from "@/lib/auth/context";
import { closeThreadAction, markThreadReadAction } from "@/server/messaging/actions";
import { Button } from "@/components/ui/button";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui/primitives";
import { ThreadView } from "@/components/messaging/thread-view";
import { formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Mensajes" };

export default async function MensajesManagerPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await requirePagePermission("students.read");
  const params = await searchParams;
  const abierto = typeof params.hilo === "string" ? params.hilo : null;

  const hilos = await ctx.db.messageThread.findMany({
    where: { deletedAt: null },
    orderBy: [{ unreadForStaff: "desc" }, { lastMessageAt: "desc" }],
    take: 100,
    select: {
      id: true,
      subject: true,
      status: true,
      lastMessageAt: true,
      unreadForStaff: true,
      student: {
        select: { id: true, user: { select: { firstName: true, lastName: true } } },
      },
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
  });

  const hilo = abierto ? hilos.find((h) => h.id === abierto) : null;
  if (hilo?.unreadForStaff) await markThreadReadAction(hilo.id);

  const sinLeer = hilos.filter((h) => h.unreadForStaff).length;

  return (
    <>
      <PageHeader
        title="Mensajes"
        description={
          sinLeer > 0
            ? `${sinLeer} conversaciones esperando respuesta.`
            : "Consultas del alumnado. Todo queda registrado."
        }
      />

      {hilo ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Link href="/gestion/mensajes" className="text-xs text-ink-muted hover:text-ink">
              ← Todas
            </Link>
            <form action={closeThreadAction}>
              <input type="hidden" name="threadId" value={hilo.id} />
              <Button type="submit" variant="secondary" size="sm">
                Cerrar conversación
              </Button>
            </form>
          </div>
          <h2 className="font-medium text-ink">
            {hilo.subject}
            <span className="ml-2 text-sm font-normal text-ink-muted">
              {hilo.student.user.firstName} {hilo.student.user.lastName ?? ""}
            </span>
          </h2>
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
            title="Sin conversaciones"
            description="Cuando el alumnado escriba, aparecerá aquí."
          />
        </Card>
      ) : (
        <Card className="divide-y divide-[var(--border-subtle)]">
          {hilos.map((h) => (
            <Link
              key={h.id}
              href={`/gestion/mensajes?hilo=${h.id}`}
              className="flex items-center gap-3 px-4 py-3 hover:bg-surface-muted"
            >
              <div className="min-w-0 flex-1">
                <p className={h.unreadForStaff ? "font-semibold text-ink" : "text-ink"}>
                  {h.subject}
                </p>
                <p className="text-xs text-ink-muted">
                  {h.student.user.firstName} {h.student.user.lastName ?? ""} ·{" "}
                  {formatDateTime(h.lastMessageAt)}
                </p>
              </div>
              {h.unreadForStaff ? <Badge tone="accent">Sin responder</Badge> : null}
              {h.status === "CLOSED" ? <Badge>Cerrada</Badge> : null}
            </Link>
          ))}
        </Card>
      )}
    </>
  );
}
