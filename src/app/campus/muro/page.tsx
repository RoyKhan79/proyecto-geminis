import type { Metadata } from "next";
import { requireAcademy } from "@/lib/auth/context";
import { loadWall } from "@/server/wall/actions";
import { Wall, type PublicacionMuro } from "@/components/wall/wall";
import { CampusTitulo } from "@/components/campus/titulo";

export const metadata: Metadata = { title: "Muro" };

/**
 * Muro del alumnado: lo que escribe su profesor y lo que se cuentan entre
 * compañeros de la misma clase. Cada uno solo ve el muro de sus grupos.
 */
export default async function MuroCampusPage() {
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
      <CampusTitulo>Muro</CampusTitulo>
      <Wall
        publicaciones={datos}
        grupos={ambitos.grupos}
        puedeFijar={false}
        membershipId={ctx.membershipId}
        puedeModerar={false}
      />
    </>
  );
}
