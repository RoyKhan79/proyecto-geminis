import crypto from "node:crypto";

/**
 * REDSYS · TPV virtual
 *
 * El cobro con tarjeta que dan los bancos españoles. La academia no manda los
 * datos de la tarjeta a ningún sitio: se envía al alumno a la pasarela del
 * banco, paga allí y el banco nos avisa por detrás. Aquí no entra ni se guarda
 * un número de tarjeta jamás, que es justo lo que evita el marrón de PCI-DSS.
 *
 * Cada academia usa SU comercio: esto se vende a academias distintas y cada una
 * cobra en su cuenta, así que las credenciales viven en la academia y no en una
 * variable de entorno del servidor.
 *
 * ── LA FIRMA ────────────────────────────────────────────────────────────────
 *
 * Es la parte que parece rara y no lo es. Redsys no firma con la clave del
 * comercio directamente: primero deriva una clave POR PEDIDO cifrando el número
 * de pedido con 3DES usando la clave del comercio, y con esa clave derivada
 * hace el HMAC-SHA256 de los parámetros. Así una firma capturada no sirve para
 * otro pedido.
 *
 * El IV de ceros y el 3DES no son decisiones nuestras: es lo que exige el
 * protocolo del banco, y cambiarlo por algo «más moderno» rompe el cobro.
 */

/** A dónde se manda al alumno. Pruebas es público y no mueve dinero. */
export const REDSYS_URLS = {
  test: "https://sis-t.redsys.es:25443/sis/realizarPago",
  live: "https://sis.redsys.es/sis/realizarPago",
} as const;

/**
 * Clave del entorno de pruebas de Redsys, publicada por ellos.
 *
 * Está aquí a propósito y no es un secreto filtrado: es la que Redsys publica
 * en su documentación para que cualquiera pueda probar. Sirve para que el cobro
 * con tarjeta funcione desde el primer día sin haber pedido nada al banco.
 */
export const CLAVE_DE_PRUEBAS = "sq7HjrUOBfKmC576ILgskD5srU870gJ7";

/** Comercio y terminal de pruebas que Redsys deja usar a cualquiera. */
export const COMERCIO_DE_PRUEBAS = { merchantCode: "999008881", terminal: "001" };

export type ConfiguracionRedsys = {
  merchantCode: string;
  terminal: string;
  secretKey: string;
  live: boolean;
};

/**
 * El número de pedido que entiende Redsys.
 *
 * Exige entre 4 y 12 caracteres y que los cuatro primeros sean dígitos. Nuestros
 * identificadores son UUID, que no valen, así que se construye uno: cuatro
 * dígitos de tiempo y ocho caracteres del identificador del recibo. Se guarda
 * en el recibo para poder reconocerlo cuando el banco conteste.
 */
export function numeroDePedido(paymentId: string, ahora: Date = new Date()): string {
  const minutos = Math.floor(ahora.getTime() / 60000) % 10000;
  const cabeza = String(minutos).padStart(4, "0");
  const cola = paymentId.replace(/[^a-zA-Z0-9]/g, "").slice(-8).toUpperCase();
  return `${cabeza}${cola}`.slice(0, 12);
}

/**
 * Comprueba que una clave de comercio sirve para firmar.
 *
 * 3DES pide exactamente 24 bytes, así que la clave en base64 tiene que
 * decodificar a eso. Se valida cuando la academia la teclea: si no, el error
 * aparecería semanas después, la primera vez que alguien intente pagar.
 */
export function claveDeComercioValida(clave: string): boolean {
  try {
    return Buffer.from(clave, "base64").length === 24;
  } catch {
    return false;
  }
}

/** Deriva la clave de ESTE pedido cifrando su número con la del comercio. */
function claveDelPedido(orden: string, claveComercio: string): Buffer {
  const clave = Buffer.from(claveComercio, "base64");
  const cifrador = crypto.createCipheriv(
    "des-ede3-cbc",
    clave,
    Buffer.alloc(8, 0),
  );
  cifrador.setAutoPadding(false);

  // 3DES va en bloques de 8 bytes: el número de pedido se rellena con ceros.
  const relleno = Buffer.alloc(Math.ceil(orden.length / 8) * 8, 0);
  Buffer.from(orden, "utf8").copy(relleno);

  return Buffer.concat([cifrador.update(relleno), cifrador.final()]);
}

/** El HMAC-SHA256 de los parámetros con la clave derivada del pedido. */
export function firmar(
  parametrosBase64: string,
  orden: string,
  claveComercio: string,
): string {
  return crypto
    .createHmac("sha256", claveDelPedido(orden, claveComercio))
    .update(parametrosBase64)
    .digest("base64");
}

export type PeticionDePago = {
  url: string;
  Ds_SignatureVersion: "HMAC_SHA256_V1";
  Ds_MerchantParameters: string;
  Ds_Signature: string;
};

