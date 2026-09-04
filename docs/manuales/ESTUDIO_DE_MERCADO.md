# Estudio de mercado y política de precios

**Septiembre de 2026 · documento interno.** No se envía a las academias: aquí
están los competidores y el razonamiento. Lo que sí se envía es la tarifa que
sale de aquí, que está en el manual de academias.

---

## 1 · Contra quién se compite

El error de partida sería creer que se compite contra «un programa de
academias». Se compite contra tres cosas distintas, y solo una de ellas es un
producto.

### a) La hoja de cálculo y el grupo de WhatsApp

Es el competidor real de la mayoría de academias pequeñas y medianas. Cuesta
0 €, funciona regular y nadie lo ha decidido: se ha quedado. Contra esto no se
gana por funciones, se gana por el coste de cambiar. De ahí que la importación
con simulación y vuelta atrás no sea una función más: es el argumento de venta.

### b) Los ERP de gestión de centros

| Producto | Precio publicado | Modelo | Notas |
|---|---|---|---|
| **Argos Academia** | desde **26 €/mes** | Modular: cada módulo 4,00–10,50 €/mes | El más parecido en filosofía. Campus aparte, desde 3,50 € por tramos de alumnos. Web: +26,50 €/mes y 330 € de alta |
| **Viday** | desde **39 €/mes** | Plan cerrado | Gestión, horarios, cobros, app |
| **PortalSocios** | desde **32 €/mes** | Plan cerrado, sin permanencia | Genérico de socios, no específico de formación |
| **Alexia** | desde **45 €/mes** | Por centro | Orientado a enseñanza reglada y familias |
| **Clickedu** | no publicado | Presupuesto | Colegios |

Son baratos y son gestión. Ninguno trae temario con ritmo por grupo, banco de
preguntas con repetición espaciada, IA sobre el material propio ni radar del
BOE. Compiten en el módulo Núcleo de Catedria y poco más.

### c) Los campus virtuales / LMS

| Producto | Precio publicado | Modelo |
|---|---|---|
| **evolCampus** | desde **80 €/mes** hasta 50 alumnos activos | Por alumno activo, sin permanencia, sin coste de alta |
| **Moodle alojado** | desde ~**85 €/mes** | Por alumnos o por instancia |
| **Classlife** | bajo presupuesto | Por usuarios activos, todo incluido |

Aquí está la competencia de verdad para el Campus. Son buenos en dar clase
online y flojos en llevar la academia: la matrícula, el recibo devuelto, la
factura rectificativa y quién debe dinero se acaban llevando fuera.

**El hueco que ocupa Catedria es exactamente ese: nadie cubre bien los dos lados
a la vez.** Una academia que hoy quiera lo que hace Catedria tiene que contratar
un ERP más un LMS, y unirlos a mano.

---

## 2 · Cuánto se puede cobrar: lo que gana el cliente

Este es el número que manda, y no el precio del competidor.

Una academia de oposiciones cobra a cada alumno, según el mercado de 2026:

| Modalidad | Precio al alumno |
|---|---|
| Online | 60 – 140 €/mes |
| Presencial | 100 – 220 €/mes |
| Grupo A / alto nivel | 200 – 250 €/mes |

Además, matrícula de alta de 30 – 150 € una sola vez.

Una academia con **150 alumnos a 100 €** factura **15.000 €/mes**. La regla
sana en software vertical es cobrar entre el **1 % y el 3 %** de lo que factura
el cliente con la herramienta. Eso sitúa el techo razonable entre **150 € y
450 €/mes** para esa academia.

Y hay un segundo número, más contundente para vender: **un solo alumno que no
se da de baja paga el programa entero.** Con la Analítica avisando de quién
lleva 30 días sin entrar, retener a uno al mes ya lo cubre. Conviene decirlo
así en la visita, porque es verdad y es comprobable.

---

## 3 · El problema del precio plano

El catálogo actual (`src/lib/modules/catalogo.ts`) cobra **por academia, no por
alumno**. Eso es cómodo de entender y desastroso en los extremos:

| Academia | Catedria Completo hoy | Coste por alumno | Contra el mercado |
|---|---|---|---|
| 30 alumnos | 314 €/mes | **10,47 €** | evolCampus 80 €. **Se pierde la venta** |
| 150 alumnos | 314 €/mes | 2,09 € | Competitivo y justo |
| 500 alumnos | 314 €/mes | **0,63 €** | Classlife cobraría varias veces eso. **Se regala dinero** |

Un precio plano es simultáneamente demasiado caro para la academia pequeña y
demasiado barato para la grande. Es el fallo comercial más serio del producto
ahora mismo, y no se arregla bajando el precio: se arregla haciéndolo escalar.

---

## 4 · La tarifa que se propone

**Se mantiene el catálogo modular y sus precios** —están bien calibrados contra
el valor— **y se le añade un coeficiente por tamaño**:

```
precio = (suma de los módulos contratados) × coeficiente del tramo
```

| Tramo (alumnado activo) | Coeficiente |
|---|---|
| Hasta 50 | **× 0,6** |
| De 51 a 150 | **× 1,0** (precio de catálogo) |
| De 151 a 350 | **× 1,5** |
| De 351 a 700 | **× 2,1** |
| Más de 700 | a medida |

