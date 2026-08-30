"use client";

import { useEffect, useState } from "react";
import { Check, CloudOff, Download, Loader2, Trash2 } from "lucide-react";
import {
  borrarTema,
  estaGuardado,
  guardarTema,
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
  // Empieza en null y no en false: hasta que el navegador no ha mirado su
  // almacén no se sabe, y pintar «Guardar» a alguien que ya lo tiene, para
  // cambiarlo un instante después, es un parpadeo feo en la pantalla que más
  // se abre de toda la aplicación.
  const [dentro, setDentro] = useState<boolean | null>(null);
  const [trabajando, setTrabajando] = useState(false);
  const [fallo, setFallo] = useState<string | null>(null);

  useEffect(() => {
    setDentro(estaGuardado(tema.fileId, tema.version));
  }, [tema.fileId, tema.version]);

  if (dentro === null) return null;

  async function alternar() {
    setTrabajando(true);
    setFallo(null);
    try {
      if (dentro) {
        await borrarTema(tema.fileId);
        setDentro(false);
      } else {
        await guardarTema(tema);
        setDentro(true);
      }
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