/**
 * Prepara el formulario que se le enseña al alumno para pagar.
 *
 * El importe va en céntimos y sin decimales porque es lo que espera Redsys:
 * mandar «45.00» en lugar de «4500» cobra cuarenta y cinco céntimos.
 */
export function construirPeticion(datos: {
  config: ConfiguracionRedsys;
  orden: string;
  importeCents: number;
  concepto: string;
  urlNotificacion: string;
  urlVuelta: string;
  urlVueltaKo: string;
}): PeticionDePago {
  const parametros = {
    DS_MERCHANT_AMOUNT: String(datos.importeCents),
    DS_MERCHANT_ORDER: datos.orden,
    DS_MERCHANT_MERCHANTCODE: datos.config.merchantCode,
    DS_MERCHANT_CURRENCY: "978", // euro
    DS_MERCHANT_TRANSACTIONTYPE: "0", // autorización
    DS_MERCHANT_TERMINAL: datos.config.terminal,
    DS_MERCHANT_MERCHANTURL: datos.urlNotificacion,
    DS_MERCHANT_URLOK: datos.urlVuelta,
    DS_MERCHANT_URLKO: datos.urlVueltaKo,
    // Redsys corta este campo, y lo lee una persona en su extracto.
    DS_MERCHANT_PRODUCTDESCRIPTION: datos.concepto.slice(0, 125),
  };

  const parametrosBase64 = Buffer.from(JSON.stringify(parametros)).toString("base64");

  return {
    url: datos.config.live ? REDSYS_URLS.live : REDSYS_URLS.test,
    Ds_SignatureVersion: "HMAC_SHA256_V1",
    Ds_MerchantParameters: parametrosBase64,
    Ds_Signature: firmar(parametrosBase64, datos.orden, datos.config.secretKey),
  };
}

export type RespuestaRedsys = {
  valida: boolean;
  pagada: boolean;
  orden: string | null;
  codigo: string | null;
  autorizacion: string | null;
  motivo?: string;
};

/**
 * Comprueba lo que contesta el banco.
 *
 * Lo primero es la firma, y no es un formalismo: sin verificarla, cualquiera
 * que conozca la dirección de notificación puede mandar un «pagado» y llevarse
 * el curso gratis. Si la firma no cuadra, la respuesta se tira entera.
 *
 * Redsys firma la notificación en base64 «seguro para URL», con `-` y `_` en
 * lugar de `+` y `/`. Comparar sin normalizar eso rechaza pagos buenos.
 */
export function comprobarRespuesta(
  cuerpo: { Ds_MerchantParameters?: string; Ds_Signature?: string },
  claveComercio: string,
): RespuestaRedsys {
  const fallo = (motivo: string): RespuestaRedsys => ({
    valida: false,
    pagada: false,
    orden: null,
    codigo: null,
    autorizacion: null,
    motivo,
  });

  const parametros = cuerpo.Ds_MerchantParameters;
  const firma = cuerpo.Ds_Signature;
  if (!parametros || !firma) return fallo("Faltan los parámetros o la firma.");

  let datos: Record<string, string>;
  try {
    datos = JSON.parse(Buffer.from(parametros, "base64").toString("utf8"));
  } catch {
    return fallo("Los parámetros no se pueden leer.");
  }

  const orden = datos.Ds_Order ?? datos.DS_ORDER ?? null;
  if (!orden) return fallo("La respuesta no trae número de pedido.");

  /*
   * Firmar puede reventar si la clave del comercio está mal —mal copiada del
   * banco, con un espacio de más—. Eso no puede tumbar la petición del banco
   * con un error del servidor: se trata como firma que no cuadra, que es lo que
   * es, y queda registrado con su motivo.
   */
  let esperada: string;
  try {
    esperada = firmar(parametros, orden, claveComercio);
  } catch {
    return fallo("La clave del comercio no es válida: revísala en Configuración.");
  }
  const normalizar = (s: string) => s.replace(/-/g, "+").replace(/_/g, "/");

  const a = Buffer.from(normalizar(esperada));
  const b = Buffer.from(normalizar(firma));
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return fallo("La firma no coincide.");
  }

  /*
   * Redsys dice que ha ido bien con un código entre 0000 y 0099. Cualquier otro
   * es un rechazo: tarjeta sin fondos, caducada, o el alumno que cierra la
   * pestaña. No es un error del que haya que avisar a nadie.
   */
  const codigo = datos.Ds_Response ?? datos.DS_RESPONSE ?? "";
  /*
   * El código tiene que venir y tiene que ser un número. `Number("")` es cero,
   * así que sin esta comprobación una notificación bien firmada pero SIN código
   * de respuesta caía dentro del rango de aprobadas y se daba por pagada.
   */
  const numero = /^\d+$/.test(codigo.trim()) ? Number(codigo.trim()) : NaN;
  const pagada = Number.isFinite(numero) && numero >= 0 && numero <= 99;

  return {
    valida: true,
    pagada,
    orden,
    codigo,
    autorizacion: datos.Ds_AuthorisationCode ?? null,
  };
}
