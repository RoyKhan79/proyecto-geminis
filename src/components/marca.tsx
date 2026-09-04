"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";

/**
 * LA IDENTIDAD
 * ────────────
 * El pórtico sostiene el libro, y el libro se deshace en píxeles. Lo de
 * siempre, en digital: es exactamente lo que vende el producto, así que el
 * dibujo no es decoración.
 *
 * El original está archivado en `docs/marca/logo-original.png`. Esto es una
 * reconstrucción en vectorial, y hacía falta: un PNG a tamaño de favicon es una
 * mancha, y a 32 píxeles se tiene que seguir viendo un pórtico. Los colores
 * están muestreados de ese archivo, no elegidos a ojo.
 *
 * **Es fiel, no idéntica al píxel.** Para imprenta conviene encargar una
 * vectorización profesional del original.
 *
 * El mismo dibujo vive en `scripts/iconos.ts`, que genera los PNG sin
 * navegador. Son dos copias con las mismas coordenadas: una tiene que funcionar
 * en React y la otra sin él. Si se toca una, se toca la otra.
 */

const AZUL_A = "#1c47e8";
const AZUL_B = "#0a2fc4";
const AZUL_C = "#0f7ff0";
const CIAN = "#22cbfe";

/**
 * El pórtico con el libro.
 *
 * El pórtico usa `currentColor`: sobre la pastilla oscura hereda crema y sobre
 * papel, tinta. Los azules del libro son fijos porque aguantan en los dos
 * fondos, y son lo que identifica la marca de un vistazo.
 */
export function SimboloCatedria({ className }: { className?: string }) {
  // Los degradados necesitan un id único: dos símbolos en la misma pantalla con
  // el mismo id hacen que el segundo herede el degradado del primero.
  const id = useId().replace(/:/g, "");

  // ── El pórtico: cuatro pilares, tres arcos y los pies escalonados ─────────
  const x0 = 62;
  const x1 = 344;
  const yTop = 300;
  const yBot = 462;
  const arco = 48;
  const r = arco / 2;
  const pilar = (x1 - x0 - 3 * arco) / 4;
  const yArco = yTop + 46;
  const pie = 10;

  let arcada = `M ${x0} ${yTop} L ${x1} ${yTop} L ${x1} ${yBot - pie} L ${x1 - pie} ${yBot} L ${x1 - pilar} ${yBot} L ${x1 - pilar} ${yArco}`;
  for (let i = 2; i >= 0; i -= 1) {
    const ax = x0 + pilar + i * (arco + pilar);
    arcada += ` A ${r} ${r} 0 0 0 ${ax} ${yArco} L ${ax} ${yBot} L ${ax - pilar} ${yBot} L ${ax - pilar} ${yArco}`;
  }
  arcada += ` L ${x0 + pie} ${yBot} L ${x0} ${yBot - pie} L ${x0} ${yTop} Z`;

  return (
    <svg
      viewBox="0 0 400 470"
      className={className}
      role="presentation"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`izq-${id}`} x1="0" y1="0" x2="0.9" y2="1">
          <stop offset="0" stopColor={AZUL_A} />
          <stop offset="1" stopColor={AZUL_B} />
        </linearGradient>
        <linearGradient id={`der-${id}`} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor={AZUL_C} />
          <stop offset="1" stopColor={CIAN} />
        </linearGradient>
      </defs>

      <path d={arcada} fill="currentColor" />
      <path d="M 46 272 L 360 272 L 344 300 L 62 300 Z" fill="currentColor" />
      <path d="M 12 234 L 197 252 L 197 266 L 44 266 Z" fill="currentColor" />
      <path
        d="M 394 234 L 203 252 L 203 266 L 358 266 Z"
        fill="currentColor"
        opacity="0.72"
      />

      <path d="M 24 110 L 193 156 L 197 244 L 24 188 Z" fill={`url(#izq-${id})`} />
      <path d="M 207 156 L 376 126 L 376 210 L 203 244 Z" fill={`url(#der-${id})`} />

      <g fill={CIAN}>
        <rect x="333" y="50" width="30" height="30" rx="4" />
        <rect x="279" y="90" width="34" height="34" rx="4" />
        <rect x="350" y="96" width="26" height="26" rx="4" />
        <rect x="309" y="138" width="20" height="20" rx="3" />
        <rect x="358" y="150" width="22" height="22" rx="3" />
        <rect x="324" y="184" width="15" height="15" rx="2" />
      </g>
    </svg>
  );
}

/**
 * El símbolo dentro de su pastilla, que es como aparece en la aplicación.
 *
 * La pastilla existe para despegarlo de un fondo cualquiera —la barra lateral,
 * la pantalla de inicio de un móvil—. Sobre papel sobra, y ahí va el logotipo
 * entero.
 */
export function MarcaCatedria({ className = "size-9" }: { className?: string }) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-[var(--radius-control)]",
        "bg-linear-to-br from-brand-800 to-brand-900 text-[oklch(0.96_0.012_85)]",
        "shadow-[var(--shadow-soft)]",
        className,
      )}
    >
      <SimboloCatedria className="size-[86%]" />
    </span>
  );
}

/**
 * EL LOGOTIPO: el símbolo encima y el nombre debajo.
 *
 * En vertical y no en fila, que es como está compuesto el original: el pórtico
 * sostiene el libro y el nombre va debajo, como el friso de un edificio. En
 * fila se pierde esa lectura.
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
    <span className={cn("inline-flex flex-col items-center gap-2.5", className)}>
      <SimboloCatedria className="h-14 text-ink" />
      <span
        className="text-[1.35rem] font-semibold uppercase leading-none text-ink"
        style={{ letterSpacing: "0.18em", textIndent: "0.18em" }}
      >
        Catedria
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
