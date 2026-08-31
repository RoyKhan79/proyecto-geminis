"use client";

import { useState } from "react";
import { CreditCard } from "lucide-react";
import type { PeticionDePago } from "@/lib/billing/redsys";
import { Button } from "@/components/ui/button";

/**
 * El formulario que lleva al alumno a la pasarela de su banco.
 *
 * Va como un envío normal del navegador y no por `fetch`: Redsys responde con
 * su propia página, así que hace falta que el navegador NAVEGUE hasta allí. Una
 * llamada en segundo plano devolvería el HTML del banco a una pantalla que no
 * puede enseñarlo.
 *
 * Los tres campos ocultos son los que espera el protocolo, con esos nombres
 * exactos. El botón se desactiva al pulsar porque en un móvil con mala cobertura
 * la navegación tarda, y dos pulsaciones son dos pedidos.
 */
export function FormularioDeRedsys({ peticion }: { peticion: PeticionDePago }) {
  const [enviando, setEnviando] = useState(false);

  return (
    <form
      method="POST"
      action={peticion.url}
      onSubmit={() => setEnviando(true)}
      className="contents"
    >
      <input
        type="hidden"
        name="Ds_SignatureVersion"
        value={peticion.Ds_SignatureVersion}
      />
      <input
        type="hidden"
        name="Ds_MerchantParameters"
        value={peticion.Ds_MerchantParameters}
      />
      <input type="hidden" name="Ds_Signature" value={peticion.Ds_Signature} />

      <Button type="submit" className="w-full" disabled={enviando}>
        <CreditCard aria-hidden />
        {enviando ? "Abriendo la pasarela…" : "Pagar con tarjeta"}
      </Button>
    </form>
  );
}
