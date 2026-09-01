import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { SectionIcon, SectionTile } from "./section-icon";

/**
 * Piezas básicas de la interfaz: tarjeta, campo, etiqueta, distintivo, tabla y
 * estado vacío. Todas leen los tokens del design system; ninguna define colores
 * propios.
 */

// ── Card ─────────────────────────────────────────────────────────────────────

/**
 * La tarjeta.
 *
 * Lleva un filo de luz en el borde superior (`edge-light`). Es un detalle de un
 * píxel que hace que la tarjeta parezca apoyada sobre el fondo en lugar de
 * recortada contra él, y es la diferencia entre una interfaz que parece hecha y
 * una que parece maquetada.
 */
export function Card({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        // El borde va transparente: la línea que se ve la pone el anillo de la
        // sombra, que es de un píxel y del color de la marca en lugar de gris.
        // Pero la caja sigue reservando ese píxel, para que una tarjeta que
        // necesite señalar algo —`border-caution` en un lote sin ejecutar,
        // `border-dashed` en un vacío— solo tenga que cambiarle el color.
        "edge-light rounded-[var(--radius-card)] border border-transparent bg-surface",
        className,
      )}
      {...props}
    />
  );
}

/** Cabecera de una tarjeta: título y descripción, con su separación ya puesta. */
export function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex items-start justify-between gap-4 p-6 pb-3.5", className)}
      {...props}
    />
  );
}

/** Título de una tarjeta. Va en `<h3>`: el nivel lo pone la jerarquía de la página. */
export function CardTitle({ className, ...props }: React.ComponentProps<"h3">) {
  return (
    <h3
      className={cn(
        "font-display text-[1.0625rem] font-semibold leading-snug tracking-[-0.015em] text-ink",
        className,
      )}
      {...props}
    />
  );
}

/** La frase que acompaña al título de una tarjeta. */
export function CardDescription({
  className,
  ...props
}: React.ComponentProps<"p">) {
  return (
    <p
      className={cn("mt-1 text-sm leading-relaxed text-ink-muted", className)}
      {...props}
    />
  );
}

/** El cuerpo de una tarjeta. */
export function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("p-6 pt-0", className)} {...props} />;
}

/** El pie de una tarjeta, normalmente con los botones. */
export function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 border-t border-line/70 px-6 py-4",
        className,
      )}
      {...props}
    />
  );
}

// ── Formulario ───────────────────────────────────────────────────────────────

/**
 * Etiqueta de un campo.
 *
 * Casi siempre es mejor {@link Field}, que además coloca la ayuda y el error y
 * los enlaza con `aria` para que un lector de pantalla los lea al entrar.
 */
export function Label({
  className,
  required,
  ...props
}: React.ComponentProps<"label"> & { required?: boolean }) {
  return (
    <label
      className={cn("block text-sm font-medium text-ink", className)}
      {...props}
    >
      {props.children}
      {required ? (
        <span className="ml-0.5 text-critical" aria-hidden>
          *
        </span>
      ) : null}
    </label>
  );
}

/*
 * El estado de foco es un anillo, no un borde que cambia de color.
 *
 * Cambiar el borde mueve un píxel el contenido y hace que el campo «salte» al
 * entrar en él. El anillo se dibuja por fuera, no ocupa sitio, y además se ve
 * sobre cualquier fondo. Es el detalle que separa un formulario que se siente
 * sólido de uno que tiembla.
 */
const fieldStyles =
  "w-full rounded-[var(--radius-control)] border border-line bg-surface px-3.5 py-2 text-sm text-ink shadow-[inset_0_1px_2px_0_oklch(0.27_0.05_265/0.04)] transition-[box-shadow,border-color] placeholder:text-ink-muted focus:border-accent/40 focus:ring-[3px] focus:ring-accent/15 disabled:cursor-not-allowed disabled:opacity-60 aria-[invalid=true]:border-critical aria-[invalid=true]:focus:ring-critical/15";

/** Campo de texto, con los estados de foco y error del sistema de diseño. */
export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return <input className={cn(fieldStyles, "h-10", className)} {...props} />;
}

