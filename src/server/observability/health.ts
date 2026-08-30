import { prismaBase } from "@/lib/db/client";
import { env } from "@/lib/env";
import { cifradoDisponible } from "@/lib/crypto/field";

/**
 * SALUD DEL SISTEMA
 *
 * La auditoría dejaba esto abierto: «la auditoría registra qué pasó; falta
 * saber cómo va el sistema». Son dos preguntas distintas y las dos hacen falta.
 *
 * Lo que se mide aquí es lo que de verdad se rompe en producción, no lo que
 * queda bonito en un panel:
 *
 *   · ¿responde la base de datos, y en cuánto tiempo?
 *   · ¿están puestas las protecciones que creemos que están? (RLS de verdad
 *     activa, rol sin privilegios, clave de cifrado configurada). Es la parte
 *     que importa: el fallo H-04 fue exactamente una protección que estaba
 *     «activada» y no protegía nada.
 *   · ¿se está usando el sistema, y cuánto?
 *   · ¿hay tareas programadas que llevan días sin correr?
 *
 * No hay agente externo ni servicio de terceros: es una consulta a la propia
 * base. Cuando haga falta enviar esto a un sistema de monitorización, se envía
 * lo que devuelve esta función.
 */

export type Comprobacion = {
  clave: string;
  etiqueta: string;
  estado: "bien" | "aviso" | "mal";
  detalle: string;
};

export type Salud = {
  comprobaciones: Comprobacion[];
  latenciaDbMs: number;
  metricas: {
    academias: number;
    academiasActivas: number;
    personas: number;
    sesionesAbiertas: number;
    intentosFallidosUltimaHora: number;
    tamanoBaseMb: number;
    consultasIaUltimos7Dias: number;
    erroresIaUltimos7Dias: number;
  };
  tareas: { nombre: string; ultimaVez: Date | null; alDia: boolean }[];
};

