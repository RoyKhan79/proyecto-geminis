# Auditoría de seguridad · septiembre de 2026

Revisión completa del código, no de la documentación. Todo lo que aquí se
afirma se ha comprobado ejecutándolo; lo que no se ha podido ejecutar se dice
expresamente y no se cuenta como comprobado.

---

## 1. Resumen ejecutivo

Geminis está mejor construido de lo que es habitual en un producto de este
tamaño. El aislamiento entre academias descansa en dos barreras independientes
que funcionan de verdad —se ha intentado romper con SQL crudo y no cede—, las
contraseñas usan scrypt con parámetros correctos, las sesiones son opacas y
revocables, y la recuperación de contraseña está escrita con el cuidado que
merece. Las 123 acciones de servidor comprueban sesión o permiso, una por una.

Dicho eso, se han encontrado **catorce problemas reales**, dos de ellos graves:

- una **contraseña de superadministrador escrita en cuatro archivos del
  repositorio** —incluidos los dos scripts de auditoría—, que cualquiera con
  acceso al código podía usar en un despliegue sembrado;
- un **XSS almacenado** aprovechable por cualquier profesor contra el alumnado
  de su academia, por una evasión del saneador de HTML.

Los dos están corregidos, con pruebas que los reproducen.

El patrón que se repite en casi todos los hallazgos no es descuido, es otro: hay
**medidas de seguridad correctas cuya cobertura se quedó atrás**. La migración
que activó Row Level Security enumeraba las 50 tablas que existían aquel día, y
las seis de facturación —las que guardan los IBAN— llegaron después. El script
de auditoría buscaba `requirePermission` en el texto del archivo, así que un
archivo con veinte acciones pasaba si una sola comprobaba. El comprobador de
despliegue daba luz verde a lo que no podía comprobar. Ninguna de esas piezas
estaba mal escrita: se habían quedado viejas sin que nada avisara.

Por eso, además de corregir, se han añadido las comprobaciones que faltaban para
que no vuelva a pasar en silencio: pruebas que comparan el esquema real con las
políticas y con las listas escritas a mano, y que fallan cuando aparece algo
nuevo sin cubrir.

**Veredicto: APTO CON CAMBIOS.** Los cambios pendientes son de despliegue, no de
código, y están en el apartado 10.

---

## 2. Vulnerabilidades encontradas

| ID | Severidad | Qué es | Estado |
|----|-----------|--------|--------|
| GEM-SEC-001 | 🔴 CRÍTICO | Contraseña de superadministrador en el repositorio | Corregido |
| GEM-SEC-002 | 🟠 ALTO | XSS almacenado: el saneador de HTML se puede rodear | Corregido |
| GEM-SEC-003 | 🟠 ALTO | Bomba de descompresión al importar Excel | Corregido |
| GEM-SEC-004 | 🟠 ALTO | Seis tablas con datos bancarios sin la segunda barrera | Corregido |
| GEM-SEC-005 | 🟠 ALTO | Las pruebas podían ejecutarse contra producción | Corregido |
| GEM-SEC-006 | 🟠 ALTO | Next.js 16.3.0 con vulnerabilidades conocidas | Corregido |
| GEM-SEC-007 | 🟡 MEDIO | La guardia no valida las claves foráneas al escribir | Corregido |
| GEM-SEC-008 | 🟡 MEDIO | `unsafe-inline` para scripts en la política de contenido | Corregido |
| GEM-SEC-009 | 🟡 MEDIO | La caché del dispositivo guardaba páginas del Campus | Corregido |
| GEM-SEC-010 | 🟡 MEDIO | IBAN completos en el HTML de dos pantallas | Corregido |
| GEM-SEC-011 | 🟡 MEDIO | La contraseña del superadmin viajaba por la línea de órdenes | Corregido |
| GEM-SEC-012 | 🟡 MEDIO | Sin límite de peticiones en la IA ni en la importación | Corregido |
| GEM-SEC-013 | 🟡 MEDIO | La clave de cifrado no se podía rotar | Corregido |
| GEM-SEC-014 | 🔵 HARDENING | Se aceptaba el tipo de archivo declarado por el navegador | Corregido |

Además, cinco defectos en los **propios scripts de auditoría**, que daban una
falsa sensación de cobertura. Están en el apartado 4.

---

## 3. Detalle de cada hallazgo

### GEM-SEC-001 · 🔴 CRÍTICO · Credenciales de superadministrador en el código

**Archivo:** `prisma/seed.ts`

**Problema.** La semilla llevaba escritas unas credenciales por defecto:

```ts
const SUPERADMIN_EMAIL = process.env.SUPERADMIN_EMAIL ?? "<un correo real>";
const SUPERADMIN_PASSWORD = process.env.SUPERADMIN_PASSWORD ?? "<contraseña real>";
```

Un valor por defecto en un archivo versionado no es un valor por defecto: es una
credencial pública. Cualquiera con acceso al repositorio —hoy o en el futuro,
porque sigue en el historial de git— conocía el correo y la contraseña del
superadministrador de cualquier despliegue donde se hubiera sembrado.

