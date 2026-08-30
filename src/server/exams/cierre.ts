import { prismaBase } from "@/lib/db/client";
import { estadoDelExamen } from "./estado";

/**
 * Cierra los exámenes a los que se les agotó el tiempo y nadie llegó a cerrar.
 *
 * El caso real: el alumno se queda sin batería a falta de diez minutos, o cierra
 * el portátil y no vuelve. Nadie abre esa pantalla otra vez, así que sin esto la
 * entrega se quedaría «pendiente» para siempre y el profesor no la vería en su
 * lista de corregir, con el examen ya escrito y guardado en la base.
 *
 * Va en el mantenimiento nocturno. Vive en su propio módulo, fuera del archivo
 * de acciones, justo para poder llamarse desde un script: aquel lleva
 * `"use server"` y arrastra `next/headers`, que fuera de una petición no existe.
 *
 * Sin sesión, así que usa el cliente sin tenant. Es una de las poquísimas
 * excepciones al aislamiento por academia, y es legítima porque no lee ni
 * expone datos de nadie: solo cambia un estado que ya venía decidido por el
 * reloj, para todas las academias por igual.
 */
export async function cerrarExamenesVencidos(): Promise<number> {
  const ahora = new Date();

  const abiertos = await prismaBase.submission.findMany({
    where: {
      submittedAt: null,
      startedAt: { not: null },
      assignment: { kind: "EXAM", status: "PUBLISHED", deletedAt: null },
    },
    select: {
      id: true,
      status: true,
      startedAt: true,
      submittedAt: true,
      assignment: {
        select: {
          status: true,
          opensAt: true,
          dueAt: true,
          timeLimitMinutes: true,
        },
      },
    },
    take: 5000,
  });

  const vencidos = abiertos.filter(
    (e) => estadoDelExamen(e.assignment, e, ahora).fase === "tiempo_agotado",
  );

  if (vencidos.length === 0) return 0;

  // El filtro repite `submittedAt: null` a propósito: entre la lectura y esta
  // escritura el alumno ha podido entregar, y su entrega manda sobre la nuestra.
  const { count } = await prismaBase.submission.updateMany({
    where: { id: { in: vencidos.map((e) => e.id) }, submittedAt: null },
    data: { status: "SUBMITTED", submittedAt: ahora, autoSubmitted: true },
  });

  return count;
}
