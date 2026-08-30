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

### ADR-0020 · Riesgo de abandono con reglas, no con un modelo
**Decisión.** Se calcula con señales explícitas y ponderadas, no con aprendizaje
automático.
**Por qué.** El preparador tiene que poder discutir el resultado («¿por qué me
sale María en rojo?») y actuar. Con pocos alumnos, un modelo daría resultados
inestables con falsa autoridad. Las reglas se ajustan en una tarde.
**Salida.** Estas mismas señales serán las variables de entrada de algo más fino
cuando haya volumen.

### ADR-0021 · La app del alumnado es una PWA
**Decisión.** Aplicación instalable, no nativa.
**Por qué.** Una sola base de código; las correcciones llegan sin pasar por
revisión de tienda, que en un producto que cambia cada semana es determinante; y
sin comisiones sobre lo que cobre la academia.
**Salida.** Si hace falta estar en las tiendas, se envuelve o se hace nativa
contra la misma API.
**Detalle.** El service worker NO cachea documentos ni respuestas de la API: son
material que depende de lo que cada alumno tenga contratado.

### ADR-0022 · El radar corre como tarea programada del servidor
**Decisión.** `npm run radar` desde cron, no dentro de la aplicación web.
**Por qué.** La academia no tiene por qué tener nada abierto, la ejecución puede
tardar minutos y no debe competir con las peticiones de los usuarios, y se puede
reintentar sin afectar a nadie.

### ADR-0023 · El radar nunca crea una oposición por su cuenta
**Decisión.** Detecta, avisa y espera.
**Por qué.** Un falso positivo que creara oposiciones generaría basura que
alguien tendría que limpiar. Y la decisión de preparar una convocatoria es
comercial, no técnica.

### ADR-0024 · Los hilos de mensajes son del alumno y de la academia
**Decisión.** No pertenecen a un profesor concreto.
**Por qué.** Si el profesor cambia o está de baja, la conversación no se pierde
ni hay que reenviar nada, y la academia conserva el historial de lo que se le ha
dicho a cada alumno.

### ADR-0025 · La nota vive en la entrega, no en la tarea
**Decisión.** Cada alumno tiene su corrección, su comentario y su historial.
**Por qué.** Permite devolver un trabajo para que se rehaga sin perder lo
anterior, que es como se corrige de verdad un supuesto práctico.

### ADR-0026 · Saneado de HTML por lista blanca, aplicado dos veces
**Decisión.** Se permite lo que se sabe seguro y se descarta el resto, tanto al
guardar como al pintar.
**Por qué.** Listar lo peligroso siempre se queda corto. Y sanear solo al
guardar deja sin cubrir el contenido almacenado antes de que existiera el
saneador. En multi-tenant, un script inyectado corre con la sesión de cada
alumno que abre el tema.
**Origen.** Hallazgo H-02 de la auditoría interna.

### ADR-0027 · La nota del simulacro usa la fórmula del examen
**Decisión.** El resultado de un simulacro se calcula aplicando la penalización
por fallo de la convocatoria, no el porcentaje de aciertos.
**Por qué.** Con penalización de un tercio, responder a todo sin saber baja la
nota. Un simulacro que no lo refleje enseña una estrategia que en el examen real
cuesta la plaza.
**Detalle.** La penalización se escribe como en las bases («1/3») y se convierte
a decimal al guardarla.

