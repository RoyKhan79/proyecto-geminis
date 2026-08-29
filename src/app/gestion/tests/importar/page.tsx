import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, FileSpreadsheet } from "lucide-react";
import { requirePagePermission } from "@/lib/auth/context";
import {
  Badge,
  Card,
  CardContent,
  EmptyState,
  PageHeader,
} from "@/components/ui/primitives";
import { formatDateTime } from "@/lib/utils";
import { UploadQuestionsForm } from "./upload-form";

export const metadata: Metadata = { title: "Importar preguntas" };

const ESTADO: Record<
  string,
  { label: string; tone: "neutral" | "positive" | "caution" | "critical" }
> = {
  UPLOADED: { label: "Subido", tone: "neutral" },
  MAPPING: { label: "Asignando columnas", tone: "caution" },
  VALIDATED: { label: "Validado", tone: "caution" },
  SIMULATED: { label: "Simulado", tone: "caution" },
  IMPORTING: { label: "Importando", tone: "caution" },
  COMPLETED: { label: "Completada", tone: "positive" },
  FAILED: { label: "Fallida", tone: "critical" },
  ROLLED_BACK: { label: "Revertida", tone: "neutral" },
};

/**
 * Importar un banco de preguntas.
 *
 * Después de los alumnos, es la segunda razón por la que una academia no se
 * cambia de programa: veinte años de preguntas en un Excel que nadie va a
 * volver a escribir.
 */
export default async function ImportarPreguntasPage() {
  const ctx = await requirePagePermission("imports.run");

  const trabajos = await ctx.db.importJob.findMany({
    where: { type: "QUESTIONS" },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      fileName: true,
      status: true,
      rowCount: true,
      createdCount: true,
      skippedCount: true,
      errorCount: true,
      createdAt: true,
    },
  });

  return (
    <>
      <PageHeader
        title="Importar preguntas"
        description="Trae tu banco entero desde un Excel o un CSV. Se simula antes de tocar nada y se puede deshacer."
        breadcrumb={
          <Link
            href="/gestion/tests"
            className="inline-flex items-center gap-1 text-xs text-ink-muted hover:text-ink"
          >
            <ChevronLeft className="size-3.5" aria-hidden />
            Tests
          </Link>
        }
      />

      <UploadQuestionsForm />

      <Card>
        <CardContent className="space-y-3 p-5 pt-5 text-sm text-ink-soft">
          <p className="font-medium text-ink">Cómo debe venir el archivo</p>
          <ul className="ml-5 list-disc space-y-1.5">
            <li>
              Una fila por pregunta, con la primera fila de cabeceras.
            </li>
            <li>
              Una columna para el enunciado y una por cada opción (hasta cinco).
            </li>
            <li>
              Una columna con la respuesta correcta. Vale la letra{" "}
              <strong className="text-ink">B</strong>, el número{" "}
              <strong className="text-ink">2</strong> o el texto exacto de la
              opción: se interpretan las tres.
            </li>
            <li>
              Opcionalmente, explicación, tema, dificultad, etiquetas y examen de
              procedencia.
            </li>
          </ul>
          <p className="text-xs text-ink-muted">
            No hace falta que las cabeceras se llamen de ninguna forma concreta:
            en el siguiente paso se propone la asignación y tú la corriges. Las
            preguntas entran siempre <strong className="text-ink">en borrador</strong>,
            para que las revises antes de examinar con ellas.
          </p>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <div className="border-b border-line px-5 py-3.5">
          <h2 className="text-sm font-semibold text-ink">Importaciones anteriores</h2>
        </div>
        {trabajos.length === 0 ? (
          <EmptyState
            icon={<FileSpreadsheet className="size-5" />}
            title="Todavía no has importado ningún banco"
            description="Sube un archivo arriba para empezar."
          />
        ) : (
          <ul className="divide-y divide-[var(--border-subtle)]">
            {trabajos.map((trabajo) => {
              const estado = ESTADO[trabajo.status] ?? ESTADO.UPLOADED;
              return (
                <li key={trabajo.id}>
                  <Link
                    href={`/gestion/tests/importar/${trabajo.id}`}
                    className="flex flex-wrap items-center gap-3 px-5 py-3.5 hover:bg-surface-muted"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink">
                        {trabajo.fileName}
                      </p>
                      <p className="text-xs text-ink-muted">
                        {trabajo.rowCount} filas · {formatDateTime(trabajo.createdAt)}
                        {trabajo.status === "COMPLETED"
                          ? ` · ${trabajo.createdCount} creadas, ${trabajo.skippedCount} saltadas, ${trabajo.errorCount} con error`
                          : ""}
                      </p>
                    </div>
                    <Badge tone={estado.tone}>{estado.label}</Badge>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </>
  );
}
