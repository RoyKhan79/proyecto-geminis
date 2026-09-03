import { cn, initials } from "@/lib/utils";

/**
 * La foto de una persona, con sus iniciales cuando no hay foto.
 *
 * Las iniciales no son un relleno: en una lista de doscientos alumnos son lo
 * que deja distinguir una fila de otra de un vistazo, y evitan el hueco gris
 * que hace parecer que algo no ha cargado.
 *
 * El color sale del propio nombre, así que la misma persona tiene siempre el
 * mismo, y dos personas distintas casi nunca coinciden. Es determinista: no se
 * guarda en ningún sitio y no cambia al recargar.
 */
export function Avatar({
  nombre,
  url,
  tamaño = "md",
  className,
}: {
  nombre: string;
  url?: string | null;
  tamaño?: "sm" | "md" | "lg";
  className?: string;
}) {
  const medidas = {
    sm: { clase: "size-7 text-[0.65rem]", px: 28 },
    md: { clase: "size-9 text-xs", px: 36 },
    lg: { clase: "size-20 text-xl", px: 80 },
  }[tamaño];

  const [nombrePila, ...resto] = nombre.trim().split(/\s+/);
  const iniciales = initials(nombrePila ?? "", resto.join(" ") || null);

  if (url) {
    /*
     * `<img>` y NO el componente de Next.
     *
     * Las fotos se sirven por `/api/archivos/…`, que exige sesión. El
     * optimizador de Next pide la imagen desde el servidor, en otra petición y
     * SIN la cookie de quien está mirando, así que se llevaba un error y
     * devolvía 400. En la lista de alumnos no se veía una foto antigua: no se
     * veía ninguna, solo el hueco.
     *
     * La ficha del alumno ya lo hacía así y lo explicaba; el fallo era que este
     * componente, que es el que usa la lista, no. Una foto de carné de 512 px
     * no necesita optimización.
     *
     * `lazy` sí importa aquí: una lista de doscientos alumnos son doscientas
     * peticiones, y las de abajo no hacen falta hasta que se baje.
     */
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt=""
        width={medidas.px}
        height={medidas.px}
        loading="lazy"
        decoding="async"
        className={cn(
          "shrink-0 rounded-full border border-line object-cover",
          medidas.clase,
          className,
        )}
      />
    );
  }

  // Doce tonos repartidos por la rueda de color, a la misma luminosidad y
  // saturación: se distinguen entre sí sin que ninguno grite más que otro.
  let suma = 0;
  for (const letra of nombre) suma = (suma * 31 + letra.charCodeAt(0)) % 360;
  const tono = Math.round(suma / 30) * 30;

  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full font-semibold",
        medidas.clase,
        className,
      )}
      style={{
        backgroundColor: `oklch(0.93 0.05 ${tono})`,
        color: `oklch(0.42 0.12 ${tono})`,
      }}
    >
      {iniciales}
    </span>
  );
}
