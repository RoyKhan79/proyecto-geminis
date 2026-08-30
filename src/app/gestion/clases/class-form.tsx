"use client";

import { useActionState, useState } from "react";
import { AlertCircle, CalendarPlus, CheckCircle2, X } from "lucide-react";
import { createClassAction, type ClassState } from "@/server/classes/actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  Field,
  Input,
  Select,
  Textarea,
} from "@/components/ui/primitives";

/**
 * Un curso, tal como se ofrece en el desplegable.
 */
export type CursoOpcion = {
  id: string;
  name: string;
  grupos: { id: string; name: string }[];
};

/**
 * Un profesor, tal como se ofrece en el desplegable.
 */
export type ProfesorOpcion = { id: string; nombre: string };
/**
 * Un tema del temario, para poder decir de qué va la clase.
 */
export type TemaOpcion = { id: string; label: string };

/**
 * Formulario para programar una clase en la agenda.
 */
export function ClassForm({
  cursos,
  profesores,
  temas,
}: {
  cursos: CursoOpcion[];
  profesores: ProfesorOpcion[];
  temas: TemaOpcion[];
}) {
  const [abierto, setAbierto] = useState(false);
  const [cursoId, setCursoId] = useState("");
  const [state, formAction, pending] = useActionState<ClassState, FormData>(
    createClassAction,
    undefined,
  );

  const grupos = cursos.find((c) => c.id === cursoId)?.grupos ?? [];

  if (!abierto) {
    return (
      <Button size="sm" onClick={() => setAbierto(true)}>
        <CalendarPlus aria-hidden />
        Programar clase
      </Button>
    );
  }

  return (
    <Card className="w-full">
      <CardContent className="space-y-4 p-5 pt-5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-ink">Programar una clase</h3>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setAbierto(false)}
            aria-label="Cerrar"
          >
            <X aria-hidden />
          </Button>
        </div>

        {state?.error ? (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-[var(--radius-control)] bg-critical-soft px-3 py-2 text-sm text-critical"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
            {state.error}
          </p>
        ) : null}

        {state?.ok ? (
          <p
            role="status"
            className="flex items-start gap-2 rounded-[var(--radius-control)] bg-positive-soft px-3 py-2 text-sm text-positive"
          >
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
            {state.ok} El alumnado del grupo recibe un aviso.
          </p>
        ) : null}

        <form action={formAction} className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Título" htmlFor="title" required>
              <Input
                name="title"
                placeholder="Tema 6 · El procedimiento administrativo"
                required
              />
            </Field>
          </div>

          <Field label="Curso" htmlFor="courseId">
            <Select
              name="courseId"
              value={cursoId}
              onChange={(e) => setCursoId(e.target.value)}
            >
              <option value="">Sin curso concreto</option>
              {cursos.map((curso) => (
                <option key={curso.id} value={curso.id}>
                  {curso.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="Grupo"
            htmlFor="groupId"
            hint={cursoId ? undefined : "Elige antes un curso."}
          >
            <Select name="groupId" disabled={!cursoId} defaultValue="">
              <option value="">Todo el curso</option>
              {grupos.map((grupo) => (
                <option key={grupo.id} value={grupo.id}>
                  {grupo.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Fecha" htmlFor="fecha" required>
            <Input name="fecha" type="date" required />
          </Field>

          <Field label="Hora" htmlFor="horaInicio" required>
            <Input name="horaInicio" type="time" defaultValue="18:00" required />
          </Field>

          <Field label="Duración (minutos)" htmlFor="duracion">
            <Input name="duracion" type="number" min={15} max={600} defaultValue={90} />
          </Field>

          <Field label="Profesor" htmlFor="teacherId">
            <Select name="teacherId" defaultValue="">
              <option value="">Sin asignar</option>
              {profesores.map((profesor) => (
                <option key={profesor.id} value={profesor.id}>
                  {profesor.nombre}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Tema que se imparte" htmlFor="nodeId">
            <Select name="nodeId" defaultValue="">
              <option value="">Sin asociar</option>
              {temas.map((tema) => (
                <option key={tema.id} value={tema.id}>
                  {tema.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Aula o lugar" htmlFor="location">
            <Input name="location" placeholder="Aula 2 · Sede centro" />
          </Field>

          <div className="sm:col-span-2">
            <Field
              label="Enlace del aula virtual"
              htmlFor="meetingUrl"
              hint="Zoom, Meet, Teams… lo que ya uséis."
            >
              <Input name="meetingUrl" type="url" placeholder="https://…" />
            </Field>
          </div>

          <div className="sm:col-span-2">
            <Field label="Descripción" htmlFor="description">
              <Textarea name="description" rows={2} />
            </Field>
          </div>

          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button type="button" variant="ghost" onClick={() => setAbierto(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={pending}>
              Programar
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
