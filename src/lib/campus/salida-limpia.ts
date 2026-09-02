"use client";

/**
 * NO DEJAR NADA EN UN DISPOSITIVO COMPARTIDO
 *
 * Cerrar sesión revoca la sesión en el servidor y borra la cookie. Eso basta
 * para que nadie pueda pedir datos nuevos, y no basta para que nadie vea los
 * viejos: el navegador guarda por su cuenta lo que el trabajador de servicio le
 * haya dicho que guarde, y eso sobrevive al cierre de sesión.
 *
 * En una academia esto no es hipotético. Los ordenadores del aula los usan
 * veinte personas al día, y el móvil de un alumno se lo presta a un compañero.
 * Quien cierra sesión espera no dejar nada detrás, y esa expectativa hay que
 * cumplirla.
 *
 * Se limpian dos cosas:
 *
 *   · la caché de navegación, que ya no debería llevar nada privado —`/campus`
 *     y `/gestion` están excluidos en `public/sw.js`— pero puede arrastrar lo
 *     que guardara una versión anterior de ese archivo, y una caché vieja no se
 *     vacía sola;
 *   · la mochila, con los temas que el alumno se descargó para estudiar sin
 *     cobertura. Es material de pago en un disco que a lo mejor no es suyo.
 *
 * Nada de esto bloquea la salida. Si el navegador no puede limpiar —modo
 * privado, permisos, una versión antigua— la sesión se cierra igual: perder la
 * sesión importa más que perder la limpieza, y la comprobación de dueño de la
 * mochila recoge el caso en la siguiente entrada.
 */

/**
 * Borra del dispositivo lo que este usuario haya dejado guardado.
 *
 * @returns Siempre; no lanza nunca. Está pensada para llamarse desde el
 *   `onSubmit` del formulario de cerrar sesión, donde una excepción impediría
 *   salir.
 *
 * @example
 * ```tsx
 * <form action={signOutAction} onSubmit={() => void limpiarDispositivo()}>
 * ```
 */
export async function limpiarDispositivo(): Promise<void> {
  if (typeof window === "undefined") return;

  // Se avisa al trabajador de servicio para que borre sus cachés. Se hace por
  // mensaje y no desde aquí porque él sabe cómo se llaman las suyas, y así una
  // versión futura que añada otra no obliga a tocar esto.
  try {
    const registro = await navigator.serviceWorker?.ready;
    registro?.active?.postMessage({ tipo: "cerrar-sesion" });
  } catch {
    // Sin trabajador de servicio (navegador antiguo, o página servida por HTTP)
    // no hay cachés suyas que borrar.
  }

  // Y por si el mensaje no llega —el trabajador puede estar parado—, se borran
  // también desde aquí. Las dos vías hacen lo mismo y ninguna estorba a la otra.
  try {
    if ("caches" in window) {
      const claves = await caches.keys();
      await Promise.all(
        claves
          .filter((clave) => clave.startsWith("geminis-"))
          .map((clave) => caches.delete(clave)),
      );
    }
  } catch {
    // Modo privado o almacenamiento bloqueado: no hay nada persistido.
  }
}
