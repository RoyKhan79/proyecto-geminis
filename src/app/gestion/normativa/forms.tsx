"use client";

import { useActionState, useState } from "react";
import { AlertCircle, CheckCircle2, Plus, Scale, X } from "lucide-react";
import {
  createArticleAction,
  createLegislationAction,
  linkArticleAction,
  registerChangeAction,
  type LegState,
} from "@/server/legislation/actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  Field,
  Input,
  Select,
  Textarea,
} from "@/components/ui/primitives";

type Norma = {
  id: string;
  reference: string;
  articulos: { id: string; number: string; title: string | null }[];
};

function Aviso({ state }: { state: LegState }) {
  if (state?.error) {
    return (
      <p role="alert" className="flex items-start gap-2 rounded-[var(--radius-control)] bg-critical-soft px-3 py-2 text-sm text-critical">
        <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
        {state.error}
      </p>
    );
  }
  if (state?.ok) {
    return (
      <p role="status" className="flex items-start gap-2 rounded-[var(--radius-control)] bg-positive-soft px-3 py-2 text-sm text-positive">
        <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
        {state.ok}
      </p>
    );
  }
  return null;
}

/** Las tres acciones de normativa, agrupadas para no llenar la pantalla. */
export function LegislationForms({
  normas,
  temas,
  puedeEscribir,
  puedeRevisar,
}: {
  normas: Norma[];
  temas: { id: string; label: string }[];
  puedeEscribir: boolean;
  puedeRevisar: boolean;
}) {
  const [panel, setPanel] = useState<"none" | "norma" | "articulo" | "cambio" | "enlace">("none");

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {puedeEscribir ? (
          <>
            <Button size="sm" onClick={() => setPanel(panel === "norma" ? "none" : "norma")}>
              <Plus aria-hidden />
              Registrar norma
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setPanel(panel === "articulo" ? "none" : "articulo")}
              disabled={normas.length === 0}
            >
              Añadir artículo
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setPanel(panel === "enlace" ? "none" : "enlace")}
              disabled={normas.length === 0}
            >
              Enlazar con un tema
            </Button>
          </>
        ) : null}
        {puedeRevisar ? (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setPanel(panel === "cambio" ? "none" : "cambio")}
            disabled={normas.length === 0}
          >
            <Scale aria-hidden />
            Registrar un cambio
          </Button>
        ) : null}
      </div>

      {panel === "norma" ? <NormaForm onClose={() => setPanel("none")} /> : null}
      {panel === "articulo" ? <ArticuloForm normas={normas} onClose={() => setPanel("none")} /> : null}
      {panel === "enlace" ? <EnlaceForm normas={normas} temas={temas} onClose={() => setPanel("none")} /> : null}
      {panel === "cambio" ? <CambioForm normas={normas} onClose={() => setPanel("none")} /> : null}
    </div>
  );
}

function NormaForm({ onClose }: { onClose: () => void }) {
  const [state, action, pending] = useActionState<LegState, FormData>(createLegislationAction, undefined);

  return (
    <Card>
      <CardContent className="space-y-4 p-5 pt-5">
        <Cabecera titulo="Registrar una norma" onClose={onClose} />
        <Aviso state={state} />
        <form action={action} className="grid gap-4 sm:grid-cols-2">
          <Field label="Referencia" htmlFor="reference" required hint="Como la citáis en clase.">
            <Input name="reference" placeholder="Ley 39/2015" required />
          </Field>
          <Field label="Ámbito" htmlFor="scope">
            <Select name="scope" defaultValue="STATE">
              <option value="STATE">Estatal</option>
              <option value="REGIONAL">Autonómica</option>
              <option value="LOCAL">Local</option>
              <option value="EUROPEAN">Europea</option>
              <option value="OTHER">Otra</option>
            </Select>
          </Field>
          <div className="sm:col-span-2">
            <Field label="Título" htmlFor="title" required>
              <Input name="title" placeholder="del Procedimiento Administrativo Común de las Administraciones Públicas" required />
            </Field>
          </div>
          <Field label="Identificador oficial" htmlFor="officialId" hint="P. ej. BOE-A-2015-10565.">
            <Input name="officialId" />
          </Field>
          <Field label="Enlace oficial" htmlFor="officialUrl">
            <Input name="officialUrl" type="url" placeholder="https://www.boe.es/…" />
          </Field>
          <Acciones pending={pending} onClose={onClose} etiqueta="Registrar" />
        </form>
      </CardContent>
    </Card>
  );
}

function ArticuloForm({ normas, onClose }: { normas: Norma[]; onClose: () => void }) {
  const [state, action, pending] = useActionState<LegState, FormData>(createArticleAction, undefined);

  return (
    <Card>
      <CardContent className="space-y-4 p-5 pt-5">
        <Cabecera titulo="Añadir un artículo" onClose={onClose} />
        <Aviso state={state} />
        <form action={action} className="grid gap-4 sm:grid-cols-2">
          <Field label="Norma" htmlFor="legislationId" required>
            <Select name="legislationId" required defaultValue="">
              <option value="">Elige la norma</option>
              {normas.map((n) => (
                <option key={n.id} value={n.id}>{n.reference}</option>
              ))}
            </Select>
          </Field>
          <Field label="Artículo" htmlFor="number" required hint="24, 24.1, Disposición adicional tercera…">
            <Input name="number" required />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Título del artículo" htmlFor="title">
              <Input name="title" placeholder="Silencio administrativo en procedimientos iniciados a solicitud del interesado" />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Texto" htmlFor="text" hint="Opcional. Sirve para comparar cuando cambie.">
              <Textarea name="text" rows={4} />
            </Field>
          </div>
          <Acciones pending={pending} onClose={onClose} etiqueta="Añadir" />
        </form>
      </CardContent>
    </Card>
  );
}

