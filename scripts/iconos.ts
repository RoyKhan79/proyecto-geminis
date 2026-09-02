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

const MARCA = {
  fondoA: "#2956c4",
  fondoB: "#1e409f",
  brillo: "#6796ee",
  letra: "#fefdfb",
  oro: "#e1a536",
};

/**
 * EL SIGNO, dibujado.
 *
 * Todo en proporción a `caja` para que valga igual a 32 px que a 512, y con
 * rectángulos redondeados en vez de un trazado: a tamaño de favicon, un
 * `path` con curvas se emborrona y estos no.
 *
 * @param cx,cy centro del signo.
 * @param caja lado útil del icono, sin el margen.
 */
function marca(cx: number, cy: number, caja: number): string {
  const alto = caja * 0.54;
  const ancho = caja * 0.5; // los remates, más anchos que las columnas
  const grueso = caja * 0.086;
  const radio = grueso / 2;
  const separacion = caja * 0.125; // del eje a cada columna
  const y0 = cy - alto / 2;
  const x0 = cx - ancho / 2;

  const columna = (x: number) =>
    `<rect x="${x - grueso / 2}" y="${y0}" width="${grueso}" height="${alto}" rx="${radio}" fill="${MARCA.letra}"/>`;
  const remate = (y: number, color: string) =>
    `<rect x="${x0}" y="${y}" width="${ancho}" height="${grueso}" rx="${radio}" fill="${color}"/>`;

  // El remate de abajo va el último: tapa el final de las columnas y así el oro
  // queda limpio en lugar de partido por dos rectángulos blancos encima.
  return [
    columna(cx - separacion),
    columna(cx + separacion),
    remate(y0, MARCA.letra),
    remate(y0 + alto - grueso, MARCA.oro),
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

  ${marca(tamano / 2, tamano / 2, caja)}
</svg>`;
}

/**
 * El logotipo horizontal: la pastilla con el signo, y el nombre al lado.
 *
 * El texto va como `<text>` con familias genéricas, no convertido a curvas.
 * Tiene una pega —se dibuja con la serif que haya en la máquina, así que no es
 * idéntico en todas— y una ventaja que aquí pesa más: se puede cambiar el
 * nombre del producto editando una línea, y el nombre todavía es provisional
 * (ver src/lib/brand.ts). El día que deje de serlo, esto se pasa a curvas.
 *
 * @param colorTexto tinta del nombre. Oscuro para fondo claro y al revés.
 */
function logotipo(colorTexto: string): string {
  const alto = 128;
  const pastilla = 96;
  const y = (alto - pastilla) / 2;
  const radio = pastilla * 0.235;
  const hueco = 28;
  const texto = y + pastilla / 2;

  /*
   * El ancho se deja holgado a propósito.
   *
   * El texto no va convertido a curvas, así que su anchura real depende de la
   * serif que tenga instalada la máquina que abra el archivo. Ajustarlo al
   * milímetro con la de aquí garantizaría que en otra se corte la última letra,
   * que es exactamente lo que pasó con 520.
   */
  const ancho = 680;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${ancho}" height="${alto}" viewBox="0 0 ${ancho} ${alto}">
  <defs>
    <linearGradient id="fondo" x1="0" y1="0" x2="0.35" y2="1">
      <stop offset="0" stop-color="${MARCA.fondoA}"/>
      <stop offset="1" stop-color="${MARCA.fondoB}"/>
    </linearGradient>
  </defs>

  <rect x="0" y="${y}" width="${pastilla}" height="${pastilla}" rx="${radio}" fill="url(#fondo)"/>
  ${marca(pastilla / 2, alto / 2, pastilla)}

  <text
    x="${pastilla + hueco}"
    y="${texto}"
    dy="0.34em"
    font-family="Georgia, 'Times New Roman', serif"
    font-size="46"
    font-weight="600"
    letter-spacing="-0.5"
    fill="${colorTexto}"
  >Proyecto Geminis</text>
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
