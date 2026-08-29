import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight, Video } from "lucide-react";
import { requirePagePermission } from "@/lib/auth/context";
import {
  agruparPorDia,
  cargarAgenda,
  claveDia,
  inicioDeMes,
  opcionesDeAgenda,
  rejillaDelMes,
  semanaDe,
} from "@/server/schedule/queries";
import { Button } from "@/components/ui/button";
import { Badge, Card, CardContent, PageHeader } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";
import { NuevaClase } from "./nueva-clase";
import { DiaConClases } from "./dia";

export const metadata: Metadata = { title: "Agenda" };

const DIAS_CORTOS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

/**
 * La agenda.
 *
 * Un mes de un vistazo, como un calendario de pared. Es la vista que pide
 * cualquiera que organice clases: no una lista, sino los huecos.
 *
 * El calendario se pinta en el servidor. No hace falta JavaScript para verlo,
 * solo para abrir el formulario, y eso hace que cargue de golpe aunque el mes
 * tenga ochenta clases.
 */
export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await requirePagePermission("classes.read");
  const params = await searchParams;

  const hoy = new Date();
  const vista = params.vista === "semana" ? "semana" : "mes";

  const referencia =
    typeof params.mes === "string" && /^\d{4}-\d{2}(-\d{2})?$/.test(params.mes)
      ? new Date(
          Number(params.mes.slice(0, 4)),
          Number(params.mes.slice(5, 7)) - 1,
          params.mes.length > 7 ? Number(params.mes.slice(8, 10)) : 1,
        )
      : hoy;

  const dias = vista === "semana" ? semanaDe(referencia) : rejillaDelMes(referencia);
  const desde = dias[0];
  const hasta = new Date(dias[dias.length - 1]);
  hasta.setDate(hasta.getDate() + 1);

  const grupoFiltro = typeof params.grupo === "string" ? params.grupo : null;
  const profesorFiltro = typeof params.profesor === "string" ? params.profesor : null;

  const [clases, opciones] = await Promise.all([
    cargarAgenda(ctx.db, desde, hasta, {
      groupId: grupoFiltro,
      teacherId: profesorFiltro,
    }),
    opcionesDeAgenda(ctx.db),
  ]);

  const porDia = agruparPorDia(clases);
  const mesActual = inicioDeMes(referencia).getMonth();

  const mover = (delta: number) => {
    const destino = new Date(referencia);
    if (vista === "semana") destino.setDate(destino.getDate() + delta * 7);
    else destino.setMonth(destino.getMonth() + delta);
    return `${destino.getFullYear()}-${String(destino.getMonth() + 1).padStart(2, "0")}-${String(destino.getDate()).padStart(2, "0")}`;
  };

  const enlace = (extra: Record<string, string | null>) => {
    const q = new URLSearchParams();
    if (vista === "semana") q.set("vista", "semana");
    if (grupoFiltro) q.set("grupo", grupoFiltro);
    if (profesorFiltro) q.set("profesor", profesorFiltro);
    for (const [k, v] of Object.entries(extra)) {
      if (v === null) q.delete(k);
      else q.set(k, v);
    }
    return `/gestion/agenda?${q.toString()}`;
  };

  const titulo = referencia.toLocaleDateString("es-ES", {
    month: "long",
    year: "numeric",
  });

  const puedeEscribir = ctx.permissions.has("classes.write");

  return (
    <>
      <PageHeader
        title="Agenda"
        description="Las clases por días. Programa una suelta o toda una serie: «los lunes y miércoles hasta junio»."
        actions={
          puedeEscribir ? (
            <NuevaClase
              grupos={opciones.grupos}
              profesores={opciones.profesores}
              temas={opciones.temas}
              fechaPorDefecto={claveDia(referencia < hoy ? hoy : referencia)}
            />
          ) : null
        }
      />

      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 p-4 pt-4">
          <div className="flex items-center gap-1">
            <Button asChild variant="ghost" size="icon" aria-label="Anterior">
              <Link href={enlace({ mes: mover(-1) })}>
                <ChevronLeft aria-hidden />
              </Link>
            </Button>
            <Button asChild variant="ghost" size="icon" aria-label="Siguiente">
              <Link href={enlace({ mes: mover(1) })}>
                <ChevronRight aria-hidden />
              </Link>
            </Button>
          </div>

          <p className="font-display text-lg font-semibold text-ink first-letter:uppercase">
            {titulo}
          </p>

          <Button asChild variant="ghost" size="sm">
            <Link href={enlace({ mes: claveDia(hoy) })}>Hoy</Link>
          </Button>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <div className="flex rounded-[var(--radius-control)] border border-line p-0.5">
              <Link
                href={`/gestion/agenda?${new URLSearchParams({
                  ...(grupoFiltro ? { grupo: grupoFiltro } : {}),
                  ...(profesorFiltro ? { profesor: profesorFiltro } : {}),
                  mes: claveDia(referencia),
                }).toString()}`}
                className={cn(
                  "rounded-[calc(var(--radius-control)-2px)] px-3 py-1 text-sm",
                  vista === "mes"
                    ? "bg-accent-soft font-semibold text-accent"
                    : "text-ink-soft hover:text-ink",
                )}
              >
                Mes
              </Link>
              <Link
                href={`/gestion/agenda?${new URLSearchParams({
                  vista: "semana",
                  ...(grupoFiltro ? { grupo: grupoFiltro } : {}),
                  ...(profesorFiltro ? { profesor: profesorFiltro } : {}),
                  mes: claveDia(referencia),
                }).toString()}`}
                className={cn(
                  "rounded-[calc(var(--radius-control)-2px)] px-3 py-1 text-sm",
                  vista === "semana"
                    ? "bg-accent-soft font-semibold text-accent"
                    : "text-ink-soft hover:text-ink",
                )}
              >
                Semana
              </Link>
            </div>

            <form className="flex flex-wrap items-center gap-2">
              {vista === "semana" ? (
                <input type="hidden" name="vista" value="semana" />
              ) : null}
              <input type="hidden" name="mes" value={claveDia(referencia)} />

              <select
                name="grupo"
                defaultValue={grupoFiltro ?? ""}
                className="h-9 rounded-[var(--radius-control)] border border-line bg-surface px-2 text-sm text-ink"
              >
                <option value="">Todos los grupos</option>
                {opciones.grupos.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.nombre}
                  </option>
                ))}
              </select>

              <select
                name="profesor"
                defaultValue={profesorFiltro ?? ""}
                className="h-9 rounded-[var(--radius-control)] border border-line bg-surface px-2 text-sm text-ink"
              >
                <option value="">Todo el profesorado</option>
                {opciones.profesores.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
              </select>

              <Button type="submit" variant="secondary" size="sm">
                Filtrar
              </Button>
            </form>
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <div className="grid grid-cols-7 border-b border-line bg-surface-muted">
          {DIAS_CORTOS.map((dia) => (
            <div
              key={dia}
              className="px-2 py-2 text-center text-[0.6875rem] font-bold uppercase tracking-[0.06em] text-ink-muted"
            >
              {dia}
            </div>
          ))}
        </div>

        <div
          className={cn(
            "grid grid-cols-7",
            vista === "semana" ? "min-h-[28rem]" : "",
          )}
        >
          {dias.map((dia) => {
            const clave = claveDia(dia);
            const delMes = dia.getMonth() === mesActual || vista === "semana";
            const esHoy = clave === claveDia(hoy);

            return (
              <DiaConClases
                key={clave}
                fecha={clave}
                numero={dia.getDate()}
                delMes={delMes}
                esHoy={esHoy}
                expandido={vista === "semana"}
                clases={(porDia.get(clave) ?? []).map((c) => ({
                  id: c.id,
                  title: c.title,
                  hora: c.startsAt.toLocaleTimeString("es-ES", {
                    hour: "2-digit",
                    minute: "2-digit",
                  }),
                  fin: c.endsAt.toLocaleTimeString("es-ES", {
                    hour: "2-digit",
                    minute: "2-digit",
                  }),
                  cancelada: c.status === "CANCELLED",
                  grupo: c.grupo,
                  profesor: c.profesor,
                  tema: c.tema,
                  location: c.location,
                  online: Boolean(c.meetingUrl),
                }))}
                puedeEscribir={puedeEscribir}
              />
            );
          })}
        </div>
      </Card>

      <Card className="border-dashed">
        <CardContent className="flex flex-wrap items-center gap-4 p-4 pt-4 text-xs text-ink-muted">
          <span className="flex items-center gap-1.5">
            <CalendarDays className="size-3.5" aria-hidden />
            {clases.length} {clases.length === 1 ? "clase" : "clases"} en{" "}
            {vista === "semana" ? "esta semana" : "este mes"}
          </span>
          <span className="flex items-center gap-1.5">
            <Video className="size-3.5" aria-hidden />
            {clases.filter((c) => c.meetingUrl).length} en línea
          </span>
          <span className="flex items-center gap-1.5">
            <Badge tone="critical">Anulada</Badge>
            se sigue viendo, para que el alumnado sepa que se canceló
          </span>
        </CardContent>
      </Card>
    </>
  );
}
