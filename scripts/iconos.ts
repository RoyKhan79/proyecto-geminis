/**
 * Recorta el logotipo y genera los iconos de la aplicación instalable.
 *
 *   npm run iconos
 *
 * ── DE DÓNDE SALE LA MARCA ─────────────────────────────────────────────────
 *
 * De `docs/marca/logo-original.png`, que es el archivo que entregó el cliente.
 * Nada de lo que hay aquí dibuja la marca: la recorta, le quita el fondo y la
 * escala.
 *
 * Esto **es un cambio deliberado**. Antes este archivo redibujaba el pórtico y
 * el libro con paths de SVG a mano, con el argumento de que un vectorial
 * escala mejor. El argumento era correcto y el resultado no: lo que salía se
 * parecía al original de lejos —el pórtico más ancho que el libro, cuatro
 * pilares en vez de tres, y el nombre en una tipografía del sistema
 * espaciada— pero no era el logotipo del cliente. Un logotipo parecido no vale
 * de nada.
 *
 * Así que manda el archivo. Si algún día hace falta vectorial de verdad —para
 * imprenta grande, o para poder recolorear la marca por academia— hay que
 * encargar una vectorización profesional del original y volver a poner paths
 * aquí, esta vez calcados.
 *
 * ── EL FONDO ───────────────────────────────────────────────────────────────
 *
 * El original viene sobre blanco opaco, sin canal alfa. Para poder ponerlo
 * sobre la barra lateral o sobre la pastilla oscura hay que recortarlo.
 *
 * Fuera todo lo que sea casi blanco, esté donde esté. La primera versión solo
 * quitaba el blanco conectado con el borde, por miedo a comerse los degradados
 * del libro; el miedo era infundado —el azul más claro del libro sigue teniendo
 * el rojo a cero— y a cambio dejaba opacas las líneas blancas que separan las
 * molduras del pórtico. Sobre papel blanco esas líneas son la separación; sobre
 * la pastilla oscura salían como rayas grises cruzando la piedra.
 *
 * El borde queda duro, sin suavizado, y da igual: todo lo que se genera aquí
 * se ve reducido —el sello a 36 px, el logotipo a unos 200— y al reducir con
 * Lanczos el borde se vuelve a suavizar solo. Lo que no se puede recuperar es
 * un color mal calculado, y por eso los colores salen intactos del original.
 */

import sharp from "sharp";

const ORIGINAL = "docs/marca/logo-original.png";

/*
 * Los recortes, medidos sobre el archivo (1448 × 1086) buscando dónde hay
 * tinta. Están escritos y no calculados en cada ejecución para que el
 * resultado sea siempre el mismo: si el original se cambia, se vuelven a medir
 * y se cambian aquí.
 *
 *   · el símbolo: pórtico, libro y los píxeles que se desprenden.
 *   · el logotipo: lo anterior más la palabra CATEDRIA debajo.
 */
const SIMBOLO = { left: 530, top: 204, width: 384, height: 451 };
const LOGOTIPO = { left: 163, top: 204, width: 1134, height: 628 };

/** El crema de la identidad, para cuando la marca va sobre fondo oscuro. */
const CREMA = { r: 244, g: 241, b: 233 };

/** El fondo de la pastilla del sello. */
const FONDO_A = "#16255e";
const FONDO_B = "#0b132c";

/**
 * El original con el fondo blanco convertido en transparencia.
 *
 * @returns Los píxeles en RGBA y sus dimensiones.
 */
async function sinFondo() {
  const { data, info } = await sharp(ORIGINAL)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width: W, height: H } = info;

  // Casi blanco es fondo. El umbral va sobre el canal más bajo: el azul más
  // claro del libro es (0, 208, 240) y no llega ni de lejos.
  for (let p = 0; p < W * H; p++) {
    const i = p * 4;
    const min = Math.min(data[i], data[i + 1], data[i + 2]);
    data[i + 3] = min > 235 ? 0 : 255;
  }

  return { data, W, H };
}

