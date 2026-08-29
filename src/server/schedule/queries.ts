import type { TenantClient } from "@/lib/db/tenant";

/**
 * AGENDA
 *
 * Las consultas de la vista de calendario. Van aparte de `server/classes`
 * porque responden a otra pregunta: aquella lista clases, esta pinta un mes.
 */

/** Primer día del mes a las 00:00, en hora local. */
export function inicioDeMes(fecha: Date): Date {
  return new Date(fecha.getFullYear(), fecha.getMonth(), 1);
}

/**
 * La rejilla del mes, empezando en lunes.
 *
 * Siempre devuelve seis semanas completas —42 días—. Es a propósito: si unos
 * meses tuvieran cinco filas y otros seis, el calendario daría un salto al
 * cambiar de mes y la vista bailaría bajo el cursor.
 */
export function rejillaDelMes(mes: Date): Date[] {
  const primero = inicioDeMes(mes);

  // getDay() da 0 para domingo; aquí la semana empieza en lunes, como en España.
  const desplazamiento = (primero.getDay() + 6) % 7;

  const inicio = new Date(primero);
  inicio.setDate(inicio.getDate() - desplazamiento);

  return Array.from({ length: 42 }, (_, i) => {
    const dia = new Date(inicio);
    dia.setDate(inicio.getDate() + i);
    return dia;
  });
}

/** Los siete días de la semana que contiene esa fecha, de lunes a domingo. */
export function semanaDe(fecha: Date): Date[] {
  const desplazamiento = (fecha.getDay() + 6) % 7;
  const lunes = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
  lunes.setDate(lunes.getDate() - desplazamiento);

  return Array.from({ length: 7 }, (_, i) => {
    const dia = new Date(lunes);
    dia.setDate(lunes.getDate() + i);
    return dia;
  });
}

/** Clave aaaa-mm-dd en hora local, para agrupar por día sin líos de zona. */
export function claveDia(fecha: Date): string {
  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, "0");
  const dia = String(fecha.getDate()).padStart(2, "0");
  return `${anio}-${mes}-${dia}`;
}

export type ClaseEnAgenda = {
  id: string;
  title: string;
  startsAt: Date;
  endsAt: Date;
  status: string;
  location: string | null;
  meetingUrl: string | null;
  grupo: string | null;
  curso: string | null;
  profesor: string | null;
  tema: string | null;
  asistentes: number;
};

/**
 * Clases entre dos fechas.
 *
 * `hasta` es exclusivo. Se filtra por el inicio de la clase: una sesión que
 * empieza el domingo a las 23:30 y acaba el lunes es del domingo, que es como
 * lo entiende cualquiera que mire una agenda.
 */
export async function cargarAgenda(
  db: TenantClient,
  desde: Date,
  hasta: Date,
  filtros: { groupId?: string | null; teacherId?: string | null } = {},
): Promise<ClaseEnAgenda[]> {
  const clases = await db.classSession.findMany({
    where: {
      deletedAt: null,
      startsAt: { gte: desde, lt: hasta },
      ...(filtros.groupId ? { groupId: filtros.groupId } : {}),
      ...(filtros.teacherId ? { teacherId: filtros.teacherId } : {}),
    },
    orderBy: { startsAt: "asc" },
    select: {
      id: true,
      title: true,
      startsAt: true,
      endsAt: true,
      status: true,
      location: true,
      meetingUrl: true,
      group: { select: { name: true } },
      course: { select: { name: true } },
      teacher: { select: { user: { select: { firstName: true, lastName: true } } } },
      node: { select: { label: true } },
      _count: { select: { attendances: true } },
    },
  });

  return clases.map((clase) => ({
    id: clase.id,
    title: clase.title,
    startsAt: clase.startsAt,
    endsAt: clase.endsAt,
    status: clase.status,
    location: clase.location,
    meetingUrl: clase.meetingUrl,
    grupo: clase.group?.name ?? null,
    curso: clase.course?.name ?? null,
    profesor: clase.teacher
      ? `${clase.teacher.user.firstName} ${clase.teacher.user.lastName ?? ""}`.trim()
      : null,
    tema: clase.node?.label ?? null,
    asistentes: clase._count.attendances,
  }));
}

/** Agrupa las clases por día para poder pintar la rejilla de un vistazo. */
export function agruparPorDia(
  clases: ClaseEnAgenda[],
): Map<string, ClaseEnAgenda[]> {
  const mapa = new Map<string, ClaseEnAgenda[]>();
  for (const clase of clases) {
    const clave = claveDia(clase.startsAt);
    const lista = mapa.get(clave) ?? [];
    lista.push(clase);
    mapa.set(clave, lista);
  }
  return mapa;
}

/** Opciones de los selectores del formulario. */
export async function opcionesDeAgenda(db: TenantClient) {
  const [grupos, profesores, temas] = await Promise.all([
    db.group.findMany({
      where: { deletedAt: null },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        course: { select: { name: true } },
      },
    }),
    db.membership.findMany({
      where: { deletedAt: null, teacherProfile: { isNot: null } },
      orderBy: { user: { firstName: "asc" } },
      select: {
        id: true,
        user: { select: { firstName: true, lastName: true } },
      },
    }),
    db.contentNode.findMany({
      where: { kind: "TOPIC", deletedAt: null },
      orderBy: [{ path: "asc" }, { position: "asc" }],
      take: 300,
      select: { id: true, label: true },
    }),
  ]);

  return {
    grupos: grupos.map((g) => ({
      id: g.id,
      nombre: g.course?.name ? `${g.name} · ${g.course.name}` : g.name,
    })),
    profesores: profesores.map((p) => ({
      id: p.id,
      nombre: `${p.user.firstName} ${p.user.lastName ?? ""}`.trim(),
    })),
    temas,
  };
}