«Alumnado activo» = con matrícula viva en el mes. El alumno que se dio de baja
en marzo no se paga en abril. Esto hay que decirlo, porque es lo que hace
evolCampus y la academia lo va a preguntar.

Resultado para el pack Completo:

| Tramo | Precio/mes | Por alumno (en el tope del tramo) |
|---|---|---|
| ≤ 50 | **189 €** | 3,78 € |
| 51 – 150 | **314 €** | 2,09 € |
| 151 – 350 | **472 €** | 1,35 € |
| 351 – 700 | **660 €** | 0,94 € |

Esas cifras **ya llevan dentro el descuento por número de módulos** que el
catálogo aplicaba desde el principio: la suma bruta del pack Completo son 393 €
y se cobran 314 €. Conviene enseñar las dos, porque un 20 % que el cliente ve
restado vende más que un precio bajo sin explicación.

El coste por alumno baja según crece la academia, que es lo que hace que un
cliente grande no se plantee irse, y el precio de entrada baja a 189 € para la
pequeña, que es lo que hace que llegue a plantearse entrar.

### Lo que va incluido siempre, y conviene que se note

- **Alta e implantación: 0 €.** Argos cobra 330 € solo por la web. Regalar el
  alta ataca justo la objeción que frena la venta.
- **Migración de los datos incluida.** Es el mayor coste de cambiar y es donde
  Catedria es mejor que nadie.
- **Sin permanencia.** evolCampus no la tiene; exigirla sería regalarle el
  argumento.
- **Exportación completa de los datos en un clic.** Se dice en voz alta: un
  programa del que no se puede salir no merece confianza.
- Actualizaciones, copias de seguridad y soporte.

### Descuentos

- **Anual: se pagan 10 meses.** Estándar del sector y mejora la caja.
- **Primeros clientes:** 50 % el primer año a las 10 primeras academias, a
  cambio de poder citarlas. Al no haber referencias todavía, esto vale más que
  el descuento que cuesta.

---

## 5 · Lo que hay que arreglar antes de mandar el mailing

1. ~~El coeficiente de tramo no está implementado.~~ **Hecho.** Está en
   `TRAMOS` y `calcularPresupuesto` (`src/lib/modules/catalogo.ts`), con el
   alumnado activo como entrada. Lo que se anuncia se puede facturar.
2. **Cinco requisitos de infraestructura siguen pendientes** (`npm run
   desplegar:comprobar`): SMTP, copias programadas y restauradas, cifrado de
   disco y de bucket, y los dos cron. Sin SMTP no salen ni los avisos del BOE ni
   la recuperación de contraseña, que son dos de los argumentos del manual.
3. **Los datos de demo deben borrarse de cualquier base con datos reales.**

---

## 6 · Aviso sobre el envío masivo

El mailing en frío a academias en España cae bajo el **artículo 21 de la
LSSI-CE**, que prohíbe la comunicación comercial por correo electrónico sin
solicitud o autorización previa. Que el destinatario sea una empresa no lo deja
fuera; sí lo deja fuera que el correo sea de persona jurídica sin datos
personales identificables, y ahí el margen es estrecho: `info@academia.es` suele
valer, `maria@academia.es` no.

Sin entrar en asesoramiento legal —y conviene consultarlo—, lo que reduce el
riesgo de forma práctica:

- Usar solo direcciones genéricas publicadas por la propia academia.
- Identificar el correo como publicidad de forma clara.
- Identidad completa del remitente y **baja en un clic** que funcione de verdad,
  con lista de exclusión que se respete.
- No comprar bases de datos de terceros.
- Enviar en tandas pequeñas: además de prudente, es lo único que salva la
  reputación del dominio. Un envío masivo de golpe desde un dominio nuevo acaba
  en la carpeta de correo no deseado y quema el dominio para siempre.

Una alternativa que suele funcionar mejor en este sector: el manual como
descarga en una página propia, y el correo solo a quien lo pide. Convierte
menos en volumen y muchísimo más por contacto, y no tiene este problema.

---

## Fuentes

- [Argos Academia](https://argosgalaica.com/) · precios y módulos
- [Classlife · precios](https://www.classlife.education/precios/)
- [evolCampus · precios](https://www.evolmind.com/en/pricing-elearning-platform/)
- [Viday · centros educativos](https://viday.es/app-gestion-negocios/centros-educativos/)
- [PortalSocios · academias](https://portalsocios.com/software-gestion-academias.php)
- [SoftwareDoit · comparativa de software educativo](https://www.softwaredoit.es/software-educativo/index.html)
- [Opositor · cuánto cuesta una academia de oposiciones en 2026](https://www.opositor.com/cuanto-cuesta-una-academia-de-oposiciones/44430)
- [PreparaOposiciones · precios 2026](https://www.preparaoposiciones.com/blog/guias/cuanto-cuesta-preparar-oposiciones-precios-2026/)
- [Centro Innova · precio academias de oposiciones 2025-2026](https://www.centroinnova.net/precio-academias-oposiciones/)
