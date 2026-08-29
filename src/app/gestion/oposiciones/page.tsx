import type { Metadata } from "next";
import { CalendarDays, GraduationCap, Pencil, Trash2, Users } from "lucide-react";
import { requireAcademy } from "@/lib/auth/context";
import {
  createEditionAction,
  createOppositionAction,
  deleteEditionAction,
  deleteOppositionAction,
  updateEditionAction,
  updateOppositionAction,
} from "@/server/academic/actions";
import { InlineCreate } from "@/components/manager/inline-create";
import {
  Badge,
  Card,
  CardContent,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Select,
  Textarea,
} from "@/components/ui/primitives";
import { fechaParaInput, formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Oposiciones" };

export default async function OposicionesPage() {
  const ctx = await requireAcademy();
  const puedeEscribir = ctx.permissions.has("oppositions.write");

  const [oposiciones, tipos] = await Promise.all([
    ctx.db.opposition.findMany({
      where: { deletedAt: null },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        code: true,
        authority: true,
        scope: true,
        status: true,
        description: true,
        typeId: true,
        type: { select: { name: true } },
        editions: {
          where: { deletedAt: null },
          orderBy: { name: "desc" },
          select: {
            id: true,
            name: true,
            year: true,
            examDate: true,
            positions: true,
            status: true,
            _count: { select: { courses: true, contentNodes: true } },
          },
        },
      },
    }),
    ctx.db.oppositionType.findMany({ orderBy: { position: "asc" } }),
  ]);

  return (
    <>
      <PageHeader
        title="Oposiciones"
        description="Cada oposición se organiza en convocatorias, y cada convocatoria tiene su propio contenido."
        actions={
          puedeEscribir ? (
            <InlineCreate
              action={createOppositionAction}
              label="Nueva oposición"
              title="Nueva oposición"
              successMessage="Oposición creada con su primera convocatoria."
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Nombre" htmlFor="name" required>
                  <Input name="name" placeholder="Administrativo del Estado" required />
                </Field>
                <Field label="Familia" htmlFor="typeId">
                  <Select name="typeId" defaultValue="">
                    <option value="">Sin clasificar</option>
                    {tipos.map((tipo) => (
                      <option key={tipo.id} value={tipo.id}>
                        {tipo.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Código" htmlFor="code">
                  <Input name="code" />
                </Field>
                <Field label="Administración convocante" htmlFor="authority">
                  <Input name="authority" />
                </Field>
                <Field label="Ámbito" htmlFor="scope" hint="Estatal, autonómico, local…">
                  <Input name="scope" />
                </Field>
                <Field label="Primera convocatoria" htmlFor="editionName" required>
                  <Input name="editionName" defaultValue="Convocatoria 2026" required />
                </Field>
                <Field label="Año" htmlFor="editionYear">
                  <Input name="editionYear" type="number" min={2000} max={2100} />
                </Field>
                <Field label="Fecha del examen" htmlFor="examDate">
                  <Input name="examDate" type="date" />
                </Field>
                <div className="sm:col-span-2">
                  <Field label="Descripción" htmlFor="description">
                    <Textarea name="description" rows={2} />
                  </Field>
                </div>
              </div>
            </InlineCreate>
          ) : null
        }
      />

      {oposiciones.length === 0 ? (
        <Card>
          <EmptyState
            icon={<GraduationCap className="size-5" />}
            title="Todavía no hay oposiciones"
            description="Crea la primera para empezar a organizar cursos, contenido y alumnos."
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {oposiciones.map((oposicion) => (
            <Card key={oposicion.id}>
              <CardContent className="space-y-4 p-5 pt-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="font-semibold text-ink">{oposicion.name}</h2>
                    <p className="text-sm text-ink-muted">
                      {[
                        oposicion.type?.name,
                        oposicion.authority,
                        oposicion.scope,
                        oposicion.code,
                      ]
                        .filter(Boolean)
                        .join(" · ") || "Sin clasificar"}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <Badge tone={oposicion.status === "ACTIVE" ? "positive" : "neutral"}>
                      {oposicion.status === "ACTIVE" ? "Activa" : "Archivada"}
                    </Badge>

                    {puedeEscribir ? (
                      <>
                        <InlineCreate
                          action={updateOppositionAction}
                          label="Editar"
                          icon={<Pencil aria-hidden />}
                          title={`Editar ${oposicion.name}`}
                          successMessage="Oposición actualizada."
                        >
                          <input
                            type="hidden"
                            name="oppositionId"
                            value={oposicion.id}
                          />
                          <div className="grid gap-4 sm:grid-cols-2">
                            <Field label="Nombre" htmlFor={`n-${oposicion.id}`} required>
                              <Input name="name" defaultValue={oposicion.name} required />
                            </Field>
                            <Field label="Familia" htmlFor={`t-${oposicion.id}`}>
                              <Select name="typeId" defaultValue={oposicion.typeId ?? ""}>
                                <option value="">Sin clasificar</option>
                                {tipos.map((tipo) => (
                                  <option key={tipo.id} value={tipo.id}>
                                    {tipo.name}
                                  </option>
                                ))}
                              </Select>
                            </Field>
                            <Field label="Código" htmlFor={`c-${oposicion.id}`}>
                              <Input name="code" defaultValue={oposicion.code ?? ""} />
                            </Field>
                            <Field
                              label="Administración convocante"
                              htmlFor={`a-${oposicion.id}`}
                            >
                              <Input
                                name="authority"
                                defaultValue={oposicion.authority ?? ""}
                              />
                            </Field>
                            <Field label="Ámbito" htmlFor={`s-${oposicion.id}`}>
                              <Input name="scope" defaultValue={oposicion.scope ?? ""} />
                            </Field>
                            <Field
                              label="Estado"
                              htmlFor={`e-${oposicion.id}`}
                              hint="Archivada deja de aparecer al dar de alta, pero conserva todo."
                            >
                              <Select name="status" defaultValue={oposicion.status}>
                                <option value="ACTIVE">Activa</option>
                                <option value="ARCHIVED">Archivada</option>
                              </Select>
                            </Field>
                            <div className="sm:col-span-2">
                              <Field label="Descripción" htmlFor={`d-${oposicion.id}`}>
                                <Textarea
                                  name="description"
                                  rows={2}
                                  defaultValue={oposicion.description ?? ""}
                                />
                              </Field>
                            </div>
                          </div>
                        </InlineCreate>

                        <InlineCreate
                          action={deleteOppositionAction}
                          label="Eliminar"
                          icon={<Trash2 aria-hidden />}
                          variant="ghost"
                          submitLabel="Eliminar definitivamente"
                          title={`Eliminar ${oposicion.name}`}
                          successMessage="Oposición eliminada."
                          aviso="Se eliminarán también sus convocatorias, sus cursos y su contenido. No se puede si hay alumnos matriculados: en ese caso archívala."
                        >
                          <input
                            type="hidden"
                            name="oppositionId"
                            value={oposicion.id}
                          />
                          <Field
                            label={`Escribe «${oposicion.name}» para confirmar`}
                            htmlFor={`conf-${oposicion.id}`}
                            required
                          >
                            <Input name="confirmacion" autoComplete="off" required />
                          </Field>
                        </InlineCreate>
                      </>
                    ) : null}
                  </div>
                </div>

                <ul className="space-y-2">
                  {oposicion.editions.map((edicion) => (
                    <li
                      key={edicion.id}
                      className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-[var(--radius-control)] border border-line px-3 py-2 text-sm"
                    >
                      <span className="font-medium text-ink">{edicion.name}</span>
                      <span className="flex items-center gap-1 text-xs text-ink-muted">
                        <CalendarDays className="size-3.5" aria-hidden />
                        {edicion.examDate
                          ? `Examen ${formatDate(edicion.examDate)}`
                          : "Sin fecha de examen"}
                      </span>
                      <span className="flex items-center gap-1 text-xs text-ink-muted">
                        <Users className="size-3.5" aria-hidden />
                        {edicion._count.courses}{" "}
                        {edicion._count.courses === 1 ? "curso" : "cursos"}
                      </span>
                      <span className="text-xs text-ink-muted">
                        {edicion._count.contentNodes} elementos de contenido
                      </span>
                      {edicion.positions ? (
                        <span className="text-xs text-ink-muted">
                          {edicion.positions} plazas
                        </span>
                      ) : null}

                      {puedeEscribir ? (
                        <span className="ml-auto flex items-center gap-1">
                          <InlineCreate
                            action={updateEditionAction}
                            label="Editar"
                            icon={<Pencil aria-hidden />}
                            variant="ghost"
                            title={`Editar ${edicion.name}`}
                            successMessage="Convocatoria actualizada."
                          >
                            <input type="hidden" name="editionId" value={edicion.id} />
                            <div className="grid gap-4 sm:grid-cols-2">
                              <Field label="Nombre" htmlFor={`en-${edicion.id}`} required>
                                <Input name="name" defaultValue={edicion.name} required />
                              </Field>
                              <Field label="Año" htmlFor={`ey-${edicion.id}`}>
                                <Input
                                  name="year"
                                  type="number"
                                  min={2000}
                                  max={2100}
                                  defaultValue={edicion.year ?? ""}
                                />
                              </Field>
                              <Field label="Fecha del examen" htmlFor={`ed-${edicion.id}`}>
                                <Input
                                  name="examDate"
                                  type="date"
                                  defaultValue={fechaParaInput(edicion.examDate)}
                                />
                              </Field>
                              <Field label="Plazas convocadas" htmlFor={`ep-${edicion.id}`}>
                                <Input
                                  name="positions"
                                  type="number"
                                  min={0}
                                  defaultValue={edicion.positions ?? ""}
                                />
                              </Field>
                              <div className="sm:col-span-2">
                                <Field label="Estado" htmlFor={`es-${edicion.id}`}>
                                  <Select name="status" defaultValue={edicion.status}>
                                    <option value="PLANNED">Prevista</option>
                                    <option value="OPEN">Abierta</option>
                                    <option value="CLOSED">Cerrada</option>
                                    <option value="ARCHIVED">Archivada</option>
                                  </Select>
                                </Field>
                              </div>
                            </div>
                          </InlineCreate>

                          <InlineCreate
                            action={deleteEditionAction}
                            label="Eliminar"
                            icon={<Trash2 aria-hidden />}
                            variant="ghost"
                            submitLabel="Eliminar convocatoria"
                            title={`Eliminar ${edicion.name}`}
                            successMessage="Convocatoria eliminada."
                            aviso="Se eliminarán también sus cursos y su contenido. No se puede si hay alumnos matriculados."
                          >
                            <input type="hidden" name="editionId" value={edicion.id} />
                            <p className="text-sm text-ink-soft">
                              ¿Seguro que quieres eliminar «{edicion.name}»?
                            </p>
                          </InlineCreate>
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>

                {puedeEscribir ? (
                  <InlineCreate
                    action={createEditionAction}
                    label="Añadir convocatoria"
                    title={`Nueva convocatoria de ${oposicion.name}`}
                    successMessage="Convocatoria creada."
                  >
                    <input type="hidden" name="oppositionId" value={oposicion.id} />
                    <div className="grid gap-4 sm:grid-cols-3">
                      <Field label="Nombre" htmlFor={`name-${oposicion.id}`} required>
                        <Input name="name" placeholder="Convocatoria 2027" required />
                      </Field>
                      <Field label="Año" htmlFor={`year-${oposicion.id}`}>
                        <Input name="year" type="number" min={2000} max={2100} />
                      </Field>
                      <Field label="Fecha del examen" htmlFor={`exam-${oposicion.id}`}>
                        <Input name="examDate" type="date" />
                      </Field>
                    </div>
                  </InlineCreate>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
