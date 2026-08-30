"use client";

import { useActionState, useState } from "react";
import { AlertCircle, CheckCircle2, Plus, X } from "lucide-react";
import { createExamAction, type ExamState } from "@/server/exams/actions";
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
 * Convocar un examen de desarrollo.
 *
 * Se parece a crear una tarea, pero lo que cambia es lo que hace distinto a un
 * examen: la hora a la que se abre y los minutos que dura. Se explican en la
 * propia pantalla porque la diferencia entre las dos fechas —cuándo se abre y
 * cuándo se cierra— y el reloj personal de cada alumno no es evidente hasta que
 * alguien te la cuenta una vez.
 */
export function ExamForm({
  cursos,
  temas,
}: {
  cursos: { id: string; name: string; grupos: { id: string; name: string }[] }[];
  temas: { id: string; label: string }[];
}) {
  const [abierto, setAbierto] = useState(false);
  const [cursoId, setCursoId] = useState("");
  const [state, formAction, pending] = useActionState<ExamState, FormData>(
    createExamAction,
    undefined,
  );

  const grupos = cursos.find((c) => c.id === cursoId)?.grupos ?? [];

  if (!abierto) {
    return (
      <Button size="sm" onClick={() => setAbierto(true)}>
        <Plus aria-hidden />
        Convocar examen
      </Button>
    );
  }

  return (
    <Card className="w-full">
      <CardContent className="space-y-4 p-5 pt-5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-ink">
            Convocar examen de desarrollo
          </h3>
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
            {state.ok}
          </p>
        ) : null}

        <form action={formAction} className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Título" htmlFor="title" required>
              <Input
                name="title"
                placeholder="Examen de desarrollo · Tema 12, acto administrativo"
                required
              />
            </Field>
          </div>

          <Field label="Curso" htmlFor="courseId" required>
            <Select
              name="courseId"
              value={cursoId}
              onChange={(e) => setCursoId(e.target.value)}
              required
            >
              <option value="">Elige un curso</option>
              {cursos.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
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
              {grupos.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="Se abre"
            htmlFor="opensAt"
            hint="Antes de esta hora nadie puede empezarlo."
          >
            <Input name="opensAt" type="datetime-local" />
          </Field>

          <Field
            label="Se cierra"
            htmlFor="dueAt"
            hint="Después de esta hora ya no se puede escribir, aunque queden minutos."
          >
            <Input name="dueAt" type="datetime-local" />
          </Field>

          <Field
            label="Minutos por alumno"
            htmlFor="timeLimitMinutes"
            hint="Cuentan desde que cada uno lo abre. Déjalo vacío para no poner reloj."
          >
            <Input
              name="timeLimitMinutes"
              type="number"
              min={5}
              max={600}
              placeholder="90"
            />
          </Field>

          <Field label="Nota máxima" htmlFor="maxScore">
            <Input name="maxScore" type="number" min={1} max={100} defaultValue={10} />
          </Field>

          <div className="sm:col-span-2">
            <Field label="Tema relacionado" htmlFor="nodeId">
              <Select name="nodeId" defaultValue="">
                <option value="">Sin asociar</option>
                {temas.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <div className="sm:col-span-2">
            <Field
              label="Enunciado"
              htmlFor="instructions"
              hint="Lo verá el alumno antes de empezar y mientras escribe."
            >
              <Textarea
                name="instructions"
                rows={5}
                placeholder="Desarrolle el concepto de acto administrativo, sus elementos y sus clases. Extensión orientativa: 4 caras."
              />
            </Field>
          </div>

          <div className="flex flex-wrap gap-4 sm:col-span-2">
            <label className="flex items-center gap-2 text-sm text-ink">
              <input type="checkbox" name="allowFiles" defaultChecked className="size-4" />
              Permitir adjuntar archivos (esquemas, foto de la hoja)
            </label>
            <label className="flex items-center gap-2 text-sm text-ink">
              <input type="checkbox" name="publicar" defaultChecked className="size-4" />
              Convocar y avisar al alumnado
            </label>
          </div>

          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button type="button" variant="ghost" onClick={() => setAbierto(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={pending}>
              Convocar
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
