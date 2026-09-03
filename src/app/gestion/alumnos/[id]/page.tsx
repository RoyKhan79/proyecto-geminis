import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, KeyRound, Receipt, SlidersHorizontal } from "lucide-react";
import { requireAcademy } from "@/lib/auth/context";
import {
  archiveStudentAction,
  quitarFotoAlumnoAction,
  restoreStudentAction,
  subirFotoAlumnoAction,
  updateStudentAction,
} from "@/server/students/actions";
import {
  getStudent,
  loadCourseOptions,
  loadEditionOptions,
} from "@/server/students/queries";
import {
  STUDENT_STATUS_LABEL,
  STUDENT_STATUS_TONE,
} from "@/lib/students/estados";
import { Button } from "@/components/ui/button";
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  PageHeader,
  Table,
  Td,
  Th,
  CardDescription,
} from "@/components/ui/primitives";
import { formatCents, formatDate, formatDateTime } from "@/lib/utils";
import { FotoDePersona } from "@/components/gestion/foto-persona";
import { AccesoForm, type AccesoConcedido } from "./acceso-form";
import { capacidadesDisponibles, CAPABILITY_LABEL } from "@/lib/access/capacidades";
import type { Capability } from "@/generated/prisma/enums";
import { StudentForm } from "../student-form";
import { EnrollForm } from "./enroll-form";
import { BillingForm } from "./billing-form";

export const metadata: Metadata = { title: "Ficha de alumno" };

const PAYMENT_LABEL: Record<string, string> = {
  PENDING: "Pendiente",
  PAID: "Pagado",
  FAILED: "Fallido",
  REFUNDED: "Devuelto",
  CANCELLED: "Cancelado",
};

/**
 * La ficha de un alumno: datos, matrículas, derechos, pagos y rendimiento.
 *
 * Es la pantalla que se abre cuando alguien llama por teléfono, así que lo
 * primero que se ve es lo que suelen preguntar.
 */
