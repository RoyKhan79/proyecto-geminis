/**
 * Modelos cuyos datos pertenecen a una academia.
 *
 * Esta lista es la fuente de verdad de la guardia multi-tenant. Si añades un
 * modelo con `academyId` y olvidas incluirlo aquí, el test
 * `tests/tenancy.test.ts` falla: compara esta lista contra las columnas reales
 * de PostgreSQL. Es deliberado que romper el aislamiento por descuido sea
 * imposible sin que se entere el conjunto de pruebas.
 */
export const TENANT_MODELS = new Set<string>([
  "Membership",
  "Role",
  "OppositionType",
  "Opposition",
  "OppositionEdition",
  "Course",
  "Group",
  "Enrollment",
  "TeacherAssignment",
  "ContentNode",
  "ContentRelease",
  "OppositionWatch",
  "OfficialCall",
  "WallPost",
  "WallComment",
  "MessageThread",
  "Message",
  "Assignment",
  "Submission",
  "SubmissionFile",
  "LiveRoom",
  "StoredFile",
  "StudentContentProgress",
  "ClassSession",
  "ClassAttendance",
  "Question",
  "QuestionOption",
  "ExamBlueprint",
  "TestDefinition",
  "TestAttempt",
  "TestAttemptAnswer",
  "StudentQuestionStat",
  "Product",
  "ProductGrant",
  "Entitlement",
  "Payment",
  "BillingProfile",
  "RecurringCharge",
  "DirectDebitRun",
  "InvoiceSeries",
  "Invoice",
  "InvoiceLine",
  "AuditLog",
  "Notification",
  "ImportJob",
  "ImportRow",
  "KnowledgeSource",
  "DocumentChunk",
  "AIConversation",
  "AIMessage",
  "AIUsage",
  "Legislation",
  "LegislationVersion",
  "LegislationArticle",
  "ContentLegislationLink",
  "LegislationChangeAlert",
]);

/**
 * Modelos globales: no pertenecen a ninguna academia y por tanto no pasan por
 * la guardia. Se enumeran de forma explícita para que ningún modelo quede sin
 * clasificar por accidente.
 */
export const GLOBAL_MODELS = new Set<string>([
  "Plan",
  "RadarRun",
  "Academy",
  "User",
  "Session",
  "PasswordResetToken",
  "MembershipRole",
  "RolePermission",
  "StudentProfile",
  "TeacherProfile",
  "ContentResource",
  "ContentNodeVersion",
  "EntitlementScope",
]);

/**
 * Los modelos de GLOBAL_MODELS que en realidad SÍ contienen datos de una
 * academia, pero de forma indirecta (cuelgan de un padre que ya está
 * protegido). Se documentan aquí para que la decisión sea consciente:
 *
 *   MembershipRole, RolePermission → cuelgan de Membership/Role
 *   StudentProfile, TeacherProfile → cuelgan de Membership
 *   ContentResource, ContentNodeVersion → cuelgan de ContentNode
 *   EntitlementScope → cuelga de Entitlement
 *
 * Acceder a ellos SIEMPRE debe hacerse a través del padre. Ver
 * docs/SECURITY_MODEL.md § "Modelos derivados".
 */
export const DERIVED_MODELS = new Set<string>([
  "MembershipRole",
  "RolePermission",
  "StudentProfile",
  "TeacherProfile",
  "ContentResource",
  "ContentNodeVersion",
  "EntitlementScope",
]);
