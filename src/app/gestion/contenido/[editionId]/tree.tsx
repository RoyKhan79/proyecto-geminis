"use client";

import { useActionState, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  FileText,
  Folder,
  FolderPlus,
  GripVertical,
  Link2,
  Pencil,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";
import {
  addLinkResourceAction,
  createNodeAction,
  deleteNodeAction,
  moveNodeAction,
  togglePublishAction,
  updateNodeAction,
  type ContentState,
} from "@/server/content/actions";
import { uploadResourceAction } from "@/server/content/actions";
import { Button } from "@/components/ui/button";
import {
  Badge,
  Card,
  CardContent,
  Field,
  Input,
  Select,
  Textarea,
} from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

/**
 * Un nodo del árbol tal como lo necesita la pantalla.
 */
export type TreeNode = {
  id: string;
  parentId: string | null;
  label: string;
  description: string | null;
  kind: "SECTION" | "FOLDER" | "TOPIC" | "RESOURCE";
  sectionKind: string | null;
  status: string;
  depth: number;
  isFree: boolean;
  visibleToStudents: boolean;
  downloadable: boolean | null;
  aiEnabled: boolean | null;
  usableForTests: boolean | null;
  watermark: boolean | null;
  estimatedMinutes: number | null;
  fileId: string | null;
  resourceType: string | null;
  externalUrl: string | null;
  children: TreeNode[];
};

const KIND_LABEL: Record<string, string> = {
  SECTION: "Apartado",
  FOLDER: "Carpeta",
  TOPIC: "Tema",
  RESOURCE: "Recurso",
};

const SECTION_KINDS: { value: string; label: string; hint: string }[] = [
  { value: "SYLLABUS", label: "Temario", hint: "Estudio con seguimiento de progreso" },
  { value: "LIBRARY", label: "Biblioteca de documentos", hint: "Material descargable o consultable" },
  { value: "CLASSES", label: "Clases", hint: "Sesiones en directo y grabaciones" },
  { value: "TESTS", label: "Tests", hint: "Autoevaluación" },
  { value: "SIMULATIONS", label: "Simulacros", hint: "Exámenes completos" },
  { value: "PRACTICAL", label: "Supuestos prácticos", hint: "Casos y supuestos" },
  { value: "LEGISLATION", label: "Normativa", hint: "Leyes y artículos" },
  { value: "VIDEO", label: "Videoteca", hint: "Vídeos" },
  { value: "CUSTOM", label: "Carpeta libre", hint: "Lo que necesites" },
];

/**
 * El árbol de contenido, con arrastrar y soltar para reordenar.
 */
export function ContentTree({
  editionId,
  nodes,
  permisos,
}: {
  editionId: string;
  nodes: TreeNode[];
  permisos: { escribir: boolean; publicar: boolean; borrar: boolean };
}) {
  return (
    <div className="space-y-3">
      {permisos.escribir ? (
        <NewNodeForm
          editionId={editionId}
          parentId={null}
          kind="SECTION"
          botón="Nuevo apartado"
          título="Nuevo apartado del Campus"
        />
      ) : null}

      {nodes.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-sm text-ink-muted">
              Todavía no hay nada. Crea el primer apartado: llámalo como lo llaméis
              vosotros («Temario», «Programación de aula», «Situaciones de
              aprendizaje»…).
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="divide-y divide-[var(--border-subtle)]">
          {nodes.map((node) => (
            <NodeRow
              key={node.id}
              node={node}
              editionId={editionId}
              permisos={permisos}
            />
          ))}
        </Card>
      )}
    </div>
  );
}