Agravante: `main()` empieza borrando la academia de demostración y todos los
usuarios `@academiademo.test`, y no había ninguna guarda que impidiera
ejecutarla contra producción. `npm run setup` la invoca.

**Escenario de explotación.** Alguien con acceso al código —un colaborador que
se va, una copia del repositorio, un fork— entra en `/plataforma` de cualquier
instalación sembrada con los valores por defecto. Desde ahí da de alta
academias, ve el estado del servicio e impersona a cualquier usuario de
cualquier academia.

**Impacto.** Compromiso total de la plataforma: escalada al nivel más alto y
acceso a los datos de todas las academias por impersonación.

**Solución aplicada.** Las credenciales solo vienen del entorno; sin ellas la
semilla no crea superadministrador y lo dice. Se añade `comprobarEntorno()`, que
aborta si `NODE_ENV=production` salvo que se escriba a mano
`PERMITIR_SEMILLA_EN_PRODUCCION=si`. El nombre incrustado se sustituye por uno
genérico.

**Y no estaba solo ahí.** Al ir a rotarla apareció que la misma contraseña
estaba escrita en dos sitios más:

- `scripts/auditoria.mjs`, en el inicio de sesión del superadministrador;
- `scripts/pentest.mjs`, dos veces: una para entrar y otra —peor— usándola como
  «la contraseña de otra persona» para comprobar que no se puede entrar con
  ella. Si algún día hubieran coincidido, esa prueba habría pasado por el motivo
  equivocado.

Un script de auditoría que publica una credencial no está auditando: está
abriendo una puerta. Los tres leen ahora `SUPERADMIN_EMAIL` y
`SUPERADMIN_PASSWORD` del entorno, y omiten expresamente las comprobaciones de
ese nivel si no están.

**Resuelto.** Con el permiso del propietario se generó una contraseña nueva
(4×6 caracteres base58, ~140 bits), se puso en el `.env` —que nunca se ha
versionado, comprobado en el historial— y se resembró la plataforma. La
contraseña anterior ya no sirve en ninguna instalación de este código.

Queda una nota para el equipo: la contraseña vieja **sigue en el historial de
git** y en `conversacion/peticiones-del-usuario.md`. Si se ha reutilizado en
algún otro servicio, hay que cambiarla también allí.

---

### GEM-SEC-002 · 🟠 ALTO · XSS almacenado por evasión del saneador

**Archivo:** `src/lib/sanitize.ts`

**Problema.** El saneador buscaba etiquetas con una expresión regular y filtraba
los atributos de las que encontraba. El fallo no era un descuido, sino la
consecuencia inevitable del método: **lo que la expresión no reconocía como
etiqueta salía intacto**. Comprobado ejecutándolo:

```
"<img/src=x onerror=alert(1)>"        → "<img/src=x onerror=alert(1)>"
"<div/onmouseover=alert(1)>hola</div>" → "<div/onmouseover=alert(1)>hola</div>"
```

La barra hace de separador de atributos para el navegador, que ejecuta el
`onerror`; para la expresión regular no era una etiqueta y por eso ni se tocaba.

**Escenario de explotación.** Un profesor —o cualquiera con `content.write`, o
una cuenta de profesor comprometida— escribe eso en el texto enriquecido de un
tema. El contenido se pinta con `dangerouslySetInnerHTML` en
`src/app/campus/estudiar/[nodeId]/page.tsx`. Cada alumno que abra el tema
ejecuta ese script con su sesión; también el administrador que revise el
contenido. La cookie es `httpOnly`, así que no se roba directamente, pero el
script puede hacer peticiones autenticadas: leer datos, cambiar el correo de la
cuenta, invitar usuarios.

**Impacto.** Escalada de privilegios dentro de una academia y acceso a los datos
de cualquiera que abra el contenido.

**Solución aplicada.** Reescrito como recorrido carácter a carácter con la regla
de fallo invertida: **lo que no se entiende se escapa, nunca se copia**. Entiende
comillas —un `>` dentro de un atributo ya no corta el análisis—, barras y
espacios entre atributos, y salta el cuerpo entero de las etiquetas cuyo
contenido no es HTML. El escapado de `&` respeta las entidades ya escritas para
que sanear dos veces —al guardar y al pintar— siga siendo idempotente.

**Prueba añadida.** `tests/sanitize.test.ts`: 45 casos, 33 de ellos de evasión.

---

### GEM-SEC-003 · 🟠 ALTO · Bomba de descompresión al importar Excel

**Archivos:** `src/server/imports/parse.ts`, `actions.ts`, `question-actions.ts`

**Problema.** El único control era `if (file.size > 10 MB)`, y después el buffer
iba directo a `workbook.xlsx.load()`, que descomprime el archivo entero en
memoria sin ningún tope. Un `.xlsx` es un ZIP: el tamaño que importa no es el
del archivo sino el de lo que sale al abrirlo.

