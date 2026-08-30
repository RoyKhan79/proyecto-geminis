"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, CloudOff, Loader2, Upload } from "lucide-react";
import {
  entregarExamenAction,
  guardarBorradorAction,
  type ExamState,
} from "@/server/exams/actions";
import { ExamTimer } from "@/components/campus/exam-timer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, Textarea } from "@/components/ui/primitives";

/**
 * EL EXAMEN DE DESARROLLO, MIENTRAS SE ESCRIBE
 *
 * Lo único que de verdad tiene que hacer bien esta pantalla es no perder lo
 * escrito. Todo lo demás —el reloj, el contador de palabras, el aviso de
 * guardado— es acompañamiento.
 *
 * Cómo se consigue:
 *
 *   · Se guarda solo a los 4 segundos de dejar de escribir, y como tarde cada
 *     30 aunque no se pare. Quien escribe del tirón también queda cubierto.
 *   · Cada guardado devuelve los segundos que quedan SEGÚN EL SERVIDOR, y con
 *     eso se recoloca la cuenta atrás. El reloj del móvil no decide nada.
 *   · Si falla el guardado se avisa en la pantalla, sin bloquear la escritura.
 *     Un aviso rojo mientras se sigue pudiendo escribir es mejor que un modal
 *     que corta el examen.
 *   · Al llegar a cero se entrega sola. Lo que hay guardado es la entrega.
 */

const PAUSA_MS = 4_000;
const MAXIMO_MS = 30_000;

type Guardado =
  | { tipo: "limpio" }
  | { tipo: "pendiente" }
  | { tipo: "guardando" }
  | { tipo: "guardado"; cuando: Date }
  | { tipo: "fallo"; mensaje: string };

