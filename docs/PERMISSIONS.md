# Permisos

## Dos preguntas, no una

Confundirlas es la causa habitual de que un sistema de permisos acabe siendo un
enredo de condicionales:

| Pregunta | Se responde con | Dónde vive |
|----------|-----------------|------------|
| ¿Puede hacer esto? | Permiso RBAC | `Role` → `RolePermission` |
| ¿Sobre qué datos? | Alcance | `TeacherAssignment` (profesorado), `Entitlement` (alumnado) |

Un profesor tiene `students.read`. Eso no significa que vea a todos los alumnos
de la academia: verá los de los grupos que tenga asignados.

---

## Catálogo

La fuente de verdad es `src/lib/auth/permissions.ts`. La base de datos guarda las
concesiones; el código guarda qué claves existen y qué significan. Si una clave
no está en el catálogo, no es un permiso válido, y hay una prueba que lo
comprueba.

Están agrupados en: Personas, Académico, Contenido, Evaluación, Normativa,
Gestión, Inteligencia Artificial y Plataforma.

Dos permisos merecen atención porque deciden en qué aplicación entra alguien:

- `manager.access` — Geminis Manager
- `campus.access` — Geminis Campus

`/inicio` los lee y redirige. Quien tenga los dos entra en Manager y puede
cambiar desde la barra superior.

---

## Roles del sistema

Cada academia recibe una copia editable de estos cuatro.

### Administrador (`ACADEMY_ADMIN`)
Todo salvo lo que solo tiene sentido para un alumno (`campus.access`,
`attempts.take`, `ai.student`). Si además quiere usar el Campus, se le añade el
rol de alumno: los roles se suman.

### Profesor / Preparador (`TEACHER`)
Contenido (crear y publicar), preguntas y tests (crear y aprobar), clases,
normativa (revisar alertas), analítica, comunicaciones, copiloto de IA y
**conceder acceso a contenido** (`entitlements.write`) — que es lo que permite
que decida qué ve cada alumno según lo que haya pagado.

No tiene: gestión económica, configuración de la academia, roles, importaciones.

### Personal administrativo (`STAFF`)
Alumnos, matrículas, grupos, pagos, comunicaciones, importaciones.

No tiene: `students.notes` (observaciones internas del profesor),
`content.publish`, `questions.*`, `legislation.write`. Puede gestionar el
negocio sin ver ni tocar lo académico sensible.

### Alumno (`STUDENT`)
`campus.access`, ver contenido, hacer tests, ver clases y normativa, usar Geminis
IA. Nada más. Lo que ve de verdad lo deciden sus derechos de acceso.

---

## Cómo se comprueba

En páginas y acciones de servidor:

```ts
// Página completa que exige un permiso
const ctx = await requirePermission("students.write");

// Página que se adapta a lo que la persona puede hacer
const ctx = await requireAcademy();
const puedeEditar = ctx.permissions.has("students.write");
```

En la interfaz:

```tsx
{puedeEditar ? <Button>Editar</Button> : null}
```

**Ocultar el botón no es autorizar.** La comprobación de servidor tiene que estar
igualmente: una petición se puede fabricar a mano. Toda Server Action de Geminis
empieza por `requirePermission()`.

El contexto (`getAuthContext`) se resuelve una sola vez por petición: sesión,
academia activa, roles y permisos. Ningún componente lee cookies por su cuenta.

---

## Cómo añadir un permiso

1. Añadir la clave a `PERMISSIONS` en `src/lib/auth/permissions.ts`, con grupo y
   etiqueta en castellano (la etiqueta se muestra en Configuración).
2. Añadirla a los roles del sistema que deban tenerla.
3. Ejecutar `syncSystemRolePermissions(academyId)` para las academias existentes.
4. Usarla con `requirePermission()` donde toque.

Las pruebas comprueban que todos los permisos de los roles existan en el catálogo
y que el alumno no reciba ninguno de gestión.

---

## Pendiente

- **Roles personalizados por academia**: el modelo ya lo admite (`Role.academyId`,
  `isSystem = false`); falta la interfaz de edición.
- **Filtrado automático por asignación del profesor**: hoy `TeacherAssignment`
  existe y se muestra, pero las consultas de alumnos aún no lo aplican como
  filtro. Llega con el módulo de contenido, que es cuando empieza a importar de
  verdad.
- **Impersonación de soporte**: modelada (`Session.impersonatedById`) y con aviso
  visible en la interfaz; el flujo se implementa con el módulo de plataforma.