**Escenario de explotación.** Cualquiera con `imports.run` —el rol STAFF lo
tiene— sube un XLSX de unos cientos de kilobytes que se expande a cientos de
megas. El proceso de Node reserva la memoria y muere. Con él se cae el servidor
de **todas las academias**, no solo la de quien lo subió. Se puede repetir.

**Impacto.** Denegación de servicio para toda la plataforma, desde una cuenta
de personal administrativo.

**Solución aplicada.** `src/server/imports/zip-seguro.ts`, que inspecciona el
archivo antes de que ExcelJS vea un byte: firma de ZIP, rechazo de ZIP64,
número de entradas, tamaño declarado por entrada y total, proporción de
compresión, nombres de entrada, y —lo que de verdad cierra el asunto—
**descompresión real con `maxOutputLength`**. Todo lo anterior son cifras que
declara el propio archivo y en las que se puede mentir; en `inflateRaw` no.

**Prueba añadida.** `tests/import-zip.test.ts`: construye los ZIP hostiles byte
a byte, incluido uno que miente sobre su tamaño en las cabeceras.

---

### GEM-SEC-004 · 🟠 ALTO · Tablas de facturación sin Row Level Security

**Archivo:** `prisma/migrations/20260901120000_rls_facturacion/migration.sql`

**Problema.** La migración que activó RLS enumeraba a mano las 50 tablas que
existían aquel día. Después llegaron la facturación, las remesas y los cobros
recurrentes, y ninguna de sus migraciones activó las políticas. Seis tablas se
quedaron con una sola barrera:

`billing_profiles` · `recurring_charges` · `direct_debit_runs` ·
`invoice_series` · `invoices` · `invoice_lines`

Es decir: precisamente las que guardan los números de cuenta del alumnado, los
mandatos SEPA y las facturas.

**Impacto.** No hay constancia de fuga —la guardia de aplicación seguía
filtrando— pero la promesa escrita en `SECURITY_MODEL.md` era de dos barreras y
sobre los datos más sensibles del producto había una. Cualquier `$queryRaw`
sobre esas tablas, o un fallo futuro en la guardia, no habría tenido nada
debajo.

**Solución aplicada.** Migración que activa `ENABLE` + `FORCE` y crea la política
de aislamiento con `USING` y `WITH CHECK` en las seis. Verificado: `npm run
rls:probar` informa ahora de **57 políticas activas y 57 tablas con FORCE**.

**Prueba añadida.** `tests/rls.test.ts` compara el esquema de Prisma con las
políticas reales de PostgreSQL y falla nombrando la tabla que falte. Sustituye a
una lista escrita a mano que nadie iba a releer.

---

### GEM-SEC-005 · 🟠 ALTO · Las pruebas podían ejecutarse contra producción

**Archivos:** `tests/setup.ts`, `tests/base-de-pruebas.ts`

**Problema.** La suite crea academias y usuarios y, al terminar, ejecuta
`academy.deleteMany` y `user.deleteMany`. El borrado de una academia arrastra en
cascada todo lo que cuelga de ella. Lo único que decidía sobre qué base se
ejecutaba todo eso era el valor de `DATABASE_URL` en ese momento.

**Escenario de explotación.** No hace falta mala fe: una terminal donde se
exportó la cadena de producción para depurar algo, un `.env` copiado de un
servidor, o un paso de integración continua mal configurado.

**Impacto.** Pérdida total de datos.

**Solución aplicada.** La comprobación se hace al cargar el archivo de
preparación, así que ninguna prueba llega a ejecutarse. La pregunta que se hace
no es «¿parece de producción?» —una lista de sospechas siempre se queda corta—
sino «¿se puede afirmar que es de desarrollo?». Anfitrión local **y** nombre
reconocible. Hay una salida explícita, `GEMINIS_BASE_DE_PRUEBAS=confirmo`, que
hay que escribir a mano.

**Verificado ejecutándolo** contra una URL de producción simulada: la suite se
niega y explica por qué.

**Prueba añadida.** `tests/base-de-pruebas.test.ts`: 14 casos, con las dos
mitades del asunto —que no pase lo que no debe, y que siga pasando lo que sí—.

---

### GEM-SEC-006 · 🟠 ALTO · Next.js 16.3.0

Actualizado a **16.3.4** (la última publicada), junto con `eslint-config-next`.
`npm run verificar` pasa entero: lint, tipos, 432 pruebas y compilación.

Se aprovechó para resolver los dos avisos de dependencias sin degradar nada:

- **deepmerge-ts 7.1.5** (severidad alta, vía `prisma` → `@prisma/config`).
  `npm audit fix --force` proponía **bajar Prisma a la versión 6**, que habría
  roto el proyecto. En su lugar, un `override` a `^8.0.2`. Comprobado que
  `prisma validate` y `prisma migrate status` siguen funcionando.
- **uuid 8.3.2** (severidad moderada, vía `exceljs`). El aviso afecta a `v3/v5/v6`
  cuando se pasa `buf`; ExcelJS solo usa `v4`, así que no era explotable aquí.
  Se resuelve igualmente con un `override` a `^11.1.1`, verificando que ExcelJS
  sigue leyendo y escribiendo XLSX.

