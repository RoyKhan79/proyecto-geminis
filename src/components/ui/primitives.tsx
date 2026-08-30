import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

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
        "edge-light rounded-[var(--radius-card)] border border-line bg-surface",
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
      className={cn("flex items-start justify-between gap-4 p-5 pb-3", className)}
      {...props}
    />
  );
}

/** Título de una tarjeta. Va en `<h3>`: el nivel lo pone la jerarquía de la página. */
export function CardTitle({ className, ...props }: React.ComponentProps<"h3">) {
  return (
    <h3
      className={cn(
        "font-display text-base font-semibold tracking-[-0.01em] text-ink",
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
  return <p className={cn("text-sm text-ink-muted", className)} {...props} />;
}

/** El cuerpo de una tarjeta. */
export function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("p-5 pt-0", className)} {...props} />;
}

/** El pie de una tarjeta, normalmente con los botones. */
export function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 border-t border-line px-5 py-3.5",
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

const fieldStyles =
  "w-full rounded-[var(--radius-control)] border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-muted transition-colors focus:border-accent disabled:cursor-not-allowed disabled:opacity-60 aria-[invalid=true]:border-critical";

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
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold tracking-[0.005em] ring-1 ring-inset",
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

// ── Estados ──────────────────────────────────────────────────────────────────

/**
 * Qué se enseña cuando no hay nada.
 *
 * Con su explicación y, si procede, el botón para crear lo primero. Una lista
 * vacía sin texto parece un fallo de carga, y quien la ve no sabe si esperar.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
      {icon ? (
        <div className="icon-chip size-12 [&_svg]:size-5">{icon}</div>
      ) : null}
      <div className="space-y-1">
        <p className="font-medium text-ink">{title}</p>
        {description ? (
          <p className="mx-auto max-w-sm text-sm text-ink-muted">{description}</p>
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
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  breadcrumb?: React.ReactNode;
}) {
  return (
    <header className="flex flex-col gap-3 border-b border-line pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="space-y-1.5">
        {breadcrumb}
        <h1 className="text-[1.6rem] font-semibold leading-tight text-ink">
          {title}
        </h1>
        {description ? (
          <p className="max-w-2xl text-sm leading-relaxed text-ink-soft">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      ) : null}
    </header>
  );
}
