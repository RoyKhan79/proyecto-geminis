/**
 * ¿SE PUEDE RESTAURAR UNA COPIA ENCIMA DE ESTA BASE DE DATOS?
 * ──────────────────────────────────────────────────────────
 * Restaurar es la operación más destructiva que tiene el sistema: vacía tablas
 * y las vuelve a llenar. Hecha contra la base equivocada no se parece a un
 * error, se parece a un desastre, y además ocurre justo el día que alguien está
 * nervioso porque acaba de perder datos.
 *
 * Por eso la pregunta que se hace aquí no es «¿parece peligrosa?» sino «¿se
 * puede afirmar que es desechable?». La primera es una lista de sospechas que
 * siempre se queda corta; la segunda falla del lado seguro ante cualquier cosa
 * que no reconozca.
 *
 * Vive aparte del script y sin tocar nada para poder probarla con veinte
 * direcciones sin restaurar nada.
 */

/**
 * Nombres que solo puede tener una base creada para esto y tirada después.
 *
 * `restauracion` está porque es el nombre que se genera solo en `--probar`.
 * Los demás son los que usa la gente para sus pruebas. Deliberadamente NO está
 * `catedria` a secas: es el nombre de la base de desarrollo con la que se
 * trabaja todos los días, y machacarla sería perder el trabajo del día aunque
 * no sea producción.
 */
const NOMBRES_DESECHABLES = /(restauracion|restore|scratch|desechable|_prueba|_test)/i;

export type MotivoDeRechazo = {
  /** Qué impide restaurar, en una frase. */
  motivo: string;
  /** Qué habría que hacer para poder hacerlo. */
  salida: string;
};

/** Host y nombre de una dirección de PostgreSQL, para compararlas. */
function señas(cadena: string): { host: string; base: string } | null {
  try {
    const url = new URL(cadena);
    return {
      host: `${url.hostname.toLowerCase()}:${url.port || "5432"}`,
      base: decodeURIComponent(url.pathname.replace(/^\//, "")).toLowerCase(),
    };
  } catch {
    return null;
  }
}

/** Dos direcciones apuntan a la misma base si coinciden anfitrión y nombre. */
export function esLaMismaBase(a: string, b: string): boolean {
  const x = señas(a);
  const y = señas(b);
  if (!x || !y) return false;
  return x.host === y.host && x.base === y.base;
}

export type EntornoDeRestauracion = {
  /** La base con la que trabaja la aplicación. Nunca es un destino válido. */
  DATABASE_URL?: string;
  /** La del dueño. Apunta a la misma base, así que tampoco. */
  DATABASE_URL_OWNER?: string;
  /**
   * La confirmación explícita, para el caso legítimo: restaurar de verdad en un
   * servidor de recuperación cuyo nombre no reconocemos. Hay que escribirla a
   * mano, que es exactamente lo que un despiste no hace.
   */
  CATEDRIA_RESTAURAR_AQUI?: string;
};

/**
 * Por qué NO se debe restaurar en esta dirección.
 *
 * @param destino La dirección donde se quiere escribir.
 * @param entorno Las variables que también deciden.
 * @returns El motivo, o `null` si se puede restaurar.
 *
 * @example
 * ```ts
 * motivoParaNoRestaurar("postgresql://u:p@localhost:5432/catedria_restauracion_x", {});
 * // → null
 * motivoParaNoRestaurar(process.env.DATABASE_URL!, { DATABASE_URL: "…" });
 * // → { motivo: "es la base con la que funciona la aplicación", … }
 * ```
 */
export function motivoParaNoRestaurar(
  destino: string | null | undefined,
  entorno: EntornoDeRestauracion,
): MotivoDeRechazo | null {
  if (!destino) {
    return {
      motivo: "no se ha dicho dónde restaurar",
      salida: "Pasa --probar para usar una base desechable, o --en <url>.",
    };
  }

  const donde = señas(destino);
  if (!donde) {
    return {
      motivo: "esa dirección no se entiende",
      salida: "Tiene que ser una URL de PostgreSQL completa.",
    };
  }

  // Lo primero, y sin excepción posible: nunca encima de la base viva. Ni
  // siquiera con la confirmación escrita a mano, porque no existe ningún motivo
  // legítimo para hacerlo con esta herramienta: para eso se para el servicio y
  // se restaura con las herramientas de PostgreSQL.
  for (const [nombre, url] of [
    ["DATABASE_URL", entorno.DATABASE_URL],
    ["DATABASE_URL_OWNER", entorno.DATABASE_URL_OWNER],
  ] as const) {
    if (url && esLaMismaBase(destino, url)) {
      return {
        motivo: `es la base con la que funciona la aplicación (${nombre})`,
        salida:
          "Restaura en otra y compara. Para una recuperación real se para el servicio y se usa pg_restore.",
      };
    }
  }

  if (entorno.CATEDRIA_RESTAURAR_AQUI === "confirmo") return null;

  if (!NOMBRES_DESECHABLES.test(donde.base)) {
    return {
      motivo: `«${donde.base}» no parece una base desechable`,
      salida:
        "Usa un nombre con «restauracion», «prueba» o «test», o escribe CATEDRIA_RESTAURAR_AQUI=confirmo si sabes lo que haces.",
    };
  }

  return null;
}
