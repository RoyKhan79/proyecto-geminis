import type { Metadata } from "next";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  XCircle,
} from "lucide-react";
import { requirePlatformAdmin } from "@/lib/auth/context";
import { medirSalud } from "@/server/observability/health";
import {
  Card,
  CardContent,
  PageHeader,
} from "@/components/ui/primitives";
import { formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Salud del sistema" };

/// Se mide en cada visita: un panel de salud cacheado no sirve para nada.
export const dynamic = "force-dynamic";

/**
 * Salud del sistema.
 *
 * Responde a «¿cómo va esto?», que es una pregunta distinta de «¿qué ha pasado?»
 * —esa la responde la auditoría—.
 *
 * Lo que más importa de esta pantalla no son los números de uso: son las
 * comprobaciones de que las protecciones siguen puestas. El hallazgo H-04 fue
 * una protección activada que no protegía nada, y estuvo así hasta que alguien
 * la puso a prueba. Aquí se pone a prueba sola cada vez que se abre.
 */
export default async function SaludPage() {
  await requirePlatformAdmin();
  const salud = await medirSalud();

  const mal = salud.comprobaciones.filter((c) => c.estado === "mal");
  const avisos = salud.comprobaciones.filter((c) => c.estado === "aviso");

  return (
    <main className="mx-auto w-full max-w-4xl space-y-6 p-6">
      <PageHeader
        title="Salud del sistema"
        description="Cómo va el servicio y si las protecciones siguen donde deben."
        breadcrumb={
          <Link
            href="/plataforma"
            className="inline-flex items-center gap-1 text-xs text-ink-muted hover:text-ink"
          >
            <ChevronLeft className="size-3.5" aria-hidden />
            Plataforma
          </Link>
        }
      />

      <Card
        className={
          mal.length > 0
            ? "border-critical/40"
            : avisos.length > 0
              ? "border-caution/40"
              : "border-positive/30"
        }
      >
        <CardContent className="flex items-center gap-3 p-5 pt-5">
          {mal.length > 0 ? (
            <XCircle className="size-6 shrink-0 text-critical" aria-hidden />
          ) : avisos.length > 0 ? (
            <AlertTriangle className="size-6 shrink-0 text-caution" aria-hidden />
          ) : (
            <CheckCircle2 className="size-6 shrink-0 text-positive" aria-hidden />
          )}
          <div>
            <p className="font-medium text-ink">
              {mal.length > 0
                ? `${mal.length} ${mal.length === 1 ? "problema" : "problemas"} que hay que resolver`
                : avisos.length > 0
                  ? `Funcionando, con ${avisos.length} ${avisos.length === 1 ? "aviso" : "avisos"}`
                  : "Todo en orden"}
            </p>
            <p className="text-sm text-ink-muted">
              Base de datos a {salud.latenciaDbMs} ms · {salud.metricas.tamanoBaseMb} MB
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <div className="border-b border-line px-5 py-3.5">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
            <Activity className="size-4 text-ink-muted" aria-hidden />
            Comprobaciones
          </h2>
        </div>
        <ul className="divide-y divide-[var(--border-subtle)]">
          {salud.comprobaciones.map((c) => (
            <li key={c.clave} className="flex items-start gap-3 px-5 py-3">
              {c.estado === "bien" ? (
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-positive" aria-hidden />
              ) : c.estado === "aviso" ? (
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-caution" aria-hidden />
              ) : (
                <XCircle className="mt-0.5 size-4 shrink-0 text-critical" aria-hidden />
              )}
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink">{c.etiqueta}</p>
                <p className="text-xs text-ink-muted">{c.detalle}</p>
              </div>
            </li>
          ))}
        </ul>
      </Card>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metrica label="Academias" valor={`${salud.metricas.academiasActivas} / ${salud.metricas.academias}`} />
        <Metrica label="Personas" valor={String(salud.metricas.personas)} />
        <Metrica label="Sesiones abiertas" valor={String(salud.metricas.sesionesAbiertas)} />
        <Metrica
          label="Intentos fallidos (1 h)"
          valor={String(salud.metricas.intentosFallidosUltimaHora)}
          alerta={salud.metricas.intentosFallidosUltimaHora > 20}
        />
        <Metrica label="Consultas a la IA (7 d)" valor={String(salud.metricas.consultasIaUltimos7Dias)} />
        <Metrica
          label="Errores de IA (7 d)"
          valor={String(salud.metricas.erroresIaUltimos7Dias)}
          alerta={salud.metricas.erroresIaUltimos7Dias > 0}
        />
        <Metrica label="Tamaño de la base" valor={`${salud.metricas.tamanoBaseMb} MB`} />
      </section>

      <Card>
        <CardContent className="space-y-2 p-5 pt-5">
          <h2 className="text-sm font-semibold text-ink">Tareas programadas</h2>
          <ul className="space-y-1.5">
            {salud.tareas.map((t) => (
              <li key={t.nombre} className="flex items-center justify-between text-sm">
                <span className="text-ink">{t.nombre}</span>
                <span className={t.alDia ? "text-xs text-positive" : "text-xs text-caution"}>
                  {t.ultimaVez ? formatDateTime(t.ultimaVez) : "nunca"}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-ink-muted">
            Van en el cron del servidor. Si una lleva días sin correr, no está
            avisando de nada y nadie se entera hasta que hace falta.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}

function Metrica({
  label,
  valor,
  alerta,
}: {
  label: string;
  valor: string;
  alerta?: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-4 pt-4">
        <p className="text-xs text-ink-muted">{label}</p>
        <p
          className={`text-xl font-semibold tabular-nums ${
            alerta ? "text-caution" : "text-ink"
          }`}
        >
          {valor}
        </p>
      </CardContent>
    </Card>
  );
}
