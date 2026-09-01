import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { requirePagePermission } from "@/lib/auth/context";
import { PageHeader } from "@/components/ui/primitives";
import { ConciliarForm } from "./conciliar-form";

export const metadata: Metadata = { title: "Conciliar el banco" };

/**
 * CONCILIAR LAS TRANSFERENCIAS
 *
 * Las domiciliaciones las cobra el banco solo y la tarjeta se marca sola. Las
 * transferencias no: alguien tenía que mirar el extracto y marcarlas a mano una
 * por una. Esto lee el extracto y propone.
 *
 * @returns La pantalla de subir el extracto y revisar lo que propone.
 */
export default async function ConciliarPage() {
  await requirePagePermission("payments.write");

  return (
    <>
      <PageHeader
        title="Conciliar el banco"
        description="Sube el extracto y marca de una vez las transferencias que han entrado."
        breadcrumb={
          <Link
            href="/gestion/pagos"
            className="inline-flex items-center gap-1 text-xs text-ink-muted hover:text-ink"
          >
            <ChevronLeft className="size-3.5" aria-hidden />
            Pagos
          </Link>
        }
      />

      <ConciliarForm />
    </>
  );
}
