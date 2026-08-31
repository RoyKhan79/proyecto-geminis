"use client";

import { useActionState, useState } from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import {
  guardarAccesoAlumnoAction,
  type FormState,
} from "@/server/students/actions";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/primitives";
import type { Capacidad } from "@/lib/access/capacidades";

export type ConvocatoriaOption = { id: string; nombre: string };

export type AccesoConcedido = {
  capacidades: string[];
  endsAt: string | null;
  note: string | null;
};

/**
 * QUÉ HERRAMIENTAS TIENE ESTE ALUMNO
 *
 * Se elige la convocatoria y se marcan las herramientas que tiene abiertas en
 * ella. Al cambiar de convocatoria, las casillas se recargan con lo que ya
 * tiene: el formulario enseña el estado actual y no uno en blanco, porque quien
 * lo abre casi siempre viene a cambiar una de las que ya hay.
 *
 * Solo aparecen las herramientas que la academia tiene contratadas. Las demás
 * ni se enseñan apagadas: una casilla que no se puede marcar solo genera la
 * pregunta de por qué no.
 */
export function AccesoForm({
  membershipId,
  convocatorias,
  capacidades,
  concedido,
}: {
  membershipId: string;
  convocatorias: ConvocatoriaOption[];
  capacidades: Capacidad[];
  concedido: Record<string, AccesoConcedido>;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    guardarAccesoAlumnoAction,
    undefined,
  );
  const [editionId, setEditionId] = useState(convocatorias[0]?.id ?? "");

  if (convocatorias.length === 0) {
    return (
      <p className="text-sm leading-relaxed text-ink-muted">
        Todavía no hay convocatorias. Crea una en Oposiciones y podrás repartir
        el acceso desde aquí.
      </p>
    );
  }

  if (capacidades.length === 0) {
    return (
      <p className="text-sm leading-relaxed text-ink-muted">
        Tu academia no tiene contratado ningún módulo que se pueda abrir a un
        alumno.
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="membershipId" value={membershipId} />

      {state?.error ? (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-[var(--radius-control)] bg-critical-soft px-3 py-2 text-sm text-critical"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          {state.error}
        </p>
      ) : null}

      {state?.ok ? (
        <p
          role="status"
          className="flex items-start gap-2 rounded-[var(--radius-control)] bg-positive-soft px-3 py-2 text-sm text-positive"
        >
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
          Acceso guardado.
        </p>
      ) : null}

      <Field label="Convocatoria" htmlFor="acceso-edicion" required>
        <Select
          name="editionId"
          value={editionId}
          onChange={(e) => setEditionId(e.target.value)}
        >
          {convocatorias.map((convocatoria) => (
            <option key={convocatoria.id} value={convocatoria.id}>
              {convocatoria.nombre}
            </option>
          ))}
        </Select>
      </Field>

      {/*
        La `key` lleva dentro lo que dice el servidor, y no solo la
        convocatoria elegida.
        
        Con la convocatoria sola, guardar volvía a montar esta pieza mientras
        las propiedades eran todavía las de ANTES de guardar, así que las
        casillas revertían a lo que había y parecía que no se hubiera guardado
        nada. Incluyendo los datos en la clave, la pieza se vuelve a sembrar
        solo cuando llegan de verdad datos nuevos: mientras tanto manda lo que
        haya marcado quien está delante.
      */}
      <CamposDeAcceso
        key={`${editionId}|${claveDelServidor(concedido[editionId])}`}
        capacidades={capacidades}
        inicial={concedido[editionId]}
      />

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Guardando…" : "Guardar acceso"}
      </Button>
    </form>
  );
}

/** Lo que el servidor dice de una convocatoria, como texto comparable. */
function claveDelServidor(acceso?: AccesoConcedido) {
  if (!acceso) return "sin-acceso";
  return [
    [...acceso.capacidades].sort().join(","),
    acceso.endsAt ?? "",
    acceso.note ?? "",
  ].join("|");
}

/** Las casillas y los dos campos que las acompañan, para una convocatoria. */
function CamposDeAcceso({
  capacidades,
  inicial,
}: {
  capacidades: Capacidad[];
  inicial?: AccesoConcedido;
}) {
  /*
   * Las casillas van sin controlar: el estado lo tiene el DOM.
   *
   * Una copia en React de lo que ya vive en el formulario es una copia que se
   * puede perder en cualquier repintado, y aquí lo que se pierde es lo que
   * alguien acababa de marcar. `cuantas` existe solo para el aviso de abajo;
   * si se desincronizara, lo peor que pasa es que sobre o falte una frase.
   */
  const [cuantas, setCuantas] = useState(inicial?.capacidades.length ?? 0);

  function recontar(formulario: HTMLFieldSetElement | null) {
    if (!formulario) return;
    setCuantas(
      formulario.querySelectorAll<HTMLInputElement>(
        'input[name="capacidades"]:checked',
      ).length,
    );
  }

  return (
    <>
      <fieldset
        className="space-y-2"
        onChange={(e) => recontar(e.currentTarget)}
      >
        <legend className="pb-1.5 text-sm font-medium text-ink">
          Herramientas
        </legend>
        {capacidades.map((capacidad) => (
          <label
            key={capacidad.codigo}
            className="flex cursor-pointer items-start gap-3 rounded-[var(--radius-control)] border border-line p-3 transition-colors has-checked:border-accent/40 has-checked:bg-accent-soft/40"
          >
            <input
              type="checkbox"
              name="capacidades"
              value={capacidad.codigo}
              defaultChecked={inicial?.capacidades.includes(capacidad.codigo)}
              className="mt-0.5 size-4 shrink-0 accent-[var(--accent)]"
            />
            <span className="min-w-0">
              <span className="block text-sm font-medium text-ink">
                {capacidad.nombre}
              </span>
              <span className="block text-xs leading-relaxed text-ink-muted">
                {capacidad.detalle}
              </span>
            </span>
          </label>
        ))}
      </fieldset>

      <Field
        label="Hasta cuándo"
        htmlFor="acceso-caduca"
        hint="Vacío = sin caducidad. Útil para una prueba o para un acceso que termina con el examen."
      >
        <Input type="date" name="endsAt" defaultValue={inicial?.endsAt ?? ""} />
      </Field>

      <Field
        label="Por qué"
        htmlFor="acceso-nota"
        hint="Queda guardado con el acceso. No lo ve el alumno."
      >
        <Input
          name="note"
          maxLength={500}
          defaultValue={inicial?.note ?? ""}
          placeholder="Beca parcial, prueba de una semana…"
        />
      </Field>

      {cuantas === 0 ? (
        <p className="text-xs leading-relaxed text-ink-muted">
          Sin ninguna marcada se le retira el acceso que le hubieras dado a mano
          en esta convocatoria. Lo que venga de una matrícula no se toca.
        </p>
      ) : null}
    </>
  );
}