`npm audit` informa ahora de **0 vulnerabilidades**.

---

### GEM-SEC-007 · 🟡 MEDIO · La guardia no validaba las claves foráneas

**Archivos:** `src/lib/db/tenant.ts`, `src/lib/db/tenant-relations.ts`

**Problema.** Encontrado escribiendo pruebas de escritura cruzada. Esto
funcionaba:

```ts
dbDeLaAcademiaA.oppositionEdition.create({
  data: { oppositionId: <id de una oposición de B>, name: "2026" },
})
```

Y funcionaba en las dos barreras a la vez: la guardia mira a qué registro apunta
un `where`, y al crear no hay tal registro; y la política de PostgreSQL acepta la
fila porque la fila es legítima —de A—, mientras que la integridad referencial se
comprueba saltándose RLS por diseño.

**Impacto.** Una fila de A colgada de datos de B. Con un
`include: { opposition: true }` de por medio, lectura cruzada.

**No era explotable hoy:** todas las acciones cargan el padre con `ctx.db` antes
de usarlo, y ahí sí se filtra. Pero eso es disciplina, no barrera.

**Solución aplicada.** La guardia comprueba cada clave foránea contra la academia
del contexto, en `create`, `createMany`, `update`, `updateMany` y `upsert`. Las
consultas se agrupan por modelo destino, así que un `create` con tres claves al
mismo modelo cuesta una consulta.

**Pendiente anotado:** lo ideal sería que la base de datos lo hiciera imposible,
con claves compuestas `(academyId, oppositionId) → oppositions(academyId, id)`.
Son 108 claves que reescribir; es un proyecto, no una corrección.

**Pruebas añadidas.** `tests/tenant-escritura.test.ts` (9 formas de intentar
escribir fuera de la academia) y `tests/tenant-relaciones.test.ts`, que compara
la lista con el esquema para que no se quede vieja.

---

### GEM-SEC-008 · 🟡 MEDIO · `unsafe-inline` para scripts

**Archivos:** `src/proxy.ts` (nuevo), `next.config.ts`

**Problema.** La política decía `script-src 'self' 'unsafe-inline'`. Con eso la
política **no protege de un XSS**: si alguien mete un `<script>` en la página, el
navegador lo ejecuta porque la propia política le ha dicho que los scripts en
línea valen. Era la defensa de fondo bajo el saneador, y cuando se encontró la
forma de rodear el saneador (GEM-SEC-002), debajo no había nada.

**Solución aplicada.** Se consultó la documentación de la versión instalada
(`node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md`), que
para Next 16 usa la convención `proxy.ts` —`middleware.ts` está obsoleto—. Cada
petición lleva ahora su propio testigo aleatorio, con `strict-dynamic`. Las
cuatro páginas que se prerenderizaban pasan a dinámicas: una página generada en
la compilación no puede llevar un testigo que aún no existía.

`style-src` conserva `unsafe-inline` y queda anotado como pendiente: la interfaz
usa atributos `style` y esos no los cubre un testigo. El riesgo no es comparable.

Las respuestas de `/api` llevan una política aparte y más cerrada, con
`script-src 'none'`: ninguna es un documento con scripts, y eso da una capa más
al servicio de archivos.

**Verificado contra el servidor:** la cabecera llega con el testigo y **los 18
scripts de la página tienen el suyo**.

---

### GEM-SEC-009 · 🟡 MEDIO · La caché del dispositivo guardaba el Campus

**Archivos:** `public/sw.js`, `src/lib/campus/salida-limpia.ts` (nuevo)

**Problema.** El trabajador de servicio cacheaba la navegación de toda ruta que
no fuera `/api/`, `/gestion` o `/entrar`. **`/campus` no estaba en esa lista** —y
es LA pantalla del alumno: sus notas, sus mensajes, su nombre—. Además,
`/campus` estaba en la precarga de instalación, y al cerrar sesión no se borraba
ninguna caché.

**Escenario de explotación.** Los ordenadores del aula de una academia los usan
veinte personas al día. Basta que al siguiente le falle la red un segundo para
que la caché le sirva la página del anterior.

**Solución aplicada.** Lista de rutas privadas ampliada con `/campus`,
`/plataforma`, `/inicio`, `/elegir-academia`, `/pagar`, `/recuperar` y
`/verificar`; `/campus` fuera de la precarga; y limpieza al cerrar sesión, por
dos vías —mensaje al trabajador de servicio y borrado directo— para que funcione
aunque esté parado. Los botones de salir de Manager y de la consola de
plataforma pasan a `BotonCerrarSesion`, que limpia antes de salir; el del Campus
ya vaciaba la mochila y ahora vacía también la caché de navegación.

---

### GEM-SEC-010 · 🟡 MEDIO · IBAN completos en el HTML

**Archivos:** `src/app/gestion/pagos/remesas/acreedor.tsx`,
`src/app/gestion/alumnos/[id]/billing-form.tsx`, `src/server/students/queries.ts`

