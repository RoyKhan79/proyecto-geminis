# Design system

Todo vive en [`src/app/globals.css`](../src/app/globals.css). Ninguna pantalla
inventa un color, un radio ni una sombra: si hace falta algo nuevo, se añade
como token y se usa por su nombre (§79).

---

## De dónde salen las decisiones

Esto lo abre gente que lleva meses estudiando ocho horas al día, y se lo
enseñamos a academias que van a pagar por ello. Las decisiones visuales salen de
ahí y no de una moda:

| Decisión | Motivo |
| --- | --- |
| Fondo cálido, no blanco puro ni gris frío | Se mira muchas horas seguidas |
| Serif en titulares, sans en el resto | El serif da la autoridad que pide un producto de temario y normativa; el sans se lee mejor en tablas, formularios y móvil |
| Azul profundo de marca | Es el color de la institución y del expediente, que es el terreno de una oposición |
| Dorado reservado a lo conseguido | Si se usa en todo, deja de significar nada |
| Sombras en dos capas y bordes finos | La profundidad se nota; no se ve |
| Cifras siempre tabulares | Una tabla de notas donde los números bailan al pasar de página se lee fatal |

---

## Tipografía

| Uso | Familia | Token |
| --- | --- | --- |
| Titulares (`h1`, `h2`, `.font-display`) | **Fraunces** · serif variable con eje óptico | `--font-display` |
| Texto, interfaz, tablas | **Manrope** | `--font-sans` |
| Código y datos técnicos | **JetBrains Mono** | `--font-mono` |

Los titulares reciben el serif desde `@layer base`, no repitiendo una clase en
cada pantalla: una academia que cambie de tipografía la cambia en un sitio.

> **Cuidado con dónde van las variables de `next/font`.** Se aplican en
> `<html>`, no en `<body>`. Los tokens se declaran en `:root`, que **es**
> `<html>`: si `--font-fraunces` colgara de `<body>`, al resolver
> `--font-display` en `:root` no existiría y la declaración entera se
> invalidaría. El síntoma es silencioso —los titulares salen con la fuente del
> sistema y no falla nada— y costó encontrarlo una vez.

---

## Color

### Marca

`--color-brand-50` … `--color-brand-900`, azul profundo (tono 264 en OKLCH).
Se usa a través de `--accent`, que **cada academia puede sobrescribir**
(white-label, §60).

### Dorado

`--color-gold-100/300/500/700`, expuesto como `--gold` y `--gold-soft`.
Reservado a lo conseguido: una racha, un simulacro aprobado, una plaza. Existen
`<Badge tone="gold">` y `<Button variant="gold">` para eso y solo para eso.

### Estados

`positive`, `caution`, `critical`, `info`, cada uno con su variante `-soft`
para fondos.

### Tokens semánticos

Nunca se usa un color de la paleta directamente en una pantalla. Se usan:

`surface`, `surface-muted`, `surface-sunken`, `surface-inverse` ·
`line`, `line-strong` · `ink`, `ink-soft`, `ink-muted`, `ink-inverse` ·
`accent`, `accent-hover`, `accent-soft`, `accent-contrast` · `gold`, `gold-soft`.

Así el modo oscuro y el white-label son un cambio de variables y no una
reescritura de componentes.

---

## Modo oscuro

Tres estados, como debe ser:

- `:root` — paleta clara por defecto.
- `@media (prefers-color-scheme: dark)` sobre `:root:not([data-theme="light"])` — sigue al sistema.
- `:root[data-theme="dark"]` — elección explícita, que gana siempre.

---

## Utilidades propias

| Clase | Para qué |
| --- | --- |
| `.shell-wash` | El lavado de color del fondo de las carcasas. Dos degradados radiales de muy poca saturación: no debe leerse como «un degradado», debe leerse como papel |
| `.edge-light` | Filo de luz de un píxel en el borde superior. Es lo que hace que una tarjeta parezca apoyada sobre el fondo en lugar de recortada contra él |
| `.icon-chip` | El icono dentro de una pastilla suave. Da jerarquía sin más color ni más peso tipográfico |
| `.text-gradient` | Degradado de marca en el texto. Solo para cifras grandes y titulares de portada; en texto corrido es ilegible |
| `.touch-target` | Área táctil mínima de 2,75 rem (§70) |
| `.safe-bottom` | Respeta la zona segura inferior del móvil |

---

## Componentes

Están en [`src/components/ui`](../src/components/ui). Detalles que parecen
tontos y no lo son:

- **Botón** · cede un píxel al pulsarlo (`active:translate-y-px`). Es la señal
  táctil que hace que una web se sienta como una aplicación. El primario lleva
  un degradado corto y un filo de luz; la transición incluye la sombra, para
  que el relieve acompañe al hover en lugar de saltar.
- **Tarjeta** · `edge-light` y radio de 1 rem.
- **Distintivo** · anillo interior en lugar de borde, para no alterar la caja.
- **Barra lateral** · marca vertical de 3 px a la izquierda del elemento
  activo. Se lee de un vistazo y no compite con el contenido.
- **Barra inferior del Campus** · el icono activo se sienta sobre una pastilla.
  En cinco destinos, un cambio de color solo no basta para saber dónde estás con
  prisa.

---

## Iconos

[lucide-react](https://lucide.dev), trazo uniforme, `size-4` en interfaz y
`size-5` en estados vacíos.

El icono de la aplicación se **genera** con `npm run iconos`
([`scripts/iconos.ts`](../scripts/iconos.ts)): una G serif sobre el azul de
marca con un punto dorado. Se genera y no se dibuja a mano porque el color es un
token: si una academia cambia su acento, los iconos se rehacen con un comando.

Salidas: `icono-192`, `icono-512`, `icono-mascara` (con el 20 % de zona segura
que Android recorta), `apple-icon` (iOS no usa el manifiesto y sin fondo opaco
lo pinta negro), `favicon-32` e `icono.svg`.

---

## Accesibilidad

- Foco siempre visible, 2 px con desplazamiento (§70).
- Área táctil mínima cómoda en móvil.
- `prefers-reduced-motion` respetado: las animaciones se anulan.
- Contraste comprobado sobre los tokens, no sobre colores sueltos.
