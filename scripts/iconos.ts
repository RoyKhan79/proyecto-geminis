/**
 * Genera el logotipo y los iconos de la aplicación instalable.
 *
 *   npm run iconos
 *
 * Se generan aquí y no en un editor de imagen por una razón concreta: el color
 * de marca es un token del design system, y si una academia lo cambia (§60,
 * white-label) los iconos tienen que poder regenerarse con un comando en lugar
 * de con una tarde de diseño.
 *
 * ── LA MARCA ───────────────────────────────────────────────────────────────
 *
 * Dos columnas iguales unidas por arriba y por abajo: el signo de Géminis, que
 * es el de los gemelos. No es una floritura sobre el nombre, es literalmente lo
 * que hace el producto: **dos aplicaciones —la de la academia y la del
 * alumnado— sobre un mismo sistema**. Las columnas son iguales porque ninguna
 * de las dos es la de verdad y la otra un añadido.
 *
 * La base va en oro, que es el único acento de la identidad. Es lo que
 * comparten: los mismos datos por debajo, de modo que la matrícula que firma
 * hoy la secretaria es el acceso que tiene esta tarde el alumno en el móvil.
 *
 * Antes había aquí una «G» en Georgia. Se entendía, pero no decía nada: una
 * inicial en una tipografía del sistema es lo que se pone cuando todavía no se
 * ha decidido la marca.
 *
 * Los remates SOBRESALEN de las columnas a propósito. Sin ese vuelo el dibujo
 * se cierra y se lee como un rectángulo o una puerta, no como el símbolo.
 *
 * Salen cinco archivos, más el SVG suelto y el logotipo horizontal:
 *   · icono-192 y icono-512 · el icono normal, con su margen.
 *   · icono-mascara · versión «maskable» de Android, que recorta el icono con
 *     la forma que use el sistema. Lleva el 20 % de zona segura a cada lado o
 *     el sistema se comería la marca.
 */
import { writeFile } from "node:fs/promises";
import sharp from "sharp";

/*
 * Los mismos valores que los tokens de `globals.css`, en hexadecimal porque
 * librsvg no entiende oklch(). El azul es tinta, no el azul encendido de antes:
 * sobre un azul saturado el oro se pelea con el fondo, y sobre tinta brilla.
 */
const MARCA = {
  fondoA: "#232c44",
  fondoB: "#151b2c",
  letra: "#f4f1e9",
  oro: "#c9a227",
  oroApagado: "#a8871f",
};

/**
 * EL SELLO, dibujado.
 *
 * La inicial dentro de un filete doble. Un anillo solo se lee como un borde;
 * dos, como un sello, y esa es toda la diferencia entre parecer una aplicación
 * y parecer una institución.
 *
 * La letra va en serif genérica y no en Fraunces porque esto se dibuja sin
 * navegador: `sharp` usa las fuentes del sistema y no se puede contar con que
 * la del producto esté instalada. A tamaño de icono la diferencia no la ve
 * nadie; donde sí se nota es en la portada de un manual, y allí se usa la
 * versión de `src/components/marca.tsx`, que sí lleva la buena.
 *
 * @param cx,cy centro del sello.
 * @param caja lado útil del icono, sin el margen.
 */
function sello(cx: number, cy: number, caja: number): string {
  /*
   * EL SELLO SE SIMPLIFICA AL ENCOGER, que es lo que hace cualquier identidad
   * que se haya usado de verdad.
   *
   * A 512 px el filete doble es el detalle que lo levanta. A 32 los dos anillos
   * se funden en un churro y se comen la letra, y lo que llega al usuario es un
   * borrón dorado. Así que por debajo de cierto tamaño se queda un solo filete
   * y la letra crece para ocupar el sitio que deja.
   */
  const pequeno = caja < 96;
  const radioExterior = caja * (pequeno ? 0.395 : 0.4);
  const grueso = Math.max(caja * (pequeno ? 0.03 : 0.018), 1.3);
  const cuerpo = caja * (pequeno ? 0.44 : 0.4);

  const anillos = [
    `<circle cx="${cx}" cy="${cy}" r="${radioExterior}" fill="none" stroke="${MARCA.oro}" stroke-width="${grueso}"/>`,
  ];
  if (!pequeno) {
    anillos.push(
      `<circle cx="${cx}" cy="${cy}" r="${caja * 0.348}" fill="none" stroke="${MARCA.oro}" stroke-width="${grueso * 0.45}" opacity="0.5"/>`,
    );
  }

  return [
    ...anillos,
    `<text x="${cx}" y="${cy}" dy="0.345em" text-anchor="middle"`,
    `  font-family="Georgia, 'Times New Roman', serif"`,
    `  font-size="${cuerpo}" font-weight="600" fill="${MARCA.letra}">G</text>`,
  ].join("\n  ");
}

/**
 * El icono, en SVG.
 *
 * @param zonaSegura proporción del lienzo que se deja de margen. 0.08 para el
 *   icono normal; 0.2 para el «maskable», que el sistema recorta.
 */
