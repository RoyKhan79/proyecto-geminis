/**
 * LAS CLAVES FORÁNEAS QUE APUNTAN A OTRO MODELO DE ACADEMIA
 *
 * Por qué hace falta esta lista, con el caso concreto que la motivó:
 *
 *     dbDeLaAcademiaA.oppositionEdition.create({
 *       data: { oppositionId: <id de una oposición de la academia B>, name: "2026" },
 *     })
 *
 * Eso funcionaba. Y funcionaba en las dos barreras a la vez, cada una por su
 * motivo:
 *
 *   · la guardia de aplicación mira a QUÉ registro se apunta cuando el `where`
 *     señala uno —por eso `update` y `delete` sobre algo ajeno fallan— pero al
 *     CREAR no hay registro al que apuntar: se fija el `academyId` y se pasa
 *     todo lo demás tal cual, incluidas las claves foráneas;
 *
 *   · PostgreSQL comprueba la fila que se escribe contra la política, y esa
 *     fila es legítima: es de la academia A. La integridad referencial la
 *     verifica aparte, y esa comprobación se ejecuta por diseño saltándose Row
 *     Level Security, así que la oposición de B «existe» a esos efectos.
 *
 * Resultado: una fila de A apuntando a una entidad de B. No es solo un dato
 * incoherente; en cuanto una consulta hiciera `include: { opposition: true }`,
 * la academia A estaría leyendo el nombre de una oposición de la B.
 *
 * No llegó a ser explotable —las acciones del proyecto cargan el padre con
 * `ctx.db` antes de usarlo, y ahí la guardia sí lo filtra— pero eso es
 * disciplina, no barrera. Y una barrera que depende de que nadie se despiste
 * es exactamente lo que esta auditoría no da por bueno.
 *
 * ── POR QUÉ UNA LISTA Y NO ALGO AUTOMÁTICO ──────────────────────────────────
 *
 * Lo ideal sería que la base de datos lo hiciera imposible, con claves foráneas
 * compuestas del tipo `(academyId, oppositionId) → oppositions(academyId, id)`.
 * Es la solución correcta y no se ha hecho aquí: son 108 claves que reescribir
 * y un cambio de esquema que Prisma tiene que reflejar, y eso es un proyecto,
 * no una corrección. Queda anotado como lo que es.
 *
 * Lo segundo mejor sería leer las relaciones del propio Prisma en tiempo de
 * ejecución, pero el modelo que expone su cliente no incluye de qué campo sale
 * cada relación, y colgarse de una interfaz interna para algo de seguridad es
 * peor que escribir la lista.
 *
 * Así que la lista, como la de `tenant-models.ts`, y con la misma red debajo:
 * `tests/tenant-relaciones.test.ts` la compara con el esquema y falla si
 * aparece una relación nueva que no esté aquí.
 */

/** Una clave foránea: el campo, y el modelo de academia al que apunta. */
export type RelacionDeTenant = {
  /** El campo escalar que guarda el identificador, p. ej. `oppositionId`. */
  campo: string;
  /** El modelo al que apunta. Siempre uno de {@link TENANT_MODELS}. */
  destino: string;
};

/**
 * Qué claves foráneas de cada modelo hay que comprobar al escribir.
 *
 * Solo están las que apuntan a OTRO modelo de academia. Las que apuntan a un
 * modelo global (`User`, `Academy`, `Plan`) no se comprueban porque no hay nada
 * que comprobar: esas entidades no pertenecen a ninguna academia.
 */
