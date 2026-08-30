"use client";

import { useActionState } from "react";
import { Send } from "lucide-react";
import { replyThreadAction, type MsgState } from "@/server/messaging/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, Textarea } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

/**
 * Un mensaje de una conversación, listo para pintar.
 */
export type MensajeVista = {
  id: string;
  body: string;
  autor: string;
  esPropio: boolean;
  createdAt: string;
};

const formatter = new Intl.DateTimeFormat("es-ES", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

/** Hilo de conversación con su caja de respuesta. */
export function ThreadView({
  threadId,
  mensajes,
}: {
  threadId: string;
  mensajes: MensajeVista[];
}) {
  const [state, formAction, pending] = useActionState<MsgState, FormData>(
    replyThreadAction,
    undefined,
  );

  return (
    <div className="space-y-3">
      <ul className="space-y-2">
        {mensajes.map((mensaje) => (
          <li
            key={mensaje.id}
            className={cn("flex", mensaje.esPropio ? "justify-end" : "justify-start")}
          >
            <div
              className={cn(
                "max-w-[85%] rounded-[var(--radius-card)] px-3.5 py-2.5",
                mensaje.esPropio
                  ? "bg-accent text-accent-contrast"
                  : "bg-surface-muted text-ink",
              )}
            >
              {!mensaje.esPropio ? (
                <p className="text-xs font-medium opacity-80">{mensaje.autor}</p>
              ) : null}
              <p className="whitespace-pre-line text-sm">{mensaje.body}</p>
              <p className="mt-0.5 text-[0.6875rem] opacity-70">
                {formatter.format(new Date(mensaje.createdAt))}
              </p>
            </div>
          </li>
        ))}
      </ul>

      <Card>
        <CardContent className="p-3">
          <form action={formAction} className="flex gap-2">
            <input type="hidden" name="threadId" value={threadId} />
            <Textarea
              name="body"
              rows={2}
              placeholder="Escribe tu respuesta…"
              className="min-h-11"
              required
            />
            <Button type="submit" size="icon" loading={pending} aria-label="Enviar">
              <Send aria-hidden />
            </Button>
          </form>
          {state?.error ? (
            <p role="alert" className="mt-2 text-xs text-critical">
              {state.error}
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
