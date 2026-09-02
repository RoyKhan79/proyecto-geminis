import type { Metadata } from "next";
import { ShieldOff } from "lucide-react";
import { BotonCerrarSesion } from "@/components/cerrar-sesion";
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
            <BotonCerrarSesion etiqueta="Cerrar sesión" />
          }
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