**Problema.** Lo encontró `npm run pentest`: la cuenta de cobro de la academia
bajaba entera al navegador en el `defaultValue` de un formulario que se pinta en
una pantalla de listado. Mirando alrededor apareció el caso peor: la ficha del
alumno hacía lo mismo con **su** cuenta y además la reenviaba en un
`<input type="hidden">` aunque nadie estuviera tocando la domiciliación.

**Impacto.** No es escalada de privilegios —hay que tener `payments.write`— pero
es un dato bancario donde no tiene por qué estar: en el HTML, en la caché del
navegador, en cualquier captura de pantalla y al alcance de un script.

**Solución aplicada.** A la pantalla baja solo la máscara (`ES91 •••• •••• 1332`).
El campo llega vacío y **vacío significa «no cambies la cuenta»**; para quitarla
hay una casilla explícita. Ese detalle importa más que el resto: si vacío
siguiera significando «bórralo», guardar la ficha tras cambiar un teléfono
dejaría al alumno sin domiciliación, y el fallo aparecería semanas después, el
día de la remesa.

**Prueba añadida.** `tests/iban-exposicion.test.ts`, con las dos mitades: que el
número no sale, y que la domiciliación no se pierde.

---

### GEM-SEC-011 · 🟡 MEDIO · Contraseña por la línea de órdenes

**Archivo:** `scripts/superadmin.ts`

La contraseña se pasaba como `process.argv[3]`, así que quedaba en el historial
del intérprete, la veía cualquiera que hiciera `ps` mientras corría, y acababa
en los registros del sistema y en las herramientas de monitorización.

Ahora se pide por teclado con el eco apagado, se pide dos veces, y se admite
`SUPERADMIN_PASSWORD` para automatizar. Se añadieron de paso validación de
correo, rechazo de contraseñas previsibles, y un aviso al pantalla cuando una
cuenta **asciende** a superadministrador o cuando ya pertenece a alguna academia.

---

### GEM-SEC-012 · 🟡 MEDIO · Sin límite en la IA ni en la importación

**Archivos:** `src/lib/rate-limit.ts`, `src/server/ai/actions.ts`,
`src/server/imports/*.ts`

El limitador estaba donde se ve el ataque de manual —entrar, recuperar la
contraseña— y en ningún sitio más. Una pregunta a Geminis IA llama a un
proveedor externo y **la paga la academia por tokens consumidos**: un alumno con
el tutor incluido y un bucle de tres líneas puede gastarle el presupuesto del
mes en una tarde. Se añaden topes por persona a las cuatro acciones de IA y a la
subida de archivos de importación, generosos a propósito para que estorben a un
bucle y no a una persona.

---

### GEM-SEC-013 · 🟡 MEDIO · La clave de cifrado no se podía rotar

**Archivos:** `src/lib/crypto/field.ts`, `scripts/rotar-clave.ts` (nuevo)

`env.ts` mencionaba un `npm run cifrar:rotar` **que no existía**, y el descifrado
usaba una sola clave: cambiar `FIELD_ENCRYPTION_KEY` dejaba todos los IBAN
ilegibles para siempre. Una clave que no se puede rotar es una clave que,
comprometida, se queda.

Ahora se descifra probando la actual y después `FIELD_ENCRYPTION_KEY_ANTERIOR`,
y se cifra siempre con la actual. Eso permite rotar sin parar el servicio y sin
que nada quede ilegible. El script recorre los cuatro campos cifrados del
producto —IBAN del alumnado, IBAN de la academia, IBAN de acreedor y **clave del
TPV**—, admite `--simular`, y no toca lo que ya está con la clave nueva.

**Prueba añadida.** `tests/rotacion-clave.test.ts`: 9 casos que recorren el paso
de una clave a otra, incluida la retirada de la vieja.

**Ejecutada de verdad.** Con el permiso del propietario se rotó la clave sobre
la base de desarrollo, siguiendo el procedimiento completo:

| Paso | Resultado |
|------|-----------|
| Simulación previa (`--simular`) | 22 valores, **0 ilegibles** — confirma que la clave anterior era la correcta |
| Rotación | 22 reescritos con la clave nueva |
| Retirada de `FIELD_ENCRYPTION_KEY_ANTERIOR` | 0 por reescribir, **0 ilegibles** |
| Comprobación posterior | Los IBAN se descifran y **validan el dígito de control**; los datos nuevos se cifran ya con la clave actual |

De paso se resolvió un problema que arrastraba la base: **20 IBAN estaban
guardados en claro** (los había escrito una versión antigua de
`probar-remesa.ts` saltándose la capa de cifrado). La rotación los cifró. El
requisito «Ningún dato bancario en claro» de `npm run desplegar:comprobar` pasa
ahora de ✗ a ✓.

---

### GEM-SEC-014 · 🔵 HARDENING · Se aceptaba el tipo declarado

**Archivo:** `src/lib/storage/index.ts`

`isAllowedMime(file.type)` filtraba una etiqueta que pone el navegador a partir
de la extensión: renombrar `algo.html` a `algo.pdf` bastaba para que llegara como
`application/pdf`. Con `nosniff` y la nueva `script-src 'none'` en `/api` el
archivo no llegaría a ejecutarse, pero eso son capas de entrega y esto es de
entrada.

