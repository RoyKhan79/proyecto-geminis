"use client";

import { useActionState, useState } from "react";
import { AlertCircle, FileSpreadsheet, UploadCloud } from "lucide-react";
import { uploadImportAction, type ImportState } from "@/server/imports/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/primitives";

/**
 * Paso 1 del asistente: subir el archivo.
 * Acepta arrastrar y soltar porque es lo que la gente intenta hacer.
 */
export function UploadForm() {
  const [state, formAction, pending] = useActionState<ImportState, FormData>(
    uploadImportAction,
    undefined,
  );
  const [fileName, setFileName] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  return (
    <Card>
      <CardContent className="p-5 pt-5">
        <form action={formAction} className="space-y-4">
          {state?.error ? (
            <p
              role="alert"
              className="flex items-start gap-2 rounded-[var(--radius-control)] bg-critical-soft px-3 py-2 text-sm text-critical"
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
              {state.error}
            </p>
          ) : null}

          <label
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={() => setDragging(false)}
            className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-[var(--radius-card)] border-2 border-dashed px-6 py-10 text-center transition-colors ${
              dragging
                ? "border-accent bg-accent-soft"
                : "border-line hover:border-line-strong hover:bg-surface-muted"
            }`}
          >
            <input
              type="file"
              name="file"
              accept=".csv,.xls,.xlsx,text/csv"
              className="sr-only"
              onChange={(event) => setFileName(event.target.files?.[0]?.name ?? null)}
              required
            />
            {fileName ? (
              <>
                <FileSpreadsheet className="size-7 text-accent" aria-hidden />
                <span className="font-medium text-ink">{fileName}</span>
                <span className="text-xs text-ink-muted">
                  Pulsa para elegir otro archivo
                </span>
              </>
            ) : (
              <>
                <UploadCloud className="size-7 text-ink-muted" aria-hidden />
                <span className="font-medium text-ink">
                  Arrastra tu archivo o pulsa para elegirlo
                </span>
                <span className="text-xs text-ink-muted">
                  Excel (.xlsx, .xls) o CSV · hasta 10 MB
                </span>
              </>
            )}
          </label>

          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-ink-muted">
              No se importa nada todavía: primero verás qué va a pasar.
            </p>
            <Button type="submit" loading={pending} disabled={!fileName}>
              Continuar
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
