/**
 * ¿Puede un alumno sacarle a la IA temario que no ha pagado?
 *
 *   npm run ia:fuga
 *
 * Esta prueba existe por un fallo real (H-07) que encontró la revisión de
 * seguridad: al preguntar por un tema concreto, el filtro de lo contratado se
 * perdía y la IA respondía con material de secciones no pagadas.
 *
 * Se comprueba de la forma más desagradable posible: cogiendo al alumno que
 * MENOS ha contratado y pidiéndole a la IA que hable de lo que NO tiene.
 */
import { prismaBase } from "@/lib/db/client";
import { recuperarFragmentos } from "@/lib/ai/retrieval";

async function main() {
  const academia = await prismaBase.academy.findFirst({
    where: { slug: "geminis-demo" },
    select: { id: true },
  });
  if (!academia) throw new Error("Falta la academia demo.");

  console.log(`\nINTENTO DE FUGA POR LA IA\n${"=".repeat(64)}`);

  let fallos = 0;
  const comprobar = (t: string, ok: boolean, detalle = "") => {
    console.log(`  ${ok ? "✓" : "✗"} ${t}${detalle ? ` · ${detalle}` : ""}`);
    if (!ok) fallos += 1;
  };

  // El alumno con el pack más pequeño y el que lo tiene todo.
  const restringido = await prismaBase.membership.findFirst({
    where: { academyId: academia.id, user: { email: "alumno2@academiademo.test" } },
    select: { id: true },
  });
  const completo = await prismaBase.membership.findFirst({
    where: { academyId: academia.id, user: { email: "alumno1@academiademo.test" } },
    select: { id: true },
  });
  if (!restringido || !completo) throw new Error("Faltan los alumnos demo.");

  const pregunta = "¿Qué plazo hay para resolver?";

  // 1 · Sin indicar tema, cada uno ve lo suyo.
  const libreCompleto = await recuperarFragmentos({
    academyId: academia.id,
    membershipId: completo.id,
    esPersonal: false,
    pregunta,
    nodeId: null,
  });
  const libreRestringido = await recuperarFragmentos({
    academyId: academia.id,
    membershipId: restringido.id,
    esPersonal: false,
    pregunta,
    nodeId: null,
  });

  console.log(
    `  · Sin indicar tema: el de curso completo ve ${libreCompleto.length} fragmentos; el de solo tests, ${libreRestringido.length}`,
  );
  comprobar(
    "el alumno con menos contratado ve menos que el que lo tiene todo",
    libreRestringido.length < libreCompleto.length,
  );

  // 2 · Ahora el ataque: se prueba con TODOS los nodos de la academia como
  //     punto de partida, incluidos los que el alumno restringido no tiene.
  const todos = await prismaBase.contentNode.findMany({
    where: { academyId: academia.id, deletedAt: null },
    select: { id: true, label: true },
  });

  // Lo que el alumno restringido SÍ puede ver, para comparar.
  const permitidosIds = new Set(
    (
      await recuperarFragmentos({
        academyId: academia.id,
        membershipId: restringido.id,
        esPersonal: false,
        pregunta: "a e i o u de la que el con",
        nodeId: null,
        limite: 1000,
      })
    ).map((f) => f.chunkId),
  );

  let fugas = 0;
  let nodosProbados = 0;

  for (const nodo of todos) {
    const resultado = await recuperarFragmentos({
      academyId: academia.id,
      membershipId: restringido.id,
      esPersonal: false,
      pregunta,
      nodeId: nodo.id,
      limite: 1000,
    });
    nodosProbados += 1;

    // Cualquier fragmento devuelto que NO esté entre los suyos es una fuga.
    for (const fragmento of resultado) {
      if (!permitidosIds.has(fragmento.chunkId)) {
        fugas += 1;
        if (fugas <= 3) {
          console.log(
            `      FUGA desde «${nodo.label}» → ${fragmento.sourceTitle} · ${fragmento.locator ?? ""}`,
          );
        }
      }
    }
  }

  comprobar(
    `probados los ${nodosProbados} nodos de la academia como punto de partida`,
    true,
  );
  comprobar(
    "ninguno devuelve material que el alumno no tenga contratado",
    fugas === 0,
    fugas > 0 ? `${fugas} fragmentos filtrados` : "",
  );

  // 3 · Un identificador de otra academia no sirve de nada.
  const otra = await prismaBase.contentNode.findFirst({
    where: { academyId: { not: academia.id } },
    select: { id: true },
  });
  if (otra) {
    const ajeno = await recuperarFragmentos({
      academyId: academia.id,
      membershipId: restringido.id,
      esPersonal: false,
      pregunta,
      nodeId: otra.id,
    });
    comprobar("un nodo de otra academia no devuelve nada", ajeno.length === 0);
  }

  console.log(`\n${"=".repeat(64)}`);
  if (fallos > 0) {
    console.log("✗ La IA deja escapar material no contratado. NO desplegar así.\n");
    process.exit(1);
  }
  console.log("✓ La IA no es una puerta trasera al material de pago.\n");
}

main()
  .catch((e) => {
    console.error("✗", e);
    process.exit(1);
  })
  .finally(() => prismaBase.$disconnect());
