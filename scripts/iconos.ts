/**
 * Genera los iconos de la aplicación instalable.
 *
 *   npm run iconos
 *
 * Se generan aquí y no en un editor de imagen por una razón concreta: el color
 * de marca es un token del design system, y si una academia lo cambia (§60,
 * white-label) los iconos tienen que poder regenerarse con un comando en lugar
 * de con una tarde de diseño.
 *
 * Salen tres:
 *   · icono-192 y icono-512 · el icono normal, con su margen.
 *   · icono-mascara · versión «maskable» de Android, que recorta el icono con
 *     la forma que use el sistema. Lleva el 20 % de zona segura a cada lado o
 *     el sistema se comería la letra.
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

  <!-- La G, en serif: es la tipografía de los titulares del producto. Va
       dibujada como texto con familias genéricas para no depender de que la
       fuente esté instalada en la máquina que genera los iconos. -->
  <text
    x="50%"
    y="50%"
    dy="0.335em"
    text-anchor="middle"
    font-family="Georgia, 'Times New Roman', serif"
    font-size="${caja * 0.56}"
    font-weight="600"
    fill="${MARCA.letra}"
  >G</text>

  <!-- El punto dorado: lo conseguido. Es el único acento del icono. -->
  <circle
    cx="${tamano * 0.5 + caja * 0.275}"
    cy="${tamano * 0.5 + caja * 0.275}"
    r="${caja * 0.048}"
    fill="${MARCA.oro}"
  />
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
}

main().catch((error) => {
  console.error("✗", error);
  process.exit(1);
});