/**
 * La versión para fondo oscuro: el azul tinta pasa a crema.
 *
 * Se distingue por el canal azul, que es lo único que separa de verdad las dos
 * familias de color del logotipo: el tinta del pórtico y de la palabra tiene el
 * azul bajo (79 sobre 255) y los azules del libro lo tienen muy alto (196 y
 * más). Por luminosidad no se podrían separar, porque el azul intenso del libro
 * es casi tan oscuro como el tinta.
 */
function aClaro(px: Buffer) {
  const salida = Buffer.from(px);
  for (let i = 0; i < salida.length; i += 4) {
    if (salida[i + 3] === 0) continue;
    const b = salida[i + 2];
    const alto = Math.max(salida[i], salida[i + 1], b);
    if (b < 140 && alto < 150) {
      salida[i] = CREMA.r;
      salida[i + 1] = CREMA.g;
      salida[i + 2] = CREMA.b;
    }
  }
  return salida;
}

/** Guarda un recorte de los píxeles ya sin fondo. */
async function recortar(
  px: Buffer,
  W: number,
  H: number,
  caja: { left: number; top: number; width: number; height: number },
  archivo: string,
) {
  await sharp(px, { raw: { width: W, height: H, channels: 4 } })
    .extract(caja)
    .png({ compressionLevel: 9 })
    .toFile(archivo);
  console.log(`  ✓ ${archivo}  ${caja.width}×${caja.height}`);
}

/**
 * Un icono: el símbolo claro centrado sobre la pastilla oscura.
 *
 * @param zona Margen libre alrededor, en tanto por uno. Android recorta el
 *   icono «maskable» con la forma que use el sistema y sin margen se comería
 *   parte de la marca.
 * @param redondeado Si la pastilla lleva esquinas redondeadas. En los iconos
 *   que recorta el sistema, no: el sistema pone su propia forma.
 */
async function icono(
  simboloClaro: Buffer,
  archivo: string,
  tamano: number,
  zona: number,
  redondeado: boolean,
) {
  const radio = Math.round(tamano * 0.22);
  const fondo = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${tamano}" height="${tamano}">
      <defs><linearGradient id="f" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="${FONDO_A}"/>
        <stop offset="1" stop-color="${FONDO_B}"/>
      </linearGradient></defs>
      <rect width="${tamano}" height="${tamano}"
        ${redondeado ? `rx="${radio}" ry="${radio}"` : ""} fill="url(#f)"/>
    </svg>`,
  );

  // El símbolo es más alto que ancho: manda la altura para que no se salga.
  const alto = Math.round(tamano * (1 - 2 * zona) * 0.78);
  const marca = await sharp(simboloClaro)
    .resize({ height: alto, fit: "inside" })
    .toBuffer();
  const meta = await sharp(marca).metadata();

  await sharp(fondo)
    .composite([
      {
        input: marca,
        left: Math.round((tamano - (meta.width ?? 0)) / 2),
        top: Math.round((tamano - (meta.height ?? 0)) / 2),
      },
    ])
    .png({ compressionLevel: 9 })
    .toFile(archivo);
  console.log(`  ✓ ${archivo}  ${tamano}×${tamano}`);
}

async function main() {
  const { data, W, H } = await sinFondo();
  const claro = aClaro(data);

  console.log("La marca, recortada del original:");
  await recortar(data, W, H, SIMBOLO, "public/simbolo.png");
  await recortar(claro, W, H, SIMBOLO, "public/simbolo-claro.png");
  await recortar(data, W, H, LOGOTIPO, "public/logo.png");
  await recortar(claro, W, H, LOGOTIPO, "public/logo-claro.png");

  // El símbolo claro suelto, que es el que va dentro de la pastilla.
  const simboloClaro = await sharp(claro, { raw: { width: W, height: H, channels: 4 } })
    .extract(SIMBOLO)
    .png()
    .toBuffer();

  console.log("\nLos iconos de la aplicación instalable:");
  await icono(simboloClaro, "public/icono-192.png", 192, 0.06, true);
  await icono(simboloClaro, "public/icono-512.png", 512, 0.06, true);
  await icono(simboloClaro, "public/icono-mascara.png", 512, 0.2, false);
  await icono(simboloClaro, "public/apple-icon.png", 180, 0.04, false);
  await icono(simboloClaro, "public/favicon-32.png", 32, 0.04, true);

  console.log("\nHecho.");
}

void main();
