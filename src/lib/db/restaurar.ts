import { Client } from "pg";

/**
 * RESTAURAR UNA COPIA DE VERDAD
 * ─────────────────────────────
 * Hasta ahora `copia:restaurar` solo leía el archivo y comprobaba que se
 * entendía. Eso está bien, pero no es probar una copia: un JSON que se lee
 * puede ser perfectamente irrestaurable —claves foráneas que no cuadran, filas
 * que no entran en su tabla, enumerados que ya no existen— y no te enteras
 * hasta el día que hace falta, que es el peor día posible.
 *
 * Esto la mete en una base de datos y comprueba que entra.
 *
 * ── CÓMO ───────────────────────────────────────────────────────────────────
 *
 * Con `json_populate_recordset`, que convierte JSON en filas usando el tipo de
 * la propia tabla. Es la pieza clave: sin ella habría que adivinar en
 * JavaScript cómo se escribe cada columna —fechas, decimales, jsonb, arrays,
 * enumerados— y ese código estaría mal para algún tipo que nadie probó.
 * PostgreSQL ya sabe hacerlo.
 *
 * Las claves foráneas se quitan antes y se vuelven a poner después, en vez de
 * insertar en orden de dependencias. No es un atajo: **volver a crearlas es la
 * comprobación**. PostgreSQL valida los datos existentes al añadir una clave
 * foránea, así que si vuelven todas, la copia es referencialmente íntegra. Un
 * orden de inserción cuidadoso no demuestra eso; esto sí.
 *
 * Lo mismo con Row Level Security: se apaga para escribir y se vuelve a
 * encender. Que vuelva a encenderse forma parte de lo que se comprueba.
 */

export type Copia = {
  version: number;
  tipo?: string;
  academia?: { id: string; slug: string; nombre: string };
  generada: string;
  tablas: number;
  filas: number;
  datos: Record<string, Record<string, unknown>[]>;
};

export type ResultadoTabla = {
  tabla: string;
  enLaCopia: number;
  restauradas: number;
  error?: string;
};

export type Restauracion = {
  tablas: ResultadoTabla[];
  filasEsperadas: number;
  filasRestauradas: number;
  clavesRetiradas: number;
  clavesRepuestas: number;
  /** Claves foráneas que no se pudieron volver a poner: datos incoherentes. */
  clavesRotas: { nombre: string; tabla: string; error: string }[];
};

type Constraint = { tabla: string; nombre: string; definicion: string };

/** Las claves foráneas del esquema, con su definición para poder rehacerlas. */
async function clavesForaneas(db: Client): Promise<Constraint[]> {
  const { rows } = await db.query<Constraint>(`
    SELECT c.conrelid::regclass::text AS tabla,
           c.conname                  AS nombre,
           pg_get_constraintdef(c.oid) AS definicion
    FROM pg_constraint c
    JOIN pg_namespace n ON n.oid = c.connamespace
    WHERE c.contype = 'f' AND n.nspname = current_schema()`);
  return rows;
}

/** Las tablas del esquema, sin la de migraciones de Prisma. */
async function tablasDelEsquema(db: Client): Promise<string[]> {
  const { rows } = await db.query<{ tablename: string }>(`
    SELECT tablename FROM pg_tables
    WHERE schemaname = current_schema() AND tablename <> '_prisma_migrations'
    ORDER BY tablename`);
  return rows.map((r) => r.tablename);
}

/**
 * Mete una copia en una base de datos ya migrada y vacía.
 *
 * @param db Conexión abierta al destino. Tiene que ser el DUEÑO de las tablas:
 *   quitar y poner restricciones no lo puede hacer el rol de la aplicación, y
 *   eso es a propósito.
 * @param copia El contenido del archivo, ya leído.
 * @returns Qué entró en cada tabla y qué claves foráneas no se pudieron
 *   restablecer. **Una lista de `clavesRotas` no vacía significa que la copia
 *   no sirve**, aunque todas las filas hayan entrado.
 */
export async function restaurarCopia(db: Client, copia: Copia): Promise<Restauracion> {
  const delEsquema = new Set(await tablasDelEsquema(db));
  const claves = await clavesForaneas(db);

  // ── Se abre el terreno: fuera claves foráneas y fuera RLS ────────────────
  for (const c of claves) {
    await db.query(`ALTER TABLE ${c.tabla} DROP CONSTRAINT "${c.nombre}"`);
  }
  for (const tabla of delEsquema) {
    await db.query(`ALTER TABLE "${tabla}" DISABLE ROW LEVEL SECURITY`);
  }

  const tablas: ResultadoTabla[] = [];
  let filasEsperadas = 0;
  let filasRestauradas = 0;

  for (const [tabla, filas] of Object.entries(copia.datos ?? {})) {
    if (!Array.isArray(filas) || filas.length === 0) continue;
    filasEsperadas += filas.length;

    // Una tabla que está en la copia y ya no está en el esquema es una copia
    // más vieja que el código. Se dice, no se calla: puede ser exactamente el
    // dato que se buscaba.
    if (!delEsquema.has(tabla)) {
      tablas.push({
        tabla,
        enLaCopia: filas.length,
        restauradas: 0,
        error: "esa tabla ya no existe en el esquema actual",
      });
      continue;
    }

    try {
      /*
       * En trozos, no de una vez. Una tabla con muchas filas produce un único
       * parámetro JSON enorme, y aunque PostgreSQL lo aguanta, el mensaje de
       * error cuando algo va mal deja de servir para nada.
       */
      let metidas = 0;
      const TROZO = 500;
      for (let i = 0; i < filas.length; i += TROZO) {
        const lote = filas.slice(i, i + TROZO);
        const r = await db.query(
          `INSERT INTO "${tabla}" SELECT (json_populate_recordset(NULL::"${tabla}", $1::json)).*`,
          [JSON.stringify(lote)],
        );
        metidas += r.rowCount ?? 0;
      }
      filasRestauradas += metidas;
      tablas.push({ tabla, enLaCopia: filas.length, restauradas: metidas });
    } catch (e) {
      tablas.push({
        tabla,
        enLaCopia: filas.length,
        restauradas: 0,
        error: (e as Error).message.split("\n")[0],
      });
    }
  }

  // ── Y se vuelve a cerrar. Esto es la comprobación de verdad ──────────────
  const clavesRotas: Restauracion["clavesRotas"] = [];
  let clavesRepuestas = 0;
  for (const c of claves) {
    try {
      await db.query(
        `ALTER TABLE ${c.tabla} ADD CONSTRAINT "${c.nombre}" ${c.definicion}`,
      );
      clavesRepuestas += 1;
    } catch (e) {
      clavesRotas.push({
        nombre: c.nombre,
        tabla: c.tabla,
        error: (e as Error).message.split("\n")[0],
      });
    }
  }
  for (const tabla of delEsquema) {
    await db.query(`ALTER TABLE "${tabla}" ENABLE ROW LEVEL SECURITY`);
  }

  return {
    tablas,
    filasEsperadas,
    filasRestauradas,
    clavesRetiradas: claves.length,
    clavesRepuestas,
    clavesRotas,
  };
}