export default async function FichaAlumnoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await requireAcademy();
  if (!ctx.permissions.has("students.read")) notFound();

  const { id } = await params;
  const alumno = await getStudent(ctx.db, id);
  if (!alumno?.studentProfile) notFound();

  const cursos = ctx.permissions.has("enrollments.write")
    ? await loadCourseOptions(ctx.db)
    : [];

  const puedeEditar = ctx.permissions.has("students.write");

  /*
   * Lo que la academia puede repartir y lo que ya le ha dado a este alumno.
   *
   * `concedido` solo mira los derechos de origen MANUAL: son los únicos que
   * gestiona este panel. Los que vienen de una matrícula se enseñan arriba pero
   * no se editan aquí, porque quitarlos a mano dejaría la matrícula diciendo
   * una cosa y el acceso otra.
   */
  const convocatorias = puedeEditar ? await loadEditionOptions(ctx.db) : [];
  const capacidadesQuePuedeDar = capacidadesDisponibles(ctx.modulos);

  const accesoConcedido: Record<string, AccesoConcedido> = {};
  for (const derecho of alumno.entitlements) {
    if (derecho.source !== "MANUAL" || derecho.status !== "ACTIVE") continue;
    for (const alcance of derecho.scopes) {
      if (!alcance.editionId) continue;
      const entrada = (accesoConcedido[alcance.editionId] ??= {
        capacidades: [],
        endsAt: derecho.endsAt ? derecho.endsAt.toISOString().slice(0, 10) : null,
        note: derecho.note,
      });
      if (!entrada.capacidades.includes(alcance.capability)) {
        entrada.capacidades.push(alcance.capability);
      }
    }
  }
  const puedeBorrar = ctx.permissions.has("students.delete");
  const estado = alumno.studentProfile.status;

  const updateAction = updateStudentAction.bind(null, alumno.id);

  return (
    <>
      <PageHeader
        title={`${alumno.user.firstName} ${alumno.user.lastName ?? ""}`}
        description={[alumno.user.email, alumno.user.phone].filter(Boolean).join(" · ")}
        breadcrumb={
          <Link
            href="/gestion/alumnos"
            className="inline-flex items-center gap-1 text-xs text-ink-muted hover:text-ink"
          >
            <ChevronLeft className="size-3.5" aria-hidden />
            Alumnos
          </Link>
        }
        actions={
          <div className="flex items-center gap-2">
            <Badge tone={STUDENT_STATUS_TONE[estado]}>
              {STUDENT_STATUS_LABEL[estado]}
            </Badge>
            {estado === "INACTIVE" ? (
              // La vuelta. Sin esto, dar de baja era un viaje de ida: la baja
              // suspende la membresía y sin nada que la reactive el alumno se
              // quedaba fuera para siempre.
              puedeEditar ? (
                <form action={restoreStudentAction}>
                  <input type="hidden" name="membershipId" value={alumno.id} />
                  <Button type="submit" variant="secondary" size="sm">
                    Dar de alta
                  </Button>
                </form>
              ) : null
            ) : puedeBorrar ? (
              <form action={archiveStudentAction}>
                <input type="hidden" name="membershipId" value={alumno.id} />
                <Button type="submit" variant="secondary" size="sm">
                  Dar de baja
                </Button>
              </form>
            ) : null}
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          {/*
            La foto va fuera del ternario de abajo a propósito.
            Estaba dentro de la rama de solo lectura, así que quien podía
            editar la ficha veía el formulario y nunca la foto, y quien la veía
            no tenía permiso para tocarla: no había forma de subir ninguna.
          */}
          <Card>
            <CardContent className="flex items-center gap-4 p-5">
              <FotoDePersona
                membershipId={alumno.id}
                nombre={`${alumno.user.firstName} ${alumno.user.lastName ?? ""}`}
                url={alumno.user.avatarUrl}
                puedeEditar={puedeEditar}
                subir={subirFotoAlumnoAction}
                quitar={quitarFotoAlumnoAction}
              />
              <div className="min-w-0">
                <p className="font-display text-[1.0625rem] font-semibold leading-snug tracking-[-0.015em] text-ink">
                  Foto
                </p>
                <p className="mt-1 text-sm leading-relaxed text-ink-muted">
                  {puedeEditar
                    ? "Pulsa encima para cambiarla. Sirve para ponerle cara a un nombre cuando alguien llama o viene a recoger un certificado."
                    : "Solo la puede cambiar quien tenga permiso para editar la ficha."}
                </p>
              </div>
            </CardContent>
          </Card>

          {puedeEditar ? (
            <StudentForm
              mode="edit"
              action={updateAction}
              submitLabel="Guardar cambios"
              values={{
                firstName: alumno.user.firstName,
                lastName: alumno.user.lastName,
                email: alumno.user.email,
                phone: alumno.user.phone,
                code: alumno.studentProfile.code,
                status: alumno.studentProfile.status,
                source: alumno.studentProfile.source,
                notes: ctx.permissions.has("students.notes")
                  ? alumno.studentProfile.notes
                  : "",
              }}
            />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Datos</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid gap-3 text-sm sm:grid-cols-2">
                  <Dato label="Teléfono" value={alumno.user.phone ?? "—"} />
                  <Dato label="Expediente" value={alumno.studentProfile.code ?? "—"} />
                  <Dato label="DNI / NIE" value={alumno.studentProfile.nationalId ?? "—"} />
                  <Dato
                    label="Fecha de nacimiento"
                    value={formatDate(alumno.studentProfile.birthDate)}
                  />
                  <Dato label="Dirección" value={alumno.studentProfile.address ?? "—"} />
                  <Dato
                    label="Localidad"
                    value={
                      [
                        alumno.studentProfile.postalCode,
                        alumno.studentProfile.city,
                        alumno.studentProfile.province
                          ? `(${alumno.studentProfile.province})`
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" ") || "—"
                    }
                  />
                  <Dato label="Alta" value={formatDate(alumno.joinedAt)} />
                  <Dato
                    label="Último acceso"
                    value={formatDateTime(alumno.user.lastLoginAt)}
                  />
                  <Dato
                    label="Cómo llegó"
                    value={alumno.studentProfile.source ?? "—"}
                  />
                  <Dato
                    label="Última actividad"
                    value={formatDate(alumno.studentProfile.lastActivityAt)}
                  />

                  {alumno.studentProfile.notes ? (
                    <div className="sm:col-span-2">
                      <p className="text-xs text-ink-muted">Observaciones internas</p>
                      <p className="mt-1 whitespace-pre-line rounded-[var(--radius-control)] bg-surface-muted p-3 text-sm leading-relaxed text-ink-soft">
                        {alumno.studentProfile.notes}
                      </p>
                      <p className="mt-1 text-[0.7rem] text-ink-muted">
                        No las ve el alumno.
                      </p>
                    </div>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Matrículas</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {alumno.enrollments.length === 0 ? (
                <EmptyState
                  title="Sin matrículas"
                  description="Matricúlalo en un curso para darle acceso al contenido."
                />
              ) : (
                <Table>
                  <thead>
                    <tr>
                      <Th>Curso</Th>
                      <Th>Grupo</Th>
                      <Th>Desde</Th>
                      <Th>Estado</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {alumno.enrollments.map((matricula) => (
                      <tr key={matricula.id}>
                        <Td>
                          <span className="block font-medium">
                            {matricula.course.name}
                          </span>
                          <span className="text-xs text-ink-muted">
                            {matricula.course.oppositionEdition.opposition.name} ·{" "}
                            {matricula.course.oppositionEdition.name}
                          </span>
                        </Td>
                        <Td className="text-ink-soft">
                          {matricula.group?.name ?? "—"}
                        </Td>
                        <Td className="text-ink-soft">
                          {formatDate(matricula.startDate)}
                        </Td>
                        <Td>
                          <Badge
                            tone={matricula.status === "ACTIVE" ? "positive" : "neutral"}
                          >
                            {matricula.status === "ACTIVE" ? "Activa" : matricula.status}
                          </Badge>
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </CardContent>
          </Card>

          {cursos.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Matricular en un curso</CardTitle>
              </CardHeader>
              <CardContent>
                <EnrollForm membershipId={alumno.id} courses={cursos} />
              </CardContent>
            </Card>
          ) : null}
        </div>

        <div className="space-y-6">
          {/*
            Qué puede ver este alumno. Es la vista que responde a la pregunta
            del día a día de una academia: "¿este alumno tiene el temario o solo
            los tests?" (§107-§111).
          */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <KeyRound className="size-4 text-ink-muted" aria-hidden />
                Acceso al contenido
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 p-5 pt-0">
              {alumno.entitlements.length === 0 ? (
                <p className="text-sm text-ink-muted">
                  Sin derechos de acceso. Solo verá el contenido marcado como libre.
                </p>
              ) : (
                alumno.entitlements.map((derecho) => {
                  const porNodo = new Map<string, Set<string>>();
                  for (const alcance of derecho.scopes) {
                    const clave = alcance.node?.label ?? "Toda la convocatoria";
                    const set = porNodo.get(clave) ?? new Set<string>();
                    set.add(alcance.capability);
                    porNodo.set(clave, set);
                  }

                  return (
                    <div
                      key={derecho.id}
                      className="space-y-2 rounded-[var(--radius-control)] border border-line p-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium text-ink">
                          {derecho.product?.name ?? "Acceso concedido a mano"}
                        </p>
                        <Badge
                          tone={derecho.status === "ACTIVE" ? "positive" : "caution"}
                        >
                          {derecho.status === "ACTIVE" ? "Activo" : "Suspendido"}
                        </Badge>
                      </div>

                      {porNodo.size === 0 ? (
                        <p className="text-xs text-ink-muted">
                          Cubre toda la convocatoria del curso.
                        </p>
                      ) : (
                        <ul className="space-y-1.5">
                          {[...porNodo.entries()].map(([seccion, capacidades]) => (
                            <li key={seccion} className="text-xs">
                              <span className="font-medium text-ink">{seccion}</span>
                              <span className="ml-1 text-ink-muted">
                                {[...capacidades]
                                  .map((c) => CAPABILITY_LABEL[c as Capability] ?? c)
                                  .join(" · ")}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}

                      {derecho.endsAt ? (
                        <p className="text-xs text-ink-muted">
                          Hasta {formatDate(derecho.endsAt)}
                        </p>
                      ) : null}
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

          {/*
            Y aquí se reparte. La tarjeta de arriba contesta «qué tiene»; esta,
            «qué le doy». Van separadas porque lo de arriba incluye lo que viene
            de una matrícula, que no se toca a mano desde aquí.
          */}
          {puedeEditar ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <SlidersHorizontal className="size-4 text-ink-muted" aria-hidden />
                  Herramientas del alumno
                </CardTitle>
                <CardDescription>
                  Lo que le abres a mano, sin pasar por una matrícula. Solo salen
                  los módulos que tiene contratados tu academia.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-5 pt-0">
                <AccesoForm
                  membershipId={alumno.id}
                  convocatorias={convocatorias}
                  capacidades={capacidadesQuePuedeDar}
                  concedido={accesoConcedido}
                />
              </CardContent>
            </Card>
          ) : null}

          {ctx.permissions.has("payments.write") ? (
            <BillingForm
              studentId={alumno.id}
              perfil={alumno.billingProfile}
              cuota={alumno.recurringCharge}
            />
          ) : null}

          {ctx.permissions.has("payments.read") ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Receipt className="size-4 text-ink-muted" aria-hidden />
                  Pagos
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {alumno.payments.length === 0 ? (
                  <p className="px-5 pb-5 text-sm text-ink-muted">
                    Sin movimientos registrados.
                  </p>
                ) : (
                  <ul className="divide-y divide-[var(--border-subtle)]">
                    {alumno.payments.map((pago) => (
                      <li
                        key={pago.id}
                        className="flex items-center justify-between gap-3 px-5 py-2.5"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm text-ink">{pago.concept}</p>
                          <p className="text-xs text-ink-muted">
                            {formatDate(pago.dueDate)}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-sm font-medium tabular-nums text-ink">
                            {formatCents(pago.amountCents)}
                          </p>
                          <Badge
                            tone={
                              pago.status === "PAID"
                                ? "positive"
                                : pago.status === "PENDING"
                                  ? "caution"
                                  : "critical"
                            }
                          >
                            {PAYMENT_LABEL[pago.status] ?? pago.status}
                          </Badge>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </>
  );
}

function Dato({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-ink-muted">{label}</dt>
      <dd className="text-ink">{value}</dd>
    </div>
  );
}
