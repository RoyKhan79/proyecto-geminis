import type { Metadata } from "next";
import { Video } from "lucide-react";
import { requirePagePermission } from "@/lib/auth/context";
import { toggleRoomAction } from "@/server/tasks/actions";
import { Button } from "@/components/ui/button";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui/primitives";
import { RoomForm } from "./room-form";

export const metadata: Metadata = { title: "Salas online" };

/**
 * Salas permanentes: el aula virtual de un grupo, las tutorías, la sala de
 * dudas antes del examen. Se diferencian de una clase en que no tienen fecha.
 */
export default async function SalasPage() {
  const ctx = await requirePagePermission("classes.read");

  const [salas, cursos] = await Promise.all([
    ctx.db.liveRoom.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        description: true,
        schedule: true,
        isOpen: true,
        group: { select: { name: true } },
        course: { select: { name: true } },
      },
    }),
    ctx.db.course.findMany({
      where: { deletedAt: null },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        groups: { where: { deletedAt: null }, select: { id: true, name: true } },
      },
    }),
  ]);

  const puedeEscribir = ctx.permissions.has("classes.write");

  return (
    <>
      <PageHeader
        title="Salas online"
        description="Aulas virtuales siempre disponibles. El enlace no se muestra al alumnado: se entra por Catedria y queda registrado."
        actions={
          puedeEscribir ? (
            <RoomForm
              cursos={cursos.map((c) => ({ id: c.id, name: c.name, grupos: c.groups }))}
            />
          ) : null
        }
      />

      {salas.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Video className="size-5" />}
            title="No hay salas creadas"
            description="Crea una sala con el enlace de vuestro Zoom, Meet o Teams y el alumnado entrará desde aquí."
          />
        </Card>
      ) : (
        <Card className="divide-y divide-[var(--border-subtle)]">
          {salas.map((sala) => (
            <div key={sala.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="font-medium text-ink">{sala.name}</p>
                <p className="text-xs text-ink-muted">
                  {[sala.course?.name, sala.group?.name, sala.schedule]
                    .filter(Boolean)
                    .join(" · ") || "Toda la academia"}
                </p>
                {sala.description ? (
                  <p className="text-xs text-ink-muted">{sala.description}</p>
                ) : null}
              </div>

              <Badge tone={sala.isOpen ? "positive" : "neutral"}>
                {sala.isOpen ? "Abierta" : "Cerrada"}
              </Badge>

              <Button asChild variant="secondary" size="sm">
                <a href={`/api/salas/${sala.id}`} target="_blank" rel="noreferrer">
                  Entrar
                </a>
              </Button>

              {puedeEscribir ? (
                <form action={toggleRoomAction}>
                  <input type="hidden" name="roomId" value={sala.id} />
                  <input type="hidden" name="abrir" value={sala.isOpen ? "0" : "1"} />
                  <Button type="submit" variant="ghost" size="sm">
                    {sala.isOpen ? "Cerrar" : "Abrir"}
                  </Button>
                </form>
              ) : null}
            </div>
          ))}
        </Card>
      )}
    </>
  );
}
