import { existsSync } from "node:fs";
import path from "node:path";
import Image from "next/image";
import { Camera } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * UNA CAPTURA DE PANTALLA DEL MANUAL
 *
 * Las imágenes las genera `npm run manual:capturas` recorriendo la aplicación
 * de verdad. No se pegan a mano: unas capturas pegadas envejecen con el primer
 * rediseño y nadie las rehace, así que el manual acaba enseñando un producto
 * que ya no existe.
 *
 * Como pueden no estar —una instalación recién clonada no las trae— se
 * comprueba en el servidor si el archivo existe y, si falta, se pinta un aviso
 * con el comando que hay que lanzar. Es mejor que una imagen rota, y además le
 * dice a quien lo lea qué hacer para arreglarlo.
 */
export function Captura({
  nombre,
  pie,
  movil = false,
}: {
  /** Nombre del archivo en `public/manual/`, sin extensión. */
  nombre: string;
  /** Qué hay que mirar en ella. No repite lo que ya dice el texto. */
  pie: string;
  /** Las del Campus se pintan con forma de teléfono, que es donde se usa. */
  movil?: boolean;
}) {
  const relativa = `/manual/${nombre}.png`;
  const hay = existsSync(path.join(process.cwd(), "public", "manual", `${nombre}.png`));

  return (
    <figure
      className={cn(
        "my-6 flex flex-col gap-2",
        movil && "items-center",
      )}
    >
      {hay ? (
        <div
          className={cn(
            "overflow-hidden border border-line bg-surface shadow-[var(--shadow-raised)]",
            movil
              ? "w-full max-w-[17rem] rounded-[1.75rem] p-1.5"
              : "rounded-[var(--radius-card)]",
          )}
        >
          <Image
            src={relativa}
            alt={pie}
            width={movil ? 402 : 1440}
            height={movil ? 874 : 940}
            className={cn("h-auto w-full", movil && "rounded-[1.4rem]")}
            // No son críticas para la primera pantalla y son diecisiete: que
            // se carguen conforme se baja, no todas de golpe.
            loading="lazy"
            sizes={movil ? "272px" : "(min-width: 1040px) 46rem, 100vw"}
          />
        </div>
      ) : (
        <div className="flex items-center gap-3 rounded-[var(--radius-card)] border border-dashed border-line bg-surface-muted px-4 py-5 text-sm text-ink-muted">
          <Camera className="size-4 shrink-0" aria-hidden />
          <span>
            Falta la captura de esta pantalla. Se generan con{" "}
            <code className="rounded border border-line bg-surface px-1.5 py-0.5 font-mono text-[0.85em]">
              npm run manual:capturas
            </code>
            , con la aplicación en marcha y la demostración sembrada.
          </span>
        </div>
      )}

      <figcaption
        className={cn(
          "text-xs leading-relaxed text-ink-muted",
          movil ? "max-w-[24rem] text-center" : "max-w-[62ch]",
        )}
      >
        {pie}
      </figcaption>
    </figure>
  );
}
