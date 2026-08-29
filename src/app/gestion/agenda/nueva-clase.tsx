"use client";

import { useActionState, useState } from "react";
import { AlertCircle, CalendarPlus, CheckCircle2, X } from "lucide-react";
import { crearClasesAction, type AgendaState } from "@/server/schedule/actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  Field,
  Input,
  Select,
  Textarea,
} from "@/components/ui/primitives";

const DIAS = [
  { clave: "lunes", etiqueta: "L" },
  { clave: "martes", etiqueta: "M" },
  { clave: "miercoles", etiqueta: "X" },
  { clave: "jueves", etiqueta: "J" },
  { clave: "viernes", etiqueta: "V" },
  { clave: "sabado", etiqueta: "S" },
  { clave: "domingo", etiqueta: "D" },
];

/**
 * Programar clases.
 *
 * Lo importante es la casilla de repetir: una academia no programa una clase
 * suelta, programa «los lunes y miércoles de 10 a 12 hasta junio». Sin eso,
 * montar un curso son ochenta formularios.
 */
export function NuevaClase({
  grupos,
  profesores,
  temas,
  fechaPorDefecto,
}: {
  grupos: { id: string; nombre: string }[];
  profesores: { id: string; nombre: string }[];
  temas: { id: string; label: string }[];
  fechaPorDefecto: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const [repite, setRepite] = useState(false);
  const [estado, accion, creando] = useActionState<AgendaState, FormData>(
    crearClasesAction,
    undefined,
  );

  if (!abierto) {
    return (
      <Button variant="primary" size="sm" onClick={() => setAbierto(true)}>
        <CalendarPlus aria-hidden />
        Programar clase
      </Button>
    );
  }

  return (
    <Card className="w-full">
      <CardContent className="space-y-4 p-5 pt-5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-ink">Programar clase</h3>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setAbierto(false)}
            aria-label="Cerrar"
          >
            <X aria-hidden />
          </Button>
        </div>

        {estado?.error ? (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-[var(--radius-control)] bg-critical-soft px-3 py-2 text-sm text-critical"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
            {estado.error}
          </p>
        ) : null}

        {estado?.ok ? (
          <p
            role="status"
            className="flex items-start gap-2 rounded-[var(--radius-control)] bg-positive-soft px-3 py-2 text-sm text-positive"
          >
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
            {estado.ok}
          </p>
        ) : null}

        <form action={accion} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Título" htmlFor="title" required>
              <Input name="title" placeholder="Tema 6 · Procedimiento" required />
            </Field>

            <Field label="Grupo" htmlFor="groupId" hint="La clase hereda su curso.">
              <Select name="groupId" defaultValue="">
                <option value="">Sin grupo</option>
                {grupos.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.nombre}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Profesor" htmlFor="teacherId">
              <Select name="teacherId" defaultValue="">
                <option value="">Sin asignar</option>
                {profesores.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Tema que se imparte" htmlFor="nodeId">
              <Select name="nodeId" defaultValue="">
                <option value="">Ninguno</option>
                {temas.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Día" htmlFor="fecha" required>
              <Input name="fecha" type="date" defaultValue={fechaPorDefecto} required />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Hora" htmlFor="horaInicio" required>
                <Input name="horaInicio" type="time" defaultValue="10:00" required />
              </Field>
              <Field label="Duración" htmlFor="duracion" hint="Minutos.">
                <Input
                  name="duracion"
                  type="number"
                  min={15}
                  max={600}
                  step={15}
                  defaultValue={90}
                />
              </Field>
            </div>

            <Field label="Aula o lugar" htmlFor="location">
              <Input name="location" placeholder="Aula 2" />
            </Field>

            <Field
              label="Enlace de videollamada"
              htmlFor="meetingUrl"
              hint="Zoom, Meet o Teams. Opcional."
            >
              <Input name="meetingUrl" type="url" placeholder="https://" />
            </Field>

            <div className="sm:col-span-2">
              <Field label="Descripción" htmlFor="description">
                <Textarea name="description" rows={2} />
              </Field>
            </div>
          </div>

          <div className="space-y-3 rounded-[var(--radius-control)] border border-line p-4">
            <label className="flex items-center gap-2 text-sm font-medium text-ink">
              <input
                type="checkbox"
                name="repetir"
                checked={repite}
                onChange={(e) => setRepite(e.target.checked)}
              />
              Se repite todas las semanas
            </label>

            {repite ? (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <p className="text-sm text-ink-soft">Qué días</p>
                  <div className="flex flex-wrap gap-1.5">
                    {DIAS.map((dia) => (
                      <label
                        key={dia.clave}
                        className="flex size-9 cursor-pointer items-center justify-center rounded-full border border-line text-sm text-ink-soft has-checked:border-accent has-checked:bg-accent-soft has-checked:font-semibold has-checked:text-accent"
                      >
                        <input
                          type="checkbox"
                          name={`dia.${dia.clave}`}
                          className="sr-only"
                        />
                        {dia.etiqueta}
                      </label>
                    ))}
                  </div>
                </div>

                <Field
                  label="Hasta"
                  htmlFor="hasta"
                  required
                  hint="Se crean todas las sesiones, y después puedes mover o anular cualquiera por separado."
                >
                  <Input name="hasta" type="date" required />
                </Field>
              </div>
            ) : null}
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setAbierto(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={creando}>
              {repite ? "Crear la serie" : "Crear clase"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
