"use client";

import { useActionState, useState } from "react";
import { AlertCircle, CheckCircle2, Send } from "lucide-react";
import {
  sendCommunicationAction,
  type ComState,
} from "@/server/communications/actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  Field,
  Input,
  Select,
  Textarea,
} from "@/components/ui/primitives";

type Opcion = { id: string; name: string };

export function CommunicationForm({
  cursos,
  grupos,
  oposiciones,
}: {
  cursos: Opcion[];
  grupos: Opcion[];
  oposiciones: Opcion[];
}) {
  const [destino, setDestino] = useState("TODOS");
  const [state, formAction, pending] = useActionState<ComState, FormData>(
    sendCommunicationAction,
    undefined,
  );

  const opciones =
    destino === "CURSO"
      ? cursos
      : destino === "GRUPO"
        ? grupos
        : destino === "OPOSICION"
          ? oposiciones
          : [];

  return (
    <Card>
      <CardContent className="space-y-4 p-5 pt-5">
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
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Enviar a" htmlFor="destino" required>
              <Select
                name="destino"
                value={destino}
                onChange={(e) => setDestino(e.target.value)}
              >
                <option value="TODOS">Toda la academia</option>
                <option value="OPOSICION">Una oposición</option>
                <option value="CURSO">Un curso</option>
                <option value="GRUPO">Un grupo</option>
              </Select>
            </Field>

            {destino !== "TODOS" ? (
              <Field label="¿Cuál?" htmlFor="destinoId" required>
                <Select name="destinoId" required defaultValue="">
                  <option value="">Elige</option>
                  {opciones.map((opcion) => (
                    <option key={opcion.id} value={opcion.id}>
                      {opcion.name}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : null}
          </div>

          <Field label="Asunto" htmlFor="titulo" required>
            <Input name="titulo" placeholder="Cambio de aula el jueves" required />
          </Field>

          <Field label="Mensaje" htmlFor="cuerpo" required>
            <Textarea name="cuerpo" rows={4} required />
          </Field>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-sm text-ink">
              <input type="checkbox" name="porCorreo" className="size-4" />
              Enviar también por correo electrónico
            </label>
            <Button type="submit" loading={pending}>
              <Send aria-hidden />
              Enviar
            </Button>
          </div>

          <p className="text-xs text-ink-muted">
            El aviso aparece siempre dentro del Campus. Push, SMS y WhatsApp están
            previstos y llegarán más adelante.
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
