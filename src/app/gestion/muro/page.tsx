import type { Metadata } from "next";
import { requireAcademy } from "@/lib/auth/context";
import { loadWall } from "@/server/wall/actions";
import { PageHeader } from "@/components/ui/primitives";
import { Wall, type PublicacionMuro } from "@/components/wall/wall";

export const metadata: Metadata = { title: "Muro" };

/** El mismo muro visto desde la academia: aquí se escribe y se modera. */
export default async function MuroManagerPage() {
  const ctx = await requireAcademy();
  const { publicaciones, ambitos } = await loadWall(ctx);

  const datos: PublicacionMuro[] = publicaciones.map((p) => ({
    id: p.id,
    title: p.title,
    body: p.body,
    pinned: p.pinned,
    createdAt: p.createdAt.toISOString(),
    autorId: p.authorId,
    autor: `${p.author.user.firstName} ${p.author.user.lastName ?? ""}`.trim(),
    esProfesor: Boolean(p.author.teacherProfile),
    ambito: p.group?.name ?? p.course?.name ?? null,
    comentarios: p.comments.map((c) => ({
      id: c.id,
      body: c.body,
      autor: `${c.author.user.firstName} ${c.author.user.lastName ?? ""}`.trim(),
      esProfesor: Boolean(c.author.teacherProfile),
      createdAt: c.createdAt.toISOString(),
    })),
  }));

  return (
    <>
      <PageHeader
        title="Muro de clase"
        description="Escribe a tus grupos y modera lo que publica el alumnado."
      />
      <Wall
        publicaciones={datos}
        grupos={ambitos.grupos}
        puedeFijar
        membershipId={ctx.membershipId}
        puedeModerar
      />
    </>
  );
}