export async function medirSalud(): Promise<Salud> {
  const comprobaciones: Comprobacion[] = [];

  // ── Latencia de la base ────────────────────────────────────────────────────
  // Se hace una consulta antes de medir. Si no, la primera incluye abrir la
  // conexión —cientos de milisegundos— y el panel saldría en rojo cada vez que
  // alguien lo abre después de un rato. Un panel que da falsas alarmas se deja
  // de mirar, y entonces no sirve para nada.
  await prismaBase.$queryRaw`SELECT 1`;

  const inicio = process.hrtime.bigint();
  await prismaBase.$queryRaw`SELECT 1`;
  const latenciaDbMs =
    Math.round((Number(process.hrtime.bigint() - inicio) / 1e6) * 100) / 100;

  comprobaciones.push({
    clave: "db",
    etiqueta: "Base de datos",
    estado: latenciaDbMs < 50 ? "bien" : latenciaDbMs < 250 ? "aviso" : "mal",
    detalle: `responde en ${latenciaDbMs} ms`,
  });

  // ── Que las protecciones estén puestas DE VERDAD ───────────────────────────
  // Esto no es adorno. El hallazgo H-04 fue una protección activada que no
  // protegía nada porque el rol de conexión se la saltaba. Se comprueba en
  // caliente, no se da por hecho.
  const rol = await prismaBase.$queryRaw<
    { rolname: string; rolsuper: boolean; rolbypassrls: boolean }[]
  >`SELECT rolname, rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user`;

  const usuario = rol[0];
  const seSaltaRls = usuario?.rolsuper || usuario?.rolbypassrls;

  comprobaciones.push({
    clave: "rol",
    etiqueta: "Rol de conexión",
    estado: seSaltaRls ? "mal" : "bien",
    detalle: seSaltaRls
      ? `«${usuario?.rolname}» se salta las políticas de la base: el aislamiento tiene una sola barrera`
      : `«${usuario?.rolname}», sin privilegios que anulen las políticas`,
  });

  const politicas = await prismaBase.$queryRaw<{ n: number }[]>`
    SELECT count(*)::int AS n FROM pg_policies WHERE schemaname = current_schema()`;
  const forzadas = await prismaBase.$queryRaw<{ n: number }[]>`
    SELECT count(*)::int AS n FROM pg_class
    WHERE relrowsecurity AND relforcerowsecurity AND relnamespace = 'public'::regnamespace`;

  const conRls = politicas[0]?.n ?? 0;
  comprobaciones.push({
    clave: "rls",
    etiqueta: "Segunda barrera (RLS)",
    estado: env.DB_RLS !== "on" ? "aviso" : conRls > 0 ? "bien" : "mal",
    detalle:
      env.DB_RLS !== "on"
        ? "apagada por configuración (DB_RLS=off)"
        : `${conRls} políticas activas sobre ${forzadas[0]?.n ?? 0} tablas`,
  });

  comprobaciones.push({
    clave: "cifrado",
    etiqueta: "Cifrado de datos bancarios",
    estado: cifradoDisponible() ? "bien" : "mal",
    detalle: cifradoDisponible()
      ? "clave configurada"
      : "FIELD_ENCRYPTION_KEY sin configurar: los IBAN se guardarían en claro",
  });

  // Un IBAN sin cifrar es un dato que se escapó a la migración.
  const sinCifrar = await prismaBase.$queryRaw<{ n: number }[]>`
    SELECT count(*)::int AS n FROM billing_profiles
    WHERE iban IS NOT NULL AND iban NOT LIKE 'v1:%'`;
  const cuentasEnClaro = sinCifrar[0]?.n ?? 0;

  if (cuentasEnClaro > 0) {
    comprobaciones.push({
      clave: "iban-claro",
      etiqueta: "Cuentas sin cifrar",
      estado: "mal",
      detalle: `${cuentasEnClaro} números de cuenta guardados en claro. Ejecuta «npm run cifrar:migrar»`,
    });
  }

  comprobaciones.push({
    clave: "correo",
    etiqueta: "Correo saliente",
    estado: env.SMTP_HOST ? "bien" : "aviso",
    detalle: env.SMTP_HOST
      ? `configurado (${env.SMTP_HOST})`
      : "sin configurar: los avisos y las recuperaciones no salen",
  });

  // ── Métricas de uso ────────────────────────────────────────────────────────
  const haceUnaHora = new Date(Date.now() - 60 * 60 * 1000);
  const hace7Dias = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [
    academias,
    academiasActivas,
    personas,
    sesionesAbiertas,
    intentosFallidos,
    consultasIa,
    erroresIa,
    tamano,
  ] = await Promise.all([
    prismaBase.academy.count({ where: { deletedAt: null } }),
    prismaBase.academy.count({ where: { deletedAt: null, status: "ACTIVE" } }),
    prismaBase.user.count({ where: { deletedAt: null } }),
    prismaBase.session.count({
      where: { revokedAt: null, expiresAt: { gt: new Date() } },
    }),
    prismaBase.rateLimitCounter.count({
      where: { key: { startsWith: "login:" }, updatedAt: { gte: haceUnaHora } },
    }),
    // tenant-ok · esto es la consola de plataforma: mide el servicio entero, no
    // una academia. Solo cuenta filas; no lee ni una pregunta ni una respuesta.
    prismaBase.aIUsage.count({ where: { createdAt: { gte: hace7Dias } } }),
    prismaBase.aIUsage.count({
      where: { createdAt: { gte: hace7Dias }, success: false },
    }),
    prismaBase.$queryRaw<{ mb: number }[]>`
      SELECT round(pg_database_size(current_database()) / 1024.0 / 1024.0, 1)::float8 AS mb`,
  ]);

  // ── Tareas programadas ─────────────────────────────────────────────────────
  // Un radar que lleva tres días sin correr no avisa de nada, y nadie se entera
  // hasta que una academia se pierde una convocatoria.
  const ultimoRadar = await prismaBase.radarRun.findFirst({
    orderBy: { startedAt: "desc" },
    select: { startedAt: true },
  });

  const alDia = (fecha: Date | null, horas: number) =>
    fecha !== null && Date.now() - fecha.getTime() < horas * 60 * 60 * 1000;

  const tareas = [
    {
      nombre: "Radar del BOE",
      ultimaVez: ultimoRadar?.startedAt ?? null,
      alDia: alDia(ultimoRadar?.startedAt ?? null, 36),
    },
  ];

  for (const tarea of tareas) {
    if (!tarea.alDia) {
      comprobaciones.push({
        clave: `tarea-${tarea.nombre}`,
        etiqueta: tarea.nombre,
        estado: "aviso",
        detalle: tarea.ultimaVez
          ? `última vez el ${tarea.ultimaVez.toLocaleDateString("es-ES")}: ¿está el cron puesto?`
          : "no se ha ejecutado nunca: ¿está el cron puesto?",
      });
    }
  }

  return {
    comprobaciones,
    latenciaDbMs,
    metricas: {
      academias,
      academiasActivas,
      personas,
      sesionesAbiertas,
      intentosFallidosUltimaHora: intentosFallidos,
      tamanoBaseMb: tamano[0]?.mb ?? 0,
      consultasIaUltimos7Dias: consultasIa,
      erroresIaUltimos7Dias: erroresIa,
    },
    tareas,
  };
}
