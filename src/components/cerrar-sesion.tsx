"use client";

import { LogOut } from "lucide-react";
import { signOutAction } from "@/lib/auth/actions";
import { limpiarDispositivo } from "@/lib/campus/salida-limpia";
import { Button } from "@/components/ui/button";

/**
 * Cerrar sesión desde Manager o desde la consola de plataforma.
 *
 * Es un componente de cliente y no un `<form action={signOutAction}>` suelto
 * por un motivo concreto: antes de salir hay que borrar del navegador lo que se
 * haya quedado guardado, y eso solo se puede hacer desde el navegador.
 *
 * Antes esos dos sitios usaban el formulario a secas. La sesión se cerraba
 * bien —se revoca en el servidor y se borra la cookie— pero la caché del
 * trabajador de servicio se quedaba donde estaba, y con ella páginas de quien
 * acababa de salir. En el ordenador de secretaría, que usa todo el equipo, eso
 * significa que el siguiente puede ver la pantalla del anterior en cuanto le
 * falle la red un segundo.
 *
 * El Campus tiene el suyo (`components/campus/salir.tsx`) porque además vacía
 * la mochila de temas descargados.
 *
 * @param etiqueta Texto del botón. Sin él sale solo el icono, que es lo que
 *   cabe en la barra superior.
 */
export function BotonCerrarSesion({ etiqueta }: { etiqueta?: string }) {
  return (
    <form
      action={signOutAction}
      onSubmit={() => {
        // No se espera: si el borrado falla o tarda, la sesión se cierra igual.
        // Perder la sesión importa más que perder la limpieza.
        void limpiarDispositivo();
      }}
    >
      {etiqueta ? (
        <Button type="submit" variant="secondary">
          {etiqueta}
        </Button>
      ) : (
        <Button type="submit" variant="ghost" size="icon" aria-label="Cerrar sesión">
          <LogOut aria-hidden />
        </Button>
      )}
    </form>
  );
}