function svg(tamano: number, zonaSegura: number, conFondoCompleto: boolean): string {
  const margen = tamano * zonaSegura;
  const caja = tamano - margen * 2;
  const radio = conFondoCompleto ? 0 : caja * 0.235;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${tamano}" height="${tamano}" viewBox="0 0 ${tamano} ${tamano}">
  <defs>
    <linearGradient id="fondo" x1="0" y1="0" x2="0.35" y2="1">
      <stop offset="0" stop-color="${MARCA.fondoA}"/>
      <stop offset="1" stop-color="${MARCA.fondoB}"/>
    </linearGradient>
    <linearGradient id="filo" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.28"/>
      <stop offset="0.5" stop-color="#ffffff" stop-opacity="0"/>
    </linearGradient>
  </defs>

  ${
    conFondoCompleto
      ? `<rect width="${tamano}" height="${tamano}" fill="url(#fondo)"/>`
      : `<rect x="${margen}" y="${margen}" width="${caja}" height="${caja}" rx="${radio}" fill="url(#fondo)"/>
         <rect x="${margen}" y="${margen}" width="${caja}" height="${caja}" rx="${radio}" fill="url(#filo)"/>`
  }

  ${sello(tamano / 2, tamano / 2, caja)}
</svg>`;
}

/**
 * EL LOGOTIPO: la palabra y nada más.
 *
 * El espaciado entre letras es casi todo el diseño. Con el tracking normal esto
 * es un nombre escrito; a 0,4 em es un logotipo. Los dos filetes de oro, cortos
 * y centrados, son lo único que se le añade.
 *
 * Va sin el sello al lado a propósito. Poner los dos juntos es la solución
 * cómoda y es la que hace que ninguna de las dos piezas mande: el sello tiene
 * su sitio —el favicon, el móvil, la barra lateral— y aquí sobra.
 *
 * @param colorTexto tinta del nombre. Oscuro para fondo claro y al revés.
 */
function logotipo(colorTexto: string): string {
  const ancho = 680;
  const alto = 190;
  const cuerpo = 54;
  const espaciado = cuerpo * 0.4;
  const cx = ancho / 2;

  /*
   * El espaciado se añade DESPUÉS de cada letra, también de la última, así que
   * el bloque queda descentrado hacia la izquierda por medio espacio. Se
   * compensa aquí. Es el fallo clásico de los logotipos muy espaciados y se ve
   * a simple vista en cuanto hay algo centrado encima o debajo.
   */
  const centro = cx + espaciado / 2;
  const filete = 108;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${ancho}" height="${alto}" viewBox="0 0 ${ancho} ${alto}">
  <rect x="${cx - filete / 2}" y="48" width="${filete}" height="1.6" fill="${MARCA.oro}"/>

  <text
    x="${centro}"
    y="102"
    text-anchor="middle"
    font-family="Georgia, 'Times New Roman', serif"
    font-size="${cuerpo}"
    letter-spacing="${espaciado}"
    fill="${colorTexto}"
  >GEMINIS</text>

  <rect x="${cx - filete / 2}" y="122" width="${filete}" height="1.6" fill="${MARCA.oro}"/>

  <text
    x="${cx + 2}"
    y="152"
    text-anchor="middle"
    font-family="Helvetica, Arial, sans-serif"
    font-size="12"
    letter-spacing="4"
    fill="${MARCA.oroApagado}"
  >ACADEMIAS DE OPOSICIONES</text>
</svg>`;
}

async function main() {
  const salidas: { archivo: string; tamano: number; zona: number; lleno: boolean }[] = [
    { archivo: "public/icono-192.png", tamano: 192, zona: 0.06, lleno: false },
    { archivo: "public/icono-512.png", tamano: 512, zona: 0.06, lleno: false },
    { archivo: "public/icono-mascara.png", tamano: 512, zona: 0.2, lleno: true },
    // iOS no usa el manifiesto para el icono de la pantalla de inicio: usa
    // apple-touch-icon, y sin fondo opaco lo pinta negro.
    { archivo: "public/apple-icon.png", tamano: 180, zona: 0, lleno: true },
    { archivo: "public/favicon-32.png", tamano: 32, zona: 0, lleno: true },
  ];

  for (const salida of salidas) {
    const png = await sharp(
      Buffer.from(svg(salida.tamano, salida.zona, salida.lleno)),
    )
      .png({ compressionLevel: 9 })
      .toBuffer();

    await writeFile(salida.archivo, png);
    console.log(`  ✓ ${salida.archivo} (${salida.tamano}px)`);
  }

  // El SVG suelto sirve para el favicon y para cualquier material comercial.
  await writeFile("public/icono.svg", svg(512, 0.06, false));
  console.log("  ✓ public/icono.svg");

  // Y el logotipo horizontal, que es lo que se pone en una portada, una firma
  // de correo o una factura. En dos versiones porque un logotipo con el texto
  // oscuro desaparece sobre fondo azul, y es justo lo que acaba pasando.
  await writeFile("public/logo.svg", logotipo("#14181f"));
  await writeFile("public/logo-claro.svg", logotipo("#fefdfb"));
  console.log("  ✓ public/logo.svg y public/logo-claro.svg");
}

main().catch((error) => {
  console.error("✗", error);
  process.exit(1);
});
