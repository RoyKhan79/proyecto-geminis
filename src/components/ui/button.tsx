import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/*
 * El botón.
 *
 * Detalles que parecen tontos y no lo son:
 *   · `active:translate-y-px` — el botón cede al pulsarlo. Es la señal táctil
 *     que hace que una interfaz web se sienta como una aplicación.
 *   · El primario lleva un degradado muy corto y un filo de luz arriba: es lo
 *     que separa un botón con volumen de un rectángulo de color.
 *   · La transición incluye la sombra, no solo el color, para que el relieve
 *     acompañe al hover en lugar de saltar.
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius-control)] text-sm font-semibold tracking-[-0.005em] transition-[background,box-shadow,transform,color] duration-150 active:translate-y-px disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary:
          "bg-linear-to-b from-accent to-accent-hover text-accent-contrast shadow-[inset_0_1px_0_0_oklch(1_0_0/0.18),var(--shadow-soft)] hover:brightness-[1.07] hover:shadow-[inset_0_1px_0_0_oklch(1_0_0/0.18),var(--shadow-raised)]",
        secondary:
          "bg-surface text-ink border border-line hover:border-line-strong hover:bg-surface-muted shadow-[var(--shadow-soft)]",
        ghost: "text-ink-soft hover:bg-surface-muted hover:text-ink",
        subtle: "bg-accent-soft text-accent hover:brightness-95",
        gold: "bg-gold-soft text-gold border border-gold/20 hover:brightness-[0.97]",
        danger:
          "bg-critical text-white shadow-[inset_0_1px_0_0_oklch(1_0_0/0.15),var(--shadow-soft)] hover:brightness-110",
        link: "text-accent underline-offset-4 hover:underline",
      },
      size: {
        sm: "h-8 px-3 text-[0.8125rem]",
        md: "h-10 px-4",
        lg: "h-11 px-5 text-base",
        icon: "size-10",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    loading?: boolean;
  };

export function Button({
  className,
  variant,
  size,
  asChild = false,
  loading = false,
  disabled,
  children,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <>
          <Loader2 className="animate-spin" aria-hidden />
          <span>{children}</span>
        </>
      ) : (
        children
      )}
    </Comp>
  );
}

export { buttonVariants };