export function EditorDeExamen({
  submissionId,
  borradorInicial,
  terminaEnISO,
  permiteArchivos,
}: {
  submissionId: string;
  borradorInicial: string;
  terminaEnISO: string | null;
  permiteArchivos: boolean;
}) {
  const router = useRouter();
  const [texto, setTexto] = useState(borradorInicial);
  const [guardado, setGuardado] = useState<Guardado>({ tipo: "limpio" });
  const [entregando, setEntregando] = useState(false);
  const [resultado, setResultado] = useState<ExamState>(undefined);
  const [archivos, setArchivos] = useState<string[]>([]);
  const [finISO, setFinISO] = useState(terminaEnISO);

  // Lo último que confirmó el servidor. Sirve para no reenviar lo mismo y para
  // saber, si algo falla, qué se perdió exactamente.
  const confirmado = useRef(borradorInicial);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tope = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cerrado = useRef(false);

  const guardar = useCallback(async () => {
    if (cerrado.current) return;
    const aEnviar = texto;
    if (aEnviar === confirmado.current) {
      setGuardado({ tipo: "limpio" });
      return;
    }

    setGuardado({ tipo: "guardando" });
    try {
      const respuesta = await guardarBorradorAction({ submissionId, body: aEnviar });

      if (respuesta.ok) {
        confirmado.current = aEnviar;
        setGuardado({ tipo: "guardado", cuando: new Date(respuesta.guardadoEn) });

        // Recolocar el reloj con la hora del servidor. Si el navegador iba
        // adelantado o el móvil se durmió, aquí se corrige.
        if (respuesta.segundosRestantes !== null) {
          setFinISO(
            new Date(Date.now() + respuesta.segundosRestantes * 1000).toISOString(),
          );
        }
        return;
      }

      if (respuesta.cerrado) {
        cerrado.current = true;
        setGuardado({ tipo: "fallo", mensaje: respuesta.error });
        router.refresh();
        return;
      }

      setGuardado({ tipo: "fallo", mensaje: respuesta.error });
    } catch {
      // Casi siempre es la cobertura. Se dice tal cual, porque el alumno puede
      // hacer algo al respecto: moverse, esperar, no cerrar la pestaña.
      setGuardado({
        tipo: "fallo",
        mensaje: "Sin conexión. Sigue escribiendo: se guardará en cuanto vuelva.",
      });
    }
  }, [submissionId, texto, router]);

  // Guardado por pausa (4 s) con techo (30 s).
  useEffect(() => {
    if (texto === confirmado.current) return;
    setGuardado((previo) =>
      previo.tipo === "guardando" ? previo : { tipo: "pendiente" },
    );

    if (temporizador.current) clearTimeout(temporizador.current);
    temporizador.current = setTimeout(() => void guardar(), PAUSA_MS);

    if (!tope.current) {
      tope.current = setTimeout(() => {
        tope.current = null;
        void guardar();
      }, MAXIMO_MS);
    }

    return () => {
      if (temporizador.current) clearTimeout(temporizador.current);
    };
  }, [texto, guardar]);

  // Reintento al recuperar la conexión: es justo el momento en que el guardado
  // pendiente puede pasar, y esperar treinta segundos más no tendría sentido.
  useEffect(() => {
    const alVolver = () => void guardar();
    window.addEventListener("online", alVolver);
    return () => window.removeEventListener("online", alVolver);
  }, [guardar]);

  // Avisar antes de cerrar la pestaña con algo sin guardar.
  useEffect(() => {
    const alCerrar = (evento: BeforeUnloadEvent) => {
      if (texto !== confirmado.current) evento.preventDefault();
    };
    window.addEventListener("beforeunload", alCerrar);
    return () => window.removeEventListener("beforeunload", alCerrar);
  }, [texto]);

  async function entregar(formData: FormData) {
    setEntregando(true);
    // Se guarda antes de entregar: si la entrega falla por lo que sea, lo
    // escrito ya está a salvo en el servidor.
    await guardar();
    formData.set("submissionId", submissionId);
    formData.set("body", texto);
    const respuesta = await entregarExamenAction(undefined, formData);
    setResultado(respuesta);
    setEntregando(false);
    if (respuesta?.ok) router.push("/campus/examenes");
    else router.refresh();
  }

  const palabras = texto.trim() ? texto.trim().split(/\s+/).length : 0;

  return (
    <div className="space-y-3">
      <div className="sticky top-15 z-10 flex items-center gap-2 rounded-[var(--radius-control)] border border-line bg-surface/90 px-3 py-2 backdrop-blur-xl">
        {finISO ? (
          <ExamTimer
            expiraISO={finISO}
            onExpirar={() => {
              if (cerrado.current) return;
              cerrado.current = true;
              // Se recarga: el servidor ya habrá cerrado la entrega con lo
              // último guardado, y la pantalla pasa a modo «entregado».
              void guardar().finally(() => router.refresh());
            }}
          />
        ) : (
          <span className="text-sm text-ink-muted">Sin límite de tiempo</span>
        )}

        <div className="flex-1" />

        <span className="text-xs tabular-nums text-ink-muted">
          {palabras} {palabras === 1 ? "palabra" : "palabras"}
        </span>

        <EstadoGuardado estado={guardado} />
      </div>

      <Textarea
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        rows={22}
        autoFocus
        spellCheck
        placeholder="Escribe aquí tu respuesta…"
        className="min-h-[60vh] text-[0.95rem] leading-relaxed"
        aria-label="Respuesta del examen"
      />

      {guardado.tipo === "fallo" ? (
        <Card>
          <CardContent className="flex items-start gap-2 p-3 pt-3 text-sm text-caution">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>{guardado.mensaje}</span>
          </CardContent>
        </Card>
      ) : null}

      <form action={entregar} className="space-y-3">
        {permiteArchivos ? (
          <label className="flex cursor-pointer items-center gap-2 rounded-[var(--radius-control)] border border-dashed border-line px-3 py-2 text-sm text-ink-soft hover:border-accent">
            <Upload className="size-4" aria-hidden />
            {archivos.length > 0
              ? archivos.join(", ")
              : "Adjuntar un esquema o una foto de tu hoja (opcional)"}
            <input
              type="file"
              name="files"
              multiple
              className="sr-only"
              onChange={(e) =>
                setArchivos([...(e.target.files ?? [])].map((f) => f.name))
              }
            />
          </label>
        ) : null}

        {resultado?.error ? (
          <p role="alert" className="text-sm text-critical">
            {resultado.error}
          </p>
        ) : null}

        <Button type="submit" loading={entregando} className="w-full">
          Entregar el examen
        </Button>
        <p className="text-center text-xs text-ink-muted">
          Una vez entregado no podrás seguir escribiendo. Si se agota el tiempo se
          entrega solo con lo último guardado.
        </p>
      </form>
    </div>
  );
}

function EstadoGuardado({ estado }: { estado: Guardado }) {
  if (estado.tipo === "guardando") {
    return (
      <span className="flex items-center gap-1 text-xs text-ink-muted">
        <Loader2 className="size-3 animate-spin" aria-hidden />
        Guardando…
      </span>
    );
  }
  if (estado.tipo === "guardado") {
    return (
      <span className="flex items-center gap-1 text-xs text-positive" role="status">
        <Check className="size-3" aria-hidden />
        Guardado
      </span>
    );
  }
  if (estado.tipo === "pendiente") {
    return <span className="text-xs text-ink-muted">Sin guardar…</span>;
  }
  if (estado.tipo === "fallo") {
    return (
      <span className="flex items-center gap-1 text-xs text-caution">
        <CloudOff className="size-3" aria-hidden />
        Sin guardar
      </span>
    );
  }
  return null;
}
