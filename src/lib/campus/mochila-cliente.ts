"use client";

/**
 * LA MOCHILA EN EL DISPOSITIVO
 *
 * El lado del navegador: guardar temas para poder abrirlos sin conexión,
 * saber qué hay guardado y —esto es lo importante— borrar lo que ha dejado de
 * estar autorizado.
 *
 * Se usa Cache Storage y no IndexedDB porque el service worker puede leer de
 * Cache Storage directamente. Así, cuando el alumno abre un tema sin cobertura,
 * el documento aparece sin que la página tenga que hacer nada distinto: el
 * service worker ve que la red ha fallado y sirve lo que hay guardado.
 *
 * REGLAS QUE NO SE TOCAN
 *
 * 1. Aquí solo se escribe cuando el alumno pulsa «Guardar». El service worker
 *    NUNCA mete nada en esta caché por su cuenta. Material de pago en el disco
 *    de un dispositivo es una decisión, no un efecto secundario.
 * 2. Cada vez que hay red se compara lo guardado con el manifiesto del servidor
 *    y se borra lo que ya no está. Una baja, un derecho caducado o una descarga
 *    que la academia retira vacían la mochila en la siguiente conexión.
 * 3. Lo guardado lleva dueño. Si entra otra persona en el mismo dispositivo, la
 *    mochila se vacía antes de enseñar nada: un móvil se comparte más de lo que
 *    nos gusta pensar —hermanos, parejas, el ordenador de casa—, y el temario de
 *    uno no puede quedarse a mano del siguiente.
 */

const CACHE = "geminis-mochila-v1";
const INDICE = "geminis.mochila.indice";
/** De quién es lo guardado. Un móvil se comparte más de lo que parece. */
const DUENO = "geminis.mochila.dueno";

/** URL interna bajo la que se guarda cada documento. No existe en el servidor:
 *  es una clave, y así nunca choca con una petición real. */
export function claveDeArchivo(fileId: string): string {
  return `/mochila/archivo/${fileId}`;
}

export type EntradaGuardada = {
  nodeId: string;
  fileId: string;
  label: string;
  fileName: string;
  sizeBytes: number;
  version: string;
  guardadoEn: string;
};

type Indice = Record<string, EntradaGuardada>;

function soportado(): boolean {
  return typeof caches !== "undefined" && typeof localStorage !== "undefined";
}

function leerIndice(): Indice {
  if (!soportado()) return {};
  try {
    return JSON.parse(localStorage.getItem(INDICE) ?? "{}") as Indice;
  } catch {
    // Índice corrupto: mejor empezar de cero que arrastrar entradas ilegibles.
    return {};
  }
}

function escribirIndice(indice: Indice) {
  try {
    localStorage.setItem(INDICE, JSON.stringify(indice));
  } catch {
    // Sin espacio o en modo privado. La caché manda; el índice es un apaño para
    // pintar la lista rápido, así que perderlo no rompe nada.
  }
}

export function loGuardado(): EntradaGuardada[] {
  return Object.values(leerIndice()).sort((a, b) =>
    a.label.localeCompare(b.label, "es"),
  );
}

export function estaGuardado(fileId: string, version?: string): boolean {
  const entrada = leerIndice()[fileId];
  if (!entrada) return false;
  // Si la academia ha subido una versión nueva del tema, lo guardado ya no
  // sirve: decirle al alumno que lo tiene sería mentirle sobre qué está
  // estudiando.
  return version ? entrada.version === version : true;
}

export type TemaDescargable = {
  nodeId: string;
  label: string;
  fileId: string;
  fileName: string;
  sizeBytes: number;
  version: string;
};

/**
 * Descarga un tema y lo deja disponible sin conexión.
 *
 * Va por la ruta protegida de siempre. Si el alumno ha perdido el derecho entre
 * que se pintó la lista y que pulsa el botón, el servidor responde 403 o 404 y
 * aquí no se guarda nada: el permiso lo decide el servidor, nunca esta lista.
 */
