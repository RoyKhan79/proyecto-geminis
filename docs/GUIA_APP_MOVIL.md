# Guía · instalar la app en el móvil y probar academia ↔ alumno

Esta guía tiene dos partes:

1. **Instalar la aplicación** en un móvil real, desde el ordenador donde está
   corriendo Proyecto Geminis.
2. **La prueba completa**: tú de academia en el ordenador, tú de alumno en el
   móvil, viendo cómo lo que haces en un lado aparece en el otro.

Todo lo que hay aquí está comprobado en este equipo. Donde algo no funciona, lo
dice y explica por qué.

---

## Antes de empezar

Necesitas tres cosas:

- El ordenador y el móvil **en la misma red wifi**.
- La base de datos levantada y la aplicación corriendo.
- Las credenciales de la academia de demostración.

### Levantar todo

```bash
npm run db:start      # arranca PostgreSQL local (sin Docker, sin sudo)
npm run dev -- -H 0.0.0.0
```

El `-H 0.0.0.0` es lo importante: sin él, el servidor solo escucha en el propio
ordenador y el móvil no lo alcanza.

### Averiguar la dirección del ordenador

En macOS:

```bash
ipconfig getifaddr en0
```

En Linux: `hostname -I`. En Windows: `ipconfig` y busca «Dirección IPv4».

Te dará algo como `192.168.18.9`. **Esa es la dirección que tienes que escribir
en el móvil**, con el puerto: `http://192.168.18.9:3000`.

Compruébalo primero desde el propio ordenador:

```bash
curl -o /dev/null -w "%{http_code}\n" http://192.168.18.9:3000/entrar   # → 200
```

Si eso no da `200`, no sigas: es el cortafuegos del ordenador. En macOS, Ajustes
del sistema → Red → Firewall, permitir conexiones entrantes para Node.

### Credenciales de la demostración

| Quién | Correo | Contraseña |
| --- | --- | --- |
| Dirección de la academia | `admin@academiademo.test` | `Geminis2026!` |
| Profesora | `laura@academiademo.test` | `Geminis2026!` |
| Secretaría | `secretaria@academiademo.test` | `Geminis2026!` |
| Alumna (curso completo) | `alumno1@academiademo.test` | `Geminis2026!` |
| Alumno (solo tests) | `alumno2@academiademo.test` | `Geminis2026!` |

Los dos alumnos son distintos a propósito: **tienen contratado material
diferente**, y esa es la parte del producto que más conviene enseñar.

---

## 1 · Instalar la app en el móvil

Proyecto Geminis Campus es una **PWA**: se instala desde el navegador, sin
tienda de aplicaciones. Una vez instalada tiene su icono, se abre a pantalla
completa sin barra de navegador y funciona igual que una aplicación nativa
(ADR-0021).

### En iPhone y iPad

1. Abre **Safari** (tiene que ser Safari; desde Chrome en iOS no se puede
   instalar).
2. Entra en `http://192.168.18.9:3000` con la dirección de tu ordenador.
3. Inicia sesión con `alumno1@academiademo.test`.
4. Toca el botón **Compartir** (el cuadrado con la flecha hacia arriba).
5. Baja y toca **Añadir a pantalla de inicio**.
6. Confirma. Ya tienes el icono en la pantalla.

Ábrela desde el icono: verás que **no hay barra de direcciones**. Eso es que se
ha instalado bien.

### En Android

1. Abre **Chrome**.
2. Entra en `http://192.168.18.9:3000` e inicia sesión.
3. Menú de los tres puntos → **Añadir a pantalla de inicio**.