function NodeRow({
  node,
  editionId,
  permisos,
}: {
  node: TreeNode;
  editionId: string;
  permisos: { escribir: boolean; publicar: boolean; borrar: boolean };
}) {
  const [abierto, setAbierto] = useState(node.depth < 1);
  const [panel, setPanel] = useState<"none" | "editar" | "añadir" | "subir" | "enlace">(
    "none",
  );

  const publicado = node.status === "PUBLISHED";
  const tieneHijos = node.children.length > 0;

  const Icono =
    node.kind === "RESOURCE" ? FileText : node.kind === "TOPIC" ? FileText : Folder;

  return (
    <div>
      <div
        className="flex items-center gap-2 px-3 py-2 hover:bg-surface-muted"
        style={{ paddingLeft: `${0.75 + node.depth * 1.25}rem` }}
      >
        <button
          type="button"
          onClick={() => setAbierto((v) => !v)}
          className={cn(
            "flex size-5 shrink-0 items-center justify-center rounded text-ink-muted",
            !tieneHijos && "invisible",
          )}
          aria-label={abierto ? "Contraer" : "Desplegar"}
        >
          {abierto ? (
            <ChevronDown className="size-4" aria-hidden />
          ) : (
            <ChevronRight className="size-4" aria-hidden />
          )}
        </button>

        <Icono
          className={cn(
            "size-4 shrink-0",
            node.kind === "SECTION" ? "text-accent" : "text-ink-muted",
          )}
          aria-hidden
        />

        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "truncate text-sm",
              node.kind === "SECTION" ? "font-semibold text-ink" : "text-ink",
            )}
          >
            {node.label}
          </p>
          <p className="flex flex-wrap items-center gap-x-2 text-[0.6875rem] text-ink-muted">
            <span>{KIND_LABEL[node.kind]}</span>
            {node.estimatedMinutes ? <span>· {node.estimatedMinutes} min</span> : null}
            {node.isFree ? <span className="text-positive">· muestra gratuita</span> : null}
            {!node.visibleToStudents ? <span>· oculto al alumnado</span> : null}
            {node.downloadable === true ? <span>· descargable</span> : null}
            {node.aiEnabled === false ? <span>· fuera de la IA</span> : null}
          </p>
        </div>

        <Badge tone={publicado ? "positive" : "neutral"}>
          {publicado ? "Publicado" : "Borrador"}
        </Badge>

        <div className="flex shrink-0 items-center gap-0.5">
          {permisos.escribir ? (
            <>
              <form action={moveNodeAction}>
                <input type="hidden" name="nodeId" value={node.id} />
                <input type="hidden" name="direccion" value="arriba" />
                <IconButton label="Subir en el orden">
                  <GripVertical className="size-3.5 rotate-90" aria-hidden />
                </IconButton>
              </form>
              <IconButton
                label="Editar"
                onClick={() => setPanel(panel === "editar" ? "none" : "editar")}
              >
                <Pencil className="size-3.5" aria-hidden />
              </IconButton>
              {node.kind !== "RESOURCE" ? (
                <>
                  <IconButton
                    label="Añadir dentro"
                    onClick={() => setPanel(panel === "añadir" ? "none" : "añadir")}
                  >
                    <FolderPlus className="size-3.5" aria-hidden />
                  </IconButton>
                  <IconButton
                    label="Subir archivo"
                    onClick={() => setPanel(panel === "subir" ? "none" : "subir")}
                  >
                    <Upload className="size-3.5" aria-hidden />
                  </IconButton>
                  <IconButton
                    label="Añadir enlace o vídeo"
                    onClick={() => setPanel(panel === "enlace" ? "none" : "enlace")}
                  >
                    <Link2 className="size-3.5" aria-hidden />
                  </IconButton>
                </>
              ) : null}
            </>
          ) : null}

          {permisos.publicar ? (
            <form action={togglePublishAction}>
              <input type="hidden" name="nodeId" value={node.id} />
              <input type="hidden" name="publicar" value={publicado ? "0" : "1"} />
              <input type="hidden" name="cascada" value={tieneHijos ? "1" : "0"} />
              <IconButton label={publicado ? "Retirar" : "Publicar"}>
                {publicado ? (
                  <EyeOff className="size-3.5" aria-hidden />
                ) : (
                  <Eye className="size-3.5" aria-hidden />
                )}
              </IconButton>
            </form>
          ) : null}

          {permisos.borrar ? (
            <form action={deleteNodeAction}>
              <input type="hidden" name="nodeId" value={node.id} />
              <IconButton label="Eliminar" danger>
                <Trash2 className="size-3.5" aria-hidden />
              </IconButton>
            </form>
          ) : null}
        </div>
      </div>

      {panel === "editar" ? (
        <PanelWrapper depth={node.depth}>
          <EditNodeForm node={node} onDone={() => setPanel("none")} />
        </PanelWrapper>
      ) : null}

      {panel === "añadir" ? (
        <PanelWrapper depth={node.depth}>
          <NewNodeForm
            editionId={editionId}
            parentId={node.id}
            kind={node.kind === "SECTION" ? "FOLDER" : "TOPIC"}
            botón="Añadir"
            título={`Añadir dentro de «${node.label}»`}
            inline
            onDone={() => setPanel("none")}
          />
        </PanelWrapper>
      ) : null}

      {panel === "subir" ? (
        <PanelWrapper depth={node.depth}>
          <UploadForm
            parentId={node.id}
            editionId={editionId}
            onDone={() => setPanel("none")}
          />
        </PanelWrapper>
      ) : null}

      {panel === "enlace" ? (
        <PanelWrapper depth={node.depth}>
          <LinkForm parentId={node.id} onDone={() => setPanel("none")} />
        </PanelWrapper>
      ) : null}

      {abierto && tieneHijos ? (
        <div className="border-t border-[var(--border-subtle)]">
          {node.children.map((hijo) => (
            <NodeRow
              key={hijo.id}
              node={hijo}
              editionId={editionId}
              permisos={permisos}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function PanelWrapper({
  depth,
  children,
}: {
  depth: number;
  children: React.ReactNode;
}) {
  return (
    <div
      className="border-t border-[var(--border-subtle)] bg-surface-muted px-4 py-4"
      style={{ paddingLeft: `${1.5 + depth * 1.25}rem` }}
    >
      {children}
    </div>
  );
}

function IconButton({
  label,
  children,
  onClick,
  danger,
}: {
  label: string;
  children: React.ReactNode;
  onClick?: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type={onClick ? "button" : "submit"}
      onClick={onClick}
      title={label}
      aria-label={label}
      className={cn(
        "flex size-7 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-surface-sunken hover:text-ink",
        danger && "hover:text-critical",
      )}
    >
      {children}
    </button>
  );
}

// ── Formularios ──────────────────────────────────────────────────────────────

function Mensaje({ state }: { state: ContentState }) {
  if (state?.error) {
    return (
      <p role="alert" className="text-sm text-critical">
        {state.error}
      </p>
    );
  }
  if (state?.ok) {
    return (
      <p role="status" className="text-sm text-positive">
        Hecho.
      </p>
    );
  }
  return null;
}

function NewNodeForm({
  editionId,
  parentId,
  kind,
  botón,
  título,
  inline,
  onDone,
}: {
  editionId: string;
  parentId: string | null;
  kind: TreeNode["kind"];
  botón: string;
  título: string;
  inline?: boolean;
  onDone?: () => void;
}) {
  const [abierto, setAbierto] = useState(Boolean(inline));
  const [tipo, setTipo] = useState<TreeNode["kind"]>(kind);
  const [state, formAction, pending] = useActionState<ContentState, FormData>(
    createNodeAction,
    undefined,
  );

  if (!abierto) {
    return (
      <Button variant="secondary" size="sm" onClick={() => setAbierto(true)}>
        <FolderPlus aria-hidden />
        {botón}
      </Button>
    );
  }

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="editionId" value={editionId} />
      {parentId ? <input type="hidden" name="parentId" value={parentId} /> : null}
      <p className="text-sm font-medium text-ink">{título}</p>
      <Mensaje state={state} />

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nombre" htmlFor={`label-${parentId ?? "raiz"}`} required>
          <Input
            name="label"
            placeholder={
              parentId ? "Bloque I, Tema 1, Unidad…" : "Temario, Situaciones de aprendizaje…"
            }
            required
            autoFocus
          />
        </Field>

        <Field label="Tipo" htmlFor={`kind-${parentId ?? "raiz"}`}>
          <Select
            name="kind"
            value={tipo}
            onChange={(e) => setTipo(e.target.value as TreeNode["kind"])}
          >
            {parentId ? (
              <>
                <option value="FOLDER">Carpeta o bloque</option>
                <option value="TOPIC">Tema (con progreso)</option>
              </>
            ) : (
              <option value="SECTION">Apartado del Campus</option>
            )}
          </Select>
        </Field>

        {tipo === "SECTION" ? (
          <div className="sm:col-span-2">
            <Field
              label="¿Cómo funciona este apartado?"
              htmlFor="sectionKind"
              hint="Define la pantalla que usa el alumno. El nombre visible es el que has escrito arriba."
            >
              <Select name="sectionKind" defaultValue="SYLLABUS">
                {SECTION_KINDS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label} — {s.hint}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        ) : null}

        {tipo === "TOPIC" ? (
          <Field label="Minutos estimados" htmlFor="estimatedMinutes">
            <Input name="estimatedMinutes" type="number" min={0} />
          </Field>
        ) : null}

        <div className="sm:col-span-2">
          <Field label="Descripción" htmlFor="description">
            <Textarea name="description" rows={2} />
          </Field>
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            setAbierto(false);
            onDone?.();
          }}
        >
          Cancelar
        </Button>
        <Button type="submit" size="sm" loading={pending}>
          Crear
        </Button>
      </div>
    </form>
  );
}

function EditNodeForm({ node, onDone }: { node: TreeNode; onDone: () => void }) {
  const [state, formAction, pending] = useActionState<ContentState, FormData>(
    updateNodeAction,
    undefined,
  );

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="nodeId" value={node.id} />
      <Mensaje state={state} />

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nombre" htmlFor={`edit-label-${node.id}`} required>
          <Input name="label" defaultValue={node.label} required />
        </Field>
        {node.kind === "TOPIC" ? (
          <Field label="Minutos estimados" htmlFor={`edit-min-${node.id}`}>
            <Input
              name="estimatedMinutes"
              type="number"
              min={0}
              defaultValue={node.estimatedMinutes ?? ""}
            />
          </Field>
        ) : null}
        <div className="sm:col-span-2">
          <Field label="Descripción" htmlFor={`edit-desc-${node.id}`}>
            <Textarea name="description" rows={2} defaultValue={node.description ?? ""} />
          </Field>
        </div>
      </div>

      <fieldset className="space-y-2 rounded-[var(--radius-control)] border border-line bg-surface p-3">
        <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-ink-muted">
          Qué se puede hacer con esto
        </legend>

        <div className="grid gap-3 sm:grid-cols-2">
          <Herencia
            name="downloadable"
            label="Descargar"
            value={node.downloadable}
            hint="Si está heredado, manda el apartado superior."
          />
          <Herencia
            name="aiEnabled"
            label="Usar en la IA"
            value={node.aiEnabled}
            hint="Si lo desactivas, la IA no podrá citarlo."
          />
          <Herencia
            name="usableForTests"
            label="Generar preguntas"
            value={node.usableForTests}
          />
          <Herencia name="watermark" label="Marca de agua" value={node.watermark} />
        </div>

        <div className="flex flex-wrap gap-4 pt-1">
          <label className="flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              name="visibleToStudents"
              defaultChecked={node.visibleToStudents}
              className="size-4"
            />
            Visible para el alumnado
          </label>
          <label className="flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              name="isFree"
              defaultChecked={node.isFree}
              className="size-4"
            />
            Muestra gratuita (sin necesidad de comprarlo)
          </label>
        </div>
      </fieldset>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onDone}>
          Cerrar
        </Button>
        <Button type="submit" size="sm" loading={pending}>
          Guardar
        </Button>
      </div>
    </form>
  );
}

