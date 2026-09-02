/**
 * EL SIGNO DE GÉMINIS
 * ───────────────────
 * Dos columnas iguales unidas por arriba y por abajo. No es una floritura sobre
 * el nombre: es lo que hace el producto. Dos aplicaciones —la de la academia y
 * la del alumnado— sobre un mismo sistema. Las columnas son iguales porque
 * ninguna de las dos es la de verdad y la otra un añadido.
 *
 * La base va en oro, que es el único acento de la identidad: es lo que
 * comparten, los mismos datos por debajo.
 *
 * Aquí y en `scripts/iconos.ts` está dibujado dos veces, con las mismas
 * proporciones. Se ha preferido eso a importar un SVG: este va en línea y hereda
 * el color del contenedor —lo que permite ponerlo sobre azul, sobre blanco o en
 * un botón sin exportar una variante de cada—, y el del script tiene que poder
 * generar PNG sin pasar por React.
 *
 * Va con `rect` redondeados y no con un `path`: a tamaño de favicon las curvas
 * de un trazado se emborronan y estos no.
 */

/** El signo suelto, sin fondo. Hereda el color del texto para las columnas. */
export function SignoGeminis({ className }: { className?: string }) {
  // Proporciones sobre un lienzo de 100: las mismas que en scripts/iconos.ts.
  const alto = 54;
  const ancho = 50; // los remates vuelan sobre las columnas
  const grueso = 8.6;
  const radio = grueso / 2;
  const separacion = 12.5;
  const y0 = 50 - alto / 2;
  const x0 = 50 - ancho / 2;

  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      role="presentation"
      aria-hidden="true"
      fill="none"
    >
      {[50 - separacion, 50 + separacion].map((cx) => (
        <rect
          key={cx}
          x={cx - grueso / 2}
          y={y0}
          width={grueso}
          height={alto}
          rx={radio}
          fill="currentColor"
        />
      ))}
      <rect
        x={x0}
        y={y0}
        width={ancho}
        height={grueso}
        rx={radio}
        fill="currentColor"
      />
      {/*
        El remate de abajo va el último: tapa el final de las columnas y así el
        oro queda limpio en vez de partido por dos blancos encima.
      */}
      <rect
        x={x0}
        y={y0 + alto - grueso}
        width={ancho}
        height={grueso}
        rx={radio}
        fill="var(--color-gold-500)"
      />
    </svg>
  );
}

/**
 * El signo dentro de su pastilla azul, que es como aparece en la aplicación.
 *
 * El tamaño lo pone quien lo usa con `className` (`size-9`, `size-10`…), igual
 * que hacía la pastilla escrita a mano que había antes en cada pantalla.
 */
export function MarcaGeminis({ className = "size-9" }: { className?: string }) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-accent to-accent-hover text-accent-contrast shadow-[inset_0_1px_0_0_oklch(1_0_0/0.25),var(--shadow-soft)] ${className}`}
    >
      <SignoGeminis className="size-full" />
    </span>
  );
}
