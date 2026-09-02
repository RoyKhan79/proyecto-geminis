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
/*
 * Lo que se guarda al instalar. `/campus` estaba aquí y ya no: es una pantalla
 * con datos de una persona concreta, así que precargarla significaba dejarla en
 * el disco antes incluso de que nadie la pidiera. La pantalla de «sin conexión»
 * no depende de nadie y es justo la que hace falta cuando no hay red.
 */
const ESENCIALES = ["/sin-conexion"];

/**
 * La mochila: temas que el alumno ha decidido guardar para estudiar sin
 * cobertura. Este service worker NO escribe aquí jamás —lo hace la página,
 * cuando alguien pulsa «Guardar»— y solo lee cuando la red ha fallado. La
 * distinción importa: material de pago en un disco ajeno es una decisión del
 * alumno, no un efecto secundario de haber abierto una página.
 */
const MOCHILA = "geminis-mochila-v1";

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
        // La mochila sobrevive a los despliegues: la llenó el alumno, no
        // nosotros, y borrarla al publicar una versión le dejaría sin temario
        // justo cuando se ha quedado sin cobertura.
        Promise.all(
          claves
            .filter((c) => c !== VERSION && c !== MOCHILA)
            .map((c) => caches.delete(c)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Documentos del temario: red primero, siempre. Solo si la red falla se mira
  // la mochila, y solo lo que el alumno guardó a propósito. Nunca se escribe
  // aquí: si el documento llega por red, se sirve y se olvida.
  const documento = url.pathname.match(/^\/api\/archivos\/([^/]+)$/);
  if (documento) {
    event.respondWith(
      fetch(request).catch(async () => {
        const guardado = await caches
          .open(MOCHILA)
          .then((cache) => cache.match(`/mochila/archivo/${documento[1]}`));
        return (
          guardado ??
          new Response(
            JSON.stringify({
              error:
                "Sin conexión y este tema no está guardado en el dispositivo.",
            }),
            { status: 503, headers: { "Content-Type": "application/json" } },
          )
        );
      }),
    );
    return;
  }

  /*
   * Nada de material privado en la caché del dispositivo.
   *
   * `/campus` faltaba en esta lista, y era el peor olvido posible: es LA
   * pantalla del alumno. Sus notas, sus mensajes, su nombre y lo que lleva
   * estudiado acababan guardados en el disco del navegador, donde se quedaban
   * después de cerrar sesión. En una academia eso no es hipotético: los
   * ordenadores del aula los usan veinte personas al día, y bastaba que al
   * siguiente le fallara la red un segundo para que la caché le sirviera la
   * página del anterior.
   *
   * La regla que se sigue ahora: **se cachea la carcasa, nunca lo que depende
   * de quién ha entrado**. Si una ruta pinta datos de alguien, va aquí.
   */
  const PRIVADAS = [
    "/api/",
    "/campus",
    "/gestion",
    "/plataforma",
    "/inicio",
    "/elegir-academia",
    "/entrar",
    "/pagar",
    "/recuperar",
    "/verificar",
  ];
  if (PRIVADAS.some((prefijo) => url.pathname.startsWith(prefijo))) return;

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

/**
 * Borrar lo guardado al cerrar sesión.
 *
 * La página avisa por aquí justo antes de salir. Se van las dos cachés: la de
 * navegación —que ya no debería llevar nada privado, pero puede arrastrar lo
 * que guardara una versión anterior de este archivo— y la mochila, con los
 * temas que el alumno se descargó.
 *
 * Que se vaya también la mochila es una decisión, no un descuido: es material
 * de pago, y quien cierra sesión en un ordenador compartido espera no dejar
 * nada suyo detrás. El coste es tener que volver a descargarla en el propio
 * dispositivo, y es el lado por el que conviene equivocarse.
 */
self.addEventListener("message", (event) => {
  if (event.data?.tipo !== "cerrar-sesion") return;

  event.waitUntil(
    caches.keys().then((claves) =>
      Promise.all(
        claves
          .filter((c) => c === VERSION || c === MOCHILA)
          .map((c) => caches.delete(c)),
      ),
    ),
  );
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