Se añade `motivoParaNoAceptar()`, que mira los bytes: firmas de los formatos
admitidos, y rechazo explícito de HTML, SVG, ejecutables y guiones de consola
aunque vengan con una etiqueta inocente.

---

## 4. Los propios scripts de auditoría

El encargo pedía expresamente buscar falsos positivos de seguridad aquí. Había
cinco, y no eran menores: son los que decidían si el proyecto «pasaba».

1. **`auditoria-interna.mjs` miraba archivos, no funciones.** Buscaba
   `requirePermission` en el texto del archivo entero, así que un archivo con
   veinte acciones donde **una sola** comprobara pasaba con las otras diecinueve
   sin mirar. Ahora se parte por cada `export async function` y se comprueba el
   cuerpo de cada una: **123 acciones, una a una**. Todas pasan.

2. **La política de contenido se comprobaba con `config.includes("Content-Security-Policy")`.**
   Ese ✓ se cumplía igual con `script-src 'unsafe-inline'`, que es exactamente la
   que no protege. Ahora se comprueba que los scripts van con testigo, que no
   queda `unsafe-inline`, que `unsafe-eval` solo está en desarrollo, y que
   `/api` no puede ejecutar scripts.

3. **La auditoría leía los comentarios.** Al corregir lo anterior, la
   comprobación fallaba porque `proxy.ts` **explica en su cabecera** el fallo que
   se corrigió, y esa frase contenía el texto prohibido. Escribir bien la
   documentación de un fallo lo reintroducía a ojos del script. Ahora se quitan
   los comentarios antes de analizar.

4. **`auditoria.mjs` gritaba fuga cuando faltaban datos.** Cuatro comprobaciones
   valían `0 < 0` con la demo vacía y salían como FALLO. Un informe que dice «el
   alumno alcanza secciones que no ha pagado» cuando no hay ni una sección es
   falso, y quien lo vea fallar siempre por lo mismo dejará de mirarlo. Ahora
   existe el estado OMITIDO, que se cuenta y se explica aparte.

5. **`comprobar-despliegue.ts` daba luz verde a lo que no comprobaba.** Tres
   puntos llevaban `|| !isProduction`, así que el informe se leía:

   ```
   ✓ La dirección pública usa HTTPS
       http://localhost:3000
   ✓ Sin datos de demostración
       24 cuentas de demostración con contraseña conocida
   ```

   Dos marcas verdes junto a un detalle que dice lo contrario. La intención era
   buena; el efecto es que el script que decide si un despliegue es apto daba el
   visto bueno justo cuando no se ejecutaba contra el despliegue. Ahora salen
   con `~` y **no se da el visto bueno** hasta pasarlo con `NODE_ENV=production`.

Una comprobación defectuosa que hay que mencionar aparte, porque medía otra
cosa: `temasOtro !== temasEnIa` pretendía verificar que cada alumno ve en la IA
solo su alcance, comparando **dos números**. Dos alumnos con packs distintos del
mismo tamaño la habrían hecho fallar sin que nada estuviera mal; y dos alumnos
viendo exactamente los mismos temas —que sería la fuga— la habrían pasado. Ahora
compara los conjuntos de identificadores.

---

## 5. Pruebas añadidas

11 archivos nuevos, de 285 pruebas a **432**. Todas negativas salvo las que
verifican que el escenario tiene datos —sin esas, una suite verde no demuestra
nada—.

| Archivo | Qué intenta romper |
|---------|--------------------|
| `tests/sanitize.test.ts` | 33 evasiones del saneador de HTML |
| `tests/import-zip.test.ts` | Bombas de descompresión y archivos disfrazados |
| `tests/rls.test.ts` | Que no falte ninguna tabla en las políticas |
| `tests/tenant-escritura.test.ts` | 9 formas de escribir en otra academia |
| `tests/tenant-relaciones.test.ts` | Que la lista de claves foráneas no envejezca |
| `tests/ia-ataque.test.ts` | Inyección de instrucciones y material no contratado |
| `tests/iban-exposicion.test.ts` | Que el IBAN no salga, y que no se pierda |
| `tests/recuperacion-ciclo.test.ts` | Doble uso, caducidad, sesiones tras el cambio |
| `tests/rotacion-clave.test.ts` | El paso de una clave de cifrado a otra |
| `tests/subidas.test.ts` | Archivos disfrazados y nombres con rutas |
| `tests/base-de-pruebas.test.ts` | Que la suite no corra contra producción |

---

## 6. Comandos ejecutados y resultado real

Todo lo de esta tabla se ha ejecutado con la demo **completamente sembrada** y
el superadministrador configurado, así que no queda ninguna comprobación sin
lanzar.

