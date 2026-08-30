import { Children, cloneElement, isValidElement, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Piezas del manual.
 *
 * Se separan del texto porque el manual es largo y, si cada aviso lleva sus
 * ocho clases escritas a mano, la página se vuelve ilegible para quien la
 * mantenga. Y este documento se va a tocar cada vez que cambie el producto.
 */

/** Ruta dentro del propio sistema: /gestion/alumnos, /campus/estudiar… */
export function Ruta({ children }: { children: ReactNode }) {
  return (
    <code className="rounded-md border border-line bg-surface-muted px-1.5 py-0.5 font-mono text-[0.85em] text-ink">
      {children}
    </code>
  );
}

/** Comando de servidor. Se distingue de una ruta a propósito: no es lo mismo
 *  algo que se abre en el navegador que algo que se ejecuta en la máquina. */
export function Comando({ children }: { children: ReactNode }) {
  return (
    <code className="whitespace-nowrap rounded-md border border-line bg-surface-sunken px-1.5 py-0.5 font-mono text-[0.85em] text-accent">
      {children}
    </code>
  );
}

/**
 * Quién puede hacer esto.
 *
 * Va en la cabecera de cada apartado y no escondido en un párrafo: en un
 * sistema con cinco roles, «¿esto lo puedo hacer yo?» es la pregunta que más se
 * repite, y responderla de un vistazo ahorra la mitad de las consultas.
 */
export function Quien({ roles }: { roles: string[] }) {
  return (
    <ul className="flex flex-wrap gap-1.5">
      {roles.map((rol) => {
        const esAlumno = rol === "Alumno";
        return (
          <li
            key={rol}
            className={cn(
              "rounded-full border px-2 py-0.5 font-mono text-[0.65rem] uppercase tracking-wider",
              esAlumno
                ? "border-gold/30 bg-gold-soft text-gold"
                : "border-accent/20 bg-accent-soft text-accent",
            )}
          >
            {rol}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Lo que de verdad hay que saber.
 *
 * En dorado, que en este producto está reservado a lo que importa. Si se usara
 * para cada nota, dejaría de significar nada y nadie lo leería.
 */
export function Regla({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-2 rounded-r-[var(--radius-control)] border-l-[3px] border-gold bg-gold-soft px-4 py-3 text-sm leading-relaxed text-ink-soft [&_strong]:text-ink">
      {children}
    </div>
  );
}

/** Un detalle útil, sin la carga de una regla. */
export function Nota({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-2 rounded-[var(--radius-control)] border border-line bg-surface px-4 py-3 text-sm leading-relaxed text-ink-soft shadow-[var(--shadow-soft)] [&_strong]:text-ink">
      {children}
    </div>
  );
}

/**
 * Pasos que se hacen EN ORDEN. Si no hay orden, va una lista sin números.
 *
 * El número se pinta como elemento, no con un contador de CSS: un contador
 * escrito como clase arbitraria de Tailwind depende de que el generador sepa
 * interpretar los paréntesis, y si un día deja de saberlo los números
 * desaparecen en silencio. Aquí están en el HTML y se ven o no se ven.
 */
export function Pasos({ children }: { children: ReactNode }) {
  return (
    <ol className="space-y-3 text-sm leading-relaxed text-ink-soft">
      {Children.map(children, (paso, indice) =>
        isValidElement<{ numero?: number }>(paso)
          ? cloneElement(paso, { numero: indice + 1 })
          : paso,
      )}
    </ol>
  );
}

/**
 * Un paso dentro de {@link Pasos}.
 *
 * @param numero Lo pone `Pasos`; no hay que escribirlo a mano.
 */
export function Paso({
  numero,
  children,
}: {
  /** Lo pone `Pasos`; no hay que escribirlo a mano. */
  numero?: number;
  children: ReactNode;
}) {
  return (
    <li className="relative pl-9">
      <span
        aria-hidden
        className="absolute left-0 top-0.5 grid size-6 place-items-center rounded-full bg-accent font-mono text-[0.7rem] text-accent-contrast"
      >
        {numero}
      </span>
      {children}
    </li>
  );
}

/** Lista sin orden. */
export function Lista({ children }: { children: ReactNode }) {
  return (
    <ul className="space-y-1.5 text-sm leading-relaxed text-ink-soft">
      {children}
    </ul>
  );
}

/** Un punto de una lista sin orden. */
export function Punto({ children }: { children: ReactNode }) {
  return (
    <li className="relative pl-5 before:absolute before:left-1 before:top-[0.6em] before:size-1.5 before:rounded-full before:bg-line-strong before:content-['']">
      {children}
    </li>
  );
}

/** Bloque de dos columnas de tarjetas cortas. */
export function Fichas({ children }: { children: ReactNode }) {
  return <div className="grid gap-3 sm:grid-cols-2">{children}</div>;
}

/** Una tarjeta corta: un título y dos líneas. */
export function Ficha({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className="rounded-[var(--radius-control)] border border-line bg-surface px-4 py-3 shadow-[var(--shadow-soft)]">
      <h4 className="text-sm font-bold text-ink">{titulo}</h4>
      <p className="mt-1 text-sm leading-relaxed text-ink-soft">{children}</p>
    </div>
  );
}

/** Tabla que puede desbordar en móvil sin arrastrar la página entera. */
export function Tabla({
  cabeceras,
  filas,
}: {
  cabeceras: string[];
  filas: ReactNode[][];
}) {
  return (
    <div className="overflow-x-auto rounded-[var(--radius-control)] border border-line bg-surface">
      <table className="w-full min-w-[34rem] border-collapse text-sm">
        <thead>
          <tr>
            {cabeceras.map((cabecera) => (
              <th
                key={cabecera}
                className="border-b border-line bg-surface-muted px-4 py-2.5 text-left font-mono text-[0.65rem] uppercase tracking-wider text-ink-muted"
              >
                {cabecera}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((fila, indice) => (
            <tr key={indice}>
              {fila.map((celda, columna) => (
                <td
                  key={columna}
                  className="border-b border-line px-4 py-2.5 align-top leading-relaxed text-ink-soft last:border-b-0 [&_strong]:text-ink"
                >
                  {celda}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Una parte del manual: el ERP, la app, la operación. */
export function Parte({
  id,
  etiqueta,
  titulo,
  entradilla,
}: {
  id: string;
  etiqueta: string;
  titulo: string;
  entradilla: string;
}) {
  return (
    <div id={id} className="scroll-mt-20 pt-14">
      <p className="flex items-center gap-3 font-mono text-[0.68rem] uppercase tracking-[0.14em] text-accent">
        {etiqueta}
        <span aria-hidden className="h-px flex-1 bg-line" />
      </p>
      <h2 className="mt-3 font-display text-[1.9rem] font-semibold leading-tight tracking-tight text-ink text-balance">
        {titulo}
      </h2>
      <p className="mt-2 max-w-[62ch] leading-relaxed text-ink-soft">{entradilla}</p>
    </div>
  );
}

/** Un apartado dentro de una parte. */
export function Apartado({
  id,
  titulo,
  roles,
  children,
}: {
  id: string;
  titulo: string;
  roles?: string[];
  children: ReactNode;
}) {
  return (
    <section id={id} className="max-w-[68ch] scroll-mt-20 space-y-3 pt-10">
      <h3 className="font-display text-xl font-semibold leading-snug tracking-tight text-ink text-balance">
        {titulo}
      </h3>
      {roles ? <Quien roles={roles} /> : null}
      {children}
    </section>
  );
}

/** Subtítulo dentro de un apartado. */
export function Sub({ children }: { children: ReactNode }) {
  return <h4 className="pt-3 text-[0.95rem] font-bold text-ink">{children}</h4>;
}

/** Un párrafo del manual, con su medida de lectura ya puesta. */
export function P({ children }: { children: ReactNode }) {
  return <p className="leading-relaxed text-ink-soft">{children}</p>;
}
