# Arquitectura

## 1. Stack elegido

| Capa | Elección | Por qué |
|------|----------|---------|
| Interfaz y servidor | Next.js 16 (App Router) + React 19 + TypeScript | Un solo proyecto para las dos aplicaciones (Manager y Campus), renderizado en servidor y Server Actions. Menos piezas que mantener con un equipo pequeño. |
| Estilos | Tailwind CSS 4 con tokens propios | El design system son variables CSS; el white-label por academia será cambiar variables, no reescribir componentes. Ver [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md). |
| Base de datos | PostgreSQL 18 | Relacional de verdad, con JSONB donde hace falta y `pgvector` disponible cuando llegue la fase de IA. |
| Acceso a datos | Prisma 7 | Tipado extremo a extremo y migraciones versionadas. Sus *client extensions* son justo lo que necesitábamos para la guardia multi-tenant. |
| Validación | Zod | El mismo esquema valida el formulario y la acción de servidor. |
| Autenticación | Propia, sobre `node:crypto` | Sesiones en base de datos, revocables. Ver ADR-0015. |
| Pruebas | Vitest | Rápido y sin ceremonia. |

Nada de esto es irreversible. Lo que sí es deliberado es que **la lógica de
negocio no depende de Next.js**: vive en `src/server/**` y `src/lib/**`, que son
funciones de TypeScript. Si algún día hace falta separar la API, se mueve esa
carpeta y las rutas pasan a ser un cliente más.

---

## 2. Las dos aplicaciones

Geminis son dos productos con la misma base de datos y el mismo servidor:

- **Geminis Manager** (`/gestion`) — la academia. Barra lateral, tablas, filtros,
  pensado para escritorio y tablet.
- **Geminis Campus** (`/campus`) — el alumno. Barra inferior, una columna, todo
  alcanzable con el pulgar. Es *mobile first* de verdad, no un ERP encogido.

Quién entra en cuál lo decide `/inicio` leyendo los permisos, no una URL que el
usuario tenga que recordar. Alguien que sea profesor y alumno a la vez puede
cambiar de una a otra desde la barra superior.

---

## 3. Capas

```
  Rutas y componentes        src/app/**, src/components/**
        │  solo presentación; nunca consultan la BD ni deciden permisos
        ▼
  Casos de uso               src/server/**
        │  validan con Zod, comprueban permisos, auditan
        ▼
  Núcleo transversal         src/lib/**
        │  auth · permisos · acceso a contenido · auditoría · guardia de tenant
        ▼
  Base de datos              Prisma → PostgreSQL
```

Reglas que sostienen esto:

1. Una página **nunca** hace `prismaBase.x.findMany()`. Usa `ctx.db`, que ya está
   limitado a su academia, o una función de `src/server`.
2. Toda Server Action empieza con `requirePermission("…")`. Que la interfaz
   oculte el botón no autoriza nada.
3. La lógica de negocio no vive en componentes. Un componente que calcula
   descuentos es un componente que nadie podrá probar.

---

## 4. Multi-tenancy

La academia **es** el tenant (ADR-0002). Estrategia: base de datos y esquema
compartidos, con `academyId` en toda tabla que contenga datos de una academia.

Lo que hace que sea seguro no es la columna, es la guardia:

```ts
const ctx = await requireAcademy();   // sesión + academia activa + permisos
const alumnos = await ctx.db.membership.findMany();  // ya filtrado
```

`ctx.db` es `tenantDb(academyId)`: un cliente Prisma extendido que intercepta
todas las operaciones. Detalle completo en [SECURITY_MODEL.md](SECURITY_MODEL.md).

Por qué esta estrategia y no una base de datos por academia: con cientos de
academias, mil bases de datos son mil migraciones, mil copias de seguridad y un
coste operativo que no aporta seguridad real si la aplicación está bien hecha.
El camino de salida existe: si una academia grande exige aislamiento físico, su
`academyId` se puede extraer a otra instancia sin cambiar el modelo.

---

## 5. Contenido: un árbol, no un esquema fijo

La decisión de producto más importante de la arquitectura (ADR-0006).

Todo el material vive en `ContentNode`, un árbol autorreferenciado donde cada
academia crea los niveles que quiere y les pone el nombre que quiere:

```
Convocatoria 2026
├── "Temario"                     SECTION · SYLLABUS
│   ├── "Bloque I"                FOLDER
│   │   ├── "Tema 1 · …"          TOPIC     ← se mide progreso
│   │   └── "Tema 2 · …"          TOPIC
├── "Clases"                      SECTION · CLASSES
├── "Programación de aula"        SECTION · LIBRARY
└── "Situaciones de aprendizaje"  SECTION · LIBRARY
```

`label` es un dato que escribe la academia. `sectionKind` solo dice qué pantalla
usa el Campus (lector de documentos, tests, clases…), nunca cómo se llama el
apartado. Cuando la ley cambie otra vez la terminología, la academia edita un
texto y Geminis sigue funcionando.

Cada nodo guarda una **ruta materializada** (`path`), de modo que una rama
completa se consulta con un `LIKE` indexado. Es la operación que más se ejecuta:
resolver permisos y pintar navegación.

---

## 6. Acceso al contenido

Matricular no da acceso. El acceso lo da un `Entitlement` con su alcance
(`EntitlementScope`): qué rama y con qué capacidad (ver, descargar, hacer tests,
asistir a clases, usar la IA).

```
Producto "Pack solo tests"
   └── concede  VIEW_CONTENT + TAKE_TESTS  sobre la rama "Tests y simulacros"

Alumno con ese producto:
   ve "Tests y simulacros" · no ve "Temario" · la IA tampoco puede citar el temario
```

Un motor único (`src/lib/access/content-access.ts`) responde siempre a la misma
pregunta, y lo usan el Campus, el visor de documentos, el módulo de tests y —
cuando llegue — la recuperación de Geminis IA.

---

## 7. Inteligencia artificial

Ningún módulo llamará a un proveedor de IA directamente. Todo pasará por el
**Geminis AI Gateway**, que decide proveedor y modelo, aplica límites, filtra el
contexto por academia y permisos, y registra el consumo. Ver
[AI_ARCHITECTURE.md](AI_ARCHITECTURE.md).

---

## 8. Almacenamiento de archivos

`StoredFile` guarda la referencia; el archivo vive en un almacén compatible con
S3 (disco local en desarrollo). Nunca se publica una URL permanente: el backend
comprueba permisos y firma una URL temporal. La academia decide por rama si el
material se puede descargar o solo visualizar.

---

## 9. Qué está preparado y todavía no construido

Estas piezas tienen su sitio en el modelo de datos, pero no código aún. Están
así a propósito: modelar bien es barato, implementar antes de tiempo no.

- Vectores de embeddings (llegan con pgvector en la fase de IA, ADR-0011)
- Integración con Zoom/Meet/Teams (hoy, enlace externo)
- Pasarelas de pago (el modelo ya contempla referencia externa y método)
- Dominio propio por academia (`Academy.customDomain` existe; no se resuelve aún)
- Row Level Security en PostgreSQL como segunda barrera (ver SECURITY_MODEL.md)
