import type { Metadata } from "next";
import Link from "next/link";
import { FileSpreadsheet, ShieldCheck, Undo2 } from "lucide-react";
import { requirePagePermission } from "@/lib/auth/context";
import {
  Badge,
  Card,
  CardContent,
  EmptyState,
  PageHeader,
  Table,
  Td,
  Th,
} from "@/components/ui/primitives";
import { formatDateTime } from "@/lib/utils";
import { UploadForm } from "./upload-form";

export const metadata: Metadata = { title: "Importar" };

const ESTADO: Record<
  string,
  { label: string; tone: "neutral" | "positive" | "caution" | "critical" | "info" }
> = {
  UPLOADED: { label: "Subido", tone: "neutral" },
  MAPPING: { label: "Asignando columnas", tone: "info" },
  VALIDATED: { label: "Validado", tone: "info" },
  SIMULATED: { label: "Listo para importar", tone: "caution" },
  IMPORTING: { label: "Importando", tone: "info" },
  COMPLETED: { label: "Completado", tone: "positive" },
  FAILED: { label: "Con errores", tone: "critical" },
  ROLLED_BACK: { label: "Revertido", tone: "neutral" },
};

export default async function ImportarPage() {
  const ctx = await requirePagePermission("imports.run");

  const trabajos = await ctx.db.importJob.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return (
    <>
      <PageHeader
        title="Importar alumnos"
        description="Trae tu listado desde Excel o CSV. Verás una simulación antes de tocar nada y podrás deshacerlo después."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Ventaja
          icon={<ShieldCheck className="size-4" />}
          title="Nada a ciegas"
          text="Antes de importar te decimos cuántos alumnos se crean, cuántos se actualizan y qué filas fallan."
        />
        <Ventaja
          icon={<FileSpreadsheet className="size-4" />}
          title="Tus columnas"
          text="No hace falta que adaptes el archivo. Tú dices qué columna es cada cosa; te lo proponemos ya resuelto."
        />
        <Ventaja
          icon={<Undo2 className="size-4" />}
          title="Se puede deshacer"
          text="Si el archivo venía mal, se revierte la importación completa y la academia queda como estaba."
        />
      </div>

      <UploadForm />

      <Card className="overflow-hidden">
        <div className="border-b border-line px-5 py-3.5">
          <h2 className="text-sm font-semibold text-ink">Importaciones anteriores</h2>
        </div>
        {trabajos.length === 0 ? (
          <EmptyState
            icon={<FileSpreadsheet className="size-5" />}
            title="Todavía no has importado nada"
            description="Cuando subas tu primer archivo aparecerá aquí con su informe."
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Archivo</Th>
                <Th>Fecha</Th>
                <Th>Filas</Th>
                <Th className="hidden sm:table-cell">Resultado</Th>
                <Th>Estado</Th>
              </tr>
            </thead>
            <tbody>
              {trabajos.map((trabajo) => {
                const estado = ESTADO[trabajo.status] ?? ESTADO.UPLOADED;
                return (
                  <tr key={trabajo.id} className="hover:bg-surface-muted">
                    <Td>
                      <Link
                        href={`/gestion/importar/${trabajo.id}`}
                        className="font-medium text-ink hover:text-accent"
                      >
                        {trabajo.fileName}
                      </Link>
                    </Td>
                    <Td className="text-ink-soft">
                      {formatDateTime(trabajo.createdAt)}
                    </Td>
                    <Td className="tabular-nums text-ink-soft">{trabajo.rowCount}</Td>
                    <Td className="hidden text-xs text-ink-soft sm:table-cell">
                      {trabajo.status === "COMPLETED" || trabajo.status === "ROLLED_BACK"
                        ? `${trabajo.createdCount} creados · ${trabajo.updatedCount} actualizados · ${trabajo.errorCount} errores`
                        : "—"}
                    </Td>
                    <Td>
                      <Badge tone={estado.tone}>{estado.label}</Badge>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}

function Ventaja({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <Card>
      <CardContent className="space-y-1.5 p-4 pt-4">
        <div className="flex items-center gap-2 text-accent">
          {icon}
          <span className="text-sm font-medium text-ink">{title}</span>
        </div>
        <p className="text-xs text-ink-muted">{text}</p>
      </CardContent>
    </Card>
  );
}
