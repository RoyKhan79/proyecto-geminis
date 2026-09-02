"use client";

import { useId, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * LOS GRÁFICOS
 * ────────────
 * Tres formas, y cada una responde a una pregunta distinta. Ese es el orden
 * correcto: primero qué trabajo hace el dato, después la forma, y el color al
 * final. Casi todos los paneles feos se hacen al revés.
 *
 *   · `SerieTemporal` — cómo va cambiando algo. Área con línea.
 *   · `BarrasComparadas` — comparar magnitudes entre categorías. Barras
 *     horizontales, porque las etiquetas son texto y en vertical se giran.
 *   · `Anillo` — una parte de un todo, con la cifra dentro.
 *
 * ── LAS REGLAS QUE COMPARTEN ───────────────────────────────────────────────
 *
 *  1. **Una serie, un color.** Ninguno de los tres compara series distintas, así
 *     que no hay paleta categórica ni leyenda: el título dice qué es. Cuando
 *     haya que comparar dos cosas serán dos gráficos, nunca dos ejes.
 *
 *  2. **El texto lleva color de texto.** Los números y las etiquetas van en la
 *     tinta de siempre, nunca en el color de la serie. El color lo lleva la
 *     marca, y al lado se lee en negro sobre blanco.
 *
 *  3. **Rejilla y ejes, hacia atrás.** Una rejilla que compite con el dato es
 *     una rejilla mal puesta.
 *
 *  4. **Nada escondido detrás del ratón.** Las barras traen su valor escrito;
 *     el tooltip de la serie temporal es para el detalle, no para el dato
 *     principal. En una pantalla que se imprime o se ve en un proyector, lo que
 *     solo aparece al pasar el ratón no existe.
 *
 *  5. **El color sale de los tokens** (`--accent`, `--gold`), no de un
 *     hexadecimal escrito aquí. Así una academia con su propio color de marca
 *     (white-label, §60) tiene los gráficos de su color sin tocar nada.
 */

// ── Serie temporal ───────────────────────────────────────────────────────────

export type PuntoDeSerie = {
  /** Lo que se lee debajo del eje. */
  etiqueta: string;
  valor: number;
  /** Línea extra del tooltip, si aporta algo. */
  detalle?: string;
};

/**
 * Cómo evoluciona una magnitud en el tiempo.
 *
 * Se dibuja con `viewBox` y coordenadas de 0 a 100 para que el SVG se estire al
 * ancho que tenga sin recalcular nada, y con `vectorEffect` en el trazo para
 * que la línea siga midiendo 2 px reales por muy estirado que esté. Sin eso, un
 * gráfico ancho engorda la línea y uno estrecho la adelgaza.
 */
export function SerieTemporal({
  datos,
  titulo,
  alto = 132,
  className,
}: {
  datos: PuntoDeSerie[];
  /** Para el lector de pantalla: qué es esta serie. */
  titulo: string;
  alto?: number;
  className?: string;
}) {
  const id = useId();
  const [encima, setEncima] = useState<number | null>(null);

  if (datos.length < 2) return null;

  const maximo = Math.max(...datos.map((d) => d.valor), 1);
  // Un poco de techo: una serie que toca el borde superior parece cortada.
  const tope = maximo * 1.15;

  const x = (i: number) => (i / (datos.length - 1)) * 100;
  const y = (v: number) => 100 - (v / tope) * 100;

  const linea = datos.map((d, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(d.valor)}`).join(" ");
  const area = `${linea} L100,100 L0,100 Z`;

  const activo = encima === null ? datos.length - 1 : encima;

  return (
    <figure className={cn("m-0", className)}>
      <div
        className="relative"
        style={{ height: alto }}
        onMouseLeave={() => setEncima(null)}
      >
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="size-full overflow-visible"
          role="img"
          aria-label={`${titulo}. ${datos.map((d) => `${d.etiqueta}: ${d.valor}`).join(", ")}`}
        >
          <defs>
            <linearGradient id={`relleno-${id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="var(--accent)" stopOpacity="0.28" />
              <stop offset="1" stopColor="var(--accent)" stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {/* Rejilla: tres líneas y hacia atrás. Sirve para leer alturas, no
              para decorar. */}
          {[0.25, 0.5, 0.75].map((p) => (
            <line
              key={p}
              x1="0"
              x2="100"
              y1={p * 100}
              y2={p * 100}
              stroke="var(--border-subtle)"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
          ))}

          <path d={area} fill={`url(#relleno-${id})`} />
          <path
            d={linea}
            fill="none"
            stroke="var(--accent)"
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />

        </svg>

        {/*
          EL PUNTO VA EN HTML, NO DENTRO DEL SVG.

          El SVG lleva `preserveAspectRatio="none"` para estirarse al ancho que
          haga falta, y eso escala la X y la Y de forma distinta: un `<circle>`
          ahí dentro sale ovalado. `vectorEffect` salva el grosor del trazo pero
          no la forma. Fuera del SVG, un div redondo es redondo siempre.

          El anillo del color de la superficie es lo que lo despega de la línea
          en vez de dejar que se funda con ella.
        */}
        <span
          aria-hidden
          className="pointer-events-none absolute size-[9px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent ring-2 ring-[var(--surface)]"
          style={{ left: `${x(activo)}%`, top: `${y(datos[activo].valor)}%` }}
        />

        {/* Zonas de ratón: una por punto y a toda altura. El objetivo tiene que
            ser mucho más grande que la marca, o acertar un punto de 4 px se
            convierte en un juego de puntería. */}
        <div className="absolute inset-0 flex">
          {datos.map((d, i) => (
            <button
              key={d.etiqueta}
              type="button"
              tabIndex={-1}
              aria-hidden
              className="h-full flex-1 cursor-default focus:outline-none"
              onMouseEnter={() => setEncima(i)}
            />
          ))}
        </div>

        {/*
          El tooltip, anclado al punto.

          Cerca de los bordes se ancla por su lado en vez de ir centrado: con el
          centrado fijo, el del último punto se salía de la tarjeta y se cortaba
          —que además es el que sale por defecto—.
        */}
        <div
          className={cn(
            "pointer-events-none absolute -translate-y-full rounded-[var(--radius-inner)] border border-line bg-surface px-2 py-1 text-[0.6875rem] leading-tight shadow-[var(--shadow-raised)]",
            activo <= 1
              ? "translate-x-0"
              : activo >= datos.length - 2
                ? "-translate-x-full"
                : "-translate-x-1/2",
          )}
          style={{
            left: `${x(activo)}%`,
            top: `calc(${y(datos[activo].valor)}% - 10px)`,
          }}
        >
          <span className="block font-semibold text-ink">{datos[activo].valor}</span>
          <span className="block whitespace-nowrap text-ink-muted">
            {datos[activo].detalle ?? datos[activo].etiqueta}
          </span>
        </div>
      </div>

      {/* El eje: solo el primero, el de en medio y el último. Doce etiquetas
          apretadas no se leen y además se solapan. */}
      <div className="mt-2 flex justify-between text-[0.6875rem] text-ink-muted">
        {[0, Math.floor((datos.length - 1) / 2), datos.length - 1].map((i) => (
          <span key={i}>{datos[i].etiqueta}</span>
        ))}
      </div>
    </figure>
  );
}

// ── Barras comparadas ────────────────────────────────────────────────────────

export type BarraComparada = {
  etiqueta: string;
  /** El número que decide la longitud. */
  valor: number;
  /** Cómo se escribe ese número. Por defecto, tal cual. */
  texto?: string;
  /** Lo de debajo: el tamaño de la muestra, normalmente. */
  pie?: string;
  /** Marca esta barra como la que hay que mirar. */
  destacada?: boolean;
};

/**
 * Comparar magnitudes entre categorías.
 *
 * Horizontales y no verticales porque las etiquetas son nombres de tema: en
 * vertical habría que girarlas, y una etiqueta girada no la lee nadie.
 *
 * @param maximo El tope de la escala. Se pasa a mano —normalmente 100— porque
 *   escalar al mayor de los datos exagera diferencias pequeñas: con valores de
 *   62 %, 64 % y 66 %, la barra más corta se quedaría a cero y parecería un
 *   desastre.
 */
export function BarrasComparadas({
  datos,
  maximo = 100,
  referencia,
  className,
}: {
  datos: BarraComparada[];
  maximo?: number;
  /** Una línea vertical de referencia: el aprobado, la media, el objetivo. */
  referencia?: { valor: number; etiqueta: string };
  className?: string;
}) {
  if (datos.length === 0) return null;

  return (
    <div className={cn("space-y-2.5", className)}>
      {datos.map((d) => (
        <div key={d.etiqueta}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate text-ink-soft">{d.etiqueta}</span>
            <span className="shrink-0 cifra text-[0.9375rem] text-ink">
              {d.texto ?? d.valor}
            </span>
          </div>

          <div className="relative mt-1 h-2 rounded-full bg-surface-sunken">
            <div
              className={cn(
                "absolute inset-y-0 left-0 rounded-full",
                d.destacada ? "bg-gold" : "bg-accent",
              )}
              style={{ width: `${Math.max(2, Math.min(100, (d.valor / maximo) * 100))}%` }}
            />
            {referencia ? (
              <span
                aria-hidden
                title={referencia.etiqueta}
                // Sobresale por arriba y por abajo del carril: dentro se
                // confundía con el borde de la propia barra y no se veía.
                className="absolute inset-y-[-4px] w-0.5 rounded-full bg-ink-muted"
                style={{ left: `${(referencia.valor / maximo) * 100}%` }}
              />
            ) : null}
          </div>

          {d.pie ? (
            <p className="mt-1 text-[0.6875rem] text-ink-muted">{d.pie}</p>
          ) : null}
        </div>
      ))}

      {referencia ? (
        <p className="pt-1 text-[0.6875rem] text-ink-muted">
          La línea vertical es {referencia.etiqueta}.
        </p>
      ) : null}
    </div>
  );
}

// ── Anillo ───────────────────────────────────────────────────────────────────

/**
 * Una parte de un todo, con la cifra dentro.
 *
 * Un anillo solo vale para UNA proporción. Para comparar varias son barras: en
 * dos anillos, la diferencia entre 38 % y 44 % no la distingue nadie, y ese es
 * el error clásico de los paneles con cuatro donuts.
 */
export function Anillo({
  valor,
  total,
  etiqueta,
  tamano = 92,
  className,
}: {
  valor: number;
  total: number;
  /** Lo que se lee debajo de la cifra. */
  etiqueta: string;
  tamano?: number;
  className?: string;
}) {
  const proporcion = total > 0 ? Math.max(0, Math.min(1, valor / total)) : 0;
  const radio = 42;
  const vuelta = 2 * Math.PI * radio;

  return (
    <div
      className={cn("relative shrink-0", className)}
      style={{ width: tamano, height: tamano }}
    >
      <svg viewBox="0 0 100 100" className="size-full -rotate-90">
        <circle
          cx="50"
          cy="50"
          r={radio}
          fill="none"
          stroke="var(--surface-sunken)"
          strokeWidth="9"
        />
        {/*
          A cero no se dibuja NADA.

          Con `strokeLinecap="round"` un arco de longitud cero no desaparece:
          deja los dos remates redondos uno encima de otro, o sea un punto
          suelto arriba del anillo. Parecía un fallo de pintado y encima
          sugería un progreso que no existe.
        */}
        {proporcion > 0 ? (
          <circle
            cx="50"
            cy="50"
            r={radio}
            fill="none"
            stroke="var(--accent)"
            strokeWidth="9"
            strokeLinecap="round"
            strokeDasharray={`${proporcion * vuelta} ${vuelta}`}
          />
        ) : null}
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="cifra text-[1.35rem] text-ink">{valor}</span>
        <span className="text-[0.625rem] leading-tight text-ink-muted">{etiqueta}</span>
      </div>
    </div>
  );
}
