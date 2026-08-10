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
