import type { Metadata } from "next";
import { requireAcademy } from "@/lib/auth/context";
import { MochilaPanel } from "./mochila-panel";

export const metadata: Metadata = { title: "Descargas" };

/**
 * Descargas · «la mochila».
 *
 * El sitio donde el alumno se lleva el temario al móvil para estudiar en el
 * metro, en el pueblo o donde no haya cobertura. Lo que aparece aquí es
 * exactamente lo que ya podía descargarse a mano: esta pantalla no abre
 * ninguna puerta nueva, solo ahorra el viaje de ir tema por tema.
 */
export default async function DescargasPage() {
  const ctx = await requireAcademy();

  return (
    <>
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight text-ink">Descargas</h1>
        <p className="text-sm text-ink-muted">
          Guarda los temas en este dispositivo y estudia aunque te quedes sin
          cobertura. Se actualizan solos cuando tu academia publica una versión
          nueva.
        </p>
      </div>

      <MochilaPanel membershipId={ctx.membershipId} />
    </>
  );
}