> **Un aviso honesto.** En Android, la instalación completa de una PWA —con el
> aviso automático de «Instalar aplicación» y con funcionamiento sin conexión—
> exige **HTTPS**. Sobre `http://` de red local, Chrome te deja crear el acceso
> directo y la aplicación funciona con normalidad, pero **no registra el service
> worker**, así que no habrá modo sin conexión. Para probar eso hay dos caminos,
> los dos reales:
>
> - **Cable USB y reenvío de puertos.** Conecta el móvil por USB, activa la
>   depuración USB, y en el ordenador abre `chrome://inspect` → *Port
>   forwarding* → `3000` → `localhost:3000`. En el móvil entras por
>   `http://localhost:3000`, que Chrome considera contexto seguro, y la
>   instalación es completa.
> - **Publicarlo con HTTPS.** Es lo que hará la academia de verdad, y entonces
>   todo esto funciona solo.
>
> (`next dev --experimental-https` genera un certificado, pero necesita
> descargar `mkcert` la primera vez. En este equipo no ha podido y ha vuelto a
> HTTP. Si tienes Homebrew: `brew install mkcert && mkcert -install`, y después
> `mkcert 192.168.18.9` y arrancar con `--experimental-https-key` y
> `--experimental-https-cert`.)

### En el escritorio

En Chrome o Edge aparece un icono de instalación a la derecha de la barra de
direcciones. También sale un aviso propio dentro del Campus a los pocos
segundos.

### Comprobar que está bien instalada

- El icono es azul con una **G** y un punto dorado.
- Al abrirla no hay barra de direcciones.
- La barra de estado del móvil se tiñe del azul de la marca.
- Desde el inicio del Campus, abajo, hay accesos directos a Estudiar, Tests y
  Avisos (mantén pulsado el icono en Android).

---

## 2 · La prueba completa: academia y alumno a la vez

Esta es la demostración que conviene enseñar a una academia. Deja el ordenador
con `admin@academiademo.test` y el móvil con `alumno1@academiademo.test`.

Cada paso indica **dónde se hace** y **qué mirar**.

### Prueba A · El profesor abre un tema y el alumno lo ve

Es el punto que más se pregunta: el temario está subido entero, pero el alumno
solo ve lo que el profesor ha abierto.

1. **Móvil** · Campus → *Estudiar*. Fíjate en cuántos temas hay abiertos.
2. **Ordenador** · Manager → *Contenido* → elige la convocatoria de
   Administrativo → botón **Ritmo del temario**.
3. **Ordenador** · Abre un tema más para el grupo (o usa «abrir hasta aquí»).
4. **Móvil** · Recarga *Estudiar*. **Aparece el tema nuevo.**
5. **Ordenador** · Ciérralo otra vez.
6. **Móvil** · Recarga. **Ha desaparecido**, y si guardaste el enlace directo,
   ahora da 404.

Lo que se demuestra: el ritmo lo marca el profesor, por grupo, y el alumno no
puede saltárselo ni con el enlace.

### Prueba B · Cada alumno ve lo que ha pagado

1. **Móvil** · Con `alumno1` (curso completo), en *Estudiar* verás las cuatro
   secciones del tema: temario, esquemas, clases y tests.
2. **Móvil** · Cierra sesión y entra con `alumno2` (solo tests).
3. **Móvil** · En el mismo tema **solo aparecen los tests**. El PDF del temario
   no está, y si intentas abrir su enlace directo, devuelve 404.

Lo que se demuestra: el acceso no se deduce de «ha pagado», sino de lo que tiene
contratado, y se comprueba en cada descarga.

### Prueba C · Un test de principio a fin

1. **Móvil** · Campus → *Tests* → «Test por tema» → 10 preguntas → Empezar.
2. Responde algunas bien y otras mal, y deja una en blanco a propósito.
3. Entrega.
4. **Móvil** · En la corrección, en una pregunta fallada, toca **«¿Por qué he
   fallado?»**. Geminis te da la explicación del preparador y la refuerza con lo
   que dice tu temario, citando de dónde lo saca.
5. **Ordenador** · Manager → *Analítica*. Tu intento ya está ahí, y la pregunta
   fallada cuenta para las estadísticas del tema.

### Prueba D · El repaso vuelve solo

1. Después de la prueba C, **móvil** → *Tests*. Arriba aparece **«Repaso de
   hoy»** con las preguntas que tocan.