export const RELACIONES_DE_TENANT: Record<string, RelacionDeTenant[]> = {

  AIConversation: [
    { campo: "memberId", destino: "Membership" },
  ],
  AIMessage: [
    { campo: "conversationId", destino: "AIConversation" },
  ],
  AIUsage: [
    { campo: "memberId", destino: "Membership" },
  ],
  Assignment: [
    { campo: "editionId", destino: "OppositionEdition" },
    { campo: "courseId", destino: "Course" },
    { campo: "groupId", destino: "Group" },
    { campo: "nodeId", destino: "ContentNode" },
    { campo: "createdById", destino: "Membership" },
  ],
  BillingProfile: [
    { campo: "studentId", destino: "Membership" },
  ],
  ClassAttendance: [
    { campo: "classId", destino: "ClassSession" },
    { campo: "studentId", destino: "Membership" },
  ],
  ClassSession: [
    { campo: "editionId", destino: "OppositionEdition" },
    { campo: "courseId", destino: "Course" },
    { campo: "groupId", destino: "Group" },
    { campo: "teacherId", destino: "Membership" },
    { campo: "nodeId", destino: "ContentNode" },
  ],
  ContentLegislationLink: [
    { campo: "articleId", destino: "LegislationArticle" },
    { campo: "nodeId", destino: "ContentNode" },
    { campo: "questionId", destino: "Question" },
  ],
  ContentNode: [
    { campo: "editionId", destino: "OppositionEdition" },
    { campo: "parentId", destino: "ContentNode" },
  ],
  ContentRelease: [
    { campo: "nodeId", destino: "ContentNode" },
    { campo: "groupId", destino: "Group" },
  ],
  Course: [
    { campo: "oppositionEditionId", destino: "OppositionEdition" },
  ],
  DocumentChunk: [
    { campo: "sourceId", destino: "KnowledgeSource" },
    { campo: "nodeId", destino: "ContentNode" },
  ],
  Enrollment: [
    { campo: "studentId", destino: "Membership" },
    { campo: "courseId", destino: "Course" },
    { campo: "groupId", destino: "Group" },
  ],
  Entitlement: [
    { campo: "studentId", destino: "Membership" },
    { campo: "productId", destino: "Product" },
    { campo: "enrollmentId", destino: "Enrollment" },
  ],
  ExamBlueprint: [
    { campo: "editionId", destino: "OppositionEdition" },
  ],
  Group: [
    { campo: "courseId", destino: "Course" },
  ],
  ImportRow: [
    { campo: "jobId", destino: "ImportJob" },
  ],
  Invoice: [
    { campo: "seriesId", destino: "InvoiceSeries" },
    { campo: "studentId", destino: "Membership" },
    { campo: "rectifiesId", destino: "Invoice" },
    { campo: "paymentId", destino: "Payment" },
  ],
  InvoiceLine: [
    { campo: "invoiceId", destino: "Invoice" },
  ],
  KnowledgeSource: [
    { campo: "nodeId", destino: "ContentNode" },
    { campo: "fileId", destino: "StoredFile" },
  ],
  LegislationArticle: [
    { campo: "legislationId", destino: "Legislation" },
    { campo: "versionId", destino: "LegislationVersion" },
  ],
  LegislationChangeAlert: [
    { campo: "legislationId", destino: "Legislation" },
    { campo: "versionId", destino: "LegislationVersion" },
    { campo: "articleId", destino: "LegislationArticle" },
  ],
  LegislationVersion: [
    { campo: "legislationId", destino: "Legislation" },
  ],
  LiveRoom: [
    { campo: "editionId", destino: "OppositionEdition" },
    { campo: "courseId", destino: "Course" },
    { campo: "groupId", destino: "Group" },
  ],
  Message: [
    { campo: "threadId", destino: "MessageThread" },
    { campo: "authorId", destino: "Membership" },
  ],
  MessageThread: [
    { campo: "studentId", destino: "Membership" },
    { campo: "teacherId", destino: "Membership" },
  ],
  Notification: [
    { campo: "recipientId", destino: "Membership" },
  ],
  OfficialCall: [
    { campo: "watchId", destino: "OppositionWatch" },
  ],
  Opposition: [
    { campo: "typeId", destino: "OppositionType" },
  ],
  OppositionEdition: [
    { campo: "oppositionId", destino: "Opposition" },
    { campo: "clonedFromId", destino: "OppositionEdition" },
  ],
  OppositionWatch: [
    { campo: "oppositionId", destino: "Opposition" },
  ],
  Payment: [
    { campo: "studentId", destino: "Membership" },
    { campo: "enrollmentId", destino: "Enrollment" },
    { campo: "productId", destino: "Product" },
    { campo: "recurringChargeId", destino: "RecurringCharge" },
    { campo: "directDebitRunId", destino: "DirectDebitRun" },
  ],
  Product: [
    { campo: "oppositionId", destino: "Opposition" },
    { campo: "editionId", destino: "OppositionEdition" },
    { campo: "courseId", destino: "Course" },
  ],
  ProductGrant: [
    { campo: "productId", destino: "Product" },
    { campo: "nodeId", destino: "ContentNode" },
  ],
  Question: [
    { campo: "editionId", destino: "OppositionEdition" },
    { campo: "nodeId", destino: "ContentNode" },
    { campo: "authorId", destino: "Membership" },
    { campo: "reviewerId", destino: "Membership" },
  ],
  QuestionOption: [
    { campo: "questionId", destino: "Question" },
  ],
  RecurringCharge: [
    { campo: "studentId", destino: "Membership" },
    { campo: "billingProfileId", destino: "BillingProfile" },
    { campo: "enrollmentId", destino: "Enrollment" },
  ],
  StudentContentProgress: [
    { campo: "studentId", destino: "Membership" },
    { campo: "nodeId", destino: "ContentNode" },
  ],
  StudentQuestionStat: [
    { campo: "studentId", destino: "Membership" },
    { campo: "questionId", destino: "Question" },
  ],
  Submission: [
    { campo: "assignmentId", destino: "Assignment" },
    { campo: "studentId", destino: "Membership" },
    { campo: "gradedById", destino: "Membership" },
  ],
  SubmissionFile: [
    { campo: "submissionId", destino: "Submission" },
    { campo: "fileId", destino: "StoredFile" },
  ],
  TeacherAssignment: [
    { campo: "teacherId", destino: "Membership" },
    { campo: "oppositionId", destino: "Opposition" },
    { campo: "editionId", destino: "OppositionEdition" },
    { campo: "courseId", destino: "Course" },
    { campo: "groupId", destino: "Group" },
  ],
  TestAttempt: [
    { campo: "studentId", destino: "Membership" },
    { campo: "testDefinitionId", destino: "TestDefinition" },
  ],
  TestAttemptAnswer: [
    { campo: "attemptId", destino: "TestAttempt" },
    { campo: "questionId", destino: "Question" },
    { campo: "selectedOptionId", destino: "QuestionOption" },
  ],
  TestDefinition: [
    { campo: "editionId", destino: "OppositionEdition" },
    { campo: "nodeId", destino: "ContentNode" },
    { campo: "blueprintId", destino: "ExamBlueprint" },
  ],
  WallComment: [
    { campo: "postId", destino: "WallPost" },
    { campo: "authorId", destino: "Membership" },
  ],
  WallPost: [
    { campo: "authorId", destino: "Membership" },
    { campo: "editionId", destino: "OppositionEdition" },
    { campo: "courseId", destino: "Course" },
    { campo: "groupId", destino: "Group" },
    { campo: "nodeId", destino: "ContentNode" },
  ],
};
