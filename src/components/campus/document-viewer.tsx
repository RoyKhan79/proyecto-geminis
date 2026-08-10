"use client";

import { useState } from "react";
import { Download, ExternalLink, FileText, Maximize2, Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Visor de documentos del Campus.
 *
 * Usa el visor nativo del navegador dentro de un marco propio: funciona en
 * móvil, tablet y escritorio sin cargar megabytes de JavaScript, que es lo que
 * importa cuando alguien estudia con datos móviles.
 *
 * El archivo se pide siempre a la ruta protegida, que vuelve a comprobar
 * permisos y derechos de acceso. La marca de agua se pinta encima con los datos
 * de quien está leyendo: no impide una captura, pero deja claro de quién es la
 * copia. Honestidad: ninguna protección web evita una foto a la pantalla.
 */
export function DocumentViewer({
  fileId,
  fileName,
  puedeDescargar,
  marcaDeAgua,
}: {
  fileId: string;
  fileName: string;
  puedeDescargar: boolean;
  marcaDeAgua: string | null;
}) {
  const [ampliado, setAmpliado] = useState(false);
  const src = `/api/archivos/${fileId}#view=FitH&toolbar=0`;

  return (
    <div
      className={cn(
        "overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface",
        ampliado && "fixed inset-0 z-50 rounded-none border-0",
      )}
    >
      <div className="flex items-center gap-2 border-b border-line px-3 py-2">
        <FileText className="size-4 shrink-0 text-ink-muted" aria-hidden />
        <p className="min-w-0 flex-1 truncate text-sm font-medium text-ink">
          {fileName}
        </p>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => setAmpliado((v) => !v)}
          aria-label={ampliado ? "Salir de pantalla completa" : "Pantalla completa"}
        >
          {ampliado ? <Minimize2 aria-hidden /> : <Maximize2 aria-hidden />}
        </Button>

        <Button asChild variant="ghost" size="icon">
          <a
            href={`/api/archivos/${fileId}`}
            target="_blank"
            rel="noreferrer"
            aria-label="Abrir en una pestaña nueva"
          >
            <ExternalLink aria-hidden />
          </a>
        </Button>

        {puedeDescargar ? (
          <Button asChild variant="ghost" size="icon">
            <a
              href={`/api/archivos/${fileId}?descargar=1`}
              aria-label="Descargar"
              download
            >
              <Download aria-hidden />
            </a>
          </Button>
        ) : null}
      </div>

      <div className="relative bg-surface-sunken">
        <iframe
          src={src}
          title={fileName}
          className={cn("w-full border-0", ampliado ? "h-[calc(100dvh-3rem)]" : "h-[70vh]")}
        />

        {marcaDeAgua ? (
          <p
            aria-hidden
            className="pointer-events-none absolute bottom-3 right-3 select-none rounded bg-black/45 px-2 py-1 text-[0.625rem] font-medium text-white"
          >
            {marcaDeAgua}
          </p>
        ) : null}
      </div>

      {!puedeDescargar ? (
        <p className="border-t border-line px-3 py-2 text-xs text-ink-muted">
          Tu academia ha configurado este material para consulta en línea, sin
          descarga.
        </p>
      ) : null}
    </div>
  );
}