2. Lo que has fallado vuelve mañana; lo que has acertado con soltura, mucho más
   tarde. Eso lo decide la repetición espaciada (ADR-0029).

### Prueba E · Geminis IA

1. **Móvil** · Campus → pregunta a Geminis: *«¿Qué plazo hay para resolver?»*
2. Responde con el material de la academia y **cita el documento y la página**.
3. Pregúntale ahora algo que no esté en el temario: *«¿Cuál es la capital de
   Mongolia?»*. Dice que no lo encuentra, en lugar de inventárselo.
4. **Móvil** · Entra con `alumno2` (solo tests) y hazle la misma primera
   pregunta: **no encuentra nada**, porque no tiene el temario contratado.
5. **Ordenador** · Manager → *Geminis IA* → elige un tema → **Generar
   preguntas**. Salen en **borrador**, con su procedencia. Nada se publica solo.

Lo que se demuestra: la IA no es una puerta trasera al material no contratado, y
funciona **sin contratar ninguna API** (ADR-0028).

### Prueba F · El muro y los mensajes

1. **Ordenador** · Manager → *Muro de clase* → publica un aviso para el grupo.
2. **Móvil** · Campus → *Muro*. Ahí está.
3. **Móvil** · Campus → *Mensajes* → escribe al profesor.
4. **Ordenador** · Manager → *Mensajes*. El hilo aparece y puedes contestar.
5. **Móvil** · Recarga. Tienes la respuesta.

### Prueba G · Tareas con entrega y corrección

1. **Ordenador** · Manager → *Tareas* → crea una con fecha de entrega.
2. **Móvil** · Campus → la tarea aparece; sube un archivo.
3. **Ordenador** · Manager → abre la entrega, ponle nota y un comentario.
4. **Móvil** · Recarga: ves tu nota y el comentario.

### Prueba H · El aislamiento entre academias

Esta no se ve, y es la más importante de todas.

```bash
node scripts/auditoria.mjs http://192.168.18.9:3000
```

Comprueba 29 cosas contra el servidor que tienes levantado: que nada es
accesible sin sesión, que un alumno no abre la ficha de otro, que un documento
no se sirve a quien no lo tiene contratado, que la IA no se salta los permisos y
que el alumnado no entra en ninguna pantalla de gestión.

---

## Si algo no va

**El móvil no abre la página.**
Comprueba que los dos están en la misma wifi, que arrancaste con `-H 0.0.0.0` y
que el cortafuegos del ordenador deja pasar el puerto 3000. Muchas redes de
hotel y de oficina aíslan los dispositivos entre sí: con el punto de acceso del
propio móvil funciona siempre.

**Entra pero no carga bien.**
Prueba en una pestaña privada. Si habías instalado una versión anterior, el
service worker puede tener guardado el armazón viejo: desinstala la app del
móvil y vuelve a añadirla.

**En Android no sale «Instalar».**
Es lo esperado sobre HTTP. Mira el aviso de más arriba.

**«No encuentro esa información» al preguntar a la IA.**
El material puede no estar indexado. En el ordenador: Manager → *Geminis IA* →
**Indexar material**. Y comprueba que ese tema esté abierto y contratado para
ese alumno.

**No hay contenido en la demostración.**

```bash
npm run demo:todo   # academia, alumnado, cursos, temario, preguntas y normativa
npm run ia:probar   # comprueba, desde la terminal, que la IA responde
```

---

## Lo que la academia debería ver en cinco minutos

Si tienes poco tiempo delante de una academia, este es el orden:

1. **Prueba A** — el profesor manda sobre el ritmo.
2. **Prueba B** — cada alumno ve lo que ha pagado, y no más.
3. **Prueba E** — la IA responde con SU temario y cita de dónde.
4. **Prueba D** — el repaso vuelve solo, sin que el alumno organice nada.

Son los cuatro puntos que ningún competidor genérico resuelve.
