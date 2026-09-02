import type { Metadata } from "next";
import { WifiOff } from "lucide-react";
import { Card, EmptyState } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Sin conexión" };

/**
 * Pantalla que muestra el service worker cuando no hay red.
 * Estática a propósito: tiene que poder servirse desde la caché.
 */
export default function SinConexionPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md items-center px-4">
      <Card className="w-full">
        <EmptyState
          icon={<WifiOff className="size-5" />}
          title="Sin conexión"
          description="No hay internet ahora mismo. Vuelve a intentarlo cuando recuperes la cobertura; lo que estabas estudiando sigue guardado."
        />
      </Card>
    </main>
  );
}

/**
 * Se renderiza en cada petición aunque su contenido no cambie.
 *
 * No es un capricho: la cabecera de seguridad del contenido lleva un testigo
 * distinto por petición (`src/proxy.ts`), y Next solo puede ponérselo a los
 * scripts de una página que se genere al pedirla. Una página prerenderizada se
 * escribió durante la compilación, cuando ese testigo todavía no existía, así
 * que sus scripts llegarían sin él y el navegador los bloquearía.
 *
 * El coste de generar una página de texto en cada visita es despreciable; el de
 * dejar `unsafe-inline` puesto para que estas cuatro siguieran siendo
 * estáticas, no.
 */
export const dynamic = "force-dynamic";