function Herencia({
  name,
  label,
  value,
  hint,
}: {
  name: string;
  label: string;
  value: boolean | null;
  hint?: string;
}) {
  return (
    <Field label={label} htmlFor={name} hint={hint}>
      <Select name={name} defaultValue={value === null ? "" : String(value)}>
        <option value="">Heredado</option>
        <option value="true">Sí</option>
        <option value="false">No</option>
      </Select>
    </Field>
  );
}

function UploadForm({
  parentId,
  editionId,
  onDone,
}: {
  parentId: string;
  editionId: string;
  onDone: () => void;
}) {
  const [state, formAction, pending] = useActionState<ContentState, FormData>(
    uploadResourceAction,
    undefined,
  );
  const [nombre, setNombre] = useState<string | null>(null);

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="parentId" value={parentId} />
      <input type="hidden" name="editionId" value={editionId} />
      <p className="text-sm font-medium text-ink">Subir archivo</p>
      <Mensaje state={state} />

      <label className="flex cursor-pointer items-center gap-3 rounded-[var(--radius-control)] border border-dashed border-line bg-surface px-4 py-3 hover:border-accent">
        <Upload className="size-4 text-ink-muted" aria-hidden />
        <span className="text-sm text-ink">
          {nombre ?? "Elegir archivo (PDF, vídeo, imagen, Word…)"}
        </span>
        <input
          type="file"
          name="file"
          className="sr-only"
          onChange={(e) => setNombre(e.target.files?.[0]?.name ?? null)}
          required
        />
      </label>

      <Field label="Nombre visible" htmlFor={`up-label-${parentId}`} hint="Si lo dejas vacío se usa el nombre del archivo.">
        <Input name="label" placeholder="Tema 1 · Constitución" />
      </Field>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onDone}>
          Cerrar
        </Button>
        <Button type="submit" size="sm" loading={pending} disabled={!nombre}>
          Subir
        </Button>
      </div>
    </form>
  );
}

function LinkForm({ parentId, onDone }: { parentId: string; onDone: () => void }) {
  const [state, formAction, pending] = useActionState<ContentState, FormData>(
    addLinkResourceAction,
    undefined,
  );

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="parentId" value={parentId} />
      <p className="flex items-center gap-2 text-sm font-medium text-ink">
        <Sparkles className="size-4 text-accent" aria-hidden />
        Enlace o vídeo alojado fuera
      </p>
      <Mensaje state={state} />

      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Nombre" htmlFor={`ln-label-${parentId}`} required>
          <Input name="label" required />
        </Field>
        <Field label="Dirección" htmlFor={`ln-url-${parentId}`} required>
          <Input name="url" type="url" placeholder="https://…" required />
        </Field>
        <Field label="Tipo" htmlFor={`ln-type-${parentId}`}>
          <Select name="type" defaultValue="VIDEO">
            <option value="VIDEO">Vídeo</option>
            <option value="LINK">Enlace</option>
            <option value="EMBED">Contenido incrustado</option>
          </Select>
        </Field>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onDone}>
          Cerrar
        </Button>
        <Button type="submit" size="sm" loading={pending}>
          Añadir
        </Button>
      </div>
    </form>
  );
}
