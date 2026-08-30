import type { Metadata } from "next";
import { ShieldOff } from "lucide-react";
import { signOutAction } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { Card, EmptyState } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Sin acceso" };

/**
 * La pantalla de «esto no es para ti».
 *
 * Existe porque una persona que llega a una dirección que no le corresponde
 * merece una explicación, no un error del servidor.
 */
export default function SinAccesoPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md items-center px-4">
      <Card className="w-full">
        <EmptyState
          icon={<ShieldOff className="size-5" />}
          title="Tu cuenta no tiene acceso todavía"
          description="Tu academia debe asignarte un rol para que puedas entrar. Ponte en contacto con ella."
          action={
            <form action={signOutAction}>
              <Button type="submit" variant="secondary" size="sm">
                Cerrar sesión
              </Button>
            </form>
          }
        />
      </Card>
    </main>
  );
}
