import { prismaBase } from "@/lib/db/client";

/**
 * LIMITADOR DE INTENTOS
 *
 * Cuenta en la base de datos, no en la memoria del proceso.
 *
 * La versión anterior contaba en memoria (ADR-0016) y era honesta sobre su
 * límite: con varias instancias detrás de un balanceador, cada una lleva su
 * cuenta y el atacante consigue tantos intentos como instancias haya. Con dos
 * instancias, el doble; con cuatro, el cuádruple. Eso no es limitar, es
 * aparentar que se limita.
 *
 * Ahora el contador es una fila con su clave, y el incremento va en una sola
 * sentencia SQL: dos peticiones simultáneas no pueden leer el mismo valor y
 * escribir el mismo resultado, que es justo lo que un atacante intentaría
 * provocar.
 *
 * Sigue siendo más lento que Redis. A cambio no añade una pieza de
 * infraestructura para algo que se consulta unas cuantas veces por minuto, y
 * la interfaz es la misma: cambiar a Redis no toca a quien lo usa.
 */

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

/**
 * ¿Se permite este intento?
 *
 * El `INSERT … ON CONFLICT` hace las tres cosas en una sola sentencia atómica:
 * crea el cubo si no existe, lo reinicia si ya venció, y lo incrementa si sigue
 * vivo. Hacerlo en tres consultas dejaría un hueco entre leer y escribir por el
 * que se cuelan los intentos simultáneos.
 */
export async function rateLimit(
  key: string,
  options: { limit: number; windowSeconds: number },
): Promise<RateLimitResult> {
  const ahora = new Date();
  const nuevoReset = new Date(ahora.getTime() + options.windowSeconds * 1000);

  try {
    const filas = await prismaBase.$queryRaw<{ count: number; resetAt: Date }[]>`
      INSERT INTO rate_limit_counters ("key", count, "resetAt", "updatedAt")
      VALUES (${key}, 1, ${nuevoReset}, ${ahora})
      ON CONFLICT ("key") DO UPDATE SET
        count = CASE
          WHEN rate_limit_counters."resetAt" <= ${ahora} THEN 1
          ELSE rate_limit_counters.count + 1
        END,
        "resetAt" = CASE
          WHEN rate_limit_counters."resetAt" <= ${ahora} THEN ${nuevoReset}
          ELSE rate_limit_counters."resetAt"
        END,
        "updatedAt" = ${ahora}
      RETURNING count, "resetAt"`;

    const fila = filas[0];
    const permitido = fila.count <= options.limit;
    const esperar = Math.max(
      0,
      Math.ceil((fila.resetAt.getTime() - ahora.getTime()) / 1000),
    );

    return {
      allowed: permitido,
      remaining: Math.max(0, options.limit - fila.count),
      // Solo tiene sentido decir cuánto esperar cuando se ha bloqueado.
      retryAfterSeconds: permitido ? 0 : esperar,
    };
  } catch (error) {
    // Si la base de datos falla, el limitador no puede tumbar el inicio de
    // sesión de toda la academia. Se deja pasar y se registra: es preferible
    // que alguien pueda entrar a que nadie pueda.
    console.error("[rate-limit] no se ha podido contar el intento", error);
    return { allowed: true, remaining: options.limit, retryAfterSeconds: 0 };
  }
}

/** Borra el contador. Se llama tras un inicio de sesión correcto. */
export async function resetRateLimit(key: string): Promise<void> {
  try {
    await prismaBase.rateLimitCounter.deleteMany({ where: { key } });
  } catch (error) {
    console.error("[rate-limit] no se ha podido reiniciar el contador", error);
  }
}

/**
 * Limpieza de contadores vencidos.
 *
 * La ejecuta el mantenimiento diario. Sin ella, la tabla crece con una fila por
 * cada IP que haya intentado entrar alguna vez.
 */
export async function limpiarContadores(): Promise<number> {
  const { count } = await prismaBase.rateLimitCounter.deleteMany({
    where: { resetAt: { lt: new Date() } },
  });
  return count;
}