function EnlaceForm({
  normas,
  temas,
  onClose,
}: {
  normas: Norma[];
  temas: { id: string; label: string }[];
  onClose: () => void;
}) {
  const [normaId, setNormaId] = useState("");
  const articulos = normas.find((n) => n.id === normaId)?.articulos ?? [];

  return (
    <Card>
      <CardContent className="space-y-4 p-5 pt-5">
        <Cabecera titulo="Enlazar un artículo con un tema" onClose={onClose} />
        <p className="text-xs text-ink-muted">
          Este enlace es lo que permite responder «el artículo 24 afecta a estos temas
          y a estas preguntas» cuando cambie la ley.
        </p>
        <form action={linkArticleAction} className="grid gap-4 sm:grid-cols-3">
          <Field label="Norma" htmlFor="normaId">
            <Select value={normaId} onChange={(e) => setNormaId(e.target.value)}>
              <option value="">Elige</option>
              {normas.map((n) => (
                <option key={n.id} value={n.id}>{n.reference}</option>
              ))}
            </Select>
          </Field>
          <Field label="Artículo" htmlFor="articleId" required>
            <Select name="articleId" required disabled={!normaId} defaultValue="">
              <option value="">Elige</option>
              {articulos.map((a) => (
                <option key={a.id} value={a.id}>Art. {a.number}</option>
              ))}
            </Select>
          </Field>
          <Field label="Tema" htmlFor="nodeId" required>
            <Select name="nodeId" required defaultValue="">
              <option value="">Elige</option>
              {temas.map((t) => (
                <option key={t.id} value={t.id}>{t.label}</option>
              ))}
            </Select>
          </Field>
          <div className="flex justify-end gap-2 sm:col-span-3">
            <Button type="button" variant="ghost" onClick={onClose}>Cerrar</Button>
            <Button type="submit">Enlazar</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function CambioForm({ normas, onClose }: { normas: Norma[]; onClose: () => void }) {
  const [state, action, pending] = useActionState<LegState, FormData>(registerChangeAction, undefined);
  const [normaId, setNormaId] = useState("");
  const articulos = normas.find((n) => n.id === normaId)?.articulos ?? [];

  return (
    <Card>
      <CardContent className="space-y-4 p-5 pt-5">
        <Cabecera titulo="Registrar un cambio legislativo" onClose={onClose} />
        <p className="text-xs text-ink-muted">
          Al guardarlo calculamos qué temas y preguntas dependen de ese artículo y las
          marcamos para que las revises. No se modifica nada de tu contenido.
        </p>
        <Aviso state={state} />
        <form action={action} className="grid gap-4 sm:grid-cols-2">
          <Field label="Norma" htmlFor="legislationId" required>
            <Select
              name="legislationId"
              required
              value={normaId}
              onChange={(e) => setNormaId(e.target.value)}
            >
              <option value="">Elige la norma</option>
              {normas.map((n) => (
                <option key={n.id} value={n.id}>{n.reference}</option>
              ))}
            </Select>
          </Field>
          <Field label="Artículo" htmlFor="articleId" hint="Vacío = toda la norma.">
            <Select name="articleId" disabled={!normaId} defaultValue="">
              <option value="">Toda la norma</option>
              {articulos.map((a) => (
                <option key={a.id} value={a.id}>Art. {a.number}</option>
              ))}
            </Select>
          </Field>
          <Field label="Tipo de cambio" htmlFor="changeType">
            <Select name="changeType" defaultValue="AMENDED">
              <option value="AMENDED">Modificación</option>
              <option value="REPEALED">Derogación</option>
              <option value="CREATED">Norma nueva</option>
              <option value="CORRECTED">Corrección</option>
            </Select>
          </Field>
          <Field label="Resumen del cambio" htmlFor="title" required>
            <Input name="title" placeholder="Nuevo plazo de resolución" required />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Descripción" htmlFor="description">
              <Textarea name="description" rows={2} />
            </Field>
          </div>
          <Field label="Texto anterior" htmlFor="previousText">
            <Textarea name="previousText" rows={3} />
          </Field>
          <Field label="Texto nuevo" htmlFor="newText">
            <Textarea name="newText" rows={3} />
          </Field>
          <Acciones pending={pending} onClose={onClose} etiqueta="Registrar cambio" />
        </form>
      </CardContent>
    </Card>
  );
}

function Cabecera({ titulo, onClose }: { titulo: string; onClose: () => void }) {
  return (
    <div className="flex items-center justify-between">
      <h3 className="text-sm font-semibold text-ink">{titulo}</h3>
      <Button variant="ghost" size="icon" onClick={onClose} aria-label="Cerrar">
        <X aria-hidden />
      </Button>
    </div>
  );
}

function Acciones({
  pending,
  onClose,
  etiqueta,
}: {
  pending: boolean;
  onClose: () => void;
  etiqueta: string;
}) {
  return (
    <div className="flex justify-end gap-2 sm:col-span-2">
      <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
      <Button type="submit" loading={pending}>{etiqueta}</Button>
    </div>
  );
}
