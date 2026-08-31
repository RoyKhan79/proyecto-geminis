"use client";

import { useActionState, useRef, useState } from "react";
import { AlertCircle, Camera, Trash2 } from "lucide-react";
import {
  quitarFotoAlumnoAction,
  subirFotoAlumnoAction,
  type FormState,
} from "@/server/students/actions";
import { Avatar } from "@/components/ui/avatar";

/**
 * LA FOTO DEL ALUMNO
 *
 * Una academia con doscientos alumnos necesita ponerle cara a un nombre: el que
 * llama por teléfono, el que viene a recoger un certificado. Sin foto, la ficha
 * es una lista de campos.
 *
 * Se sube pulsando sobre la propia foto, que es donde todo el mundo pincha, y
 * el formulario se envía solo al elegir el archivo: pedir «elige» y luego
 * «guarda» es un paso de más para algo que solo puede significar una cosa.
 *
 * La imagen se sirve por la ruta protegida, así que se usa `<img>` y no el
 * componente de Next: su optimizador pide la imagen desde el servidor, sin la
 * cookie de sesión, y se llevaría un 401. Una foto de carné no necesita
 * optimización.
 */
export function FotoDelAlumno({
  membershipId,
  nombre,
  url,
  puedeEditar,
}: {
  membershipId: string;
  nombre: string;
  url: string | null;
  puedeEditar: boolean;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(
    subirFotoAlumnoAction,
    undefined,
  );
  const formulario = useRef<HTMLFormElement>(null);
  const [subiendo, setSubiendo] = useState(false);

  const foto = url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={`Foto de ${nombre}`}
      className="size-20 shrink-0 rounded-full border border-line object-cover"
    />
  ) : (
    <Avatar nombre={nombre} tamaño="lg" />
  );

  if (!puedeEditar) return foto;

  return (
    <div className="space-y-1.5">
      <form ref={formulario} action={formAction}>
        <input type="hidden" name="membershipId" value={membershipId} />

        <label
          className="group relative block cursor-pointer"
          title={url ? "Cambiar la foto" : "Subir una foto"}
        >
          {foto}
          <span
            className={[
              "absolute inset-0 flex items-center justify-center rounded-full",
              "bg-black/45 text-white opacity-0 transition-opacity",
              "group-hover:opacity-100 group-focus-within:opacity-100",
              subiendo ? "opacity-100" : "",
            ].join(" ")}
          >
            <Camera className="size-5" aria-hidden />
            <span className="sr-only">
              {url ? "Cambiar la foto" : "Subir una foto"}
            </span>
          </span>

          <input
            type="file"
            name="foto"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={(e) => {
              if (!e.target.files?.length) return;
              // Se envía al elegir. Pedir «elige» y luego «guarda» es un paso de
              // más para algo que solo puede significar una cosa.
              setSubiendo(true);
              formulario.current?.requestSubmit();
            }}
          />
        </label>
      </form>

      {url ? (
        <form action={quitarFotoAlumnoAction} className="text-center">
          <input type="hidden" name="membershipId" value={membershipId} />
          <button
            type="submit"
            className="inline-flex items-center gap-1 text-[0.7rem] text-ink-muted hover:text-critical"
          >
            <Trash2 className="size-3" aria-hidden />
            Quitar
          </button>
        </form>
      ) : null}

      {state?.error ? (
        <p
          role="alert"
          className="flex max-w-[9rem] items-start gap-1 text-[0.7rem] leading-snug text-critical"
        >
          <AlertCircle className="mt-0.5 size-3 shrink-0" aria-hidden />
          {state.error}
        </p>
      ) : null}
    </div>
  );
}
