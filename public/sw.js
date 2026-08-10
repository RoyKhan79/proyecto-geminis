/**
 * Service worker de Proyecto Geminis Campus.
 *
 * Hace poco a propósito, y lo poco que hace es lo que de verdad importa cuando
 * alguien estudia en el metro:
 *
 *   · cachea el armazón de la aplicación para que abra al instante;
 *   · si no hay red, enseña una pantalla decente en lugar del dinosaurio;
 *   · NUNCA cachea documentos ni respuestas de la API.
 *
 * Esa última regla no es una optimización, es seguridad: los PDFs del temario
 * dependen de quién los pide y de lo que tenga contratado. Guardarlos en el
 * disco del navegador dejaría material de pago accesible después de una baja.
 */

const VERSION = "geminis-v1";
const ESENCIALES = ["/campus", "/sin-conexion"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((cache) => cache.addAll(ESENCIALES))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((claves) =>
        Promise.all(claves.filter((c) => c !== VERSION).map((c) => caches.delete(c))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Nada de material privado en la caché del dispositivo.
  const privado =
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/gestion") ||
    url.pathname.startsWith("/entrar");
  if (privado) return;

  // Navegación: primero la red (los datos han de estar frescos), y si no hay
  // conexión, lo que haya en caché o la pantalla de sin conexión.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((respuesta) => {
          const copia = respuesta.clone();
          caches.open(VERSION).then((cache) => cache.put(request, copia));
          return respuesta;
        })
        .catch(async () => {
          const enCache = await caches.match(request);
          return enCache ?? caches.match("/sin-conexion");
        }),
    );
    return;
  }

  // Estáticos: se sirven de caché si están, y se refrescan por detrás.
  if (/\.(css|js|woff2?|png|svg|webp|ico)$/.test(url.pathname)) {
    event.respondWith(
      caches.match(request).then((enCache) => {
        const red = fetch(request)
          .then((respuesta) => {
            const copia = respuesta.clone();
            caches.open(VERSION).then((cache) => cache.put(request, copia));
            return respuesta;
          })
          .catch(() => enCache);
        return enCache ?? red;
      }),
    );
  }
});

// Notificaciones push. La suscripción y el envío llegan con el módulo de
// notificaciones; el receptor ya está listo para no tener que reinstalar la
// aplicación en los móviles del alumnado cuando se active.
self.addEventListener("push", (event) => {
  if (!event.data) return;
  let datos = {};
  try {
    datos = event.data.json();
  } catch {
    datos = { title: "Proyecto Geminis", body: event.data.text() };
  }

  event.waitUntil(
    self.registration.showNotification(datos.title ?? "Proyecto Geminis", {
      body: datos.body ?? "",
      icon: "/icono-192.png",
      badge: "/icono-192.png",
      data: { url: datos.url ?? "/campus" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(self.clients.openWindow(event.notification.data?.url ?? "/campus"));
});
