"use client";

import { useActionState, useState } from "react";
import { MessageCircle, Pin, Send, Trash2 } from "lucide-react";
import {
  commentWallPostAction,
  deleteWallPostAction,
  publishWallPostAction,
  type WallState,
} from "@/server/wall/actions";
import { Button } from "@/components/ui/button";
import {
  Badge,
  Card,
  CardContent,
  EmptyState,
  Select,
  Textarea,
} from "@/components/ui/primitives";
import { cn, initials } from "@/lib/utils";

export type PublicacionMuro = {
  id: string;
  title: string | null;
  body: string;
  pinned: boolean;
  createdAt: string;
  autor: string;
  autorId: string;
  esProfesor: boolean;
  ambito: string | null;
  comentarios: {
    id: string;
    body: string;
    autor: string;
    esProfesor: boolean;
    createdAt: string;
  }[];
};

const relativo = (iso: string) => {
  const minutos = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutos < 1) return "ahora";
  if (minutos < 60) return `hace ${minutos} min`;
  const horas = Math.round(minutos / 60);
  if (horas < 24) return `hace ${horas} h`;
  const dias = Math.round(horas / 24);
  return dias === 1 ? "ayer" : `hace ${dias} días`;
};

export function Wall({
  publicaciones,
  grupos,
  puedeFijar,
  membershipId,
  puedeModerar,
}: {
  publicaciones: PublicacionMuro[];
  grupos: { id: string; name: string }[];
  puedeFijar: boolean;
  membershipId: string;
  puedeModerar: boolean;
}) {
  const [state, formAction, pending] = useActionState<WallState, FormData>(
    publishWallPostAction,
    undefined,
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 pt-4">
          <form action={formAction} className="space-y-3">
            <Textarea
              name="body"
              rows={3}
              placeholder={
                puedeFijar
                  ? "Escribe a tu clase: avisos, correcciones, ánimos antes del simulacro…"
                  : "Pregunta o comparte algo con tus compañeros de clase…"
              }
              required
            />

            {state?.error ? (
              <p role="alert" className="text-sm text-critical">
                {state.error}
              </p>
            ) : null}

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <Select name="groupId" defaultValue="" aria-label="Dónde publicar" className="w-auto">
                  {grupos.length === 0 ? <option value="">Sin grupo</option> : null}
                  {grupos.map((grupo) => (
                    <option key={grupo.id} value={grupo.id}>
                      {grupo.name}
                    </option>
                  ))}
                </Select>

                {puedeFijar ? (
                  <label className="flex items-center gap-1.5 text-xs text-ink-soft">
                    <input type="checkbox" name="pinned" className="size-3.5" />
                    Fijar arriba
                  </label>
                ) : null}
              </div>

              <Button type="submit" size="sm" loading={pending}>
                <Send aria-hidden />
                Publicar
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {publicaciones.length === 0 ? (
        <Card>
          <EmptyState
            icon={<MessageCircle className="size-5" />}
            title="El muro está vacío"
            description="Escribe lo primero y anima a los demás a participar."
          />
        </Card>
      ) : (
        publicaciones.map((publicacion) => (
          <Publicacion
            key={publicacion.id}
            publicacion={publicacion}
            membershipId={membershipId}
            puedeModerar={puedeModerar}
          />
        ))
      )}
    </div>
  );
}

function Publicacion({
  publicacion,
  membershipId,
  puedeModerar,
}: {
  publicacion: PublicacionMuro;
  membershipId: string;
  puedeModerar: boolean;
}) {
  const [abierto, setAbierto] = useState(false);
  const [state, formAction, pending] = useActionState<WallState, FormData>(
    commentWallPostAction,
    undefined,
  );

  const puedeBorrar = puedeModerar || publicacion.autorId === membershipId;

  return (
    <Card className={cn(publicacion.pinned && "border-accent")}>
      <CardContent className="space-y-3 p-4 pt-4">
        <div className="flex items-start gap-3">
          <span
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
              publicacion.esProfesor
                ? "bg-accent text-accent-contrast"
                : "bg-surface-muted text-ink-soft",
            )}
          >
            {initials(publicacion.autor.split(" ")[0] ?? "?", publicacion.autor.split(" ")[1])}
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <p className="text-sm font-medium text-ink">{publicacion.autor}</p>
              {publicacion.esProfesor ? <Badge tone="accent">Profesor</Badge> : null}
              {publicacion.pinned ? (
                <Badge tone="caution">
                  <Pin className="size-3" aria-hidden />
                  Fijado
                </Badge>
              ) : null}
              <span className="text-xs text-ink-muted">
                {relativo(publicacion.createdAt)}
                {publicacion.ambito ? ` · ${publicacion.ambito}` : ""}
              </span>
            </div>

            {publicacion.title ? (
              <p className="mt-1 font-medium text-ink">{publicacion.title}</p>
            ) : null}
            <p className="mt-1 whitespace-pre-line text-sm text-ink">
              {publicacion.body}
            </p>
          </div>

          {puedeBorrar ? (
            <form action={deleteWallPostAction}>
              <input type="hidden" name="postId" value={publicacion.id} />
              <Button
                type="submit"
                variant="ghost"
                size="icon"
                aria-label="Borrar publicación"
              >
                <Trash2 className="size-4" aria-hidden />
              </Button>
            </form>
          ) : null}
        </div>

        {publicacion.comentarios.length > 0 ? (
          <ul className="space-y-2 border-t border-line pt-3">
            {publicacion.comentarios.map((comentario) => (
              <li key={comentario.id} className="flex gap-2 text-sm">
                <span className="font-medium text-ink">
                  {comentario.autor}
                  {comentario.esProfesor ? " · profesor" : ""}:
                </span>
                <span className="min-w-0 flex-1 text-ink-soft">{comentario.body}</span>
                <span className="shrink-0 text-xs text-ink-muted">
                  {relativo(comentario.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        ) : null}

        {abierto ? (
          <form action={formAction} className="flex gap-2 border-t border-line pt-3">
            <input type="hidden" name="postId" value={publicacion.id} />
            <Textarea
              name="body"
              rows={1}
              placeholder="Escribe un comentario…"
              className="min-h-10"
              required
            />
            <Button type="submit" size="sm" loading={pending}>
              Enviar
            </Button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setAbierto(true)}
            className="flex items-center gap-1.5 text-xs font-medium text-accent hover:underline"
          >
            <MessageCircle className="size-3.5" aria-hidden />
            Comentar
          </button>
        )}

        {state?.error ? (
          <p role="alert" className="text-xs text-critical">
            {state.error}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
