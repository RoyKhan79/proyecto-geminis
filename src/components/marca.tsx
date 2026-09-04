import Image from "next/image";

import { cn } from "@/lib/utils";

/**
 * LA IDENTIDAD
 * ────────────
 * El pórtico sostiene el libro, y el libro se deshace en píxeles. Lo de
 * siempre, en digital: es exactamente lo que vende el producto, así que el
 * dibujo no es decoración.
 *
 * **Aquí no se dibuja nada.** Se enseñan los archivos que `npm run iconos`
 * recorta de `docs/marca/logo-original.png`, que es el logotipo que entregó el
 * cliente.
 *
 * Hubo una versión anterior que redibujaba el pórtico y el libro con paths de
 * SVG, para poder teñirlos con `currentColor` y que escalaran sin límite. Era
 * más cómodo de usar y no era el logotipo: el pórtico salía más ancho que el
 * libro, con cuatro pilares en vez de tres, y el nombre en una tipografía del
 * sistema espaciada en lugar de la suya, que lleva los acentos en cian. Se
 * parecía, y parecerse no sirve.
 *
 * El precio de usar imágenes es que hay dos de cada cosa —una para fondo claro
 * y otra para fondo oscuro— y hay que enseñar la que toque. De eso se encargan
 * las clases `en-tema-claro` y `en-tema-oscuro` de `globals.css`.
 */

/** Proporciones de los archivos, para reservar el hueco antes de que carguen. */
const SIMBOLO = { ancho: 384, alto: 451 };
const LOGOTIPO = { ancho: 1134, alto: 628 };

/**
 * El símbolo suelto: pórtico, libro y píxeles.
 *
 * @param sobreOscuro Si va sobre un fondo oscuro fijo —la pastilla del sello,
 *   por ejemplo— en cuyo caso siempre es la versión clara y no depende del
 *   tema. Sin esto, se enseña la que corresponda al tema del usuario.
 */
export function SimboloCatedria({
  className,
  sobreOscuro = false,
}: {
  className?: string;
  sobreOscuro?: boolean;
}) {
  const comun = cn("h-full w-auto object-contain", className);

  if (sobreOscuro) {
    return (
      <Image
        src="/simbolo-claro.png"
        alt=""
        aria-hidden
        width={SIMBOLO.ancho}
        height={SIMBOLO.alto}
        className={comun}
      />
    );
  }

  return (
    <>
      <Image
        src="/simbolo.png"
        alt=""
        aria-hidden
        width={SIMBOLO.ancho}
        height={SIMBOLO.alto}
        className={cn(comun, "en-tema-claro")}
      />
      <Image
        src="/simbolo-claro.png"
        alt=""
        aria-hidden
        width={SIMBOLO.ancho}
        height={SIMBOLO.alto}
        className={cn(comun, "en-tema-oscuro")}
      />
    </>
  );
}

/**
 * El símbolo dentro de su pastilla, que es como aparece en la aplicación.
 *
 * La pastilla existe para despegarlo de un fondo cualquiera —la barra lateral,
 * la pantalla de inicio de un móvil—. Es oscura siempre, en los dos temas, así
 * que dentro va siempre la versión clara. Sobre papel sobra, y ahí va el
 * logotipo entero.
 */
export function MarcaCatedria({ className = "size-9" }: { className?: string }) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-[var(--radius-control)]",
        "bg-linear-to-br from-brand-800 to-brand-900",
        "shadow-[var(--shadow-soft)]",
        className,
      )}
    >
      <SimboloCatedria className="h-[84%]" sobreOscuro />
    </span>
  );
}

/**
 * EL LOGOTIPO: el símbolo con la palabra CATEDRIA debajo.
 *
 * Va entero, de una pieza, tal como está compuesto el original: el nombre lleva
 * tipografía propia y detalles en cian que no se pueden imitar escribiendo el
 * texto con una fuente del sistema.
 *
 * @param descriptor Si se enseña el «academias de oposiciones» de debajo. Fuera
 *   en la aplicación, donde ya se sabe dónde está uno; dentro en el manual y en
 *   cualquier cosa que salga de casa.
 */
export function LogotipoCatedria({
  className,
  descriptor = false,
}: {
  className?: string;
  descriptor?: boolean;
}) {
  const imagen = "h-full w-auto object-contain";

  return (
    <span className={cn("inline-flex flex-col items-center gap-2", className)}>
      <span className="h-24">
        <Image
          src="/logo.png"
          alt="Catedria"
          width={LOGOTIPO.ancho}
          height={LOGOTIPO.alto}
          className={cn(imagen, "en-tema-claro")}
        />
        <Image
          src="/logo-claro.png"
          alt="Catedria"
          width={LOGOTIPO.ancho}
          height={LOGOTIPO.alto}
          className={cn(imagen, "en-tema-oscuro")}
        />
      </span>
      {descriptor ? (
        <span
          className="font-sans text-[0.5625rem] uppercase text-ink-muted"
          style={{ letterSpacing: "0.28em", textIndent: "0.28em" }}
        >
          Academias de oposiciones
        </span>
      ) : null}
    </span>
  );
}