/** Campo de texto largo. Se puede estirar en vertical, no en horizontal. */
export function Textarea({
  className,
  ...props
}: React.ComponentProps<"textarea">) {
  return (
    <textarea className={cn(fieldStyles, "min-h-24 resize-y", className)} {...props} />
  );
}

/** Desplegable nativo. Nativo a propósito: en el móvil es mucho mejor que uno hecho a mano. */
export function Select({ className, ...props }: React.ComponentProps<"select">) {
  return (
    <select className={cn(fieldStyles, "h-10 pr-8", className)} {...props} />
  );
}

/** Campo completo: etiqueta + control + ayuda + error, con `aria` correcto. */
export function Field({
  label,
  htmlFor,
  hint,
  error,
  required,
  children,
  className,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  const hintId = hint ? `${htmlFor}-hint` : undefined;
  const errorId = error ? `${htmlFor}-error` : undefined;

  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={htmlFor} required={required}>
        {label}
      </Label>
      {React.isValidElement(children)
        ? React.cloneElement(children as React.ReactElement<Record<string, unknown>>, {
            id: htmlFor,
            "aria-describedby": [hintId, errorId].filter(Boolean).join(" ") || undefined,
            "aria-invalid": error ? true : undefined,
          })
        : children}
      {hint && !error ? (
        <p id={hintId} className="text-xs text-ink-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-xs font-medium text-critical">
          {error}
        </p>
      ) : null}
    </div>
  );
}