### ADR-0028 · Geminis IA funciona sin proveedor externo ⭐
**Decisión.** Existe un motor propio (`src/lib/ai/local-engine.ts`) que responde
con el material de la academia sin ninguna API contratada. Si hay proveedor
configurado, responde el modelo; si no, o si el proveedor falla, responde el
motor propio. Nunca hay una pantalla que diga «la IA no está activada».
**Por qué.** Tres razones. Una academia pequeña no va a contratar una API para
probar el producto, y si lo primero que ve es un cartel de «no disponible», la
IA deja de ser un argumento de venta y pasa a ser una promesa. Hay academias que
no quieren que su temario salga de su servidor. Y un proveedor caído no puede
dejar sin asistente a todo el alumnado en plena semana de examen.
**Qué hace y qué no.** Detecta la intención de la pregunta, localiza las frases
que responden y las ordena citando de dónde sale cada una; resume, compara,
define, enumera y genera preguntas de completar con distractores sacados del
propio material. No redacta explicaciones nuevas ni razona más allá del texto.
Si el material no lo dice, dice que no lo encuentra.
**Honestidad.** La interfaz distingue «motor propio» de «modo avanzado» y
muestra la confianza de cada respuesta. Vender lo primero como lo segundo sería
mentir a la academia.
**Decisiones internas que costaron.** Los refuerzos por cifra o por artículo no
pueden hacer relevante una frase por sí solos: si cuentan, «¿cuál es la capital
de Mongolia?» se responde con el artículo 21. Y las palabras que aparecen en
casi todas las frases pesan menos, porque en un temario de derecho
administrativo la palabra «administrativo» no distingue nada.

### ADR-0029 · Repetición espaciada deducida, no autocalificada
**Decisión.** SM-2 adaptado: la calidad de la respuesta se deduce de si acertó y
de cuánto tardó, no de que el alumno se puntúe a sí mismo.
**Por qué.** El SM-2 original pide una autocalificación de 0 a 5 después de ver
la solución. Aquí no hay tarjetas, hay tests: pedir además una autoevaluación
añade un paso que la gente se salta y contamina el dato. Acertar rápido y
acertar tras dos minutos no significan lo mismo, y eso ya lo sabemos.
**Detalle.** El tiempo por pregunta se limita a cinco minutos al guardarlo:
dejar la pestaña abierta no significa que la pregunta costara una hora.

### ADR-0030 · Geminis IA propone sin que le pregunten
**Decisión.** Al entrar en el Campus, el alumno ve hasta tres propuestas
calculadas con sus propios datos, cada una con el motivo concreto que la
justifica. Si no hay nada que decir con fundamento, no se muestra nada.
**Por qué.** El alumno que va mal es precisamente el que no pregunta. Y una
recomendación sin motivo («estudia el tema 4») no la sigue nadie; con el dato
delante («llevas 12 fallos de 20 en el tema 4») sí.
**Sin modelo.** Son reglas sobre sus datos, no una predicción. Se pueden
discutir, que es lo que un preparador necesita poder hacer.

### ADR-0031 · Identidad visual: serif en titulares, sans en el resto
**Decisión.** Fraunces para titulares y Manrope para todo lo demás, sobre fondo
cálido y con azul profundo de marca. El dorado se reserva a lo conseguido.
**Por qué.** El producto lo abre gente que estudia ocho horas al día y se le
enseña a academias que van a pagar por él. El serif da la autoridad que pide un
producto de temario y normativa; el sans se lee mejor en tablas, formularios y
móvil, que es donde se pasa el tiempo. El blanco puro cansa a las once de la
noche.
**Detalle que costó.** Las variables de `next/font` van en `<html>` y no en
`<body>`. Los tokens se declaran en `:root`, que es `<html>`: con las variables
en `<body>`, al resolver `--font-display` en `:root` no existía `--font-fraunces`
y la declaración se invalidaba entera. El fallo es silencioso —los titulares
salen con la fuente del sistema y no se rompe nada— y solo se ve comparando.

### ADR-0032 · Los iconos de la aplicación se generan, no se dibujan
**Decisión.** `npm run iconos` produce todos los iconos desde un SVG paramétrico
con los colores de marca.
**Por qué.** El color de marca es un token que cada academia puede cambiar
(§60). Si los iconos fueran archivos dibujados a mano, cambiar el acento
significaría una tarde de diseño en lugar de un comando.

