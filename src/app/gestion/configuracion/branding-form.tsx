"use client";

import { useActionState, useState } from "react";
import { AlertCircle, CheckCircle2, Download } from "lucide-react";
import {
  exportAcademyDataAction,
  updateBrandingAction,
  type PlatformState,
} from "@/server/platform/actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Field,
  Input,
} from "@/components/ui/primitives";

/** Personalización de la academia y exportación de sus datos. */
export function BrandingForm({
  valores,
  puedeExportar,
}: {
  valores: {
    name: string;
    legalName: string | null;
    email: string | null;
    phone: string | null;
    primaryColor: string | null;
    logoUrl: string | null;
  };
  puedeExportar: boolean;
}) {
  const [state, formAction, pending] = useActionState<PlatformState, FormData>(
    updateBrandingAction,
    undefined,
  );
  const [exportando, setExportando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  async function exportar() {
    setExportando(true);
    setAviso(null);
    try {
      const resultado = await exportAcademyDataAction();
      if (resultado?.error) {
        setAviso(resultado.error);
      } else if (resultado?.ok) {
        // La descarga se genera en el navegador a partir del paquete recibido.
        const blob = new Blob([resultado.ok], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const enlace = document.createElement("a");
        enlace.href = url;
        enlace.download = `proyecto-geminis-export-${new Date().toISOString().slice(0, 10)}.json`;
        enlace.click();
        URL.revokeObjectURL(url);
        setAviso("Exportación descargada.");
      }
    } finally {
      setExportando(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Personalización</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 p-5 pt-0">
          {state?.error ? (
            <p role="alert" className="flex items-start gap-2 text-sm text-critical">
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
              {state.error}
            </p>
          ) : null}
          {state?.ok ? (
            <p role="status" className="flex items-start gap-2 text-sm text-positive">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
              {state.ok}
            </p>
          ) : null}

          <form action={formAction} className="space-y-4">
            <Field label="Nombre" htmlFor="name" required>
              <Input name="name" defaultValue={valores.name} required />
            </Field>
            <Field label="Razón social" htmlFor="legalName">
              <Input name="legalName" defaultValue={valores.legalName ?? ""} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Correo" htmlFor="email">
                <Input name="email" type="email" defaultValue={valores.email ?? ""} />
              </Field>
              <Field label="Teléfono" htmlFor="phone">
                <Input name="phone" type="tel" defaultValue={valores.phone ?? ""} />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Color principal"
                htmlFor="primaryColor"
                hint="Se aplica a botones y acentos."
              >
                <Input
                  name="primaryColor"
                  type="color"
                  defaultValue={valores.primaryColor ?? "#4F46E5"}
                  className="h-10 w-full p-1"
                />
              </Field>
              <Field label="Logotipo" htmlFor="logoUrl" hint="Dirección de la imagen.">
                <Input name="logoUrl" type="url" defaultValue={valores.logoUrl ?? ""} />
              </Field>
            </div>

            <div className="flex justify-end">
              <Button type="submit" loading={pending}>Guardar</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tus datos son tuyos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 p-5 pt-0">
          <p className="text-sm text-ink-muted">
            Descarga todo lo que tienes en Proyecto Geminis: personas, oposiciones,
            cursos, matrículas, contenido, preguntas, resultados y pagos. Los
            archivos subidos se entregan aparte desde el almacén.
          </p>
          <p className="text-xs text-ink-muted">
            Facilitar la salida es lo que hace creíble la entrada. Nadie debería
            confiar en un programa del que no puede irse.
          </p>

          {aviso ? <p className="text-sm text-positive">{aviso}</p> : null}

          {puedeExportar ? (
            <Button
              variant="secondary"
              onClick={exportar}
              loading={exportando}
              className="w-full"
            >
              <Download aria-hidden />
              Exportar todos mis datos
            </Button>
          ) : (
            <p className="text-xs text-ink-muted">
              Hace falta el permiso de exportación de datos.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
