import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CheckCircle2, CreditCard, ShieldCheck, XCircle } from "lucide-react";
import { prismaBase } from "@/lib/db/client";
import { prepararCobroConTarjeta } from "@/server/billing/tarjeta";
import { Card, CardContent } from "@/components/ui/primitives";
import { formatCents } from "@/lib/utils";
import { FormularioDeRedsys } from "./formulario";

export const metadata: Metadata = { title: "Pagar" };

/**
 * PAGAR UN RECIBO CON TARJETA
 *
 * Es la única pantalla de la aplicación sin sesión: el enlace se le manda al
 * alumno por correo y tiene que abrirse sin más, también desde el móvil de
 * quien le paga las clases, que puede no tener cuenta.
 *
 * Lo que se enseña sin identificarse es lo mínimo para saber qué se paga: el
 * concepto y el importe. Ni el nombre del alumno, ni su correo, ni el resto de
 * sus recibos. El identificador del recibo es un UUID v7, que no se adivina
 * probando.
 */
export default async function PagarPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ estado?: string }>;
}) {
  const { id } = await params;
  const { estado } = await searchParams;

  const recibo = await prismaBase.payment.findFirst({
    where: { id, deletedAt: null },
    select: {
      id: true,
      academyId: true,
      concept: true,
      amountCents: true,
      status: true,
      academy: { select: { name: true, legalName: true } },
    },
  });
  if (!recibo) notFound();

  const academia = recibo.academy.legalName ?? recibo.academy.name;

  if (recibo.status === "PAID") {
    return (
      <Marco academia={academia}>
        <div className="flex flex-col items-center gap-3 text-center">
          <CheckCircle2 className="size-10 text-positive" aria-hidden />
          <p className="font-display text-lg font-semibold text-ink">
            Este recibo ya está pagado
          </p>
          <p className="text-sm leading-relaxed text-ink-muted">
            {recibo.concept} · {formatCents(recibo.amountCents)}. No hace falta
            que hagas nada más.
          </p>
        </div>
      </Marco>
    );
  }

  const cobro = await prepararCobroConTarjeta(recibo.academyId, recibo.id);
  if (!cobro.ok) {
    return (
      <Marco academia={academia}>
        <p className="text-center text-sm text-ink-muted">{cobro.motivo}</p>
      </Marco>
    );
  }

  return (
    <Marco academia={academia}>
      {estado === "ko" ? (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-[var(--radius-control)] bg-critical-soft px-3 py-2 text-sm text-critical"
        >
          <XCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          El pago no se ha completado. No se te ha cobrado nada; puedes volver a
          intentarlo.
        </p>
      ) : null}

      {estado === "ok" ? (
        <p
          role="status"
          className="flex items-start gap-2 rounded-[var(--radius-control)] bg-positive-soft px-3 py-2 text-sm text-positive"
        >
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
          Pago enviado. Puede tardar un momento en confirmarse; te llegará el
          justificante por correo.
        </p>
      ) : null}

      <div className="space-y-1 text-center">
        <p className="text-sm text-ink-muted">{recibo.concept}</p>
        <p className="cifra text-[2.5rem] leading-none text-ink">
          {formatCents(recibo.amountCents)}
        </p>
      </div>

      {cobro.enPruebas ? (
        <p className="rounded-[var(--radius-control)] bg-caution-soft px-3 py-2 text-xs leading-relaxed text-caution">
          <strong>Entorno de pruebas.</strong> No se va a cobrar nada de verdad.
          La academia todavía no ha conectado su TPV.
        </p>
      ) : null}

      <FormularioDeRedsys peticion={cobro.peticion} />

      <p className="flex items-start gap-1.5 text-xs leading-relaxed text-ink-muted">
        <ShieldCheck className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        Los datos de la tarjeta se teclean en la pasarela de tu banco. Ni la
        academia ni esta aplicación llegan a verlos en ningún momento.
      </p>
    </Marco>
  );
}

/** La carcasa: sin barra lateral ni menú, que aquí no hay dónde navegar. */
function Marco({
  academia,
  children,
}: {
  academia: string;
  children: React.ReactNode;
}) {
  return (
    <main className="shell-wash flex min-h-dvh items-center justify-center bg-surface-sunken p-4">
      <Card className="w-full max-w-sm">
        <CardContent className="space-y-5 p-6 pt-6">
          <div className="flex items-center gap-2.5">
            <span className="icon-chip size-9 [&_svg]:size-4" data-tone="emerald" aria-hidden>
              <CreditCard />
            </span>
            <p className="min-w-0 truncate font-display text-[0.9375rem] font-semibold text-ink">
              {academia}
            </p>
          </div>
          {children}
        </CardContent>
      </Card>
    </main>
  );
}