### ADR-0033 · Los textos legales son plantillas y lo dicen
**Decisión.** `/privacidad` y `/condiciones` están escritos a partir de lo que el
software hace de verdad, pero llevan arriba un aviso visible de que hay campos
por rellenar, y los huecos se pintan resaltados.
**Por qué.** Un texto legal con huecos publicado como si estuviera terminado es
peor que no tener ninguno: da una falsa sensación de cumplimiento. Y cada
academia tiene sus propios tratamientos, proveedores y plazos.
**Compromiso asumido.** Cada afirmación del documento sobre seguridad o sobre
datos corresponde a algo implementado. Si algo se deja de hacer, el texto se
cambia el mismo día.

### ADR-0034 · Un banco importado entra siempre en borrador
**Decisión.** Las preguntas que llegan por importación se crean con estado
`DRAFT` y `source: IMPORT`, sin opción de publicarlas de golpe.
**Por qué.** Un banco heredado de veinte años trae erratas, opciones que ya no
aplican tras un cambio normativo y respuestas mal marcadas. Publicarlo entero
pone esas preguntas en el test de un alumno mañana, y el alumno no tiene forma
de saber que la que ha fallado estaba mal.
**Coste asumido.** Alguien tiene que revisar. Se compensa con el filtro por
estado del banco y con la detección de repetidas, que reduce mucho el volumen a
mirar.

### ADR-0035 · La respuesta correcta se interpreta, no se exige un formato
**Decisión.** Se aceptan la letra («B», «b)», «Opción B»), el número («2») y el
texto exacto de la opción.
**Por qué.** Obligar a normalizar el Excel antes de importarlo es exactamente la
fricción que hace que la academia se quede donde estaba. Y en un banco real
conviven las tres formas, a veces en el mismo archivo.

### ADR-0036 · Deshacer una importación no borra preguntas ya contestadas
**Decisión.** Al revertir, las preguntas que nadie ha respondido se borran; las
que ya tienen respuestas se archivan.
**Por qué.** Borrar una pregunta contestada se llevaría por delante el histórico
de errores de esos alumnos, su repetición espaciada y las estadísticas del tema.
Archivar la saca de circulación sin destruir lo que ya pasó.

### ADR-0037 · Recuperación y verificación comparten tabla, separadas por prefijo
**Decisión.** Los dos testigos viven en `PasswordResetToken`. El de verificación
lleva el prefijo `v_` **dentro del texto sobre el que se calcula el resumen**, y
`comprobarToken(token, propósito)` exige que el prefijo case con el propósito.
**Por qué.** Compartir tabla ahorra una migración y un modelo, pero abre un
agujero clásico: un enlace de «confirma tu correo» —que dura tres días y que
cualquiera puede haber reenviado a un grupo— serviría para cambiar la
contraseña. Con el prefijo dentro del resumen no se puede quitar ni añadir sin
invalidar el testigo.
**Descartado.** Una columna `purpose`: funcionaría igual, pero exige acordarse
de filtrarla en cada consulta. El prefijo hace que olvidarse sea imposible,
porque el resumen simplemente no coincide.

### ADR-0038 · Cambiar la contraseña cierra todas las sesiones
**Decisión.** `resetPasswordAction` llama a `revokeAllSessions`.
**Por qué.** Si alguien ha recuperado la contraseña es porque sospecha que la
cuenta está comprometida o porque la perdió. En el primer caso, cambiarla sin
echar al intruso no sirve de nada: seguiría dentro con su cookie.
**Coste asumido.** La persona tiene que volver a entrar en todos sus
dispositivos. Se le avisa antes de guardar.

### ADR-0039 · El enlace se comprueba al abrir y se consume al guardar
**Decisión.** Abrir `/recuperar/<token>` valida el testigo pero no lo marca como
usado; se marca al guardar la contraseña nueva.
**Por qué.** Muchos filtros antivirus de correo abren los enlaces antes de que
lo haga la persona. Si abrir consumiera el testigo, el enlace llegaría siempre
gastado y la recuperación no funcionaría nunca en esos dominios.

