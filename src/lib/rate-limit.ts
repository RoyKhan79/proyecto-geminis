/**
 * Limitador de intentos en memoria.
 *
 * Decisión ADR-0016: para el MVP basta con un contador en memoria del proceso.
 * Es honesto reconocer sus límites: con varias instancias cada una lleva su
 * cuenta, y se reinicia al desplegar. Cubre lo que tiene que cubrir hoy
 * (fuerza bruta desde una IP contra el login) y tiene la misma interfaz que
 * tendrá la versión con Redis, de modo que sustituirla no toca a quien la usa.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

/// Limpieza perezosa para que el mapa no crezca sin límite.
function sweep(now: number) {
  if (buckets.size < 5000) return;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

export function rateLimit(
  key: string,
  options: { limit: number; windowSeconds: number },
): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + options.windowSeconds * 1000 });
    return { allowed: true, remaining: options.limit - 1, retryAfterSeconds: 0 };
  }

  bucket.count += 1;

  if (bucket.count > options.limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000),
    };
  }

  return {
    allowed: true,
    remaining: options.limit - bucket.count,
    retryAfterSeconds: 0,
  };
}

export function resetRateLimit(key: string) {
  buckets.delete(key);
}
