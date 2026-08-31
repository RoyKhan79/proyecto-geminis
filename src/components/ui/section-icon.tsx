"use client";

import type * as React from "react";
import { usePathname } from "next/navigation";
import { resolveSectionIcon } from "./section-icons";
import { cn } from "@/lib/utils";

/*
 * Las dos piezas que sacan el color de la ruta en lugar de recibirlo.
 *
 * Existen para que ninguna pantalla tenga que declarar su color: si «Tests» es
 * verde, lo es en su cabecera, en su estado vacío y en el acceso rápido que
 * lleva hasta ella, sin que ninguna de las tres lo sepa. Una pantalla no puede
 * ponerse un color que no le toca porque no lo elige.
 *
 * Van aquí y no dentro de las primitivas para no cerrar un círculo de
 * importaciones: son las primitivas quienes las usan.
 */

/** La pastilla, con la clase del chip ya puesta y el tono de la sección. */
function chip(tone: string | undefined, className?: string) {
  return {
    "aria-hidden": true as const,
    "data-tone": tone,
    className: cn("icon-chip", className),
  };
}

/**
 * El icono de la sección en la que estás, con su color y a tinte lleno.
 *
 * En una ruta que no pertenece a ninguna sección —la entrada, el manual
 * público, las páginas legales— no pinta nada, que es mejor que pintar un
 * icono genérico.
 */
export function SectionIcon({ className }: { className?: string }) {
  const pathname = usePathname();
  const section = resolveSectionIcon(pathname);
  if (!section) return null;

  const Icon = section.icon;
  return (
    <span
      {...chip(section.tone, cn("size-12 [&_svg]:size-[1.35rem]", className))}
      data-fill="solid"
      data-block="true"
    >
      <Icon />
    </span>
  );
}

/**
 * Una pastilla con el color de la sección pero con el icono que se le pase.
 *
 * Para cuando el icono lo elige la pantalla —un estado vacío dice de qué está
 * vacío— y solo el color viene de fuera.
 */
export function SectionTile({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  return <span {...chip(resolveSectionIcon(pathname)?.tone, className)}>{children}</span>;
}
