"use client";

import { useActionState } from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { updateClassAction, type ClassState } from "@/server/classes/actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Field,
  Input,
  Select,
  Textarea,
} from "@/components/ui/primitives";

/**
 * Gestión posterior a la clase: estado, grabación y resumen.
 * Publicar la grabación avisa al alumnado del grupo automáticamente.
 */
export function ClassAdminForm({
  classId,
  status,
  recordingUrl,
  summary,
}: {
  classId: string;
  status: string;
  recordingUrl: string | null;
  summary: string | null;
}) {
  const [state, formAction, pending] = useActionState<ClassState, FormData>(
    updateClassAction,
    undefined,
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Después de la clase</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 p-5 pt-0">
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

        <form action={formAction} className="space-y-4">
          <input type="hidden" name="classId" value={classId} />

          <Field label="Estado" htmlFor="status">
            <Select name="status" defaultValue={status}>
              <option value="SCHEDULED">Programada</option>
              <option value="LIVE">En directo</option>
              <option value="FINISHED">Impartida</option>
              <option value="CANCELLED">Cancelada</option>
            </Select>
          </Field>

          <Field
            label="Enlace de la grabación"
            htmlFor="recordingUrl"
            hint="Al guardarlo, el alumnado del grupo recibe un aviso."
          >
            <Input
              name="recordingUrl"
              type="url"
              defaultValue={recordingUrl ?? ""}
              placeholder="https://…"
            />
          </Field>

          <Field
            label="Resumen de lo dado"
            htmlFor="summary"
            hint="Lo escribe el profesor. La IA podrá proponerlo más adelante, pero se publica con revisión."
          >
            <Textarea name="summary" rows={3} defaultValue={summary ?? ""} />
          </Field>

          <div className="flex justify-end">
            <Button type="submit" loading={pending}>
              Guardar
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
