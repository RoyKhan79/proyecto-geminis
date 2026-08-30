# Referencia del código

Lo que hay aquí es el **qué** de cada función: su firma, sus parámetros, lo que
devuelve y lo que puede lanzar. Se genera del propio código con `npm run docs`,
así que los tipos son los de verdad y no una copia que se desactualiza.

El **por qué** no está aquí, está en [`DECISIONS.md`](../DECISIONS.md): 57
decisiones con el problema real que las causó. Si algo del código parece raro,
la respuesta suele estar allí antes que en la firma de la función.

---

## Por dónde empezar

| Módulo | Qué contiene |
| --- | --- |
| `lib/db/tenant` | **La guardia de aislamiento.** Ninguna consulta de una academia sale de aquí sin acotar. Si vas a tocar una sola cosa, que sea entendiendo esto |
| `lib/access/content-access` | Quién puede ver, descargar o preguntarle a la IA sobre cada rama del temario |
| `lib/auth` | Sesiones, contraseñas, permisos y recuperación |
| `lib/crypto/field` | Cifrado de los datos bancarios del alumnado |
| `lib/billing` | IBAN, remesas SEPA y numeración de facturas |
| `lib/ai` | Indexado, recuperación con permisos y el motor propio de respuesta |
| `server/*` | Las acciones y consultas de cada área, ya con sesión y permisos resueltos |

---

## Cómo se lee

Las etiquetas son las habituales:

- **`@param`** · qué espera cada argumento, y lo que no se deduce del tipo.
- **`@returns`** · qué devuelve, incluido qué significa `null`.
- **`@throws`** · cuándo revienta a propósito. En este proyecto lanzar es una
  decisión: hay sitios donde un fallo tiene que parar la petición entera.
- **`@example`** · solo donde el uso no es evidente.
- **`@see`** · el ADR que explica por qué está hecho así.

---

## Cobertura

Todo lo exportado —funciones, componentes, tipos y constantes— lleva su
comentario. `npm run docs:faltan` lo comprueba y hoy dice cero.

Lo que queda fuera a propósito: las propiedades de los tipos que infiere el
compilador (la forma de un `where`, por ejemplo) y las exportaciones de
convención de Next.js como `metadata`. Ni unas ni otras las escribió nadie, y
documentarlas llenaría la referencia de ruido. El informe las cuenta aparte para
que quede dicho que no se están escondiendo.

---

## Dos avisos

**Lo que devuelve `null` casi nunca es un error.** En este sistema, «no
existe» y «no tienes derecho a verlo» se responden igual a propósito: si un
alumno pide un tema que no ha contratado, para él ese tema no existe. Cada
función dice en su `@returns` cuál de las dos cosas significa su `null`.

**Las funciones de `server/` ya han comprobado la sesión y el permiso.** Las de
`lib/` no: son piezas, y quien las usa es responsable de haber comprobado
antes. Está dicho en cada una.
