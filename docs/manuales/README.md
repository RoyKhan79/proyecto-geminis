# Los manuales

Dos PDF que se generan desde el propio proyecto:

| Archivo | Para quién | Páginas |
|---|---|---|
| `manual-academias.pdf` | La academia. Presentación comercial, con la tarifa al final. | 22 |
| `manual-alumnado.pdf` | El alumnado. Cómo se usa el campus. | 15 |

Y un tercero que **no se envía a nadie**: [`ESTUDIO_DE_MERCADO.md`](ESTUDIO_DE_MERCADO.md),
con los competidores, sus precios y el razonamiento del que sale la tarifa.

---

## Cómo se regeneran

```bash
npm run dev          # hace falta el servidor: las capturas son reales
npm run demo:todo    # y la demo con material, si no hay
npm run manual       # capturas + PDF
```

O por partes: `npm run manual:capturas` y `npm run manual:pdf`.

## Por qué está montado así

**Las capturas se toman contra el servidor de verdad**, con dos sesiones
abiertas (la academia y una alumna), en vez de dibujarse a mano. Un manual con
maquetas envejece el día que cambia una pantalla y nadie se entera; este falla
de forma visible, porque la captura se vuelve a tomar y sale distinta.

`scripts/capturas-manual.mjs` incluso **hace un test entero por la interfaz**
—elige respuestas, lo entrega y fotografía la corrección— porque la demo recién
sembrada no tiene ningún intento y las pantallas salían vacías. Es preferible a
inventar datos por detrás: lo que aparece en el manual es exactamente lo que
verá quien lo use.

**El PDF lo imprime Chromium** desde `manual-*.html` con `manual.css`, así que
usa las tipografías y los colores reales del producto.

## Al tocarlos, dos cuidados

1. **Que cada sección quepa en su página.** Si una `.pagina` pasa de 297 mm,
   Chromium la parte en dos y aparecen páginas de relleno medio vacías. El
   generador avisa cuando el número de páginas del PDF no coincide con el de
   secciones.
2. **Los números del manual salen del código.** Los precios son los de
   `src/lib/modules/catalogo.ts`. Si cambian ahí, hay que cambiarlos aquí: hoy
   están escritos a mano en el HTML.

## Pendiente

El **coeficiente por tramo de alumnado** que aparece en la página 20 del manual
está anunciado pero **no implementado**: el catálogo tiene un precio plano por
academia. Antes de mandar la tarifa a nadie hay que poder facturarla. Está
explicado en el estudio de mercado, apartado 5.

## Sobre el envío

Los PDF pesan 4,8 MB y 3,3 MB. Como adjunto en un envío masivo es demasiado:
penaliza la entrega y muchos servidores lo rechazan. Mejor alojarlos y mandar el
enlace. El apartado 6 del estudio de mercado explica además lo que exige la
LSSI-CE para el correo comercial no solicitado.
