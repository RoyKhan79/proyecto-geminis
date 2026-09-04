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
/*
 * Los colores salen del logotipo original, muestreados del archivo
 * `docs/marca/logo-original.png` en vez de escritos a ojo.
 */
const MARCA = {
  navy: "#0b1c4f",
  azulA: "#1c47e8",
  azulB: "#0a2fc4",
  azulC: "#0f7ff0",
  cian: "#22cbfe",
  claro: "#f4f1e9",
  fondoA: "#16255e",
  fondoB: "#0b132c",
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
/**
 * EL SÍMBOLO: el pórtico con el libro que se deshace en píxeles.
 *
 * Es el logotipo que eligió la academia, redibujado en vectorial. El original
 * (`docs/marca/logo-original.png`) es un PNG, y un PNG a tamaño de favicon es
 * una mancha: hace falta trazado para que a 32 píxeles se siga viendo un
 * pórtico. Los colores están muestreados de ese archivo, no elegidos a ojo.
 *
 * Qué dice el dibujo, porque conviene que no se pierda: la cátedra sostiene el
 * libro, y el libro se convierte en píxeles. Lo de siempre, en digital.
 *
 * AVISO: esto es una reconstrucción a mano, fiel pero no idéntica al píxel.
 * Para papel y para material impreso conviene encargar una vectorización
 * profesional del original.
 *
 * @param sobreOscuro dibuja el pórtico en crema en vez de en tinta. Sobre un
 *   fondo oscuro el navy desaparece; los azules del libro aguantan solos.
 */
function simbolo(
  cx: number,
  cy: number,
  caja: number,
  sobreOscuro: boolean,
): string {
  // Se dibuja en un lienzo de 400x470 y se traslada/escala al sitio pedido.
  const k = caja / 470;
  const dx = cx - (400 * k) / 2;
  const dy = cy - (470 * k) / 2;
  const tinta = sobreOscuro ? MARCA.claro : MARCA.navy;
  const tinta2 = sobreOscuro ? "#d9d3c4" : "#14286e";
  const id = sobreOscuro ? "c" : "o";

  // ── El pórtico: cuatro pilares, tres arcos y los pies escalonados ─────────
  const x0 = 62, x1 = 344, yTop = 300, yBot = 462;
  const arco = 48, r = arco / 2, pilar = (x1 - x0 - 3 * arco) / 4;
  const yArco = yTop + 46;
  const pie = 10;
  let arcada = `M ${x0} ${yTop} L ${x1} ${yTop} L ${x1} ${yBot - pie} L ${x1 - pie} ${yBot} L ${x1 - pilar} ${yBot} L ${x1 - pilar} ${yArco}`;
  for (let i = 2; i >= 0; i -= 1) {
    const ax = x0 + pilar + i * (arco + pilar);
    arcada += ` A ${r} ${r} 0 0 0 ${ax} ${yArco} L ${ax} ${yBot} L ${ax - pilar} ${yBot} L ${ax - pilar} ${yArco}`;
  }
  arcada += ` L ${x0 + pie} ${yBot} L ${x0} ${yBot - pie} L ${x0} ${yTop} Z`;

  return `<defs>
    <linearGradient id="izq-${id}" x1="0" y1="0" x2="0.9" y2="1">
      <stop offset="0" stop-color="${MARCA.azulA}"/><stop offset="1" stop-color="${MARCA.azulB}"/>
    </linearGradient>
    <linearGradient id="der-${id}" x1="0" y1="1" x2="1" y2="0">
      <stop offset="0" stop-color="${MARCA.azulC}"/><stop offset="1" stop-color="${MARCA.cian}"/>
    </linearGradient>
  </defs>
  <g transform="translate(${dx} ${dy}) scale(${k})">
    <path d="${arcada}" fill="${tinta}"/>
    <path d="M 46 272 L 360 272 L 344 300 L 62 300 Z" fill="${tinta}"/>
    <path d="M 12 234 L 197 252 L 197 266 L 44 266 Z" fill="${tinta}"/>
    <path d="M 394 234 L 203 252 L 203 266 L 358 266 Z" fill="${tinta2}"/>
    <path d="M 24 110 L 193 156 L 197 244 L 24 188 Z" fill="url(#izq-${id})"/>
    <path d="M 207 156 L 376 126 L 376 210 L 203 244 Z" fill="url(#der-${id})"/>
    <g fill="${MARCA.cian}">
      <rect x="333" y="50" width="30" height="30" rx="4"/>
      <rect x="279" y="90" width="34" height="34" rx="4"/>
      <rect x="350" y="96" width="26" height="26" rx="4"/>
      <rect x="309" y="138" width="20" height="20" rx="3"/>
      <rect x="358" y="150" width="22" height="22" rx="3"/>
      <rect x="324" y="184" width="15" height="15" rx="2"/>
    </g>
  </g>`;
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

  ${simbolo(tamano / 2, tamano / 2, caja * 0.94, true)}
</svg>`;
}

/**
 * EL LOGOTIPO: el símbolo encima y el nombre debajo.
 *
 * En vertical y no en fila, que es como está compuesto el original: el pórtico
 * sostiene el libro y el nombre va debajo, como el friso de un edificio. Puesto
 * en fila se pierde esa lectura.
 *
 * El nombre va en versales espaciadas. El original usa una tipografía con los
 * remates cortados en diagonal que no está aquí, así que se aproxima con una
 * sans geométrica: la proporción y el espaciado son lo que hace el parecido.
 *
 * @param colorTexto tinta del nombre.
 * @param sobreOscuro si el pórtico se dibuja en crema en vez de en tinta.
 */
function logotipo(colorTexto: string, sobreOscuro: boolean): string {
  const ancho = 620;
  const alto = 340;
  const simboloAlto = 210;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${ancho}" height="${alto}" viewBox="0 0 ${ancho} ${alto}">
  ${simbolo(ancho / 2, simboloAlto / 2 + 10, simboloAlto, sobreOscuro)}

  <text
    x="${ancho / 2 + 7}"
    y="292"
    text-anchor="middle"
    font-family="Helvetica, Arial, sans-serif"
    font-size="76"
    font-weight="600"
    letter-spacing="14"
    fill="${colorTexto}"
  >CATEDRIA</text>
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
  await writeFile("public/logo.svg", logotipo("#0b1c4f", false));
  await writeFile("public/logo-claro.svg", logotipo("#f4f1e9", true));
  console.log("  ✓ public/logo.svg y public/logo-claro.svg");
}

main().catch((error) => {
  console.error("✗", error);
  process.exit(1);
});
