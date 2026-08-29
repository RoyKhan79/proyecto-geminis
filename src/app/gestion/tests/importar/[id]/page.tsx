import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, CheckCircle2, ChevronLeft, Undo2, XCircle } from "lucide-react";
import { requirePagePermission } from "@/lib/auth/context";
import {
  previewQuestionImport,
  rollbackQuestionImportAction,
  runQuestionImportAction,
} from "@/server/imports/question-actions";
import { QUESTION_FIELDS } from "@/server/imports/questions";
import { Button } from "@/components/ui/button";
import {
  Badge,
  Card,
  CardContent,
  PageHeader,
  Table,
  Td,
  Th,
} from "@/components/ui/primitives";
import { formatDateTime } from "@/lib/utils";
import { QuestionMappingForm } from "./mapping-form";

export const metadata: Metadata = { title: "Importar preguntas" };

const FILA_ESTADO: Record<
  string,
  { label: string; tone: "neutral" | "positive" | "caution" | "critical" | "info" }
> = {
  PENDING: { label: "Pendiente", tone: "neutral" },
  VALID: { label: "Se creará", tone: "positive" },
  WARNING: { label: "Con avisos", tone: "caution" },
  ERROR: { label: "Error", tone: "critical" },
  CREATED: { label: "Creada", tone: "positive" },
  UPDATED: { label: "Actualizada", tone: "info" },
  SKIPPED: { label: "Saltada", tone: "neutral" },
  ROLLED_BACK: { label: "Revertida", tone: "neutral" },
};