| Comando | Resultado |
|---------|-----------|
| `npm run lint` | Limpio |
| `npm run typecheck` | Limpio |
| `npm test` | **432 pruebas, 30 archivos, todas pasan** |
| `npm run build` | Correcto con Next 16.3.4 |
| `npm audit` | **0 vulnerabilidades** |
| `npm run auditoria:interna` | **41 de 41**, sin fallos · comprueba las 123 acciones una a una |
| `npm run auditoria:http` | **47 de 47**, sin fallos y **sin omisiones** |
| `npm run pentest` | **43 ataques repelidos, 0 con éxito**, ninguno sin lanzar |
| `npm run ia:fuga` | **32 nodos probados**; el alumno restringido recupera **0 fragmentos** |
| `npm run rls:probar` | **57 políticas activas y forzadas**; SQL crudo no cruza academias |
| `npm run rls:concurrencia` | 200 consultas simultáneas, ninguna vio datos ajenos |
| `npm run dispositivos:probar` | El límite de sesiones funciona |
| `npm run facturas:probar` | Numeración correlativa, sin duplicados, rectificativas correctas |
| `npm run remesa:probar` | Fichero SEPA válido en las 6 comprobaciones de formato |
| `npm run cifrar:rotar` | **Rotación completa: 22 valores, 0 ilegibles** |
| `npm run desplegar:comprobar` | **5** requisitos pendientes, todos de infraestructura |

### Lo que apareció al sembrar la demo

Las cinco comprobaciones que antes no se podían lanzar destaparon **dos defectos
más en los propios scripts**, ninguno en el producto:

1. **`auditoria.mjs` exigía un 403 al descargar un documento**, bajo el título
   «la descarga se deniega si la academia no la permite». Pero no comprobaba en
   ningún sitio que la academia no la permitiera: daba por supuesta una
   configuración. En cuanto la demo se sembró con el temario descargable —que es
   lo normal— empezó a informar de una fuga donde había un permiso concedido a
   propósito. Verificado en la base: `downloadable: true` y la alumna con
   derecho `DOWNLOAD_CONTENT`. Reescrita para comprobar la regla de seguridad
   real: quien no tiene el contenido contratado no lo descarga, permita lo que
   permita la academia.

2. **Los dos scripts se lanzan con `node` a secas, sin `--env-file`**, así que
   no veían las credenciales del superadministrador que acababan de dejar de
   estar escritas a mano. Cargan el `.env` ellos mismos.

Con eso, `auditoria:http` pasa de 42/3 fallidas/4 omitidas a **47 de 47 sin
omisiones**, y `pentest` de 38 a **43 ataques**, incluidos los cinco que nunca se
habían llegado a lanzar: mochila sin conexión del alumno restringido, descarga a
mano de temas que no están en su mochila, y simulacros de otra oposición.

**Un aviso práctico:** pasar `auditoria` y `pentest` seguidos agota el limitador
de intentos por IP (20 cada 10 minutos) y la segunda tanda falla los inicios de
sesión. Ocurrió dos veces durante esta auditoría y las dos parecía una
regresión. No lo era: era el limitador funcionando.

**Un aviso práctico:** pasar `auditoria` y `pentest` seguidos agota el limitador
de intentos por IP (20 cada 10 minutos) y la segunda tanda falla los inicios de
sesión. Ocurrió durante esta auditoría y parecía una regresión. No lo era: era el
limitador funcionando.

---

## 7. Dependencias actualizadas

| Paquete | Antes | Después | Motivo |
|---------|-------|---------|--------|
| `next` | 16.3.0 | **16.3.4** | Vulnerabilidades conocidas |
| `eslint-config-next` | 16.3.0 | **16.3.4** | A la par |
| `deepmerge-ts` (transitiva) | 7.1.5 | **^8.0.2** vía `overrides` | Agotamiento de pila (alta) |
| `uuid` (transitiva de exceljs) | 8.3.2 | **^11.1.1** vía `overrides` | Límites de buffer (moderada) |

`exceljs`, `prisma` y `@prisma/client` **no se han tocado**: las degradaciones
que proponía `npm audit fix --force` habrían roto el proyecto.

---

## 8. Arquitectura multi-tenant

**Sí, se puede afirmar razonablemente que una academia no puede leer ni
modificar datos de otra.** No por lo que dice la documentación, sino por lo que
se ha comprobado ejecutándolo:

- La guardia de aplicación intercepta todas las operaciones y falla cerrando
  ante cualquier operación de Prisma que no contemple.
- Debajo, 57 políticas de PostgreSQL con `FORCE` y `WITH CHECK`, sobre un rol de
  aplicación sin `BYPASSRLS`. `npm run rls:probar` intenta leer, escribir y
  borrar datos ajenos con SQL crudo, saltándose la guardia, y no lo consigue.
- 200 consultas simultáneas de dos academias no se contaminan entre sí.
- Se han intentado nueve formas de escribir fuera de la academia, incluidas las
  tres que no pasan por pedir un identificador ajeno. La que funcionaba —enlazar
  con una clave foránea— está corregida.
- Los archivos tienen su propia segunda barrera: la clave de todo objeto empieza
  por su academia y se comprueba antes de devolver un byte.

