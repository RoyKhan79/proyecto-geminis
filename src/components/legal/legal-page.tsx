import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { BRAND } from "@/lib/brand";

/**
 * Carcasa de los textos legales.
 *
 * Van fuera de las carcasas de Manager y Campus a propósito: tienen que poder
 * leerse sin haber entrado, porque quien todavía no ha aceptado nada es
 * precisamente quien necesita leerlos.
 */
export function LegalPage({
  titulo,
  actualizado,
  children,
}: {
  titulo: string;
  actualizado: string;
  children: React.ReactNode;
}) {
  return (
    <main className="shell-wash min-h-dvh bg-surface-sunken px-4 py-10">
      <div className="mx-auto w-full max-w-2xl space-y-8">
        <div className="space-y-4">
          <Link
            href="/entrar"
            className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink"
          >
            <ArrowLeft className="size-4" aria-hidden />
            Volver
          </Link>

          <div className="space-y-2">
            <h1 className="text-3xl font-semibold leading-tight text-ink">
              {titulo}
            </h1>
            <p className="text-sm text-ink-muted">
              {BRAND.name} · última actualización: {actualizado}
            </p>
          </div>
        </div>

        <div className="legal-prose space-y-6 text-[0.9375rem] leading-relaxed text-ink-soft">
          {children}
        </div>

        <footer className="border-t border-line pt-6 text-xs text-ink-muted">
          <Link href="/privacidad" className="underline-offset-2 hover:underline">
            Política de privacidad
          </Link>
          <span aria-hidden> · </span>
          <Link href="/condiciones" className="underline-offset-2 hover:underline">
            Condiciones de uso
          </Link>
        </footer>
      </div>
    </main>
  );
}

/** Un apartado del documento. */
export function Apartado({
  numero,
  titulo,
  children,
}: {
  numero: string;
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="flex items-baseline gap-2 text-lg font-semibold text-ink">
        <span className="font-sans text-sm font-bold tabular-nums text-accent">
          {numero}
        </span>
        {titulo}
      </h2>
      {children}
    </section>
  );
}

/**
 * Aviso de que el documento hay que completarlo.
 *
 * Va arriba y bien visible. Un texto legal con huecos sin rellenar publicado
 * como si estuviera terminado es peor que no tener ninguno: da una falsa
 * sensación de cumplimiento.
 */
export function AvisoPlantilla() {
  return (
    <div className="rounded-[var(--radius-card)] border border-caution/30 bg-caution-soft/60 p-4 text-sm text-ink">
      <p className="font-semibold">Este documento hay que completarlo.</p>
      <p className="mt-1 text-ink-soft">
        Los campos entre corchetes los rellena quien explota el servicio. El
        texto refleja fielmente lo que el software hace y qué datos trata, pero
        no sustituye a la revisión de un profesional: cada academia tiene sus
        propios tratamientos, sus proveedores y sus plazos.
      </p>
    </div>
  );
}

/** Dato pendiente de rellenar. Se ve a la legua, que es la intención. */
export function Hueco({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded bg-caution-soft px-1 font-mono text-[0.8125rem] text-caution">
      [{children}]
    </span>
  );
}