### ADR-0040 · Row Level Security como segunda barrera, con rol propio ⭐
**Decisión.** Las 50 tablas con datos de academia llevan RLS activado y forzado.
La guardia fija `geminis.academy_id` al principio de cada operación y la política
solo deja ver las filas de esa academia.
**Por qué.** Hasta ahora el aislamiento descansaba en una sola barrera. Tres
cosas la rodean sin querer: una consulta con `$queryRaw`, un fallo futuro al
fusionar el `where`, o una operación de Prisma que la extensión no contemple.
**Lo que costó descubrir.** La primera versión **no protegía nada**. La
aplicación se conectaba con el rol dueño de las tablas, que además era
superusuario, y un superusuario se salta RLS incluso con FORCE. Se vio al
escribir la prueba que intentaba leer datos de otra academia con una consulta
cruda: los leía todos. Por eso existe el rol `geminis_app`, sin superusuario y
sin BYPASSRLS, y por eso hay dos URL de conexión: la de la aplicación y la del
dueño, que solo usan las migraciones.
**Coste medido.** `npm run rls:medir`: unos 3 ms por consulta, del orden de
20 ms en una pantalla con seis. Se puede apagar con `DB_RLS=off` para medirlo,
pero en producción va encendida.
**Comprobado.** `npm run rls:probar` y `npm run rls:concurrencia`: 200 consultas
simultáneas de dos academias, ninguna vio datos de la otra.

### ADR-0041 · Dentro de una transacción, la guardia no envuelve
**Decisión.** `transaccionDeAcademia(academyId, fn)` fija la variable una vez
para toda la transacción y marca el contexto; dentro, las operaciones se
ejecutan sin volver a envolverse.
**Por qué.** Es un fallo que apareció probando la facturación. Dentro de una
transacción interactiva, cada operación abría **su propia** transacción en otra
conexión. Con un `SELECT … FOR UPDATE` de por medio, la de dentro esperaba un
bloqueo que solo soltaría la de fuera: bloqueo mutuo y timeout a los cinco
segundos. Afectaba a reservar el número de una factura y a borrar una oposición
en cascada, que son justo las dos operaciones que más falta hace que sean
atómicas.
**Coste asumido.** Dentro de la transacción se trabaja con el cliente sin
guardia, así que hay que acotar por `academyId` a mano. RLS sigue comprobándolo
por debajo, que es exactamente para lo que está.

### ADR-0042 · Los cobros recurrentes generan el fichero, no mueven dinero
**Decisión.** Geminis guarda la forma de pago de cada alumno, sus datos
bancarios y su mandato; emite los recibos del mes; y produce el fichero SEPA
(pain.008.001.02) que la academia sube a su banco.
**Por qué no cobramos nosotros.** Mover dinero exige ser entidad de pago
autorizada por el Banco de España. Decir «cobramos» sin serlo sería mentir a la
academia y meterla en un problema.
**Reglas que se siguen.** No se cobra dos veces el mismo mes; quien no tiene
mandato firmado no entra en la remesa pero sí se le emite el recibo; los
primeros cobros y los recurrentes van en lotes separados, porque el banco
rechaza un lote que los mezcle.
**Un fallo que se coló y se corrigió.** La fecha de cobro se enviaba con
`toISOString()`, que en España resta un día. Un adeudo con la fecha equivocada
es un adeudo rechazado. Ahora hay `fechaParaInput()` en `lib/utils` y su
equivalente en el generador, y una prueba que lo fija.

### ADR-0043 · Una factura emitida no se edita ni se borra
**Decisión.** Se emite con número correlativo dentro de su serie y a partir de
ahí es inmutable. Si está mal, se emite una rectificativa con los importes en
negativo que la anula, con su motivo, y las dos quedan enlazadas.
**Por qué.** Lo exige el reglamento de facturación, y es lo único que da sentido
a una numeración correlativa: si se pudieran borrar, la numeración tendría
huecos y no probaría nada.
**Detalle que importa.** El número se reserva con `SELECT … FOR UPDATE` dentro
de una transacción. Sin el bloqueo, dos personas facturando a la vez se llevan
el mismo número.
**Sobre el IVA.** El tipo por defecto es 0 con su mención de exención, no el
21 %: la preparación de oposiciones suele estar exenta por el art. 20.Uno.9º de
la Ley del IVA. Se ofrece como opción y no se decide por la academia, porque
depende de la materia y hay servicios accesorios que sí tributan.

