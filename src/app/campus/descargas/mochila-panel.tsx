"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  CloudOff,
  Download,
  HardDrive,
  Loader2,
  RefreshCw,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import {
  borrarTema,
  comprobarDueno,
  espacioOcupado,
  estaGuardado,
  guardarTema,
  loGuardado,
  sincronizar,
  vaciarMochila,
  type TemaDescargable,
} from "@/lib/campus/mochila-cliente";
import { Button } from "@/components/ui/button";
import { Card, CardContent, EmptyState } from "@/components/ui/primitives";

/**
 * LA MOCHILA
 *
 * Los temas que la academia ha ido colgando, guardados en el móvil para poder
 * estudiarlos sin cobertura. Cliente entero a propósito: el estado de lo
 * guardado vive en el dispositivo y solo el dispositivo lo sabe.
 */

function talla(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type Estado = "cargando" | "listo" | "sin-conexion" | "error";

export function MochilaPanel({ membershipId }: { membershipId: string }) {
  const [estado, setEstado] = useState<Estado>("cargando");
  const [temas, setTemas] = useState<TemaDescargable[]>([]);
  const [guardados, setGuardados] = useState<Set<string>>(new Set());
  const [caducados, setCaducados] = useState<Set<string>>(new Set());
  const [ocupado, setOcupado] = useState(0);
  const [trabajando, setTrabajando] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [fallo, setFallo] = useState<string | null>(null);

  const refrescarLocal = useCallback(() => {
    setGuardados(new Set(loGuardado().map((e) => e.fileId)));
    setOcupado(espacioOcupado());
  }, []);

  const cargar = useCallback(async () => {
    setFallo(null);

    // Lo primero de todo, antes incluso de mirar la red: ¿es mío lo que hay
    // guardado aquí? Si el dispositivo lo usó otra persona, se vacía.
    if (await comprobarDueno(membershipId)) {
      setAviso(
        "Se han borrado los temas guardados en este dispositivo porque eran de otra cuenta.",
      );
      refrescarLocal();
    }

    try {
      const respuesta = await fetch("/api/campus/mochila", {
        credentials: "same-origin",
        cache: "no-store",
      });
      if (!respuesta.ok) throw new Error("respuesta no válida");

      const datos = (await respuesta.json()) as { temas: TemaDescargable[] };
      setTemas(datos.temas);

      // Lo primero que se hace con la lista fresca es limpiar el dispositivo.
      // Si un tema ha dejado de estar autorizado, se va antes de pintar nada.
      const { retirados, caducados: cad } = await sincronizar(datos.temas);
      setCaducados(new Set(cad));
      if (retirados > 0) {
        setAviso(
          retirados === 1
            ? "Se ha retirado 1 tema que ya no tienes disponible."
            : `Se han retirado ${retirados} temas que ya no tienes disponibles.`,
        );
      }

      refrescarLocal();
      setEstado("listo");
    } catch {
      // Sin red: no se puede sincronizar, pero lo guardado sigue ahí y se puede
      // seguir estudiando. Es justo el caso para el que existe esta pantalla.
      refrescarLocal();
      setEstado(navigator.onLine ? "error" : "sin-conexion");
    }
  }, [refrescarLocal, membershipId]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  async function alGuardar(tema: TemaDescargable) {
    setTrabajando(tema.fileId);
    setFallo(null);
    try {
      await guardarTema(tema);
      setCaducados((previo) => {
        const siguiente = new Set(previo);
        siguiente.delete(tema.fileId);
        return siguiente;
      });
      refrescarLocal();
    } catch (error) {
      setFallo(error instanceof Error ? error.message : "No se ha podido guardar.");
    } finally {
      setTrabajando(null);
    }
  }

  async function alBorrar(fileId: string) {
    setTrabajando(fileId);
    await borrarTema(fileId);
    refrescarLocal();
    setTrabajando(null);
  }

  async function alGuardarTodo() {
    setFallo(null);
    for (const tema of temas) {
      if (estaGuardado(tema.fileId, tema.version)) continue;
      await alGuardar(tema);
    }
  }

  async function alVaciar() {
    setTrabajando("todo");
    await vaciarMochila();
    refrescarLocal();
    setTrabajando(null);
  }

  const pendientes = temas.filter((t) => !estaGuardado(t.fileId, t.version));

  if (estado === "cargando") {
    return (
      <Card>
        <CardContent className="flex items-center justify-center gap-2 py-12 text-sm text-ink-muted">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          Comprobando qué puedes descargar…
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 p-4 pt-4">
          <div className="icon-chip size-10 [&_svg]:size-4">
            <HardDrive aria-hidden />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-ink">
              {guardados.size === 0
                ? "No tienes ningún tema guardado"
                : `${guardados.size} ${guardados.size === 1 ? "tema guardado" : "temas guardados"} · ${talla(ocupado)}`}
            </p>
            <p className="text-xs text-ink-muted">
              Lo guardado se abre sin conexión desde «Estudiar».
            </p>
          </div>
          {guardados.size > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={alVaciar}
              disabled={trabajando !== null}
            >
              <Trash2 aria-hidden />
              Vaciar
            </Button>
          ) : null}
          <Button
            variant="secondary"
            size="sm"
            onClick={cargar}
            disabled={trabajando !== null}
          >
            <RefreshCw aria-hidden />
            Actualizar
          </Button>
        </CardContent>
      </Card>

      {estado === "sin-conexion" ? (
        <Card>
          <CardContent className="flex items-start gap-3 p-4 pt-4">
            <CloudOff className="mt-0.5 size-4 shrink-0 text-caution" aria-hidden />
            <p className="text-sm text-ink-soft">
              Estás sin conexión. Puedes seguir estudiando lo que tengas guardado;
              para descargar temas nuevos hará falta red.
            </p>
          </CardContent>
        </Card>
      ) : null}

      {aviso ? (
        <Card>
          <CardContent className="flex items-start gap-3 p-4 pt-4">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-caution" aria-hidden />
            <p className="text-sm text-ink-soft">{aviso}</p>
          </CardContent>
        </Card>
      ) : null}

      {fallo ? (
        <Card>
          <CardContent className="p-4 pt-4 text-sm text-critical">{fallo}</CardContent>
        </Card>
      ) : null}

      {temas.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Download aria-hidden />}
            title="Todavía no hay temas para descargar"
            description="Aquí aparecerán los temas que tu academia vaya publicando con la descarga permitida. Si echas alguno en falta, pregúntale a tu preparador."
          />
        </Card>
      ) : (
        <>
          {pendientes.length > 0 ? (
            <Button onClick={alGuardarTodo} disabled={trabajando !== null} className="w-full">
              <Download aria-hidden />
              Guardar los {pendientes.length} que faltan ·{" "}
              {talla(pendientes.reduce((s, t) => s + t.sizeBytes, 0))}
            </Button>
          ) : null}

          <Card>
            <ul className="divide-y divide-[var(--border-subtle)]">
              {temas.map((tema) => {
                const dentro = guardados.has(tema.fileId);
                const viejo = caducados.has(tema.fileId);
                const ocupada = trabajando === tema.fileId;

                return (
                  <li key={tema.fileId} className="flex items-center gap-3 p-3">
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/campus/estudiar/${tema.nodeId}`}
                        className="block truncate text-sm font-medium text-ink hover:text-accent"
                      >
                        {tema.label}
                      </Link>
                      <p className="text-xs text-ink-muted">
                        {talla(tema.sizeBytes)}
                        {viejo ? " · hay una versión más reciente" : ""}
                      </p>
                    </div>

                    {ocupada ? (
                      <Loader2 className="size-4 animate-spin text-ink-muted" aria-hidden />
                    ) : dentro && !viejo ? (
                      <div className="flex items-center gap-1">
                        <CheckCircle2 className="size-4 text-positive" aria-hidden />
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Borrar ${tema.label} del dispositivo`}
                          onClick={() => alBorrar(tema.fileId)}
                        >
                          <Trash2 aria-hidden />
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => alGuardar(tema)}
                        disabled={estado === "sin-conexion"}
                      >
                        <Download aria-hidden />
                        {viejo ? "Actualizar" : "Guardar"}
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          </Card>
        </>
      )}
    </div>
  );
}
