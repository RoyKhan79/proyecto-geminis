"use client";

import { useActionState, useState } from "react";
import { AlertCircle, CheckCircle2, Plus, X } from "lucide-react";
import { createAssignmentAction, type TaskState } from "@/server/tasks/actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  Field,
  Input,
  Select,
  Textarea,
} from "@/components/ui/primitives";

export function AssignmentForm({
  cursos,
  temas,
}: {
  cursos: { id: string; name: string; grupos: { id: string; name: string }[] }[];
  temas: { id: string; label: string }[];
}) {
  const [abierto, setAbierto] = useState(false);
  const [cursoId, setCursoId] = useState("");
  const [state, formAction, pending] = useActionState<TaskState, FormData>(
    createAssignmentAction,
    undefined,
  );

  const grupos = cursos.find((c) => c.id === cursoId)?.grupos ?? [];

  if (!abierto) {
    return (
      <Button size="sm" onClick={() => setAbierto(true)}>
        <Plus aria-hidden />
        Nueva tarea
      </Button>
    );
  }

  return (
    <Card className="w-full">
      <CardContent className="space-y-4 p-5 pt-5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-ink">Nueva tarea</h3>
          <Button variant="ghost" size="icon" onClick={() => setAbierto(false)} aria-label="Cerrar">
            <X aria-hidden />
          </Button>
        </div>

        {state?.error ? (
          <p role="alert" className="flex items-start gap-2 rounded-[var(--radius-control)] bg-critical-soft px-3 py-2 text-sm text-critical">
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
            {state.error}
          </p>
        ) : null}
        {state?.ok ? (
          <p role="status" className="flex items-start gap-2 rounded-[var(--radius-control)] bg-positive-soft px-3 py-2 text-sm text-positive">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
            {state.ok}
          </p>
        ) : null}

        <form action={formAction} className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Título" htmlFor="title" required>
              <Input name="title" placeholder="Supuesto práctico · procedimiento sancionador" required />
            </Field>
          </div>

          <Field label="Curso" htmlFor="courseId" required>
            <Select name="courseId" value={cursoId} onChange={(e) => setCursoId(e.target.value)} required>
              <option value="">Elige un curso</option>
              {cursos.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
          </Field>

          <Field label="Grupo" htmlFor="groupId" hint={cursoId ? undefined : "Elige antes un curso."}>
            <Select name="groupId" disabled={!cursoId} defaultValue="">
              <option value="">Todo el curso</option>
              {grupos.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </Select>
          </Field>

          <Field label="Fecha de entrega" htmlFor="dueAt">
            <Input name="dueAt" type="date" />
          </Field>

          <Field label="Nota máxima" htmlFor="maxScore">
            <Input name="maxScore" type="number" min={1} max={100} defaultValue={10} />
          </Field>

          <Field label="Tema relacionado" htmlFor="nodeId">
            <Select name="nodeId" defaultValue="">
              <option value="">Sin asociar</option>
              {temas.map((t) => (
                <option key={t.id} value={t.id}>{t.label}</option>
              ))}
            </Select>
          </Field>

          <div className="sm:col-span-2">
            <Field label="Instrucciones" htmlFor="instructions">
              <Textarea name="instructions" rows={4} placeholder="Qué tienen que hacer, extensión, criterios de corrección…" />
            </Field>
          </div>

          <div className="flex flex-wrap gap-4 sm:col-span-2">
            <label className="flex items-center gap-2 text-sm text-ink">
              <input type="checkbox" name="allowLate" defaultChecked className="size-4" />
              Admitir entregas fuera de plazo (marcadas como tal)
            </label>
            <label className="flex items-center gap-2 text-sm text-ink">
              <input type="checkbox" name="publicar" defaultChecked className="size-4" />
              Publicar y avisar al alumnado
            </label>
          </div>

          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button type="button" variant="ghost" onClick={() => setAbierto(false)}>Cancelar</Button>
            <Button type="submit" loading={pending}>Crear tarea</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