export default async function ImportarPreguntasDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await requirePagePermission("imports.run");
  const { id } = await params;

  const datos = await previewQuestionImport(id);
  if (!datos) notFound();

  const { job, headers, evaluadas, resumen } = datos;
  const opciones = job.options as {
    onDuplicate?: "skip" | "import";
    editionId?: string | null;
  };

  const terminado = job.status === "COMPLETED" || job.status === "ROLLED_BACK";
  const revertido = job.status === "ROLLED_BACK";

  const convocatorias = await ctx.db.oppositionEdition.findMany({
    where: { deletedAt: null },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  const conErrores = evaluadas.filter((fila) => fila.status === "ERROR");
  const muestra = evaluadas.slice(0, 30);

  return (
    <>
      <PageHeader
        title={job.fileName}
        description={`${job.rowCount} preguntas · subido el ${formatDateTime(job.createdAt)}`}
        breadcrumb={
          <Link
            href="/gestion/tests/importar"
            className="inline-flex items-center gap-1 text-xs text-ink-muted hover:text-ink"
          >
            <ChevronLeft className="size-3.5" aria-hidden />
            Importar preguntas
          </Link>
        }
        actions={
          revertido ? (
            <Badge tone="neutral">Revertida</Badge>
          ) : terminado ? (
            <form action={rollbackQuestionImportAction}>
              <input type="hidden" name="jobId" value={job.id} />
              <Button type="submit" variant="secondary" size="sm">
                <Undo2 aria-hidden />
                Deshacer importación
              </Button>
            </form>
          ) : null
        }
      />

      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-muted">
        {["Subir archivo", "Asignar columnas", "Previsualizar", "Importar"].map(
          (paso, indice) => {
            const actual = terminado ? 3 : job.status === "SIMULATED" ? 2 : 1;
            const estado =
              indice < actual ? "hecho" : indice === actual ? "actual" : "pendiente";
            return (
              <li key={paso} className="flex items-center gap-2">
                <span
                  className={
                    estado === "hecho"
                      ? "flex size-5 items-center justify-center rounded-full bg-positive text-[0.625rem] font-semibold text-white"
                      : estado === "actual"
                        ? "flex size-5 items-center justify-center rounded-full bg-accent text-[0.625rem] font-semibold text-accent-contrast"
                        : "flex size-5 items-center justify-center rounded-full bg-surface-muted text-[0.625rem] font-semibold text-ink-muted"
                  }
                >
                  {indice + 1}
                </span>
                <span className={estado === "actual" ? "font-medium text-ink" : ""}>
                  {paso}
                </span>
                {indice < 3 ? <span aria-hidden>·</span> : null}
              </li>
            );
          },
        )}
      </ol>

      <QuestionMappingForm
        jobId={job.id}
        headers={headers}
        fields={QUESTION_FIELDS}
        mapping={(job.columnMapping as Record<string, string>) ?? {}}
        onDuplicate={opciones.onDuplicate ?? "skip"}
        editionId={opciones.editionId ?? null}
        editions={convocatorias}
        disabled={terminado}
      />

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metrica
          label={terminado ? "Creadas" : "Se crearán"}
          value={resumen.crear}
          tone="positive"
        />
        <Metrica label="Se saltan" value={resumen.saltar} tone="neutral" />
        <Metrica label="Con error" value={resumen.errores} tone="critical" />
        <Metrica label="Sin tema" value={resumen.sinTema} tone="info" />
      </section>

      {!terminado ? (
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-5 pt-5">
            <div className="space-y-1 text-sm">
              {resumen.errores > 0 ? (
                <p className="flex items-center gap-2 text-caution">
                  <AlertTriangle className="size-4 shrink-0" aria-hidden />
                  Hay {resumen.errores} preguntas con errores. Se importarán las demás
                  y esas quedarán en el informe.
                </p>
              ) : (
                <p className="flex items-center gap-2 text-positive">
                  <CheckCircle2 className="size-4 shrink-0" aria-hidden />
                  Todo listo. No se ha modificado nada todavía.
                </p>
              )}
              {resumen.sinTema > 0 ? (
                <p className="text-xs text-ink-muted">
                  {resumen.sinTema} preguntas entrarán sin tema asignado: no
                  aparecerán en los tests por tema hasta que se lo pongas.
                </p>
              ) : null}
            </div>
            <form action={runQuestionImportAction}>
              <input type="hidden" name="jobId" value={job.id} />
              <Button type="submit" disabled={resumen.crear === 0}>
                Importar {resumen.crear} preguntas
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : null}

      {conErrores.length > 0 ? (
        <Card>
          <CardContent className="space-y-2 p-5 pt-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
              <XCircle className="size-4 text-critical" aria-hidden />
              Preguntas con problemas
            </h2>
            <ul className="space-y-1 text-sm text-ink-soft">
              {conErrores.slice(0, 10).map((fila) => (
                <li key={fila.rowNumber}>
                  <span className="font-medium text-ink">Fila {fila.rowNumber}:</span>{" "}
                  {fila.messages.map((m) => m.text).join(" ")}
                </li>
              ))}
              {conErrores.length > 10 ? (
                <li className="text-xs text-ink-muted">
                  …y {conErrores.length - 10} más.
                </li>
              ) : null}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <h2 className="text-sm font-semibold text-ink">
            {terminado ? "Resultado" : "Previsualización"}
          </h2>
          <span className="text-xs text-ink-muted">
            {muestra.length} de {evaluadas.length} filas
          </span>
        </div>
        <Table>
          <thead>
            <tr>
              <Th>Fila</Th>
              <Th>Enunciado</Th>
              <Th className="hidden sm:table-cell">Correcta</Th>
              <Th className="hidden md:table-cell">Tema</Th>
              <Th>Qué pasa</Th>
              <Th className="hidden lg:table-cell">Avisos</Th>
            </tr>
          </thead>
          <tbody>
            {muestra.map((fila) => {
              const estado = FILA_ESTADO[fila.status] ?? FILA_ESTADO.PENDING;
              const correcta =
                fila.correctIndex >= 0 && fila.options[fila.correctIndex]
                  ? `${String.fromCharCode(65 + fila.correctIndex)}. ${fila.options[fila.correctIndex]}`
                  : "—";

              return (
                <tr key={fila.rowNumber}>
                  <Td className="tabular-nums text-ink-muted">{fila.rowNumber}</Td>
                  <Td className="max-w-xs">
                    <span className="line-clamp-2 text-ink">
                      {fila.statement || "—"}
                    </span>
                  </Td>
                  <Td className="hidden max-w-[14rem] sm:table-cell">
                    <span className="line-clamp-2 text-ink-soft">{correcta}</span>
                  </Td>
                  <Td className="hidden text-ink-soft md:table-cell">
                    {fila.nodeLabel ?? "—"}
                  </Td>
                  <Td>
                    <Badge tone={estado.tone}>{estado.label}</Badge>
                  </Td>
                  <Td className="hidden text-xs text-ink-muted lg:table-cell">
                    {fila.messages.map((m) => m.text).join(" ") || "—"}
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </Card>
    </>
  );
}

function Metrica({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "positive" | "info" | "neutral" | "critical";
}) {
  const color = {
    positive: "text-positive",
    info: value > 0 ? "text-info" : "text-ink-soft",
    neutral: "text-ink-soft",
    critical: value > 0 ? "text-critical" : "text-ink-soft",
  }[tone];

  return (
    <Card>
      <CardContent className="p-4 pt-4">
        <p className="text-xs text-ink-muted">{label}</p>
        <p className={`text-2xl font-semibold tabular-nums ${color}`}>{value}</p>
      </CardContent>
    </Card>
  );
}