export async function guardarTema(tema: TemaDescargable): Promise<void> {
  if (!soportado()) throw new Error("Este navegador no permite guardar temas.");

  const respuesta = await fetch(`/api/archivos/${tema.fileId}?descargar=1`, {
    credentials: "same-origin",
  });

  if (!respuesta.ok) {
    throw new Error(
      respuesta.status === 403 || respuesta.status === 404
        ? "Ya no tienes este tema disponible para descargar."
        : "No se ha podido descargar el tema. Inténtalo de nuevo.",
    );
  }

  const cache = await caches.open(CACHE);
  await cache.put(claveDeArchivo(tema.fileId), respuesta.clone());

  const indice = leerIndice();
  indice[tema.fileId] = {
    nodeId: tema.nodeId,
    fileId: tema.fileId,
    label: tema.label,
    fileName: tema.fileName,
    sizeBytes: tema.sizeBytes,
    version: tema.version,
    guardadoEn: new Date().toISOString(),
  };
  escribirIndice(indice);
}

export async function borrarTema(fileId: string): Promise<void> {
  if (!soportado()) return;
  const cache = await caches.open(CACHE);
  await cache.delete(claveDeArchivo(fileId));
  const indice = leerIndice();
  delete indice[fileId];
  escribirIndice(indice);
}

/**
 * Comprueba de quién es lo guardado y lo tira si es de otra persona.
 *
 * Se llama antes de pintar nada. Devuelve true si ha habido que vaciar, para
 * poder decirlo en pantalla en lugar de que los temas desaparezcan sin más.
 */
export async function comprobarDueno(membershipId: string): Promise<boolean> {
  if (!soportado()) return false;

  let anterior: string | null = null;
  try {
    anterior = localStorage.getItem(DUENO);
  } catch {
    return false;
  }

  if (anterior === membershipId) return false;

  const habia = anterior !== null && Object.keys(leerIndice()).length > 0;
  if (anterior !== null) await vaciarMochila();

  try {
    localStorage.setItem(DUENO, membershipId);
  } catch {
    // Sin poder anotar el dueño, lo prudente es no guardar temas nuevos; el
    // navegador está en modo privado y no persistirá nada de todas formas.
  }

  return habia;
}

/** Vacía la mochila entera. Se llama al cerrar sesión y al cambiar de persona. */
export async function vaciarMochila(): Promise<void> {
  if (!soportado()) return;
  await caches.delete(CACHE);
  try {
    localStorage.removeItem(INDICE);
    localStorage.removeItem(DUENO);
  } catch {
    // Si no se puede limpiar el índice, la caché ya no está: la lista aparecerá
    // vacía en la siguiente sincronización de todos modos.
  }
}

/**
 * Sincroniza con el servidor: borra del dispositivo todo lo que ya no está
 * autorizado, y avisa de lo que ha cambiado de versión.
 *
 * Es la pieza que hace que guardar temas sea aceptable. Sin ella, una descarga
 * sería para siempre y un alumno de baja seguiría con el temario en el bolsillo.
 * Devuelve cuántos se han retirado para poder decírselo con claridad.
 */
export async function sincronizar(
  autorizados: TemaDescargable[],
): Promise<{ retirados: number; caducados: string[] }> {
  if (!soportado()) return { retirados: 0, caducados: [] };

  const porArchivo = new Map(autorizados.map((t) => [t.fileId, t]));
  const indice = leerIndice();
  const caducados: string[] = [];
  let retirados = 0;

  for (const [fileId, entrada] of Object.entries(indice)) {
    const vigente = porArchivo.get(fileId);
    if (!vigente) {
      await borrarTema(fileId);
      retirados += 1;
      continue;
    }
    if (vigente.version !== entrada.version) caducados.push(fileId);
  }

  return { retirados, caducados };
}

/** Cuánto ocupa la mochila, para decirlo en la pantalla. */
export function espacioOcupado(): number {
  return loGuardado().reduce((suma, e) => suma + e.sizeBytes, 0);
}
