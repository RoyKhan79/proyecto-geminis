/**
 * Vuelve a cifrar los datos sensibles con la clave nueva.
 *
 *   npm run cifrar:rotar
 *   npm run cifrar:rotar -- --simular
 *
 * ── CUÁNDO SE ROTA ──────────────────────────────────────────────────────────
 *
 * Cuando la clave ha podido verse: un `.env` compartido por un canal que no
 * tocaba, una copia de seguridad que salió del sitio, alguien que se va con el
 * portátil. La regla es la de siempre: una clave de la que se duda ya no vale,
 * aunque no conste que se haya usado.
 *
 * ── CÓMO SE ROTA, SIN PARAR EL SERVICIO Y SIN DEJAR NADA ILEGIBLE ───────────
 *
 *   1. Genera la clave nueva:          openssl rand -base64 48
 *   2. En el entorno:
 *        FIELD_ENCRYPTION_KEY_ANTERIOR = <la que había>
 *        FIELD_ENCRYPTION_KEY          = <la nueva>
 *   3. Despliega. A partir de aquí todo lo que se guarde va con la nueva, y lo
 *      que quede con la vieja se sigue leyendo, porque el descifrado prueba las
 *      dos (ver src/lib/crypto/field.ts).
 *   4. Pasa este script. Reescribe lo que quedaba con la clave nueva.
 *   5. Quita FIELD_ENCRYPTION_KEY_ANTERIOR y vuelve a desplegar.
 *
 * El paso 5 es el que de verdad termina la rotación: mientras la variable siga
 * puesta, la clave de la que se dudaba sigue viva en el entorno.
 *
 * ── LO QUE ESTE SCRIPT NO HACE ──────────────────────────────────────────────
 *
 * No toca las copias de seguridad ya generadas: están cifradas con la clave
 * vieja y se quedan así. Si la rotación es por una fuga, esas copias hay que
 * regenerarlas y destruir las anteriores; este script no puede hacerlo por ti
 * porque no sabe dónde están.
 */
import { prismaBase } from "@/lib/db/client";
import { cifrar, claveDe, descifrar, estaCifrado } from "@/lib/crypto/field";
import { env } from "@/lib/env";

/** Un campo cifrado del esquema: dónde vive y cómo se lee y se escribe. */
type CampoCifrado = {
  nombre: string;
  leer: () => Promise<{ id: string; valor: string | null }[]>;
  escribir: (id: string, valor: string) => Promise<void>;
};

/**
 * Todos los campos cifrados del producto.
 *
 * La lista está escrita a mano y eso es un riesgo conocido: un campo cifrado
 * nuevo que no se añada aquí se quedaría con la clave vieja para siempre, y no
 * se notaría hasta que se quitara la variable de la clave anterior. Por eso hay
 * una prueba que recorre el código buscando llamadas a `cifrar()` y comprueba
 * que cada campo que aparece está en esta lista.
 */
const CAMPOS: CampoCifrado[] = [
  {
    nombre: "BillingProfile.iban",
    leer: async () =>
      (
        await prismaBase.billingProfile.findMany({
          where: { iban: { not: null } },
          select: { id: true, iban: true },
        })
      ).map((f) => ({ id: f.id, valor: f.iban })),
    escribir: async (id, valor) => {
      await prismaBase.billingProfile.update({ where: { id }, data: { iban: valor } });
    },
  },
  {
    nombre: "Academy.billingIban",
    leer: async () =>
      (
        await prismaBase.academy.findMany({
          where: { billingIban: { not: null } },
          select: { id: true, billingIban: true },
        })
      ).map((f) => ({ id: f.id, valor: f.billingIban })),
    escribir: async (id, valor) => {
      await prismaBase.academy.update({ where: { id }, data: { billingIban: valor } });
    },
  },
  {
    nombre: "Academy.redsysSecretKey",
    leer: async () =>
      (
        await prismaBase.academy.findMany({
          where: { redsysSecretKey: { not: null } },
          select: { id: true, redsysSecretKey: true },
        })
      ).map((f) => ({ id: f.id, valor: f.redsysSecretKey })),
    escribir: async (id, valor) => {
      await prismaBase.academy.update({
        where: { id },
        data: { redsysSecretKey: valor },
      });
    },
  },
  {
    nombre: "DirectDebitRun.creditorIban",
    leer: async () =>
      (
        // `creditorIban` no admite nulos en el esquema, así que se filtra por
        // «no vacío» en lugar de por «no nulo».
        await prismaBase.directDebitRun.findMany({
          where: { creditorIban: { not: "" } },
          select: { id: true, creditorIban: true },
        })
      ).map((f) => ({ id: f.id, valor: f.creditorIban })),
    escribir: async (id, valor) => {
      await prismaBase.directDebitRun.update({
        where: { id },
        data: { creditorIban: valor },
      });
    },
  },
];

