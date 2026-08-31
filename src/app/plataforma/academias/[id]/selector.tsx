"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Check, CheckCircle2, Info, Lock } from "lucide-react";
import {
  CATALOGO,
  MODULOS_NUCLEO,
  PACKS,
  anadidosPorDependencia,
  arrastraAlQuitar,
  calcularPresupuesto,
  MODULOS,
  type CodigoModulo,
} from "@/lib/modules/catalogo";
import {
  guardarModulosAction,
  type ModuloState,
} from "@/server/platform/module-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/primitives";
import { formatCents, cn } from "@/lib/utils";
import { DescuentoPactado } from "./descuento";
import { PrecioDelModulo } from "./precio";

/**
 * COMPONER EL PACK DE UNA ACADEMIA
 *
 * Marcar módulos y ver el precio cambiar. Lo que hace que esta pantalla sirva
 * para vender por teléfono es que el total se actualiza al instante: se puede
 * decir «y sin la app se queda en tanto» mientras se habla, sin colgar y
 * recalcular.
 *
 * Las dependencias se enseñan, no se imponen en silencio. Si al marcar
 * Facturación entra Cobros, se dice; y si al quitar Cobros se cae Facturación,
 * se avisa antes.
 */
export function SelectorDeModulos({
  academyId,
  inicial,
  preciosPactados,
  descuentoPactado,
}: {
  academyId: string;
  inicial: CodigoModulo[];
  /** Lo que paga esta academia por módulo, si se pactó algo distinto. */
  preciosPactados: Partial<Record<CodigoModulo, number>>;
  /** Porcentaje acordado, o `null` para que salga del volumen. */
  descuentoPactado: number | null;
}) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [elegidos, setElegidos] = useState<Set<CodigoModulo>>(new Set(inicial));
  const [resultado, setResultado] = useState<ModuloState>(undefined);
  const [aviso, setAviso] = useState<string | null>(null);

  const lista = useMemo(() => [...elegidos], [elegidos]);
  const presupuesto = useMemo(
    () => calcularPresupuesto(lista, preciosPactados, descuentoPactado),
    [lista, preciosPactados, descuentoPactado],
  );
  const porDependencia = useMemo(() => new Set(anadidosPorDependencia(lista)), [lista]);

  const sinGuardar =
    lista.length !== inicial.length || lista.some((c) => !inicial.includes(c));

  function alternar(codigo: CodigoModulo) {
    setAviso(null);
    setResultado(undefined);

    if (MODULOS_NUCLEO.includes(codigo)) {
      setAviso("El núcleo no se puede quitar: sin él no hay producto.");
      return;
    }

    setElegidos((previo) => {
      const siguiente = new Set(previo);
      if (siguiente.has(codigo)) {
        const arrastra = arrastraAlQuitar(codigo, [...siguiente]);
        siguiente.delete(codigo);
        for (const c of arrastra) siguiente.delete(c);
        if (arrastra.length > 0) {
          setAviso(
            `Al quitar «${MODULOS[codigo].nombre}» se va también ${arrastra
              .map((c) => `«${MODULOS[c].nombre}»`)
              .join(" y ")}: no funciona sin él.`,
          );
        }
      } else {
        siguiente.add(codigo);
      }
      return siguiente;
    });
  }

  function aplicarPack(modulos: CodigoModulo[]) {
    setAviso(null);
    setResultado(undefined);
    setElegidos(new Set(modulos));
  }

  function guardar() {
    const datos = new FormData();
    datos.set("academyId", academyId);
    datos.set("modulos", lista.join(","));

    iniciar(async () => {
      const respuesta = await guardarModulosAction(undefined, datos);
      setResultado(respuesta);
      if (respuesta?.ok) router.refresh();
    });
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
      {/* ── Los módulos ──────────────────────────────────────────────────── */}
      <div className="space-y-4">
        <Card>
          <CardContent className="space-y-3 p-4 pt-4">
            <p className="text-sm font-medium text-ink">Empezar por un pack</p>
            <div className="flex flex-wrap gap-2">
              {PACKS.map((pack) => (
                <Button
                  key={pack.codigo}
                  variant="secondary"
                  size="sm"
                  onClick={() => aplicarPack(pack.modulos)}
                  title={pack.para}
                >
                  {pack.nombre}
                  <span className="text-ink-muted">
                    {formatCents(
                    calcularPresupuesto(pack.modulos, preciosPactados, descuentoPactado)
                      .totalCents,
                  )}
                  </span>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        <ul className="space-y-2">
          {CATALOGO.map((modulo) => {
            const dentro = elegidos.has(modulo.codigo) || porDependencia.has(modulo.codigo);
            const obligatorio = Boolean(modulo.esNucleo);
            const automatico = porDependencia.has(modulo.codigo) && !elegidos.has(modulo.codigo);
            const pactado = preciosPactados[modulo.codigo];

            return (
              <li
                key={modulo.codigo}
                className={cn(
                  "flex gap-3 rounded-[var(--radius-card)] border p-4 transition-colors",
                  dentro
                    ? "border-accent/30 bg-accent-soft/40"
                    : "border-line bg-surface",
                )}
              >
                {/*
                  La fila ya no es un botón entero. Lo era, y así no cabía el de
                  «Editar» dentro: un botón dentro de otro botón no es HTML
                  válido y los lectores de pantalla no saben cuál anunciar.
                  Ahora el que alterna es solo la parte izquierda.
                */}
                <button
                  type="button"
                  onClick={() => alternar(modulo.codigo)}
                  aria-pressed={dentro}
                  className="flex min-w-0 flex-1 gap-3 text-left"
                >
                  <span
                    className={cn(
                      "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border",
                      dentro
                        ? "border-accent bg-accent text-accent-contrast"
                        : "border-line-strong",
                    )}
                  >
                    {dentro ? <Check className="size-3.5" aria-hidden /> : null}
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-baseline gap-x-2">
                      <span className="font-medium text-ink">{modulo.nombre}</span>
                      {obligatorio ? (
                        <span className="inline-flex items-center gap-1 text-[0.7rem] text-ink-muted">
                          <Lock className="size-3" aria-hidden />
                          siempre incluido
                        </span>
                      ) : null}
                      {automatico ? (
                        <span className="text-[0.7rem] text-accent">
                          añadido: lo necesita otro módulo
                        </span>
                      ) : null}
                    </span>
                    <span className="mt-0.5 block text-sm leading-relaxed text-ink-soft">
                      {modulo.resumen}
                    </span>
                  </span>
                </button>

                <PrecioDelModulo
                  academyId={academyId}
                  codigo={modulo.codigo}
                  precioActual={pactado ?? null}
                  contratado={inicial.includes(modulo.codigo)}
                />
              </li>
            );
          })}
        </ul>
      </div>

      {/* ── El presupuesto ───────────────────────────────────────────────── */}
      <div className="space-y-3 lg:sticky lg:top-6">
        <Card>
          <CardContent className="space-y-3 p-4 pt-4">
            <p className="text-sm font-medium text-ink">
              {presupuesto.lineas.length} módulos
            </p>

            <ul className="space-y-1 border-b border-line pb-3 text-sm">
              {presupuesto.lineas.map((linea) => (
                <li key={linea.codigo} className="flex justify-between gap-3">
                  <span className="min-w-0 truncate text-ink-soft">
                    {linea.nombre}
                    {linea.pactado ? (
                      <span className="ml-1 text-[0.7rem] text-accent">pactado</span>
                    ) : null}
                  </span>
                  <span className="shrink-0 tabular-nums text-ink-muted">
                    {formatCents(linea.precioCents)}
                  </span>
                </li>
              ))}
            </ul>

            <dl className="space-y-1 text-sm">
              <div className="flex justify-between">
                <dt className="text-ink-soft">Subtotal</dt>
                <dd className="tabular-nums text-ink">
                  {formatCents(presupuesto.subtotalCents)}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-2">
                <DescuentoPactado
                  academyId={academyId}
                  porcentaje={presupuesto.descuentoPorcentaje}
                  origen={presupuesto.descuentoOrigen}
                />
                <dd className="shrink-0 tabular-nums text-positive">
                  {presupuesto.descuentoCents > 0
                    ? `−${formatCents(presupuesto.descuentoCents)}`
                    : "—"}
                </dd>
              </div>
              <div className="flex items-baseline justify-between border-t border-line pt-2">
                <dt className="font-medium text-ink">Al mes</dt>
                <dd className="text-xl font-semibold tabular-nums text-ink">
                  {formatCents(presupuesto.totalCents)}
                </dd>
              </div>
              <div className="flex justify-between text-xs text-ink-muted">
                <dt>Al año</dt>
                <dd className="tabular-nums">
                  {formatCents(presupuesto.totalCents * 12)}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        {aviso ? (
          <p className="flex items-start gap-2 rounded-[var(--radius-control)] bg-caution-soft px-3 py-2 text-sm text-caution">
            <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
            {aviso}
          </p>
        ) : null}

        {resultado?.error ? (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-[var(--radius-control)] bg-critical-soft px-3 py-2 text-sm text-critical"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
            {resultado.error}
          </p>
        ) : null}

        {resultado?.ok ? (
          <div className="space-y-1 rounded-[var(--radius-control)] bg-positive-soft px-3 py-2 text-sm text-positive">
            <p className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
              {resultado.ok}
            </p>
            {resultado.añadidos && resultado.añadidos.length > 0 ? (
              <p className="pl-6 text-xs">
                Se añadieron por dependencia: {resultado.añadidos.join(", ")}.
              </p>
            ) : null}
          </div>
        ) : null}

        <Button onClick={guardar} disabled={pendiente || !sinGuardar} className="w-full">
          {pendiente ? "Guardando…" : sinGuardar ? "Guardar cambios" : "Sin cambios"}
        </Button>

        <p className="text-xs leading-relaxed text-ink-muted">
          Lo que se quita se desactiva, no se borra: hay que poder consultar qué
          tuvo contratado una academia y hasta cuándo.
        </p>
      </div>
    </div>
  );
}
