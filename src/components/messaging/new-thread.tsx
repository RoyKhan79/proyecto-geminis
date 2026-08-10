"use client";

import { useActionState, useState } from "react";
import { MessageSquarePlus, X } from "lucide-react";
import { startThreadAction, type MsgState } from "@/server/messaging/actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  Field,
  Input,
  Select,
  Textarea,
} from "@/components/ui/primitives";

/** Caja para que el alumno abra una consulta con su academia. */
export function NewThread({
  profesores,
}: {
  profesores: { id: string; nombre: string }[];
}) {
  const [abierto, setAbierto] = useState(false);
  const [state, formAction, pending] = useActionState<MsgState, FormData>(
    startThreadAction,
    undefined,
  );

  if (!abierto) {
    return (
      <Button size="sm" onClick={() => setAbierto(true)}>
        <MessageSquarePlus aria-hidden />
        Nueva consulta
      </Button>
    );
  }

  return (
    <Card>
      <CardContent className="space-y-3 p-4 pt-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-ink">Escribe a tu academia</p>
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
          <p role="alert" className="text-sm text-critical">
            {state.error}
          </p>
        ) : null}
        {state?.ok ? (
          <p role="status" className="text-sm text-positive">
            {state.ok}
          </p>
        ) : null}

        <form action={formAction} className="space-y-3">
          <Field label="Asunto" htmlFor="subject" required>
            <Input name="subject" placeholder="Duda del tema 6" required />
          </Field>

          {profesores.length > 0 ? (
            <Field
              label="Para"
              htmlFor="teacherId"
              hint="Si no eliges a nadie, lo atiende quien esté disponible."
            >
              <Select name="teacherId" defaultValue="">
                <option value="">La academia</option>
                {profesores.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
              </Select>
            </Field>
          ) : null}

          <Field label="Mensaje" htmlFor="body" required>
            <Textarea name="body" rows={4} required />
          </Field>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setAbierto(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={pending}>
              Enviar
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
