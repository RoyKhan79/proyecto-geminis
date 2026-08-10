# Decisiones de arquitectura

Cada decisión relevante se anota aquí con su motivo. Lo importante no es la
decisión, es el porqué: es lo que permitirá dentro de un año saber si sigue
siendo válida o si cambió el contexto.

Formato: qué se decidió · por qué · qué se descartó · cómo salir de ella si nos
equivocamos.

---

### ADR-0001 · Next.js como aplicación única
**Decisión.** Manager y Campus viven en el mismo proyecto Next.js, con
renderizado en servidor y Server Actions.
**Por qué.** Comparten sesión, permisos y modelo de datos. Separarlos desde el
principio significaría duplicar autenticación y mantener un contrato de API
entre dos cosas que evolucionan juntas.
**Descartado.** SPA + API separada; dos aplicaciones independientes.
**Salida.** La lógica está en `src/server/**` y `src/lib/**`, que son funciones
de TypeScript sin dependencia de Next. Separar la API sería mover esa carpeta.

### ADR-0002 · La academia es el tenant
**Decisión.** No existe tabla `Tenant`; `Academy` lo es.
**Por qué.** Una indirección que hoy nadie usa complica todas las consultas.
**Salida.** Si aparecen grupos con varias academias, se añade `Organization` por
encima. Es una migración aditiva.

### ADR-0003 · `User` global, `Membership` por academia
**Decisión.** Correo único en toda la plataforma; el vínculo con cada academia es
`Membership`, y todo lo del tenant cuelga de ahí.
**Por qué.** Una persona puede ser alumna de una academia y profesora de otra.
Con usuarios duplicados por academia eso obliga a varias cuentas y contraseñas.

### ADR-0004 · Roles copiados por academia
**Decisión.** Cada academia recibe su copia de los roles del sistema.
**Por qué.** Permite roles personalizados sin tocar a las demás y mantiene la
resolución de permisos dentro del tenant.

### ADR-0005 · Oposición → convocatoria → curso → grupo, con niveles opcionales
**Decisión.** Solo la oposición es obligatoria; el resto se puede no usar.
**Por qué.** Un preparador independiente no tiene «grupos». Obligarle a crear
estructura vacía es la clase de fricción que hace abandonar un producto.

### ADR-0006 · El contenido es un árbol libre que nombra la academia ⭐
**Decisión.** Todo el material vive en `ContentNode`, autorreferenciado. `label`
lo escribe la academia. `sectionKind` describe el comportamiento, nunca el
nombre visible.
**Por qué.** La terminología cambia por especialidad y por ley. En Magisterio hoy
se dice «Programación de aula» y «Situaciones de aprendizaje» donde antes se
decía «programación didáctica» y «unidades didácticas». Con esos nombres en el
código, Geminis quedaría obsoleto en cada reforma y sería inútil para cualquier
oposición que no encaje en BLOQUE → TEMA → TEST.
**Descartado.** Tablas `Block`, `Topic`, `TopicSection` fijas.
**Coste asumido.** Un árbol genérico es algo más difícil de consultar que tres
tablas específicas. Se compensa con la ruta materializada.

### ADR-0007 · Ruta materializada en el árbol
**Decisión.** Cada nodo guarda `path` con sus ancestros; el prefijo de su rama es
`path + id + "/"`.
**Por qué.** La consulta más frecuente es «esta rama entera», tanto para navegar
como para resolver permisos. Con `path` es un `LIKE` indexado; con recursión
serían varias consultas o un CTE en cada petición.
**Cuidado.** `path`, `depth` y `position` solo los escribe
`src/server/content/tree.ts`.

### ADR-0008 · Derechos de acceso explícitos ⭐
**Decisión.** El acceso al contenido nunca se deduce de `pagado = true`. Existe
`Entitlement` con estados y alcance (`EntitlementScope`: rama + capacidad).
**Por qué.** El negocio real vende packs distintos —solo temario, solo clases,
temario + tests, curso completo— y el profesor necesita poder ajustar el acceso
de un alumno concreto. Con un booleano eso no se puede expresar.
**Consecuencia importante.** La misma comprobación la usa Geminis IA: preguntar
a la IA no puede ser una puerta trasera al material no contratado.

### ADR-0009 · La IA nunca publica sola
**Decisión.** Todo lo generado por IA nace como borrador y guarda su procedencia.
**Por qué.** La responsabilidad académica es del preparador. Y en normativa, una
respuesta plausible y falsa puede costar una plaza.