### ADR-0044 · La agenda crea sesiones reales, no reglas de repetición
**Decisión.** «Los lunes y miércoles hasta junio» genera una fila por clase, no
una regla que se expanda al leer.
**Por qué.** Son más filas, pero permiten lo que de verdad pasa en una academia:
mover la clase del 12 de octubre porque es festivo, cambiarle el profesor a una
sola, o anular la de Navidad. Con una regla, cada excepción es un caso especial
y acaban siendo más código y más fallos que las filas que ahorra.
**Tope.** 200 sesiones por serie. Pasado eso, casi seguro que alguien se ha
equivocado con la fecha final.

### ADR-0045 · Tres niveles y una frontera que no se cruza
**Decisión.** Superadministrador de plataforma → administrador de academia →
usuarios de la academia (profesorado, personal, alumnado).
**Lo que lo hace real.** El superadministrador **no pertenece a ninguna
academia**, y sin `Membership` no hay `tenantDb`, y sin `tenantDb` no hay datos.
No es una comprobación que se pueda olvidar: es que no existe el camino. Para
entrar en una academia tiene que impersonar, y eso queda registrado.
**Comprobado en la auditoría HTTP:** el superadministrador recibe una redirección
al pedir el alumnado o el contenido de una academia.

### ADR-0046 · Los datos bancarios se cifran en la propia columna
**Decisión.** El IBAN del alumnado y el de la academia se guardan cifrados con
AES-256-GCM y una clave del entorno (`FIELD_ENCRYPTION_KEY`), obligatoria en
producción.
**Por qué.** Protege del escenario realista: una copia de seguridad que se
pierde, un volcado que acaba donde no debe, o «pásame el dump para depurar
esto». No protege de un servidor comprometido, y decir lo contrario sería
mentir.
**Detalles que importan.** Vector de inicialización nuevo en cada cifrado, así
que dos IBAN iguales no se parecen en la base; y GCM autentica, así que una fila
manipulada no se descifra en lugar de devolver basura que parezca un número de
cuenta.

### ADR-0047 · El limitador de intentos cuenta en la base de datos
**Decisión.** Sustituye al contador en memoria del ADR-0016.
**Por qué.** Con varias instancias, un contador en memoria deja pasar tantos
intentos como instancias haya. Eso no es limitar, es aparentarlo.
**Detalle.** El incremento va en un solo `INSERT … ON CONFLICT`: veinte
peticiones simultáneas cuentan veinte, no una. Probado.

### ADR-0048 · Límite de sesiones por alumno, y se echa a la más antigua
**Decisión.** Cada academia fija cuántas sesiones simultáneas permite. Al
superarlo se cierra la más antigua, no se rechaza la nueva. Al profesorado no se
le limita.
**Por qué.** Compartir la cuenta es la primera fuga de ingresos de una academia.
Rechazar la sesión nueva castigaría al titular, que es quien acaba de escribir
su contraseña; cerrando la antigua, quien tenía la cuenta prestada se queda
fuera y el titular lo nota.

### ADR-0049 · Nunca dos condiciones sobre la misma clave en un `where` ⭐
**Decisión.** Cuando dos filtros afectan al mismo campo, se cruzan en una sola
lista antes de construir la consulta. Nunca se escriben como dos `...spread`
consecutivos.
**Por qué.** Es el origen del hallazgo H-07, el más grave del proyecto: el
filtro de lo contratado y el del tema pedido se escribieron como dos spreads
sobre `nodeId`, ganó el último, y la IA acabó citando temario no pagado. Las dos
líneas son válidas por separado y TypeScript no dice nada.
**Cómo se evita que vuelva.** `npm run ia:fuga` intenta la fuga desde cada nodo
de la academia con el alumno que menos ha contratado.