// ── Badge ────────────────────────────────────────────────────────────────────

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.045em] ring-1 ring-inset",
  {
    variants: {
      tone: {
        neutral: "bg-surface-muted text-ink-soft ring-[var(--border-subtle)]",
        accent: "bg-accent-soft text-accent ring-accent/15",
        positive: "bg-positive-soft text-positive ring-positive/15",
        caution: "bg-caution-soft text-caution ring-caution/20",
        critical: "bg-critical-soft text-critical ring-critical/15",
        info: "bg-info-soft text-info ring-info/15",
        /// Reservado a lo conseguido: una racha, un aprobado, una plaza.
        gold: "bg-gold-soft text-gold ring-gold/25",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

/**
 * Etiqueta de estado.
 *
 * El tono es semántico, no decorativo: el mismo estado se ve igual en toda la
 * aplicación. El dorado está reservado a lo conseguido —una racha, un aprobado,
 * una plaza—; si se usa para todo, deja de significar nada.
 */
export function Badge({
  className,
  tone,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}

// ── Tabla ────────────────────────────────────────────────────────────────────

/** Tabla, dentro de un contenedor que desborda en horizontal sin arrastrar la página. */
export function Table({ className, ...props }: React.ComponentProps<"table">) {
  return (
    <div className="w-full overflow-x-auto">
      <table className={cn("w-full border-collapse text-sm", className)} {...props} />
    </div>
  );
}

/** Celda de cabecera. */
export function Th({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      className={cn(
        "border-b border-line px-4 py-2.5 text-left text-[0.6875rem] font-bold uppercase tracking-[0.06em] text-ink-muted",
        className,
      )}
      {...props}
    />
  );
}

/** Celda de datos. */
export function Td({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      className={cn("border-b border-line px-4 py-3 align-middle text-ink", className)}
      {...props}
    />
  );
}


// ── Icono con color ──────────────────────────────────────────────────────────

/**
 * Las familias de color de los iconos.
 *
 * No son estados —para eso están `positive`, `caution` y `critical`— sino
 * identidad: cada área de la aplicación tiene su tinte y se reconoce de un
 * vistazo, que es lo que hace navegable una barra lateral de treinta destinos.
 * El dorado sigue reservado a lo conseguido.
 */
export const ICON_TONES = [
  "brand",
  "indigo",
  "violet",
  "rose",
  "amber",
  "emerald",
  "teal",
  "sky",
  "gold",
] as const;

/** Una de las familias de color de {@link ICON_TONES}. */
export type IconTone = (typeof ICON_TONES)[number];

/** El tinte aplicado al trazo del icono, sin pastilla debajo. */
export const iconToneText: Record<IconTone, string> = {
  brand: "text-icon-brand",
  indigo: "text-icon-indigo",
  violet: "text-icon-violet",
  rose: "text-icon-rose",
  amber: "text-icon-amber",
  emerald: "text-icon-emerald",
  teal: "text-icon-teal",
  sky: "text-icon-sky",
  gold: "text-gold",
};

const tileSizes = {
  sm: "size-8 [&_svg]:size-4",
  md: "size-10 [&_svg]:size-[1.15rem]",
  lg: "size-12 [&_svg]:size-[1.35rem]",
  xl: "size-14 [&_svg]:size-6",
} as const;

/**
 * El icono dentro de su pastilla de color.
 *
 * `fill="solid"` es la versión de portada —tinte lleno y luz propia debajo—,
 * para el icono que encabeza una pantalla o corona una tarjeta destacada. En
 * una lista de diez elementos satura; ahí va la suave.
 */
export function IconTile({
  tone,
  fill,
  size = "md",
  className,
  children,
  ...props
}: React.ComponentProps<"span"> & {
  tone?: IconTone;
  fill?: "soft" | "solid";
  size?: keyof typeof tileSizes;
}) {
  return (
    <span
      aria-hidden
      data-tone={tone}
      data-fill={fill === "solid" ? "solid" : undefined}
      className={cn("icon-chip", tileSizes[size], className)}
      {...props}
    >
      {children}
    </span>
  );
}

// ── Estados ──────────────────────────────────────────────────────────────────

/**
 * Qué se enseña cuando no hay nada.
 *
 * Con su explicación y, si procede, el botón para crear lo primero. Una lista
 * vacía sin texto parece un fallo de carga, y quien la ve no sabe si esperar.
 */
export function EmptyState({
  icon,
  tone,
  title,
  description,
  action,
}: {
  icon?: React.ReactNode;
  /**
   * El color de la pastilla. Sin él lo pone la sección en la que está la
   * pantalla, que es lo que se quiere casi siempre: el vacío de «Tests» se ve
   * verde como el resto de Tests sin que esta pantalla tenga que decirlo.
   */
  tone?: IconTone;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      {icon ? (
        tone ? (
          <IconTile tone={tone} size="xl">
            {icon}
          </IconTile>
        ) : (
          <SectionTile className="size-14 [&_svg]:size-6">{icon}</SectionTile>
        )
      ) : null}
      <div className="space-y-1.5">
        <p className="font-display text-[1.0625rem] font-semibold tracking-[-0.01em] text-ink">
          {title}
        </p>
        {description ? (
          <p className="mx-auto max-w-sm text-sm leading-relaxed text-ink-muted">
            {description}
          </p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

/** Hueco gris mientras carga. Con la forma de lo que va a venir, no un girador. */
export function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-surface-muted", className)}
      {...props}
    />
  );
}

/** Cabecera de una pantalla: migas, título, descripción y acciones. */
export function PageHeader({
  title,
  description,
  actions,
  breadcrumb,
  icon,
  tone,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  breadcrumb?: React.ReactNode;
  /**
   * El icono de la cabecera. Por defecto lo pone la propia sección —sale de
   * `section-icons`, el mismo sitio del que sale el de la barra lateral—, así
   * que solo hay que pasarlo aquí para una pantalla que no está en el menú.
   */
  icon?: React.ReactNode;
  tone?: IconTone;
}) {
  return (
    <header className="flex flex-col gap-4 pb-1 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0 space-y-2">
        {breadcrumb}
        {icon ? (
          <IconTile tone={tone} fill="solid" size="lg" data-block="true" className="mb-0.5">
            {icon}
          </IconTile>
        ) : (
          <SectionIcon className="mb-0.5" />
        )}
        {/*
          El titular va en la serif de la marca y con el interletrado cerrado.
          A este tamaño, una sans a espaciado normal se lee como el texto de un
          formulario; la serif ajustada se lee como el nombre de una sección.
        */}
        <h1 className="font-display text-[1.75rem] font-semibold leading-[1.15] tracking-[-0.025em] text-ink text-balance sm:text-[1.9rem]">
          {title}
        </h1>
        {description ? (
          <p className="max-w-2xl text-[0.9375rem] leading-relaxed text-ink-soft">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </header>
  );
}
