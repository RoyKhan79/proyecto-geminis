"use client";

import { useActionState, useState } from "react";
import { Plus, X } from "lucide-react";
import { createRoomAction, type TaskState } from "@/server/tasks/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, Field, Input, Select } from "@/components/ui/primitives";

/**
 * Crear una sala online permanente.
 */
export function RoomForm({
  cursos,
}: {
  cursos: { id: string; name: string; grupos: { id: string; name: string }[] }[];
}) {
  const [abierto, setAbierto] = useState(false);
  const [cursoId, setCursoId] = useState("");
  const [state, formAction, pending] = useActionState<TaskState, FormData>(
    createRoomAction,
    undefined,
  );

  const grupos = cursos.find((c) => c.id === cursoId)?.grupos ?? [];

  if (!abierto) {
    return (
      <Button size="sm" onClick={() => setAbierto(true)}>
        <Plus aria-hidden />
        Nueva sala
      </Button>
    );
  }

  return (
    <Card className="w-full">
      <CardContent className="space-y-4 p-5 pt-5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-ink">Nueva sala online</h3>
          <Button variant="ghost" size="icon" onClick={() => setAbierto(false)} aria-label="Cerrar">
            <X aria-hidden />
          </Button>
        </div>

        {state?.error ? (
          <p role="alert" className="text-sm text-critical">{state.error}</p>
        ) : null}
        {state?.ok ? (
          <p role="status" className="text-sm text-positive">{state.ok}</p>
        ) : null}

        <form action={formAction} className="grid gap-4 sm:grid-cols-2">
          <Field label="Nombre" htmlFor="name" required>
            <Input name="name" placeholder="Aula virtual · grupo tarde" required />
          </Field>

          <Field label="Enlace" htmlFor="url" required hint="Zoom, Meet, Teams…">
            <Input name="url" type="url" placeholder="https://…" required />
          </Field>

          <Field label="Curso" htmlFor="courseId">
            <Select name="courseId" value={cursoId} onChange={(e) => setCursoId(e.target.value)}>
              <option value="">Toda la academia</option>
              {cursos.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
          </Field>

          <Field label="Grupo" htmlFor="groupId">
            <Select name="groupId" disabled={!cursoId} defaultValue="">
              <option value="">Todo el curso</option>
              {grupos.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </Select>
          </Field>

          <Field label="Horario" htmlFor="schedule" hint="Cuándo hay alguien dentro.">
            <Input name="schedule" placeholder="L-J de 18:00 a 20:00" />
          </Field>

          <Field label="Descripción" htmlFor="description">
            <Input name="description" placeholder="Dudas y tutorías" />
          </Field>

          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button type="button" variant="ghost" onClick={() => setAbierto(false)}>Cancelar</Button>
            <Button type="submit" loading={pending}>Crear sala</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
