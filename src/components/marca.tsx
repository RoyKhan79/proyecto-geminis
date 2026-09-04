import { cn } from "@/lib/utils";

/**
 * LA IDENTIDAD
 * ────────────
 * Dos piezas, y cada una tiene su sitio:
 *
 *   · **El logotipo** (`LogotipoCatedria`) es la palabra. Sin símbolo: versales
 *     muy espaciadas de la serif del producto entre dos filetes de oro. Manda
 *     en la portada del manual, en la pantalla de acceso y en una factura, que
 *     es donde hay sitio y donde interesa que se lea el nombre.
 *
 *   · **El sello** (`SelloCatedria`) es la inicial dentro de un filete doble.
 *     Existe porque una palabra no cabe en un cuadrado de 32 píxeles: resuelve
 *     la pestaña del navegador, el icono del móvil y la esquina de la barra
 *     lateral.
 *
 * Antes había aquí dos columnas de rectángulos redondeados. El concepto no
 * estaba mal —dos aplicaciones, un sistema— pero el trazo era de grosor
 * constante, y eso es lo que separa un símbolo dibujado de uno generado. A
 * tamaño de favicon acababa siendo un pictograma cualquiera.
 *
 * Ahora el peso lo lleva la tipografía: la serif del producto tiene alternancia
 * de fino y grueso de verdad, y el oro aparece una sola vez, en el filete.
 *
 * ── SOBRE LA LETRA ─────────────────────────────────────────────────────────
 * La C va con `var(--font-display)`, que en la aplicación es Fraunces. En
 * `scripts/iconos.ts`, que genera los PNG sin navegador, no se puede contar con
 * ella y se cae a Georgia. La diferencia entre las dos a 32 píxeles no la ve
 * nadie; a tamaño de portada sí, y por eso ahí se usa siempre esta versión.
 */

/** El sello suelto, sin fondo: filete doble y la inicial. */
export function SelloCatedria({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      role="presentation"
      aria-hidden="true"
    >
      {/* El filete doble. Es el detalle que no se produce solo: un anillo
          único se lee como un borde; dos, como un sello. */}
      <circle
        cx="50"
        cy="50"
        r="46.5"
        fill="none"
        stroke="var(--gold)"
        strokeWidth="2"
      />
      <circle
        cx="50"
        cy="50"
        r="40.5"
        fill="none"
        stroke="var(--gold)"
        strokeWidth="0.9"
        opacity="0.5"
      />
      <text
        x="50"
        y="50"
        dy="0.345em"
        textAnchor="middle"
        fontFamily="var(--font-display)"
        fontSize="47"
        fontWeight="500"
        fill="currentColor"
      >
        C
      </text>
    </svg>
  );
}

/**
 * El sello dentro de su pastilla, que es como aparece en la aplicación.
 *
 * La pastilla es tinta, no el azul de antes: sobre un azul encendido el oro se
 * pelea con el fondo, y sobre tinta brilla.
 */
export function MarcaCatedria({ className = "size-9" }: { className?: string }) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-[var(--radius-control)]",
        "bg-linear-to-br from-brand-800 to-brand-900 text-[oklch(0.97_0.01_85)]",
        "shadow-[var(--shadow-soft)]",
        className,
      )}
    >
      <SelloCatedria className="size-[78%]" />
    </span>
  );
}

/**
 * EL LOGOTIPO: la palabra y nada más.
 *
 * El espaciado entre letras es casi todo el diseño. Con el tracking normal esto
 * es un nombre escrito; a 0.4em es un logotipo. Por eso va en su propia clase y
 * no como un `<h1>` con estilos sueltos: quien lo toque tiene que ver que ese
 * número es la pieza.
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
  return (
    <span className={cn("inline-flex flex-col items-center", className)}>
      <span aria-hidden className="h-px w-14 bg-gold" />
      <span
        className="font-display text-[1.35rem] font-normal uppercase leading-none text-ink"
        style={{ letterSpacing: "0.4em", textIndent: "0.4em" }}
      >
        Catedria
      </span>
      <span aria-hidden className="h-px w-14 bg-gold" />
      {descriptor ? (
        <span
          className="mt-2.5 font-sans text-[0.5625rem] uppercase text-ink-muted"
          style={{ letterSpacing: "0.3em", textIndent: "0.3em" }}
        >
          Academias de oposiciones
        </span>
      ) : null}
    </span>
  );
}
