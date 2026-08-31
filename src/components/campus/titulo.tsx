import type * as React from "react";
import { SectionIcon } from "@/components/ui/section-icon";

/**
 * El titular de una pantalla del Campus.
 *
 * El Campus no usa {@link PageHeader}: su carcasa es una barra de aplicación
 * compacta pensada para el móvil, y un encabezado de escritorio ahí se come
 * media pantalla. Pero el icono de sección sí le corresponde, así que se pone
 * al lado del título en lugar de encima.
 *
 * El icono lo resuelve la ruta, igual que en Manager, de modo que «Tests» es
 * verde en la barra inferior, en su titular y en su estado vacío sin que
 * ninguna de las tres pantallas lo diga.
 */
export function CampusTitulo({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5">
      <SectionIcon className="size-9 [&_svg]:size-[1.05rem]" />
      <h1 className="min-w-0 text-xl font-semibold tracking-tight text-ink">
        {children}
      </h1>
    </div>
  );
}