async function main() {
  const simular = process.argv.includes("--simular");

  console.log(`\nROTACIÓN DE LA CLAVE DE CIFRADO\n${"=".repeat(60)}`);
  if (simular) console.log("  (simulación: no se escribe nada)\n");

  if (!env.FIELD_ENCRYPTION_KEY) {
    console.error(
      "✗ FIELD_ENCRYPTION_KEY no está configurada. Sin clave nueva no hay rotación.",
    );
    process.exit(1);
  }

  if (!env.FIELD_ENCRYPTION_KEY_ANTERIOR) {
    console.log(
      [
        "· No hay FIELD_ENCRYPTION_KEY_ANTERIOR.",
        "",
        "  Eso significa que no hay ninguna rotación en curso. Si querías rotar,",
        "  el orden es: mover la clave actual a FIELD_ENCRYPTION_KEY_ANTERIOR,",
        "  poner la nueva en FIELD_ENCRYPTION_KEY, desplegar, y entonces pasar",
        "  esto. Cambiar la clave a secas dejaría los datos ilegibles.",
        "",
        "  Se sigue de todas formas, por si hay algo cifrado con una clave que ya",
        "  no existe: aparecería como ilegible y conviene saberlo.",
      ].join("\n"),
    );
  }

  if (env.FIELD_ENCRYPTION_KEY === env.FIELD_ENCRYPTION_KEY_ANTERIOR) {
    console.error("✗ La clave nueva y la anterior son la misma. No hay nada que rotar.");
    process.exit(1);
  }

  let total = 0;
  let rotados = 0;
  let ilegibles = 0;
  let enClaro = 0;

  for (const campo of CAMPOS) {
    const filas = await campo.leer();
    let rotadosAqui = 0;
    let ilegiblesAqui = 0;
    let claroAqui = 0;

    for (const fila of filas) {
      if (!fila.valor) continue;
      total += 1;

      const origen = claveDe(fila.valor);

      // Ya está con la clave nueva: no se toca. Reescribirlo cambiaría el
      // vector de inicialización sin ganar nada, y en una tabla grande son
      // miles de escrituras para nada.
      if (origen === "actual") continue;

      if (origen === "ilegible") {
        // Ni la actual ni la anterior lo abren. O la fila está manipulada, o se
        // rotó una vez sin conservar la clave. No se toca: reescribirlo sería
        // perder el dato de verdad, y así al menos se puede investigar.
        ilegiblesAqui += 1;
        ilegibles += 1;
        console.warn(`    ! ${campo.nombre} ${fila.id}: no lo abre ninguna clave`);
        continue;
      }

      const claro = descifrar(fila.valor);
      if (claro === null) {
        ilegiblesAqui += 1;
        ilegibles += 1;
        continue;
      }

      if (origen === "claro") claroAqui += 1;

      if (!simular) {
        const nuevo = cifrar(claro);
        // Comprobación de seguridad antes de escribir: si por lo que sea el
        // cifrado devolviera el valor tal cual —no hay clave—, escribirlo
        // guardaría un IBAN en claro encima de uno cifrado.
        if (!estaCifrado(nuevo)) {
          console.error("✗ El cifrado no ha devuelto un valor cifrado. Se aborta.");
          process.exit(1);
        }
        await campo.escribir(fila.id, nuevo);
      }

      rotadosAqui += 1;
      rotados += 1;
    }

    enClaro += claroAqui;

    console.log(
      `  · ${campo.nombre.padEnd(28)} ${String(rotadosAqui).padStart(5)} de ${filas.length}` +
        (ilegiblesAqui ? `  (${ilegiblesAqui} ilegibles)` : "") +
        (claroAqui ? `  (${claroAqui} estaban en claro)` : ""),
    );
  }

  console.log(`${"─".repeat(60)}`);
  console.log(`  Valores mirados:            ${total}`);
  console.log(`  Reescritos con la nueva:    ${rotados}${simular ? " (simulado)" : ""}`);
  if (enClaro > 0) {
    console.log(`  Estaban sin cifrar:         ${enClaro}  → ahora ya no`);
  }
  if (ilegibles > 0) {
    console.log(`  ILEGIBLES:                  ${ilegibles}  ← revísalos antes de seguir`);
  }

  if (ilegibles === 0 && !simular) {
    console.log("");
    console.log("  Todo está con la clave nueva. Ya puedes quitar");
    console.log("  FIELD_ENCRYPTION_KEY_ANTERIOR del entorno y volver a desplegar.");
    console.log("");
    console.log("  Y si la rotación era por una fuga: regenera las copias de");
    console.log("  seguridad anteriores y destruye las viejas. Siguen cifradas con");
    console.log("  la clave de la que dudabas.");
  }

  process.exit(ilegibles > 0 ? 1 : 0);
}

main()
  .catch((error) => {
    // El mensaje, nunca el error entero: podría arrastrar valores de la fila.
    console.error("✗", (error as Error).message);
    process.exit(1);
  })
  .finally(() => prismaBase.$disconnect());
