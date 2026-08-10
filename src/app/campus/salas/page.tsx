import type { Metadata } from "next";
import { Video } from "lucide-react";
import { requireAcademy } from "@/lib/auth/context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, EmptyState } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Salas" };

/** Salas a las que puede entrar el alumno, según sus matrículas. */
export default async function SalasCampusPage() {
  const ctx = await requireAcademy();

  const matriculas = await ctx.db.enrollment.findMany({
    where: {
      studentId: ctx.membershipId,
      deletedAt: null,
      status: { in: ["ACTIVE", "PAST_DUE"] },
    },
    select: { courseId: true, groupId: true },
  });

  const courseIds = matriculas.map((m) => m.courseId);
  const groupIds = matriculas.map((m) => m.groupId).filter((x): x is string => Boolean(x));

  const salas =
    courseIds.length === 0
      ? []
      : await ctx.db.liveRoom.findMany({
          where: {
            deletedAt: null,
            isOpen: true,
            OR: [
              { groupId: { in: groupIds } },
              { groupId: null, courseId: { in: courseIds } },
              { groupId: null, courseId: null },
            ],
          },
          orderBy: { name: "asc" },
          select: {
            id: true,
            name: true,
            description: true,
            schedule: true,
            group: { select: { name: true } },
          },
        });

  return (
    <>
      <h1 className="text-xl font-semibold tracking-tight text-ink">Salas online</h1>

      {salas.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Video className="size-5" />}
            title="No hay salas abiertas"
            description="Cuando tu academia abra un aula virtual, entrarás desde aquí."
          />
        </Card>
      ) : (
        salas.map((sala) => (
          <Card key={sala.id}>
            <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4 pt-4">
              <div className="min-w-0">
                <p className="font-medium text-ink">{sala.name}</p>
                <p className="text-xs text-ink-muted">
                  {[sala.group?.name, sala.schedule, sala.description]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              <Button asChild size="sm">
                <a href={`/api/salas/${sala.id}`} target="_blank" rel="noreferrer">
                  <Video aria-hidden />
                  Entrar
                </a>
              </Button>
            </CardContent>
          </Card>
        ))
      )}
    </>
  );
}
