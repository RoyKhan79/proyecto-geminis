# Modelo de seguridad

Geminis guarda el trabajo de años de una academia y los datos personales de sus
alumnos. Este documento describe lo que impide que eso se filtre, y también lo
que todavía no cubre.

---

## 1. Aislamiento entre academias

### La barrera

Toda tabla con datos de una academia lleva `academyId`. Pero la columna sola no
protege: lo que protege es que nadie pueda consultar sin ella.

`tenantDb(academyId)` (`src/lib/db/tenant.ts`) devuelve un cliente Prisma que
intercepta **todas** las operaciones:

| Operación | Qué hace la guardia |
|-----------|---------------------|
| `findMany`, `findFirst`, `count`, `aggregate`, `groupBy` | Añade `academyId` al `where` |
| `findUnique`, `findUniqueOrThrow` | Lo reescribe como `findFirst` con `academyId`. Buscar por id un registro de otra academia devuelve «no encontrado», nunca el registro |
| `create`, `createMany` | Fija `academyId`. Si el código intentaba escribir otro, **lanza error** |
| `update`, `delete`, `upsert` | Comprueba la propiedad antes de ejecutar nada |
| `updateMany`, `deleteMany` | Añade `academyId` al `where` |
| Cualquier otra | Se bloquea. Preferimos romper a dejar pasar algo sin filtrar |

Un modelo que no esté clasificado como global ni de tenant hace fallar la
consulta. Olvidarse de registrar un modelo nuevo no puede acabar en una fuga
silenciosa.

### El centinela `SIN_TENANT`

`academyId` tiene `@default("SIN_TENANT")`, un valor que no existe como academia
(ADR-0017). No es un dato: hace que TypeScript no obligue a escribir `academyId`
en cada create (lo pone la guardia) y que cualquier escritura que se salte la
guardia sea rechazada al instante por PostgreSQL con un error que dice
literalmente `SIN_TENANT`. Falla pronto y falla claro.

### Modelos derivados

`StudentProfile`, `TeacherProfile`, `ContentResource`, `ContentNodeVersion`,
`RolePermission`, `MembershipRole` y `EntitlementScope` no llevan `academyId`
porque cuelgan de un padre que sí está protegido. Consultarlos desde un cliente
de academia lanza error a propósito: hay que llegar a ellos por su padre. Para
escribir en ellos se usa `prismaBase` desde un caso de uso que ya ha comprobado
la propiedad del padre.

### Escrituras anidadas

Las escrituras anidadas (`create: { hijos: { create: [...] } }`) **no** pasan por
la guardia para los hijos. Por eso, para cualquier modelo de tenant, los hijos
se crean en su propia llamada. Está señalado en el código donde importa.

### Qué lo comprueba

`tests/tenancy.test.ts` crea dos academias reales y verifica que ninguna alcanza
a la otra: leer, contar, actualizar, borrar y borrar en masa. Además compara la
lista de modelos de tenant contra las columnas reales de PostgreSQL, así que
añadir un modelo con `academyId` y olvidar registrarlo rompe la suite.

### Segunda barrera: Row Level Security

Todavía **no** está activa. La guardia de aplicación es la primera línea; RLS en
PostgreSQL sería la segunda, para el caso de que alguien acceda a la base por
fuera de la aplicación. Requiere ejecutar cada petición dentro de una
transacción con `SET LOCAL app.academy_id`, lo que tiene coste y complejidad.
Está previsto para la fase 2. Se documenta aquí para que no se dé por hecho.

---

## 2. Autenticación

- **Contraseñas**: scrypt de `node:crypto` con N=65536, r=8, p=1 y sal aleatoria
  de 16 bytes. El formato guarda los parámetros, así que subir el coste en el
  futuro no invalida las contraseñas existentes; al entrar, las antiguas se
  rehashean solas. Comparación con `timingSafeEqual`.
- **Sesiones**: token opaco de 32 bytes aleatorios en cookie `httpOnly`,
  `sameSite=lax` y `secure` en producción. En la base de datos solo se guarda su
  SHA-256: quien leyera la tabla `sessions` no podría suplantar a nadie.
- **Revocación**: al ser sesiones en base de datos, se pueden cerrar al instante
  (impago, cuenta compartida, baja) y se registran IP y dispositivo.
- **Renovación deslizante**: pasada la mitad de su vida, una sesión en uso se
  renueva sola. Las abandonadas caducan.
