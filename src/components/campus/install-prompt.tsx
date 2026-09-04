"use client";

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Registro del service worker e invitación a instalar la app.
 *
 * La invitación aparece una sola vez y se puede descartar: un banner insistente
 * molesta más de lo que convierte. Solo se muestra cuando el navegador confirma
 * que la instalación es posible.
 */

type PromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const CLAVE_DESCARTADO = "catedria:instalacion-descartada";

/**
 * El aviso para instalar la aplicación en el móvil.
 *
 * Solo aparece si el navegador dice que se puede, y se calla si ya se ha
 * descartado: insistir con esto es la forma de que se deje de leer.
 */
export function InstallPrompt() {
  const [evento, setEvento] = useState<PromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Sin service worker la aplicación funciona igual, solo pierde el
        // arranque instantáneo y el modo sin conexión.
      });
    }

    const descartado = window.localStorage.getItem(CLAVE_DESCARTADO) === "1";
    if (descartado) return;

    const alInstalar = (e: Event) => {
      e.preventDefault();
      setEvento(e as PromptEvent);
      setVisible(true);
    };

    window.addEventListener("beforeinstallprompt", alInstalar);
    return () => window.removeEventListener("beforeinstallprompt", alInstalar);
  }, []);

  if (!visible || !evento) return null;

  const descartar = () => {
    window.localStorage.setItem(CLAVE_DESCARTADO, "1");
    setVisible(false);
  };

  return (
    <div className="safe-bottom fixed inset-x-3 bottom-20 z-40 rounded-[var(--radius-card)] border border-line bg-surface p-4 shadow-[var(--shadow-overlay)]">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-contrast">
          <Download className="size-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-ink">Instala el Campus</p>
          <p className="text-xs text-ink-muted">
            Se añade a tu pantalla de inicio y abre como una aplicación.
          </p>
        </div>
        <button
          type="button"
          onClick={descartar}
          aria-label="Ahora no"
          className="text-ink-muted hover:text-ink"
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>

      <div className="mt-3 flex gap-2">
        <Button
          size="sm"
          className="flex-1"
          onClick={async () => {
            await evento.prompt();
            await evento.userChoice;
            setVisible(false);
          }}
        >
          Instalar
        </Button>
        <Button variant="ghost" size="sm" onClick={descartar}>
          Ahora no
        </Button>
      </div>
    </div>
  );
}