Con una salvedad honesta: la comprobación de claves foráneas vive en la
aplicación, no en la base de datos. Lo definitivo serían claves compuestas con
`academyId`, y eso está pendiente.

---

## 9. Inteligencia artificial

**No, un alumno no puede obtener material no contratado a través de Geminis IA.**

El diseño es el correcto y es la razón por la que aguanta: **el filtro va antes
de buscar, no después**. La recuperación resuelve primero qué nodos puede ver esa
persona —derechos de acceso, ritmo del temario, fuentes autorizadas— y solo
entonces busca dentro de ellos. El material prohibido nunca sale de la base de
datos, así que no hay nada que el modelo pueda filtrar por mucho que se le
insista.

**La prueba definitiva, ejecutada sobre la demo sembrada** (`npm run ia:fuga`):
con el temario real indexado, el alumno con el curso completo recupera **6
fragmentos** y el que solo tiene el pack de tests recupera **0**. Y no es un caso
suelto: se probaron **los 32 nodos de la academia** como punto de partida, uno a
uno, y ninguno devuelve material que ese alumno no tenga contratado.

Comprobado además en `tests/ia-ataque.test.ts`, que monta su propio escenario y
no depende del estado de la base, con una prueba positiva que confirma que quien
sí ha pagado recupera el texto —sin ella, las diez negativas no demostrarían
nada—:

- pedir el material con sus palabras exactas: nada;
- apuntar al identificador del tema: nada;
- apuntar a la sección padre —el fallo H-07, que fue real—: nada;
- cinco formas de escribir la pregunta como una orden al modelo: nada;
- desde otra academia, con y sin identificador ajeno: nada.

Sobre lo que sale del servidor: el gateway llama a URLs fijas de Anthropic y
OpenAI y solo envía los fragmentos recuperados y la pregunta. Se ha verificado
que el contexto **no lleva el nombre, el correo, el identificador ni los datos de
pago** del alumno.

---

## 10. Preparación para producción

### **APTO CON CAMBIOS**

El código está en condiciones. Lo que falta es de despliegue, y
`npm run desplegar:comprobar` lo enumera y **se niega a dar el visto bueno**
hasta que esté resuelto:

**Ya resuelto durante esta auditoría, con permiso del propietario:**

- ✅ **`FIELD_ENCRYPTION_KEY` rotada**, con el procedimiento completo y sin dejar
  nada ilegible. De paso se cifraron 20 IBAN que estaban en claro.
- ✅ **Contraseña del superadministrador cambiada** y sacada de los cuatro
  archivos del repositorio donde estaba escrita.
- ✅ **`AUTH_SECRET` configurado** con un valor aleatorio. Antes no estaba en el
  `.env`, así que se usaba el de desarrollo, que está en el repositorio.

**Sigue pendiente antes de poner datos reales de alumnos.** Todo es
infraestructura, nada es código, y `npm run desplegar:comprobar` lo enumera:

1. **SMTP**, o nadie podrá recuperar su contraseña.
2. **Copias de seguridad programadas, y restaurar una al menos una vez.** Una
   copia que no se ha restaurado nunca no es una copia.
3. **Cifrado del disco de la base de datos** y **del almacén de archivos** (SSE
   en el bucket).
4. **Cron** del radar del BOE y del mantenimiento diario.
5. **Borrar los datos de demostración** de cualquier base con datos reales. Las
   cuentas `@academiademo.test` llevan una contraseña publicada en el README.

### Riesgos que quedan abiertos

| Riesgo | Por qué se acepta |
|--------|-------------------|
| Sin segundo factor | Es la limitación que más pesa: la cuenta de un administrador de academia puede exportar todos sus datos. Es trabajo de producto, no una corrección. |
| `style-src 'unsafe-inline'` | Quitarlo exige sacar los atributos `style` de la interfaz. Con CSS en línea se afea una página; con JavaScript se roba una sesión. |
| Claves foráneas sin `academyId` compuesto | La comprobación está en la aplicación y probada. Lo definitivo son 108 claves reescritas. |
| `/_not-found` sigue estática | Su HTML se sirve igual; solo no hidrata. Es la página de 404. |
| La lista de campos cifrados en `rotar-clave.ts` se escribe a mano | Un campo cifrado nuevo que no se añada se quedaría con la clave vieja. Anotado en el propio archivo. |

### Lo que no se ha encontrado

Se buscó y **no hay**: inyección SQL (todo parametrizado o vía Prisma), SSRF (las
URL salientes son fijas: BOE, Anthropic, OpenAI), inyección de comandos (`spawn`
con argumentos en array, sin shell), open redirect (no hay ningún parámetro de
redirección), inyección de fórmulas en CSV (la exportación es JSON; no se genera
ningún CSV), ni acciones de servidor sin comprobación de permisos.

Los importes de los pagos salen siempre de la base de datos, nunca del
navegador. La notificación de Redsys verifica la firma con la clave de la
academia correcta y **no da nada por cobrado mientras el TPV esté en pruebas**,
que es un detalle que mucha gente pasa por alto.

---

*Auditoría realizada sobre el estado del repositorio a 1 de septiembre de 2026.*
