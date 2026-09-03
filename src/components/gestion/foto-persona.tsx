"use client";

import { useActionState, useRef, useState } from "react";
import { AlertCircle, Camera, Trash2 } from "lucide-react";
import type { FormState } from "@/server/students/actions";
import { Avatar } from "@/components/ui/avatar";

/**
 * LA FOTO DE UNA PERSONA · alumnado y profesorado
 *
 * Una academia con doscientos alumnos necesita ponerle cara a un nombre: el que
 * llama por teléfono, el que viene a recoger un certificado. Sin foto, la ficha
 * es una lista de campos.
 *
 * Las dos acciones —subir y quitar— llegan como propiedades en vez de estar
 * escritas aquí. Es lo que permite que el mismo componente valga para el
 * alumnado y para el profesorado sin duplicarlo, y sobre todo que cada uno
 * conserve SU permiso: quien lleva las matrículas no tiene por qué poder
 * cambiarle la cara a un compañero. Si las acciones estuvieran dentro, ese
 * matiz se perdería en la primera copia y pega del archivo.
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
/** Lo que mide el lado mayor de la foto guardada. */
const LADO_MAXIMO = 512;

/**
 * REDUCE LA FOTO ANTES DE MANDARLA
 *
 * La foto de una ficha se enseña a 80 píxeles. Mandar los cuatro megas que
 * saca un móvil para eso es tirar el ancho de banda de la academia, llenar el
 * disco y hacer lenta la pantalla de alumnos, donde se cargan doscientas.
 *
 * Hay además dos razones que no son de rendimiento:
 *
 *   · **Se quita el EXIF.** Una foto de móvil lleva dentro el modelo, la fecha
 *     y muchas veces **las coordenadas GPS de dónde se hizo**. Eso viaja al
 *     servidor y se queda ahí para siempre pegado a la ficha de una persona,
 *     normalmente menor de edad. Volver a dibujarla en un lienzo deja solo los
 *     píxeles.
 *
 *   · **Se acaba el problema del tamaño.** Aunque el servidor ya admita 32 MB,
 *     una foto que se manda a 60 KB no depende de ningún límite.
 *
 * Si algo falla —un formato que el navegador no sabe decodificar, un lienzo
 * bloqueado— se devuelve el archivo original y que decida el servidor. Un
 * ayudante que rompe la subida cuando no puede ayudar es peor que no tenerlo.
 *
 * @param archivo El que ha elegido la persona.
 * @returns La versión reducida, o el original si no se ha podido.
 */
async function reducir(archivo: File): Promise<File> {
  try {
    // `from-image` respeta la orientación del EXIF ANTES de descartarlo. Sin
    // esto, las fotos hechas en vertical se guardan tumbadas.
    const bitmap = await createImageBitmap(archivo, { imageOrientation: "from-image" });

    const escala = Math.min(1, LADO_MAXIMO / Math.max(bitmap.width, bitmap.height));
    const ancho = Math.round(bitmap.width * escala);
    const alto = Math.round(bitmap.height * escala);

    const lienzo = document.createElement("canvas");
    lienzo.width = ancho;
    lienzo.height = alto;
    const pincel = lienzo.getContext("2d");
    if (!pincel) return archivo;
    pincel.drawImage(bitmap, 0, 0, ancho, alto);
    bitmap.close();

    const trozo = await new Promise<Blob | null>((listo) =>
      lienzo.toBlob(listo, "image/jpeg", 0.85),
    );
    if (!trozo) return archivo;

    // Si por lo que sea la reducida pesa más que la original, se manda la
    // original: pasa con imágenes ya optimizadas y muy pequeñas.
    if (trozo.size >= archivo.size) return archivo;

    return new File([trozo], "foto.jpg", { type: "image/jpeg" });
  } catch {
    return archivo;
  }
}

export function FotoDePersona({
  membershipId,
  nombre,
  url,
  puedeEditar,
  subir,
  quitar,
}: {
  membershipId: string;
  nombre: string;
  url: string | null;
  puedeEditar: boolean;
  /** La acción que sube la foto, con el permiso que corresponda. */
  subir: (prev: FormState, datos: FormData) => Promise<FormState>;
  /** La que la quita. */
  quitar: (datos: FormData) => void | Promise<void>;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(
    subir,
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
            onChange={async (e) => {
              const elegido = e.target.files?.[0];
              if (!elegido) return;
              setSubiendo(true);

              // Se reduce antes de enviar y se cambia el archivo del propio
              // campo, para que el formulario mande la versión ligera sin que
              // haya que montar el envío a mano.
              const ligera = await reducir(elegido);
              if (ligera !== elegido) {
                const caja = new DataTransfer();
                caja.items.add(ligera);
                e.target.files = caja.files;
              }

              // Se envía al elegir. Pedir «elige» y luego «guarda» es un paso de
              // más para algo que solo puede significar una cosa.
              formulario.current?.requestSubmit();
            }}
          />
        </label>
      </form>

      {url ? (
        <form action={quitar} className="text-center">
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