- **Mensajes de error**: iguales para «correo inexistente» y «contraseña
  incorrecta». Decir cuál falla permitiría averiguar qué correos están de alta.
- **Límite de intentos**: 8 por cuenta y 20 por IP cada 10 minutos.

### Limitaciones conocidas

- El limitador es en memoria del proceso (ADR-0016): con varias instancias cada
  una lleva su cuenta. Sustituirlo por Redis no toca a quien lo usa.
- No hay todavía verificación de correo, recuperación de contraseña ni segundo
  factor. El modelo de datos ya contempla `PasswordResetToken` y
  `emailVerifiedAt`.

---

## 3. Autorización

Dos preguntas distintas, que se responden por separado:

**¿Puede hacer esto?** → permisos RBAC, catálogo único en
`src/lib/auth/permissions.ts`. Nunca `if (rol === "profesor")` repartido por la
aplicación.

**¿Sobre qué datos?** → alcance:
- profesorado: `TeacherAssignment` (qué oposiciones, cursos y grupos tiene),
- alumnado: `Entitlement` (qué contenido ha contratado).

Toda Server Action llama a `requirePermission()` en servidor. Ocultar un botón
es cortesía con el usuario, no una medida de seguridad.

Detalle en [PERMISSIONS.md](PERMISSIONS.md).

---

## 4. Acceso al contenido y pagos

El acceso nunca se deduce de `pagado = true` (ADR-0008). Existe `Entitlement`,
con estados propios (`PENDING`, `ACTIVE`, `PAST_DUE`, `SUSPENDED`, `EXPIRED`,
`CANCELLED`) y alcance explícito: qué rama del contenido y con qué capacidad.

Consecuencia importante: **la IA respeta lo mismo**. La recuperación filtrará por
academia, permisos, matrículas y derechos activos ANTES de la búsqueda
semántica. Preguntarle a Geminis IA no puede ser una forma de leer un temario
que no se ha comprado.

Ver y descargar son cosas distintas. Un nodo puede ser visible y no descargable;
la bandera se hereda del ancestro más cercano y por defecto **no** se descarga.

Sobre la protección de documentos: se usan URLs firmadas y temporales, control
en servidor y marca de agua opcional con los datos del alumno. Eso disuade y deja
rastro. No impide que alguien con acceso legítimo haga una captura de pantalla, y
el producto no debe prometer lo contrario.

---

## 5. Auditoría

`src/lib/audit.ts` es el único punto de escritura del registro. Guarda actor,
suplantador (si lo hay), acción, entidad, cambios y contexto. Los campos
sensibles se enmascaran antes de escribir. Se registran las altas y bajas de
alumnos, cambios de matrícula, accesos concedidos, publicaciones de contenido,
importaciones y sus reversiones, y los inicios y cierres de sesión.

---

## 6. Superadmin de plataforma

`User.isPlatformAdmin` da acceso a la consola de plataforma: academias, uso,
planes. **No** da acceso al contenido de ninguna academia. El acceso de soporte
se hará por impersonación explícita: `Session.impersonatedById` ya está en el
modelo y la interfaz muestra un aviso permanente cuando una sesión es de
soporte. El flujo completo se implementa con el módulo de plataforma.

---

## 7. RGPD

- Datos personales concentrados en `User` y `StudentProfile`.
- Borrado lógico (`deletedAt`) por defecto: dar de baja no destruye el historial
  académico ni los pagos, que la academia necesita conservar.
- El borrado real es un proceso aparte y explícito: anonimizar `User` (nombre,
  correo, teléfono) manteniendo los identificadores para no romper la integridad
  de resultados y facturación.
- Portabilidad: exportar los datos de una academia es un requisito del producto,
  no un favor (§89). Está en la fase 2.
- Minimización con la IA: al proveedor solo se envían los fragmentos necesarios,
  nunca la ficha del alumno.
- El contenido de una academia **no** se usa para responder a otra ni para
  entrenar nada (§135). Por defecto: no.

---

## 8. Otras medidas

- Toda entrada se valida con Zod en servidor. Lo que llegue del cliente no se
  cree nunca: la academia activa sale de la sesión, no de un formulario.
- Consultas parametrizadas siempre (Prisma). No se construye SQL con
  concatenación.
- React escapa por defecto; el HTML enriquecido se saneará en servidor antes de
  guardarse, no al pintarlo.
- Las Server Actions de Next.js llevan protección CSRF propia; las cookies son
  `sameSite=lax`.
- Secretos solo por variables de entorno. `.env` está ignorado por git.
