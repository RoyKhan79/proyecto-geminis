import type { Metadata } from "next";
import { Bell } from "lucide-react";
import { requireAcademy } from "@/lib/auth/context";
import { markNotificationReadAction } from "@/server/communications/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, EmptyState } from "@/components/ui/primitives";
import { formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Avisos" };

export default async function AvisosPage() {
  const ctx = await requireAcademy();

  const avisos = await ctx.db.notification.findMany({
    where: { recipientId: ctx.membershipId, channel: "IN_APP" },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      type: true,
      title: true,
      body: true,
      actionUrl: true,
      createdAt: true,
      readAt: true,
    },
  });

  const sinLeer = avisos.filter((a) => !a.readAt).length;

  return (
    <>
      <div className="flex items-baseline justify-between">
        <h1 className="text-xl font-semibold tracking-tight text-ink">Avisos</h1>
        {sinLeer > 0 ? (
          <span className="text-sm text-ink-muted">{sinLeer} sin leer</span>
        ) : null}
      </div>

      {avisos.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Bell className="size-5" />}
            title="No tienes avisos"
            description="Aquí verás lo que te comunique tu academia: clases nuevas, cambios de horario, grabaciones…"
          />
        </Card>
      ) : (
        <Card className="divide-y divide-[var(--border-subtle)]">
          {avisos.map((aviso) => (
            <CardContent key={aviso.id} className="p-4 pt-4">
              <div className="flex items-start gap-3">
                {!aviso.readAt ? (
                  <span
                    className="mt-1.5 size-2 shrink-0 rounded-full bg-accent"
                    aria-label="Sin leer"
                  />
                ) : (
                  <span className="mt-1.5 size-2 shrink-0" aria-hidden />
                )}

                <div className="min-w-0 flex-1">
                  <p
                    className={
                      aviso.readAt
                        ? "text-sm text-ink-soft"
                        : "text-sm font-medium text-ink"
                    }
                  >
                    {aviso.title}
                  </p>
                  {aviso.body ? (
                    <p className="mt-0.5 whitespace-pre-line text-sm text-ink-muted">
                      {aviso.body}
                    </p>
                  ) : null}
                  <p className="mt-1 text-xs text-ink-muted">
                    {formatDateTime(aviso.createdAt)}
                  </p>
                </div>

                {!aviso.readAt ? (
                  <form action={markNotificationReadAction}>
                    <input type="hidden" name="notificationId" value={aviso.id} />
                    <Button type="submit" variant="ghost" size="sm">
                      Leído
                    </Button>
                  </form>
                ) : null}
              </div>
            </CardContent>
          ))}
        </Card>
      )}
    </>
  );
}
