"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
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
  instantanea,
  instantaneaEnServidor,
  sincronizar,
  suscribirse,
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

type Estado = "listo" | "sin-conexion" | "error";

export function MochilaPanel({
  membershipId,
  temasIniciales,
}: {
  membershipId: string;
  /**
   * La lista ya viene resuelta del servidor.
   *
   * Antes se pedía desde el navegador nada más montar, lo que significaba
   * enseñar un cargando por un dato que el servidor tenía en la mano al pintar
   * la página. Se sigue pudiendo pedir de nuevo —el botón «Actualizar», o al
   * volver la conexión—, pero la primera vez no.
   */
  temasIniciales: TemaDescargable[];
}) {
  const [estado, setEstado] = useState<Estado>("listo");
  const [temas, setTemas] = useState<TemaDescargable[]>(temasIniciales);
  const [caducados, setCaducados] = useState<Set<string>>(new Set());
  const [trabajando, setTrabajando] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [fallo, setFallo] = useState<string | null>(null);

  // Lo guardado se lee del almacén del navegador, no de un estado propio. Así
  // esta lista y el botón de la pantalla de cada tema no pueden discrepar, y no
  // hay que acordarse de refrescar nada después de cada guardado o borrado.
  const entradas = useSyncExternalStore(
    suscribirse,
    instantanea,
    instantaneaEnServidor,
  );

  const guardados = useMemo(
    () => new Set(entradas.map((e) => e.fileId)),
    [entradas],
  );
  const ocupado = useMemo(() => espacioOcupado(entradas), [entradas]);

  /**
   * Pone el dispositivo al día con lo que dice el servidor.
   *
   * Es la pieza que hace aceptable guardar temario en un móvil: compara lo
   * guardado con la lista autorizada y borra lo que ya no está —una baja, un
   * derecho caducado, una descarga que la academia retira—.
   */
  const conciliar = useCallback(
    async (lista: TemaDescargable[]) => {
      if (await comprobarDueno(membershipId)) {
        setAviso(
          "Se han borrado los temas guardados en este dispositivo porque eran de otra cuenta.",
        );
      }

      const { retirados, caducados: cad } = await sincronizar(lista);
      setCaducados(new Set(cad));
      if (retirados > 0) {
        setAviso(
          retirados === 1
            ? "Se ha retirado 1 tema que ya no tienes disponible."
            : `Se han retirado ${retirados} temas que ya no tienes disponibles.`,
        );
      }
    },
    [membershipId],
  );

  /** Volver a preguntar al servidor: el botón «Actualizar» y el volver la red. */
  const cargar = useCallback(async () => {
    setFallo(null);
    try {
      const respuesta = await fetch("/api/campus/mochila", {
        credentials: "same-origin",
        cache: "no-store",
      });
      if (!respuesta.ok) throw new Error("respuesta no válida");

      const datos = (await respuesta.json()) as { temas: TemaDescargable[] };
      setTemas(datos.temas);
      await conciliar(datos.temas);
      setEstado("listo");
    } catch {
      // Sin red: lo guardado sigue ahí y se puede seguir estudiando. Es justo
      // el caso para el que existe esta pantalla.
      setEstado(navigator.onLine ? "error" : "sin-conexion");
    }
  }, [conciliar]);

  // Conciliar al abrir, con la lista que ya trajo el servidor.
  //
  // Esto es exactamente lo que un efecto debe hacer y lo que la propia
  // documentación de la regla admite: sincronizar con un sistema externo, que
  // aquí es el almacén del dispositivo. No pide datos ni cambia lo que se
  // pinta; borra del móvil lo que ha dejado de estar autorizado. Lo único que
  // toca del estado es el aviso que explica qué se ha retirado, y callarlo
  // sería peor: los temas desaparecerían del móvil sin decir por qué.
  //
  // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
  useEffect(() => void conciliar(temasIniciales), [conciliar]);

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
    } catch (error) {
      setFallo(error instanceof Error ? error.message : "No se ha podido guardar.");
    } finally {
      setTrabajando(null);
    }
  }

  async function alBorrar(fileId: string) {
    setTrabajando(fileId);
    await borrarTema(fileId);
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
    setTrabajando(null);
  }

  const pendientes = temas.filter((t) => !estaGuardado(t.fileId, t.version));

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
