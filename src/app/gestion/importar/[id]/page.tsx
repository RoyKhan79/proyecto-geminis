import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, CheckCircle2, ChevronLeft, Undo2, XCircle } from "lucide-react";
import { requirePagePermission } from "@/lib/auth/context";
import {
  previewImport,
  rollbackImportAction,
  runImportAction,
} from "@/server/imports/actions";
import { STUDENT_FIELDS } from "@/server/imports/students";
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
import { MappingForm } from "./mapping-form";

export const metadata: Metadata = { title: "Importación" };

const FILA_ESTADO: Record<
  string,
  { label: string; tone: "neutral" | "positive" | "caution" | "critical" | "info" }
> = {
  PENDING: { label: "Pendiente", tone: "neutral" },
  VALID: { label: "Se creará", tone: "positive" },
  WARNING: { label: "Con avisos", tone: "caution" },
  ERROR: { label: "Error", tone: "critical" },
  CREATED: { label: "Creado", tone: "positive" },
  UPDATED: { label: "Actualizado", tone: "info" },
  SKIPPED: { label: "Saltado", tone: "neutral" },
  ROLLED_BACK: { label: "Revertido", tone: "neutral" },
};

export default async function ImportacionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await requirePagePermission("imports.run");
  const { id } = await params;

  const datos = await previewImport(id);
  if (!datos) notFound();

  const { job, headers, evaluadas, resumen } = datos;
  const opciones = job.options as {
    onDuplicate?: "update" | "skip";
    defaultCourseId?: string | null;
  };

  const terminado = job.status === "COMPLETED" || job.status === "ROLLED_BACK";
  const revertido = job.status === "ROLLED_BACK";

  const cursos = await ctx.db.course.findMany({
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
        description={`${job.rowCount} filas · subido el ${formatDateTime(job.createdAt)}`}
        breadcrumb={
          <Link
            href="/gestion/importar"
            className="inline-flex items-center gap-1 text-xs text-ink-muted hover:text-ink"
          >
            <ChevronLeft className="size-3.5" aria-hidden />
            Importar
          </Link>
        }
        actions={
          revertido ? (
            <Badge tone="neutral">Revertida</Badge>
          ) : terminado ? (
            <form action={rollbackImportAction}>
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

      <MappingForm
        jobId={job.id}
        headers={headers}
        fields={STUDENT_FIELDS}
        mapping={(job.columnMapping as Record<string, string>) ?? {}}
        onDuplicate={opciones.onDuplicate ?? "update"}
        defaultCourseId={opciones.defaultCourseId ?? null}
        courses={cursos}
        disabled={terminado}
      />

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metrica
          label={terminado ? "Creados" : "Se crearán"}
          value={resumen.crear}
          tone="positive"
        />
        <Metrica
          label={terminado ? "Actualizados" : "Se actualizarán"}
          value={resumen.actualizar}
          tone="info"
        />
        <Metrica label="Se saltan" value={resumen.saltar} tone="neutral" />
        <Metrica label="Con error" value={resumen.errores} tone="critical" />
      </section>

      {!terminado ? (
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-5 pt-5">
            <div className="text-sm">
              {resumen.errores > 0 ? (
                <p className="flex items-center gap-2 text-caution">
                  <AlertTriangle className="size-4 shrink-0" aria-hidden />
                  Hay {resumen.errores} filas con errores. Se importarán las demás y
                  esas quedarán registradas en el informe.
                </p>
              ) : (
                <p className="flex items-center gap-2 text-positive">
                  <CheckCircle2 className="size-4 shrink-0" aria-hidden />
                  Todo listo. No se ha modificado nada todavía.
                </p>
              )}
            </div>
            <form action={runImportAction}>
              <input type="hidden" name="jobId" value={job.id} />
              <Button type="submit" disabled={resumen.crear + resumen.actualizar === 0}>
                Importar {resumen.crear + resumen.actualizar} alumnos
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
              Filas con problemas
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
              <Th>Nombre</Th>
              <Th className="hidden sm:table-cell">Correo</Th>
              <Th>Qué pasa</Th>
              <Th className="hidden md:table-cell">Avisos</Th>
            </tr>
          </thead>
          <tbody>
            {muestra.map((fila) => {
              const estado = FILA_ESTADO[fila.status] ?? FILA_ESTADO.PENDING;
              return (
                <tr key={fila.rowNumber}>
                  <Td className="tabular-nums text-ink-muted">{fila.rowNumber}</Td>
                  <Td className="text-ink">
                    {[fila.parsed.firstName, fila.parsed.lastName]
                      .filter(Boolean)
                      .join(" ") || "—"}
                  </Td>
                  <Td className="hidden text-ink-soft sm:table-cell">
                    {fila.parsed.email ?? "—"}
                  </Td>
                  <Td>
                    <Badge tone={estado.tone}>{estado.label}</Badge>
                  </Td>
                  <Td className="hidden text-xs text-ink-muted md:table-cell">
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
    info: "text-info",
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
