# Modelo de datos

52 tablas, divididas por dominio en `prisma/schema/*.prisma`. Este documento
explica las decisiones; el detalle campo a campo está comentado en el propio
esquema, que es donde no se queda desactualizado.

Convenciones: identificadores `uuid(7)` (ordenados por tiempo, buenos para los
índices), `createdAt`/`updatedAt` en todo, `deletedAt` donde el borrado debe ser
lógico, importes en **céntimos** (nunca coma flotante).

---

## Mapa

```
PLATAFORMA        Plan · Academy
IDENTIDAD         User · Membership · Role · RolePermission · MembershipRole
                  StudentProfile · TeacherProfile · Session · PasswordResetToken
ACADÉMICO         OppositionType · Opposition · OppositionEdition
                  Course · Group · Enrollment · TeacherAssignment
CONTENIDO         ContentNode · ContentResource · ContentNodeVersion
                  StoredFile · StudentContentProgress
                  ClassSession · ClassAttendance
EVALUACIÓN        Question · QuestionOption · ExamBlueprint · TestDefinition
                  TestAttempt · TestAttemptAnswer · StudentQuestionStat
COMERCIAL         Product · ProductGrant · Entitlement · EntitlementScope · Payment
OPERACIÓN         AuditLog · Notification · ImportJob · ImportRow
IA                KnowledgeSource · DocumentChunk
                  AIConversation · AIMessage · AIUsage
NORMATIVA         Legislation · LegislationVersion · LegislationArticle
                  ContentLegislationLink · LegislationChangeAlert
```

---

## Decisiones que conviene entender

### La academia es el tenant

No hay tabla `Tenant`. `Academy` lo es. Añadir una indirección que hoy nadie usa
solo complica las consultas. Si aparecen grupos con varias academias, se añade
`Organization` **por encima**, que es una migración aditiva.

### `User` es global, `Membership` es del tenant

El correo es único en toda la plataforma. Una misma persona puede ser alumna de
una academia y profesora de otra sin duplicar cuentas, y las academias siguen sin
verse entre ellas.

Consecuencia práctica: **todo lo que pertenece a la academia apunta a
`Membership`, nunca a `User`**. Matrículas, intentos de test, asignaciones,
conversaciones con la IA.

### Roles copiados por academia

Cada academia recibe su copia de `ACADEMY_ADMIN`, `TEACHER`, `STAFF` y `STUDENT`
(`isSystem = true`). Así podrá crear roles propios sin afectar a nadie más, y los
permisos siempre se resuelven dentro del tenant. Una pertenencia puede tener
varios roles: el dueño de la academia que además da clase es lo normal.

### Un árbol de contenido, no una jerarquía fija

`ContentNode` es autorreferenciado con cuatro tipos:

| `kind` | Para qué |
|--------|----------|
| `SECTION` | Apartado raíz del Campus. Su `sectionKind` dice qué pantalla usa |
| `FOLDER` | Agrupador: bloque, unidad, carpeta… lo que decida la academia |
| `TOPIC` | Unidad de estudio: se mide progreso y se enganchan preguntas |
| `RESOURCE` | PDF, vídeo, enlace, texto |

`label` lo escribe la academia. Que un apartado se llame «Situaciones de
aprendizaje» o «Unidades didácticas» es un dato, no una constante del código.

**Ruta materializada**: `path` guarda los ancestros (`/raiz/padre/`), y el
prefijo que cubre a un nodo y toda su descendencia es `path + id + "/"`. Con eso,
resolver «¿tiene acceso a esta rama?» es un `LIKE` indexado. `depth` y `position`
completan el orden. Estos tres campos **solo** los escribe
`src/server/content/tree.ts`; si se desincronizan, los permisos por rama dejan de
funcionar.

Banderas heredables (`downloadable`, `aiEnabled`, `usableForTests`, `watermark`,
`trackLegislation`) son `Boolean?`: `null` significa «heredar del padre». La
academia configura una vez la rama y afina donde quiera.

### Derechos de acceso separados del pago

```
Product ──< ProductGrant        qué desbloquea el producto (rama + capacidad)
Entitlement ──< EntitlementScope   qué tiene concedido un alumno concreto
```

`Entitlement.source` distingue de dónde viene: `PRODUCT` (compra),
`ENROLLMENT` (va con la matrícula), `MANUAL` (lo concedió el profesor a mano),
`TRIAL`. Esto es lo que permite packs distintos y ajustes individuales sin tocar
código.

`Payment` registra el cobro, pero **no** es lo que da acceso.

### Convocatorias en lugar de sobrescribir

`OppositionEdition` existe para no destruir el histórico cada año. El contenido
cuelga de la convocatoria, no de la oposición, y una convocatoria puede clonarse
de otra (`clonedFromId`).

### Preguntas con procedencia

`Question.aiProvenance` guarda, cuando la pregunta la generó la IA, el modelo, la
fecha, quién la pidió y los fragmentos fuente. `status` incluye
`POSSIBLY_OUTDATED`, que es lo que marca el módulo de normativa cuando cambia una
ley relacionada. Nada se publica sin revisión humana.

`TestAttempt.config` guarda una copia de la configuración del intento: si la
plantilla cambia después, el histórico sigue siendo interpretable.

### Importaciones reversibles

`ImportRow` guarda la fila original, la fila normalizada, qué entidad creó o
actualizó y el estado anterior. Es lo que hace posible el requisito de poder
**deshacer una importación entera** (§39), que es de las cosas que más confianza
dan al migrar desde otro programa.

### Normativa como grafo ligero

`ContentLegislationLink` une un artículo con un tema o con una pregunta, y
distingue si lo marcó una persona (`MANUAL`) o lo propuso Catedria (`DETECTED`),
porque la confianza no es la misma. Con eso se responde «el artículo 16 afecta a
2 temas y 128 preguntas» sin montar una base de datos de grafos.

### Embeddings: todavía sin columna vectorial

`DocumentChunk` guarda el fragmento, su localizador para citar y sus metadatos de
permisos, pero no el vector. La columna `vector` se añade con `pgvector` en la
fase de IA (ADR-0011). Preferimos un esquema honesto a declarar una columna que
hoy no podríamos crear en todos los entornos.

---

## Índices

Los índices siguen las consultas reales, no la intuición:

- Casi todo lleva `@@index([academyId, …])`, porque **toda** consulta filtra por
  academia. Poner `academyId` primero es lo que hace que el índice sirva.
- `content_nodes`: `(academyId, path)` para las ramas, `(academyId, editionId,
  parentId, position)` para pintar la navegación.
- `entitlements`: `(academyId, studentId, status)` — se consulta en cada petición
  del Campus.
- `sessions`: `tokenHash` único y `(userId, revokedAt)` para listar dispositivos.
- `student_question_stats`: `(academyId, studentId, nextReviewAt)` para la
  repetición espaciada y `(…, timesWrong)` para el test de errores.

---

## Migraciones

```bash
npm run db:migrate     # crear y aplicar una migración en desarrollo
npm run db:deploy      # aplicar migraciones en producción
npm run db:seed        # recrear la academia demo (borra la anterior)
```

Las migraciones están en `prisma/migrations/` y se versionan. Nunca se edita una
migración ya aplicada: se crea otra encima.
