/**
 * Añade material real a la Academia Geminis Demo: PDFs de temario colgados del
 * árbol de contenido, para poder probar el visor y los permisos de descarga.
 *
 *   npm run demo:contenido
 *
 * Los PDFs se generan aquí mismo, sin dependencias: son ficticios y sirven para
 * comprobar que la cadena completa funciona (subida → almacén → visor → permisos).
 */
import { prismaBase } from "../src/lib/db/client";
import { tenantDb } from "../src/lib/db/tenant";
import { buildStorageKey, storage } from "../src/lib/storage";
import { createContentNode } from "../src/server/content/tree";

/**
 * PDF mínimo pero válido, con texto real dentro y varias páginas.
 *
 * Pagina solo: un temario de verdad no cabe en una página, y si las líneas se
 * salen del papel el visor las pierde y el indexador se queda sin texto.
 */
const LINEAS_POR_PAGINA = 32;
const ANCHO_LINEA = 92;

function makePdf(titulo: string, lineas: string[]): { buffer: Buffer; paginas: number } {
  const limpio = (s: string) => s.replace(/[()\\]/g, "");

  // Ajuste de línea: en un PDF no existe; hay que partir el texto a mano o se
  // sale del margen derecho y desaparece.
  const ajustadas: string[] = [];
  for (const linea of lineas) {
    if (linea.length <= ANCHO_LINEA) {
      ajustadas.push(linea);
      continue;
    }
    let actual = "";
    for (const palabra of linea.split(" ")) {
      if ((actual + palabra).length > ANCHO_LINEA) {
        ajustadas.push(actual.trimEnd());
        actual = "";
      }
      actual += `${palabra} `;
    }
    if (actual.trim()) ajustadas.push(actual.trimEnd());
  }

  const paginas: string[][] = [];
  for (let i = 0; i < ajustadas.length; i += LINEAS_POR_PAGINA) {
    paginas.push(ajustadas.slice(i, i + LINEAS_POR_PAGINA));
  }
  if (paginas.length === 0) paginas.push([]);

  const objetos: string[] = [];
  // 1 catálogo · 2 páginas · 3 fuente · después, por cada página, su objeto y
  // su contenido.
  const primerObjetoDePagina = 4;
  const ids = paginas.map((_, i) => primerObjetoDePagina + i * 2);

  objetos.push("<< /Type /Catalog /Pages 2 0 R >>");
  objetos.push(
    `<< /Type /Pages /Kids [${ids.map((id) => `${id} 0 R`).join(" ")}] /Count ${paginas.length} >>`,
  );
  objetos.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");

  paginas.forEach((pagina, indice) => {
    const cuerpo = [
      indice === 0
        ? `BT /F1 17 Tf 60 780 Td (${limpio(titulo)}) Tj ET`
        : `BT /F1 9 Tf 60 800 Td (${limpio(titulo)} - pag. ${indice + 1}) Tj ET`,
      ...pagina.map(
        (l, i) => `BT /F1 11 Tf 60 ${(indice === 0 ? 745 : 770) - i * 21} Td (${limpio(l)}) Tj ET`,
      ),
    ].join("\n");

    objetos.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${ids[indice] + 1} 0 R >>`,
    );
    objetos.push(`<< /Length ${cuerpo.length} >>\nstream\n${cuerpo}\nendstream`);
  });

  let out = "%PDF-1.4\n";
  const offsets: number[] = [0];
  objetos.forEach((o, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objetos.length; i += 1) {
    out += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  out += `trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return { buffer: Buffer.from(out, "latin1"), paginas: paginas.length };
}

/**
 * Temario de la demo.
 *
 * No es un indice: es texto explicativo de verdad, con sus plazos y sus
 * articulos. La razon es practica: con un indice de epigrafes, Geminis IA no
 * tiene nada que responder ni con que generar preguntas, y una demostracion
 * comercial se vendria abajo en la primera pregunta. El contenido esta escrito
 * sin acentos porque el PDF se genera a mano y asi se extrae limpio.
 *
 * Es material didactico resumido y correcto a fecha de redaccion, pero es una
 * demo: una academia real sube el suyo.
 */
const DOCUMENTOS = [
  {
    tema: 0,
    nombre: "Tema 1 · La Constitución Española de 1978.pdf",
    titulo: "Tema 1 - La Constitucion Espanola de 1978",
    lineas: [
      "1. CARACTERISTICAS Y ESTRUCTURA",
      "",
      "La Constitucion Espanola fue aprobada por las Cortes Generales el 31 de octubre de 1978,",
      "ratificada en referendum el 6 de diciembre de 1978, sancionada por el Rey el 27 de diciembre",
      "y publicada en el BOE el 29 de diciembre de 1978, fecha de su entrada en vigor.",
      "",
      "Consta de 169 articulos distribuidos en un Titulo Preliminar y diez Titulos numerados,",
      "mas cuatro disposiciones adicionales, nueve transitorias, una derogatoria y una final.",
      "Es rigida, porque su reforma exige un procedimiento agravado, y es directamente aplicable.",
      "",
      "2. TITULO PRELIMINAR",
      "",
      "El articulo 1.1 define a Espana como un Estado social y democratico de Derecho, que propugna",
      "como valores superiores de su ordenamiento juridico la libertad, la justicia, la igualdad y el",
      "pluralismo politico. El articulo 1.2 establece que la soberania nacional reside en el pueblo",
      "espanol, del que emanan los poderes del Estado. El articulo 1.3 fija como forma politica del",
      "Estado la Monarquia parlamentaria.",
      "",
      "El articulo 2 se fundamenta en la indisoluble unidad de la Nacion espanola y reconoce el",
      "derecho a la autonomia de las nacionalidades y regiones que la integran.",
      "",
      "El articulo 9.3 garantiza el principio de legalidad, la jerarquia normativa, la publicidad de",
      "las normas, la irretroactividad de las disposiciones sancionadoras no favorables o restrictivas",
      "de derechos individuales, la seguridad juridica, la responsabilidad y la interdiccion de la",
      "arbitrariedad de los poderes publicos.",
      "",
      "3. DERECHOS Y DEBERES FUNDAMENTALES",
      "",
      "El Titulo I comprende los articulos 10 a 55. La Seccion 1a del Capitulo II, articulos 15 a 29,",
      "recoge los derechos fundamentales y libertades publicas, que junto al articulo 14, igualdad ante",
      "la ley, y al articulo 30.2, objecion de conciencia, gozan de la maxima proteccion.",
      "",
      "Su desarrollo exige ley organica (art. 81). Su tutela se articula por un procedimiento",
      "preferente y sumario ante los tribunales ordinarios y, en su caso, mediante recurso de amparo",
      "ante el Tribunal Constitucional (art. 53.2).",
      "",
      "El articulo 55 permite la suspension de determinados derechos en los estados de excepcion y de",
      "sitio, y de forma individual en investigaciones relacionadas con bandas armadas o terrorismo.",
      "",
      "4. GARANTIAS DE LOS DERECHOS",
      "",
      "El articulo 53.1 vincula a todos los poderes publicos a los derechos del Capitulo II y reserva",
      "su regulacion a la ley, que en todo caso debera respetar su contenido esencial.",
      "",
      "Los principios rectores del Capitulo III, articulos 39 a 52, informan la legislacion positiva,",
      "la practica judicial y la actuacion de los poderes publicos, pero solo pueden ser alegados ante",
      "la jurisdiccion ordinaria de acuerdo con lo que dispongan las leyes que los desarrollen.",
      "",
      "5. LA REFORMA CONSTITUCIONAL",
      "",
      "El procedimiento ordinario del articulo 167 exige mayoria de tres quintos de cada Camara. Si no",
      "hay acuerdo, se crea una Comision paritaria; y si aun asi no se logra, cabe aprobar la reforma",
      "con mayoria absoluta del Senado y dos tercios del Congreso. El referendum es facultativo: debe",
      "someterse a ratificacion si lo solicita una decima parte de los miembros de cualquiera de las",
      "Camaras dentro de los quince dias siguientes a su aprobacion.",
      "",
      "El procedimiento agravado del articulo 168 se aplica a la revision total y a la que afecte al",
      "Titulo Preliminar, a la Seccion 1a del Capitulo II del Titulo I o al Titulo II. Exige mayoria de",
      "dos tercios de cada Camara, disolucion inmediata de las Cortes, ratificacion de la decision por",
      "las nuevas Camaras, aprobacion del nuevo texto por dos tercios de ambas y referendum obligatorio.",
      "",
      "El articulo 169 impide iniciar la reforma en tiempo de guerra o durante los estados de alarma,",
      "excepcion o sitio.",
      "",
      "La Constitucion se ha reformado dos veces: en 1992, el articulo 13.2, para permitir el sufragio",
      "pasivo de los ciudadanos de la Union Europea en las elecciones municipales; y en 2011, el",
      "articulo 135, para incorporar el principio de estabilidad presupuestaria.",
      "",
      "Academia Geminis Demo - material para alumnado matriculado.",
    ],
  },
  {
    tema: 4,
    nombre: "Tema 5 · El acto administrativo.pdf",
    titulo: "Tema 5 - El acto administrativo",
    lineas: [
      "1. CONCEPTO, CLASES Y ELEMENTOS",
      "",
      "El acto administrativo es la declaracion de voluntad, de juicio, de conocimiento o de deseo",
      "realizada por una Administracion publica en el ejercicio de una potestad administrativa distinta",
      "de la potestad reglamentaria.",
      "",
      "Se distingue del reglamento en que el acto se agota con su cumplimiento, mientras que el",
      "reglamento se integra en el ordenamiento juridico y se aplica de forma repetida.",
      "",
      "Clases habituales: expresos y presuntos; favorables y de gravamen; definitivos y de tramite;",
      "que ponen fin a la via administrativa y que no la ponen; firmes y no firmes.",
      "",
      "Elementos: subjetivo, el organo competente; objetivo, el contenido, que debe ser determinado y",
      "licito; causal, el fin de interes publico; y formal, el procedimiento y la forma.",
      "",
      "2. REQUISITOS: MOTIVACION Y FORMA",
      "",
      "El articulo 35 de la Ley 39-2015 impone la motivacion, con sucinta referencia de hechos y",
      "fundamentos de derecho, entre otros, en los actos que limiten derechos subjetivos o intereses",
      "legitimos, los que resuelvan procedimientos de revision de oficio, recursos administrativos y",
      "procedimientos de arbitraje, los que se separen del criterio seguido en actuaciones precedentes",
      "o del dictamen de organos consultivos, los acuerdos de suspension de actos, los que acuerden la",
      "tramitacion de urgencia y los actos discrecionales.",
      "",
      "El articulo 36 exige que los actos se produzcan por escrito a traves de medios electronicos,",
      "salvo que su naturaleza exija otra forma mas adecuada de expresion y constancia.",
      "",
      "3. EFICACIA Y NOTIFICACION",
      "",
      "El articulo 39 establece que los actos se presumen validos y producen efectos desde la fecha en",
      "que se dicten, salvo que en ellos se disponga otra cosa.",
      "",
      "La eficacia queda demorada cuando lo exija el contenido del acto o este supeditada a su",
      "notificacion, publicacion o aprobacion superior.",
      "",
      "El articulo 40.2 obliga a notificar toda resolucion en el plazo de diez dias a partir de la fecha",
      "en que el acto haya sido dictado. La notificacion debe contener el texto integro de la",
      "resolucion, indicar si pone fin o no a la via administrativa, los recursos que procedan, el",
      "organo ante el que hubieran de presentarse y el plazo para interponerlos.",
      "",
      "Las notificaciones se practicaran preferentemente por medios electronicos (art. 41). Se entiende",
      "rechazada la notificacion electronica si transcurren diez dias naturales desde su puesta a",
      "disposicion sin acceder a su contenido (art. 43.2).",
      "",
      "En la notificacion en papel, si nadie se hace cargo, se intentara por una sola vez mas dentro de",
      "los tres dias siguientes y en hora distinta (art. 42.2).",
      "",
      "4. NULIDAD Y ANULABILIDAD",
      "",
      "El articulo 47.1 enumera los actos nulos de pleno derecho: los que lesionen derechos y libertades",
      "susceptibles de amparo constitucional; los dictados por organo manifiestamente incompetente por",
      "razon de la materia o del territorio; los de contenido imposible; los que sean constitutivos de",
      "infraccion penal o se dicten como consecuencia de esta; los dictados prescindiendo total y",
      "absolutamente del procedimiento legalmente establecido o de las normas que contienen las reglas",
      "esenciales para la formacion de la voluntad de los organos colegiados; los actos expresos o",
      "presuntos contrarios al ordenamiento juridico por los que se adquieren facultades o derechos",
      "cuando se carezca de los requisitos esenciales para su adquisicion; y cualquier otro que se",
      "establezca expresamente en una disposicion con rango de ley.",
      "",
      "El articulo 48 declara anulables los actos que incurran en cualquier infraccion del ordenamiento",
      "juridico, incluida la desviacion de poder. El defecto de forma solo determina la anulabilidad",
      "cuando el acto carezca de los requisitos formales indispensables para alcanzar su fin o de lugar",
      "a la indefension de los interesados. La actuacion fuera de plazo solo implica anulabilidad cuando",
      "asi lo imponga la naturaleza del termino o plazo.",
      "",
      "5. LA REVISION DE OFICIO",
      "",
      "El articulo 106 permite a las Administraciones declarar de oficio la nulidad de los actos nulos",
      "de pleno derecho que hayan puesto fin a la via administrativa o que no hayan sido recurridos en",
      "plazo, en cualquier momento, previo dictamen favorable del Consejo de Estado u organo consultivo",
      "equivalente de la Comunidad Autonoma.",
      "",
      "El articulo 107 regula la declaracion de lesividad de actos anulables favorables al interesado,",
      "que no podra adoptarse una vez transcurridos cuatro anos desde que se dicto el acto, y exige la",
      "posterior impugnacion ante el orden jurisdiccional contencioso-administrativo.",
      "",
      "El articulo 109 permite rectificar en cualquier momento los errores materiales, de hecho o",
      "aritmeticos existentes en los actos.",
      "",
      "Academia Geminis Demo - material para alumnado matriculado.",
    ],
  },
  {
    tema: 5,
    nombre: "Tema 6 · El procedimiento administrativo común.pdf",
    titulo: "Tema 6 - El procedimiento administrativo comun",
    lineas: [
      "1. AMBITO DE APLICACION",
      "",
      "La Ley 39-2015, de 1 de octubre, del Procedimiento Administrativo Comun de las Administraciones",
      "Publicas regula los requisitos de validez y eficacia de los actos administrativos, el",
      "procedimiento comun a todas las Administraciones y los principios de la potestad sancionadora y",
      "de la responsabilidad patrimonial.",
      "",
      "2. FASES DEL PROCEDIMIENTO",
      "",
      "Iniciacion: de oficio, por acuerdo del organo competente, por propia iniciativa, orden superior,",
      "peticion razonada de otros organos o denuncia; o a solicitud del interesado.",
      "",
      "Ordenacion: el expediente se impulsa de oficio en todos sus tramites y a traves de medios",
      "electronicos, respetando el orden riguroso de incoacion en asuntos de homogenea naturaleza.",
      "",
      "Instruccion: alegaciones, prueba, informes y tramite de audiencia. El periodo de prueba no sera",
      "superior a treinta dias ni inferior a diez. Los informes son, salvo disposicion expresa,",
      "facultativos y no vinculantes, y deben emitirse en el plazo de diez dias.",
      "",
      "El tramite de audiencia (art. 82) da a los interesados un plazo no inferior a diez dias ni",
      "superior a quince para formular alegaciones y presentar documentos.",
      "",
      "Terminacion: resolucion, desistimiento, renuncia, caducidad e imposibilidad material de",
      "continuarlo por causas sobrevenidas. Tambien cabe la terminacion convencional.",
      "",
      "3. PLAZOS PARA RESOLVER",
      "",
      "El articulo 21.1 impone a la Administracion la obligacion de dictar resolucion expresa y",
      "notificarla en todos los procedimientos, cualquiera que sea su forma de iniciacion.",
      "",
      "El plazo maximo para resolver y notificar sera el fijado por la norma reguladora del",
      "procedimiento, sin que pueda exceder de seis meses salvo que una norma con rango de ley o el",
      "Derecho de la Union Europea establezca uno mayor (art. 21.2).",
      "",
      "Cuando la norma no fije plazo maximo, este sera de tres meses (art. 21.3).",
      "",
      "El plazo se cuenta, en los procedimientos iniciados de oficio, desde la fecha del acuerdo de",
      "iniciacion; y en los iniciados a solicitud del interesado, desde la fecha en que la solicitud",
      "tuvo entrada en el registro electronico de la Administracion competente.",
      "",
      "4. EL SILENCIO ADMINISTRATIVO",
      "",
      "En los procedimientos iniciados a solicitud del interesado, el vencimiento del plazo maximo sin",
      "haberse notificado resolucion expresa legitima al interesado para entenderla estimada por",
      "silencio administrativo (art. 24.1).",
      "",
      "El silencio sera desestimatorio en los procedimientos de ejercicio del derecho de peticion del",
      "articulo 29 de la Constitucion, en aquellos cuya estimacion tuviera como consecuencia que se",
      "transfirieran al solicitante o a terceros facultades relativas al dominio publico o al servicio",
      "publico, en los procedimientos de responsabilidad patrimonial y en los de impugnacion de actos y",
      "disposiciones.",
      "",
      "No obstante, cuando el recurso de alzada se haya interpuesto contra la desestimacion por silencio",
      "de una solicitud, se entendera estimado si, llegado el plazo de resolucion, el organo competente",
      "no dictase y notificase resolucion expresa.",
      "",
      "La estimacion por silencio tiene a todos los efectos la consideracion de acto administrativo",
      "finalizador del procedimiento. La desestimacion por silencio tiene los solos efectos de permitir",
      "a los interesados la interposicion del recurso que resulte procedente.",
      "",
      "En los procedimientos iniciados de oficio (art. 25), el vencimiento del plazo produce la",
      "caducidad si podian derivarse efectos desfavorables o de gravamen, y la desestimacion si podian",
      "derivarse efectos favorables.",
      "",
      "5. COMPUTO DE PLAZOS",
      "",
      "El articulo 30 establece que, salvo que por ley o Derecho de la Union se disponga otro computo,",
      "cuando los plazos se senalen por horas se entienden habiles todas las horas del dia que forme",
      "parte de un dia habil, y los plazos expresados por horas no podran tener una duracion superior a",
      "veinticuatro horas.",
      "",
      "Cuando los plazos se senalen por dias, se entiende que estos son habiles, excluyendose del",
      "computo los sabados, los domingos y los declarados festivos.",
      "",
      "Si el plazo se fija en meses o anos, se computa de fecha a fecha. Si en el mes de vencimiento no",
      "hubiera dia equivalente a aquel en que comienza el computo, se entiende que el plazo expira el",
      "ultimo dia del mes.",
      "",
      "Cuando el ultimo dia del plazo sea inhabil, se entiende prorrogado al primer dia habil siguiente.",
      "",
      "6. RECURSOS ADMINISTRATIVOS",
      "",
      "Recurso de alzada (arts. 121 y 122): contra actos que no pongan fin a la via administrativa, ante",
      "el organo superior jerarquico. El plazo de interposicion es de un mes si el acto es expreso. El",
      "plazo maximo para dictar y notificar la resolucion es de tres meses; transcurrido sin resolucion",
      "se entiende desestimado, salvo el supuesto del articulo 24.1 parrafo tercero.",
      "",
      "Recurso potestativo de reposicion (arts. 123 y 124): contra actos que pongan fin a la via",
      "administrativa, ante el mismo organo que los dicto. El plazo de interposicion es de un mes si el",
      "acto es expreso. El plazo maximo para resolver y notificar es de un mes.",
      "",
      "Recurso extraordinario de revision (art. 125): contra actos firmes en via administrativa, por las",
      "causas tasadas del articulo 125.1. Si se funda en error de hecho resultante de los propios",
      "documentos del expediente, se interpone dentro de los cuatro anos siguientes a la fecha de la",
      "notificacion de la resolucion impugnada; en los demas casos, el plazo es de tres meses. El plazo",
      "maximo para resolver y notificar es de tres meses, y el silencio es desestimatorio.",
      "",
      "Academia Geminis Demo - material para alumnado matriculado.",
    ],
  },
];

const rehacer = process.argv.includes("--rehacer");

async function main() {
  const academia = await prismaBase.academy.findUnique({
    where: { slug: "geminis-demo" },
    select: { id: true, name: true },
  });
  if (!academia) {
    console.error("✗ No existe la academia demo. Ejecuta antes `npm run db:seed`.");
    process.exit(1);
  }

  const db = tenantDb(academia.id);

  // Solo la convocatoria de Administrativo: si mezclamos oposiciones, los
  // documentos acaban colgando del tema equivocado.
  const edicion = await db.oppositionEdition.findFirst({
    where: { opposition: { slug: "administrativo-estado" }, deletedAt: null },
    select: { id: true },
  });
  if (!edicion) {
    console.error("✗ No encuentro la convocatoria de Administrativo en la demo.");
    process.exit(1);
  }

  const temas = await db.contentNode.findMany({
    where: { kind: "TOPIC", editionId: edicion.id, deletedAt: null },
    orderBy: { path: "asc" },
    select: { id: true, label: true, path: true, position: true, editionId: true },
  });
  temas.sort((a, b) =>
    a.path === b.path ? a.position - b.position : a.path.localeCompare(b.path),
  );

  if (temas.length === 0) {
    console.error("✗ La academia demo no tiene temas. Ejecuta `npm run db:seed`.");
    process.exit(1);
  }

  const almacen = storage();
  let creados = 0;

  for (const documento of DOCUMENTOS) {
    const tema = temas[documento.tema];
    if (!tema) continue;

    const yaTiene = await db.contentNode.findFirst({
      where: { parentId: tema.id, label: documento.nombre, deletedAt: null },
      select: { id: true },
    });

    // Con --rehacer se sustituye el documento existente. Sirve para actualizar
    // el temario de la demo sin tener que borrar la base entera.
    if (yaTiene && !rehacer) {
      console.log(`  · ya existía: ${documento.nombre}`);
      continue;
    }
    if (yaTiene) {
      await prismaBase.contentResource.deleteMany({ where: { nodeId: yaTiene.id } });
      await db.contentNode.delete({ where: { id: yaTiene.id } });
    }

    const { buffer, paginas } = makePdf(documento.titulo, documento.lineas);
    const key = buildStorageKey(academia.id, documento.nombre);
    const guardado = await almacen.put(key, buffer, "application/pdf");

    const archivo = await db.storedFile.create({
      data: {
        storageKey: guardado.key,
        storageDriver: almacen.name,
        originalName: documento.nombre,
        mimeType: "application/pdf",
        sizeBytes: guardado.sizeBytes,
        checksumSha256: guardado.checksumSha256,
      },
    });

    const nodo = await createContentNode(db, {
      editionId: tema.editionId,
      parentId: tema.id,
      kind: "RESOURCE",
      label: documento.nombre,
      status: "PUBLISHED",
    });

    await prismaBase.contentResource.create({
      data: { nodeId: nodo.id, type: "PDF", fileId: archivo.id, pageCount: paginas },
    });

    creados += 1;
    console.log(`  ✓ ${documento.nombre} → ${tema.label} (${paginas} págs.)`);
  }

  console.log(`\n✓ ${creados} documentos añadidos a ${academia.name}`);
}

main()
  .catch((error) => {
    console.error("✗", error);
    process.exit(1);
  })
  .finally(() => prismaBase.$disconnect());
