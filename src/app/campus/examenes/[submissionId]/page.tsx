import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, FileText, Timer } from "lucide-react";
import { requireAcademy } from "@/lib/auth/context";
import { loadExamForStudent } from "@/server/exams/queries";
import { Card, CardContent } from "@/components/ui/primitives";
import { formatDateTime } from "@/lib/utils";
import { BotonEmpezar } from "./empezar";
import { EditorDeExamen } from "./editor";

export const metadata: Metadata = { title: "Examen" };

/**
 * Un examen de desarrollo.
 *
 * La pantalla decide qué enseñar a partir del estado que calcula el servidor, y
 * solo del servidor. Aquí no se calcula ningún plazo con la hora del navegador:
 * si el estado dice «en curso», se escribe; si dice cualquier otra cosa, no.
 */
export default async function ExamenPage({
  params,
}: {
  params: Promise<{ submissionId: string }>;
}) {
  const ctx = await requireAcademy();
  const { submissionId } = await params;

  const examen = await loadExamForStudent(ctx.db, ctx.membershipId, submissionId);
  if (!examen) notFound();

  const { estado } = examen;

  return (
    <>
      <div className="space-y-1">
        <Link
          href="/campus/examenes"
          className="inline-flex items-center gap-1 text-xs text-ink-muted hover:text-ink"
        >
          <ChevronLeft className="size-3.5" aria-hidden />
          Exámenes
        </Link>
        <h1 className="text-xl font-semibold tracking-tight text-ink">
          {examen.titulo}
        </h1>
        <p className="text-sm text-ink-muted">
          {examen.timeLimitMinutes
            ? `${examen.timeLimitMinutes} minutos`
            : "Sin límite de tiempo"}
          {` · sobre ${examen.maxScore}`}
        </p>
      </div>

      {examen.enunciado ? (
        <Card>
          <CardContent className="whitespace-pre-line p-4 pt-4 text-sm leading-relaxed text-ink-soft">
            {examen.enunciado}
          </CardContent>
        </Card>
      ) : null}

      {estado.fase === "disponible" ? (
        <Card>
          <CardContent className="space-y-3 p-4 pt-4">
            <p className="flex items-start gap-2 text-sm text-ink-soft">
              <Timer className="mt-0.5 size-4 shrink-0 text-caution" aria-hidden />
              <span>
                {examen.timeLimitMinutes ? (
                  <>
                    En cuanto pulses, empiezan a contar tus{" "}
                    <strong>{examen.timeLimitMinutes} minutos</strong>. El reloj no se
                    puede parar ni reiniciar, ni siquiera cerrando la aplicación.
                  </>
                ) : (
                  <>
                    Este examen no tiene reloj
                    {examen.dueAt ? `, pero se cierra el ${formatDateTime(examen.dueAt)}` : ""}
                    .
                  </>
                )}{" "}
                Lo que escribas se guarda solo cada pocos segundos.
              </span>
            </p>

            <BotonEmpezar submissionId={examen.submissionId} />
          </CardContent>
        </Card>
      ) : null}

      {estado.fase === "en_curso" ? (
        <EditorDeExamen
          submissionId={examen.submissionId}
          borradorInicial={examen.borrador ?? ""}
          terminaEnISO={
            Number.isFinite(estado.segundosRestantes)
              ? estado.terminaEn.toISOString()
              : null
          }
          permiteArchivos={examen.allowFiles}
        />
      ) : null}

      {estado.fase === "no_abierto" ? (
        <Card>
          <CardContent className="p-4 pt-4 text-sm text-ink-soft">
            Este examen se abre el <strong>{formatDateTime(estado.abreEn)}</strong>.
            Vuelve entonces.
          </CardContent>
        </Card>
      ) : null}

      {estado.fase === "caducado" ? (
        <Card>
          <CardContent className="p-4 pt-4 text-sm text-ink-soft">
            El plazo se cerró el {formatDateTime(estado.cerroEn)} y no llegaste a
            empezarlo. Habla con tu preparador si crees que hay un error.
          </CardContent>
        </Card>
      ) : null}

      {estado.fase === "entregado" || estado.fase === "corregido" || estado.fase === "tiempo_agotado" ? (
        <Card>
          <CardContent className="space-y-3 p-4 pt-4">
            <p className="text-sm text-ink-soft">
              {examen.autoSubmitted
                ? "Se entregó solo al agotarse el tiempo, con lo último que habías escrito."
                : `Entregado el ${formatDateTime(examen.submittedAt)}.`}
            </p>

            {estado.fase === "corregido" ? (
              <p className="text-lg font-semibold tabular-nums text-ink">
                {examen.score ?? "—"}
                <span className="text-sm text-ink-muted">/{examen.maxScore}</span>
              </p>
            ) : null}

            {examen.feedback ? (
              <div className="rounded-[var(--radius-control)] bg-surface-muted p-3">
                <p className="text-xs font-medium text-ink">Comentario del profesor</p>
                <p className="mt-1 whitespace-pre-line text-sm text-ink-soft">
                  {examen.feedback}
                </p>
              </div>
            ) : null}

            {examen.borrador ? (
              <div className="space-y-1">
                <p className="text-xs font-medium text-ink">Lo que entregaste</p>
                <p className="whitespace-pre-line rounded-[var(--radius-control)] bg-surface-muted p-3 text-sm leading-relaxed text-ink-soft">
                  {examen.borrador}
                </p>
              </div>
            ) : null}

            {examen.archivos.length > 0 ? (
              <ul className="flex flex-wrap gap-2">
                {examen.archivos.map((archivo) => (
                  <li key={archivo.id}>
                    <a
                      href={`/api/archivos/${archivo.fileId}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-xs text-accent hover:bg-surface-muted"
                    >
                      <FileText className="size-3" aria-hidden />
                      {archivo.nombre}
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </>
  );
}