### ADR-0010 · Filtrar antes de buscar
**Decisión.** La recuperación filtra por academia, permisos, matrículas y
derechos **antes** de la búsqueda semántica.
**Por qué.** Filtrar después implica que el sistema ya leyó material que esa
persona no puede ver. Basta un descuido para que acabe en la respuesta.

### ADR-0011 · Sin columna vectorial hasta la fase de IA
**Decisión.** `DocumentChunk` guarda fragmento, localizador y metadatos, pero no
el vector. La columna llega con `pgvector`.
**Por qué.** No declaramos en el esquema algo que hoy no se puede crear en todos
los entornos. Lo que condiciona el diseño —los metadatos de permisos— ya está.

### ADR-0012 · Normativa: primero el flujo, después el rastreador
**Decisión.** Se construye el modelo y el flujo de revisión; las fuentes
oficiales se conectan después.
**Por qué.** El valor está en «este cambio afecta a 2 temas y 126 preguntas, ¿qué
hacemos?». Un rastreador de boletines sin ese flujo no sirve de nada.

### ADR-0013 · Geminis no modifica el contenido de una academia
**Decisión.** Ante un cambio legal, se genera una alerta con propuesta. Nunca se
edita el material del profesor.

### ADR-0014 · scrypt de `node:crypto` para contraseñas
**Decisión.** scrypt (N=65536, r=8, p=1) en lugar de argon2 o bcrypt.
**Por qué.** KDF con coste de memoria aprobado por OWASP, sin dependencias
nativas que compilar en cada plataforma de despliegue y sin depender del
mantenimiento de un paquete externo para algo tan crítico. El formato guarda los
parámetros, así que subirlos no invalida las contraseñas existentes.
**Descartado.** `@node-rs/argon2` (binario nativo), `bcrypt` (límite de 72 bytes,
sin coste de memoria).

### ADR-0015 · Sesiones en base de datos, no JWT
**Decisión.** Token opaco en cookie; en la base solo su SHA-256.
**Por qué.** Una academia necesita cerrar la sesión de alguien al instante
(impago, cuenta compartida, baja) y ver desde qué dispositivos entra. Con JWT eso
exige igualmente una lista de revocación, es decir, volver a la base de datos.
**Coste.** Una consulta indexada por petición autenticada.

### ADR-0016 · Limitador de intentos en memoria (provisional)
**Decisión.** Contador en memoria del proceso para el login.
**Por qué.** Cubre la fuerza bruta desde una IP, que es el riesgo real hoy.
**Limitación reconocida.** Con varias instancias cada una lleva su cuenta.
**Salida.** Misma interfaz que tendrá la versión con Redis.

### ADR-0017 · Centinela `SIN_TENANT` en `academyId`
**Decisión.** `academyId` lleva `@default("SIN_TENANT")`, un valor que no existe
como academia.
**Por qué.** Dos cosas a la vez: que TypeScript no obligue a escribir `academyId`
en cada create (lo pone la guardia, y pedirlo a mano sería ruido que además se
puede equivocar), y que saltarse la guardia falle al instante por clave foránea
con un error que dice literalmente `SIN_TENANT`.
**Descartado.** Envolver los tipos de Prisma con tipos derivados: mucha
complejidad de tipos y compilación más lenta a cambio de lo mismo.

### ADR-0018 · PostgreSQL local sin Docker para desarrollo
**Decisión.** `scripts/dev-db.sh` levanta PostgreSQL 18 con los binarios que trae
`@embedded-postgres`, en `.dev/pgdata`, sin sudo.
**Por qué.** Que alguien pueda clonar y tener el proyecto corriendo con dos
comandos, sin instalar Docker ni PostgreSQL. En producción se usa un PostgreSQL
normal: no hay nada específico de este montaje en el código.
**Detalle.** El socket va a `/tmp` y no dentro del proyecto, porque un socket en
el árbol de archivos rompe el escaneo de Turbopack.

### ADR-0019 · Módulos «Pronto» en lugar de botones falsos
**Decisión.** Lo no implementado aparece apagado y con la etiqueta «Pronto».
**Por qué.** Un menú lleno de enlaces que no llevan a ninguna parte destruye la
confianza en una demostración comercial más que una lista corta y honesta.
