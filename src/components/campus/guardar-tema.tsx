"use client";

import { useState, useSyncExternalStore } from "react";
import { Check, CloudOff, Download, Loader2, Trash2 } from "lucide-react";
import {
  borrarTema,
  estaGuardado,
  guardarTema,
  suscribirse,
  type TemaDescargable,
} from "@/lib/campus/mochila-cliente";
import { Button } from "@/components/ui/button";

/**
 * «Guardar en el dispositivo», desde la propia pantalla del tema.
 *
 * La pantalla de Descargas sirve para llevarse el temario entero de una vez,
 * antes de un viaje. Pero la decisión de guardar un tema concreto se toma
 * mientras se lee, y obligar a ir a otra pantalla a buscarlo por su nombre es
 * pedirle al alumno que haga de índice. Por eso el botón está también aquí.
 *
 * Guarda exactamente igual que la otra pantalla: por la ruta protegida, que
 * vuelve a comprobar los permisos. Si el alumno los ha perdido entre que se
 * pintó la página y pulsa, el servidor dice que no y aquí no se guarda nada.
 */
export function GuardarTema({ tema }: { tema: TemaDescargable }) {
  const [trabajando, setTrabajando] = useState(false);
  const [fallo, setFallo] = useState<string | null>(null);

  // Se lee del almacén del navegador, no de un estado propio: así el botón de
  // esta pantalla y la lista de Descargas nunca discrepan sobre si un tema está
  // guardado. La tercera función es la respuesta del servidor —«no guardado»—,
  // y es la que React usa durante la hidratación para que no haya un instante
  // en el que el HTML y el navegador digan cosas distintas.
  const dentro = useSyncExternalStore(
    suscribirse,
    () => estaGuardado(tema.fileId, tema.version),
    () => false,
  );

  async function alternar() {
    setTrabajando(true);
    setFallo(null);
    try {
      if (dentro) await borrarTema(tema.fileId);
      else await guardarTema(tema);
    } catch (error) {
      setFallo(error instanceof Error ? error.message : "No se ha podido guardar.");
    } finally {
      setTrabajando(false);
    }
  }

  return (
    <div className="space-y-1">
      <Button
        variant={dentro ? "subtle" : "secondary"}
        size="sm"
        onClick={alternar}
        disabled={trabajando}
        className="w-full"
      >
        {trabajando ? (
          <Loader2 className="animate-spin" aria-hidden />
        ) : dentro ? (
          <Check aria-hidden />
        ) : (
          <Download aria-hidden />
        )}
        {dentro
          ? "Guardado en este dispositivo"
          : `Guardar para leer sin conexión · ${talla(tema.sizeBytes)}`}
      </Button>

      {dentro ? (
        <button
          type="button"
          onClick={alternar}
          disabled={trabajando}
          className="mx-auto flex items-center gap-1 text-xs text-ink-muted hover:text-ink"
        >
          <Trash2 className="size-3" aria-hidden />
          Quitarlo del dispositivo
        </button>
      ) : null}

      {fallo ? (
        <p role="alert" className="flex items-center gap-1 text-xs text-caution">
          <CloudOff className="size-3 shrink-0" aria-hidden />
          {fallo}
        </p>
      ) : null}
    </div>
  );
}

function talla(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
