import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth/context";
import { BRAND } from "@/lib/brand";
import { SignInForm } from "./sign-in-form";
import { SignoGeminis } from "@/components/marca";

export const metadata: Metadata = {
  title: "Entrar",
  description: "Accede a tu academia.",
};

/**
 * LA PUERTA
 *
 * Es la única pantalla que ve todo el mundo —la academia, el profesorado y el
 * alumnado— y muchas veces la primera. Un formulario suelto en medio de una
 * página en blanco funciona, pero no dice nada de lo que hay detrás.
 *
 * Así que la pantalla está partida: a la izquierda lo único que hay que hacer
 * aquí, entrar; a la derecha, en pantalla grande, qué es esto. El panel de la
 * derecha no es decoración de relleno: dice las tres cosas que de verdad
 * distinguen al producto, y desaparece en el móvil, donde lo que importa es el
 * teclado y el botón.
 *
 * El fondo del panel es el azul de la marca, el de la institución y el sello,
 * que es el terreno de una oposición. El dorado se usa una sola vez, en el
 * remate: está reservado a lo conseguido, y si se repartiera por la pantalla
 * dejaría de significar nada.
 */
export default async function EntrarPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await getAuthContext();
  if (ctx) redirect("/inicio");

  const params = await searchParams;

  return (
    <main className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      {/* ── Entrar ──────────────────────────────────────────────────────── */}
      <div className="shell-wash flex flex-col justify-center bg-surface-sunken px-5 py-12 sm:px-10">
        <div className="mx-auto w-full max-w-[26rem]">
          <Link href="/" className="inline-flex items-center gap-2.5">
            <span className="flex size-10 items-center justify-center rounded-xl bg-linear-to-br from-accent to-accent-hover text-base font-bold text-accent-contrast shadow-[inset_0_1px_0_0_oklch(1_0_0/0.28),var(--shadow-raised)]">
              <SignoGeminis className="size-full" />
            </span>
            <span className="font-display text-lg font-semibold tracking-tight text-ink">
              {BRAND.name}
            </span>
          </Link>

          <div className="mt-9 space-y-1.5">
            <h1 className="font-display text-[2rem] font-semibold leading-[1.1] tracking-tight text-ink">
              Entra en tu academia
            </h1>
            <p className="text-[0.9375rem] leading-relaxed text-ink-soft">
              Con el mismo acceso para el equipo y para el alumnado. Te llevamos
              a tu sitio.
            </p>
          </div>

          <div className="mt-7">
            <SignInForm cambiada={params.cambiada === "1"} />
          </div>

          <p className="mt-8 text-[0.8125rem] leading-relaxed text-ink-muted">
            ¿Problemas para entrar? Ponte en contacto con tu academia: ellos
            gestionan las cuentas.
          </p>

          <p className="mt-5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-muted">
            <Link href="/privacidad" className="underline-offset-2 hover:text-ink hover:underline">
              Privacidad
            </Link>
            <span aria-hidden>·</span>
            <Link href="/condiciones" className="underline-offset-2 hover:text-ink hover:underline">
              Condiciones de uso
            </Link>
          </p>
        </div>
      </div>

      {/* ── Qué es esto ─────────────────────────────────────────────────── */}
      <aside className="relative hidden overflow-hidden lg:flex lg:flex-col lg:justify-center bg-[var(--color-brand-800)] px-14 py-16">
        {/*
          Textura de fondo. Dos capas de líneas finísimas que sugieren una hoja
          pautada —un temario, un boletín— sin dibujar nada. Hecho con
          gradientes: cero peticiones y nada que se quede a medio cargar.
        */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.09]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(0deg, transparent 0 27px, oklch(1 0 0 / 0.6) 27px 28px)",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(80% 60% at 15% 0%, oklch(0.58 0.17 263 / 0.55) 0%, transparent 60%), radial-gradient(70% 60% at 100% 100%, oklch(0.27 0.1 267 / 0.7) 0%, transparent 55%)",
          }}
        />

        <div className="relative max-w-[30rem]">
          <p className="font-mono text-[0.7rem] uppercase tracking-[0.16em] text-[var(--color-brand-200)]">
            Para academias de oposiciones
          </p>

          <h2 className="mt-5 font-display text-[2.6rem] font-semibold leading-[1.08] tracking-tight text-white text-balance">
            El temario, las clases y los cobros.{" "}
            <span className="text-[var(--color-gold-300)]">En el mismo sitio.</span>
          </h2>

          <p className="mt-5 text-[1.0625rem] leading-relaxed text-[var(--color-brand-100)]">
            Y tu alumnado estudiando desde el móvil, con lo que ha contratado y
            solo con lo que ha contratado.
          </p>

          <ul className="mt-10 space-y-5">
            {[
              {
                titulo: "Cada academia, sola en su casa",
                texto:
                  "Dos barreras independientes separan tus datos de los de cualquier otra. No es una promesa: cada una funciona aunque la otra falle.",
              },
              {
                titulo: "Una IA que no se inventa nada",
                texto:
                  "Responde solo con tu material y cita de dónde lo saca. Si no lo tiene, lo dice. Funciona sin contratar ninguna API.",
              },
              {
                titulo: "Se estudia sin cobertura",
                texto:
                  "El alumnado se lleva los temas al móvil. Y si se da de baja, se le vacían: guardar no es quedárselo.",
              },
            ].map((punto) => (
              <li key={punto.titulo} className="flex gap-3.5">
                <span
                  aria-hidden
                  className="mt-[0.55rem] h-px w-6 shrink-0 bg-[var(--color-gold-300)]/70"
                />
                <div className="space-y-1">
                  <p className="font-medium leading-snug text-white">{punto.titulo}</p>
                  <p className="text-[0.9375rem] leading-relaxed text-[var(--color-brand-200)]">
                    {punto.texto}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </main>
  );
}
