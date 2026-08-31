import type { Metadata } from "next";
import Link from "next/link";
import { Check, Lock } from "lucide-react";
import { getAuthContext } from "@/lib/auth/context";
import { MODULOS, type CodigoModulo } from "@/lib/modules/catalogo";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/primitives";
import { formatCents } from "@/lib/utils";

export const metadata: Metadata = { title: "Módulo no contratado" };

/**
 * «Esto no lo tenéis contratado».
 *
 * Es una pantalla distinta de `/sin-acceso` porque es un problema distinto: ahí
 * falta un permiso, que lo arregla el administrador de la academia; aquí falta
 * un módulo, que se resuelve contratándolo. Mandar a alguien a buscar un ajuste
 * que no existe es la peor forma de decir que no.
 *
 * Así que en lugar de un cartel, se explica qué es ese módulo y qué incluye. Si
 * alguien ha llegado hasta aquí es porque le hacía falta.
 */
export default async function SinModuloPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await getAuthContext();
  const params = await searchParams;
  const codigo = typeof params.m === "string" ? (params.m as CodigoModulo) : null;
  const modulo = codigo ? MODULOS[codigo] : null;

  const volver = ctx?.permissions.has("manager.access") ? "/gestion" : "/campus";

  return (
    <main className="shell-wash flex min-h-dvh items-center justify-center bg-surface-sunken px-4 py-12">
      <div className="w-full max-w-lg space-y-5">
        <div className="space-y-2 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-surface-muted text-ink-muted">
            <Lock className="size-5" aria-hidden />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            {modulo ? modulo.nombre : "Módulo no contratado"}
          </h1>
          <p className="mx-auto max-w-sm text-sm leading-relaxed text-ink-soft">
            {modulo
              ? `Tu academia no tiene contratado este módulo. ${modulo.resumen}`
              : "Tu academia no tiene contratada esta parte del sistema."}
          </p>
        </div>

        {modulo ? (
          <Card>
            <CardContent className="space-y-4 p-5 pt-5">
              <div className="flex items-baseline justify-between gap-3 border-b border-line pb-3">
                <span className="text-sm font-medium text-ink">Qué incluye</span>
                <span className="text-sm text-ink-muted">
                  desde{" "}
                  <strong className="text-ink">
                    {formatCents(modulo.precioCents)}
                  </strong>{" "}
                  al mes
                </span>
              </div>

              <ul className="space-y-2">
                {modulo.incluye.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-ink-soft">
                    <Check className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
                    {item}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ) : null}

        <p className="text-center text-sm text-ink-muted">
          Para añadirlo, habla con quien lleva la cuenta de tu academia.
        </p>

        <Button asChild variant="secondary" className="w-full">
          <Link href={volver}>Volver</Link>
        </Button>
      </div>
    </main>
  );
}
