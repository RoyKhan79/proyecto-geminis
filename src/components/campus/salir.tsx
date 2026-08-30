"use client";

import { LogOut } from "lucide-react";
import { signOutAction } from "@/lib/auth/actions";
import { vaciarMochila } from "@/lib/campus/mochila-cliente";
import { Button } from "@/components/ui/button";

/**
 * Cerrar sesión desde el Campus.
 *
 * Hace una cosa más que el botón normal: vacía la mochila antes de salir. Los
 * temas guardados para estudiar sin conexión están en el disco del dispositivo,
 * y ahí no llega ninguna comprobación del servidor. Si alguien cierra sesión en
 * un móvil prestado o en el ordenador de la biblioteca, el temario se va con él.
 *
 * El borrado no bloquea la salida: si el navegador falla al limpiar la caché, se
 * cierra la sesión igual y la comprobación de dueño lo recogerá en la siguiente
 * entrada. Perder la sesión importa más que perder la limpieza.
 */
export function BotonSalir({ ancho = false }: { ancho?: boolean }) {
  return (
    <form
      action={signOutAction}
      onSubmit={() => {
        void vaciarMochila();
      }}
      className={ancho ? "w-full" : undefined}
    >
      {ancho ? (
        <Button type="submit" variant="secondary" className="w-full">
          Cerrar sesión
        </Button>
      ) : (
        <Button type="submit" variant="ghost" size="icon" aria-label="Cerrar sesión">
          <LogOut aria-hidden />
        </Button>
      )}
    </form>
  );
}
