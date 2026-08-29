"use client";

import { useActionState, useState } from "react";
import { AlertCircle, CheckCircle2, Plus, Timer, X } from "lucide-react";
import {
  createBlueprintAction,
  createSimulationAction,
  type SimState,
} from "@/server/simulations/actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  Field,
  Input,
  Select,
  Textarea,
} from "@/components/ui/primitives";

type Plantilla = { id: string; name: string; totalQuestions: number };
type Edicion = { id: string; name: string; opposition: { name: string } };

function Aviso({ state }: { state: SimState }) {
  if (state?.error) {
    return (
      <p role="alert" className="flex items-start gap-2 rounded-[var(--radius-control)] bg-critical-soft px-3 py-2 text-sm text-critical">
        <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
        {state.error}
      </p>
    );
  }
  if (state?.ok) {
    return (
      <p role="status" className="flex items-start gap-2 rounded-[var(--radius-control)] bg-positive-soft px-3 py-2 text-sm text-positive">
        <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
        {state.ok}
      </p>
    );
  }
  return null;
}

export function SimulationForms({
  plantillas,
  ediciones,
}: {
  plantillas: Plantilla[];
  ediciones: Edicion[];
}) {
  const [panel, setPanel] = useState<"none" | "plantilla" | "simulacro">("none");

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="secondary"
          onClick={() => setPanel(panel === "plantilla" ? "none" : "plantilla")}
        >
          <Plus aria-hidden />
          Nueva plantilla de examen
        </Button>
        <Button
          size="sm"
          onClick={() => setPanel(panel === "simulacro" ? "none" : "simulacro")}
          disabled={plantillas.length === 0}
        >
          <Timer aria-hidden />
          Nuevo simulacro
        </Button>
      </div>

      {panel === "plantilla" ? (
        <PlantillaForm ediciones={ediciones} onClose={() => setPanel("none")} />
      ) : null}
      {panel === "simulacro" ? (
        <SimulacroForm plantillas={plantillas} onClose={() => setPanel("none")} />
      ) : null}
    </div>
  );
}

function PlantillaForm({
  ediciones,
  onClose,
}: {
  ediciones: Edicion[];
  onClose: () => void;
}) {
  const [state, action, pending] = useActionState<SimState, FormData>(
    createBlueprintAction,
    undefined,
  );

  return (
    <Card>
      <CardContent className="space-y-4 p-5 pt-5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-ink">Plantilla de examen</h3>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Cerrar">
            <X aria-hidden />
          </Button>
        </div>

        <p className="text-xs text-ink-muted">
          Copia aquí las condiciones de las bases de la convocatoria. Es lo que hace
          que el simulacro se parezca al examen de verdad.
        </p>

        <Aviso state={state} />

        <form action={action} className="grid gap-4 sm:grid-cols-2">
          <Field label="Nombre" htmlFor="name" required>
            <Input name="name" placeholder="Administrativo del Estado · primer ejercicio" required />
          </Field>

          <Field label="Convocatoria" htmlFor="editionId">
            <Select name="editionId" defaultValue="">
              <option value="">Cualquiera</option>
              {ediciones.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.opposition.name} · {e.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Número de preguntas" htmlFor="totalQuestions" required>
            <Input name="totalQuestions" type="number" min={5} max={300} defaultValue={100} required />
          </Field>

          <Field label="Opciones por pregunta" htmlFor="optionsPerQuestion">
            <Input name="optionsPerQuestion" type="number" min={2} max={6} defaultValue={4} />
          </Field>

          <Field label="Duración (minutos)" htmlFor="durationMinutes" required>
            <Input name="durationMinutes" type="number" min={5} max={600} defaultValue={90} required />
          </Field>

          <Field
            label="Penalización por fallo"
            htmlFor="penalty"
            hint="Escríbelo como en las bases: 1/3, 1/4 o 0."
          >
            <Input name="penalty" defaultValue="1/3" />
          </Field>

          <Field label="Nota de corte" htmlFor="passingScore" hint="Opcional, sobre 100.">
            <Input name="passingScore" type="number" min={0} max={100} step="0.5" />
          </Field>

          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button type="submit" loading={pending}>Crear plantilla</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function SimulacroForm({
  plantillas,
  onClose,
}: {
  plantillas: Plantilla[];
  onClose: () => void;
}) {
  const [state, action, pending] = useActionState<SimState, FormData>(
    createSimulationAction,
    undefined,
  );

  return (
    <Card>
      <CardContent className="space-y-4 p-5 pt-5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-ink">Nuevo simulacro</h3>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Cerrar">
            <X aria-hidden />
          </Button>
        </div>

        <Aviso state={state} />

        <form action={action} className="grid gap-4 sm:grid-cols-2">
          <Field label="Plantilla" htmlFor="blueprintId" required>
            <Select name="blueprintId" required defaultValue="">
              <option value="">Elige la plantilla</option>
              {plantillas.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.totalQuestions} preguntas)
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Título" htmlFor="title" required>
            <Input name="title" placeholder="Simulacro 1 · noviembre" required />
          </Field>

          <Field label="Disponible desde" htmlFor="availableFrom">
            <Input name="availableFrom" type="date" />
          </Field>

          <Field label="Disponible hasta" htmlFor="availableUntil">
            <Input name="availableUntil" type="date" />
          </Field>

          <Field label="Intentos máximos" htmlFor="maxAttempts" hint="Vacío = sin límite.">
            <Input name="maxAttempts" type="number" min={1} max={10} />
          </Field>

          <div className="sm:col-span-2">
            <Field label="Descripción" htmlFor="description">
              <Textarea name="description" rows={2} />
            </Field>
          </div>

          <label className="flex items-center gap-2 text-sm text-ink sm:col-span-2">
            <input type="checkbox" name="publicar" className="size-4" />
            Publicar ya en el Campus
          </label>

          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button type="submit" loading={pending}>Crear simulacro</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
