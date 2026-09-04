import { prismaBase } from "@/lib/db/client";
import { env } from "@/lib/env";

/**
 * CATEDRIA AI GATEWAY
 *
 * Punto ÚNICO por el que la aplicación habla con un proveedor de inteligencia
 * artificial. Ningún módulo llama nunca a un SDK directamente.
 *
 * Motivo (§53): si las llamadas se dispersan por el código, cambiar de
 * proveedor —o negociar precios, o cumplir un requisito de privacidad— deja de
 * ser una decisión y pasa a ser una refactorización. Además, aquí es donde se
 * controla lo que de verdad importa:
 *
 *   · qué contexto se envía (nunca más del necesario),
 *   · cuánto se gasta y quién lo gasta,
 *   · qué se registra y qué no.
 *
 * Si no hay proveedor configurado, el gateway responde de forma degradada pero
 * honesta: dice que la IA no está disponible. Nunca inventa una respuesta.
 */

export type AiMessage = { role: "system" | "user" | "assistant"; content: string };

/**
 * Una petición al proveedor de IA.
 *
 * `feature` no es decorativa: es lo que permite saber después en qué se está
 * gastando, y poder cortar una funcionalidad concreta sin apagarlas todas.
 */
export type AiRequest = {
  academyId: string;
  memberId?: string | null;
  /// Funcionalidad que llama: "student.chat", "copilot.questions"…
  feature: string;
  messages: AiMessage[];
  maxTokens?: number;
  temperature?: number;
};

/**
 * La respuesta del proveedor, o la explicación de por qué no la hay.
 *
 * Cuando `ok` es `false`, `content` trae un texto **honesto** para enseñar tal
 * cual: que la IA no está disponible. Nunca una respuesta inventada, que es lo
 * peor que puede hacer un asistente de oposiciones.
 */
export type AiResponse = {
  ok: boolean;
  content: string;
  provider: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  /// Motivo cuando ok = false, en lenguaje llano.
  reason?: string;
};

/** Modelos por defecto. Se puede afinar por funcionalidad más adelante. */
const MODELOS = {
  anthropic: "claude-sonnet-5",
  openai: "gpt-4.1-mini",
} as const;

/**
 * Coste aproximado en milésimas de céntimo por millón de tokens. Sirve para
 * que la academia vea lo que gasta; no pretende ser una factura.
 */
const COSTE_POR_MILLON = {
  anthropic: { entrada: 300_000, salida: 1_500_000 },
  openai: { entrada: 40_000, salida: 160_000 },
} as const;

/**
 * Pregunta al proveedor de IA. Es el único sitio del código que lo hace.
 *
 * @param request Qué se pregunta, quién y para qué funcionalidad.
 * @returns Siempre una respuesta, nunca una excepción. Si no hay proveedor
 *   configurado, si la clave falla o si el servicio no contesta, devuelve
 *   `ok: false` con el motivo en lenguaje llano. Que se caiga un proveedor
 *   externo no puede tumbar la pantalla de un alumno.
 * @remarks Registra el consumo por academia y por funcionalidad antes de
 *   devolver, también cuando falla: un intento que ha costado tokens cuenta.
 */
export async function askAi(request: AiRequest): Promise<AiResponse> {
  const inicio = Date.now();
  const proveedor = env.AI_PROVIDER;

  if (proveedor === "none") {
    return degradada(
      "La inteligencia artificial no está activada en esta instalación.",
    );
  }

  const clave =
    proveedor === "anthropic" ? env.ANTHROPIC_API_KEY : env.OPENAI_API_KEY;

  if (!clave) {
    return degradada(
      `Falta la clave del proveedor ${proveedor}. Configúrala para activar Catedria IA.`,
    );
  }

  const modelo = MODELOS[proveedor];

  try {
    const respuesta =
      proveedor === "anthropic"
        ? await llamarAnthropic(clave, modelo, request)
        : await llamarOpenAi(clave, modelo, request);

    await registrarConsumo({
      request,
      proveedor,
      modelo,
      promptTokens: respuesta.promptTokens,
      completionTokens: respuesta.completionTokens,
      latencia: Date.now() - inicio,
      ok: true,
    });

    return respuesta;
  } catch (error) {
    await registrarConsumo({
      request,
      proveedor,
      modelo,
      promptTokens: 0,
      completionTokens: 0,
      latencia: Date.now() - inicio,
      ok: false,
      errorCode: (error as Error).message.slice(0, 120),
    });

    return degradada(
      "Catedria IA no está disponible en este momento. Inténtalo más tarde.",
    );
  }
}

function degradada(motivo: string): AiResponse {
  return {
    ok: false,
    content: "",
    provider: env.AI_PROVIDER,
    model: "—",
    promptTokens: 0,
    completionTokens: 0,
    reason: motivo,
  };
}

async function llamarAnthropic(
  clave: string,
  modelo: string,
  request: AiRequest,
): Promise<AiResponse> {
  const sistema = request.messages
    .filter((m) => m.role === "system")
    .map((m) => m.content)
    .join("\n\n");

  const respuesta = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": clave,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: modelo,
      max_tokens: request.maxTokens ?? 1200,
      temperature: request.temperature ?? 0.2,
      ...(sistema ? { system: sistema } : {}),
      messages: request.messages
        .filter((m) => m.role !== "system")
        .map((m) => ({ role: m.role, content: m.content })),
    }),
    signal: AbortSignal.timeout(60_000),
  });

  if (!respuesta.ok) {
    throw new Error(`Anthropic ${respuesta.status}`);
  }

  const json = (await respuesta.json()) as {
    content?: { type: string; text?: string }[];
    usage?: { input_tokens?: number; output_tokens?: number };
  };

  return {
    ok: true,
    content: (json.content ?? [])
      .filter((bloque) => bloque.type === "text")
      .map((bloque) => bloque.text ?? "")
      .join("\n")
      .trim(),
    provider: "anthropic",
    model: modelo,
    promptTokens: json.usage?.input_tokens ?? 0,
    completionTokens: json.usage?.output_tokens ?? 0,
  };
}

async function llamarOpenAi(
  clave: string,
  modelo: string,
  request: AiRequest,
): Promise<AiResponse> {
  const respuesta = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${clave}`,
    },
    body: JSON.stringify({
      model: modelo,
      max_tokens: request.maxTokens ?? 1200,
      temperature: request.temperature ?? 0.2,
      messages: request.messages,
    }),
    signal: AbortSignal.timeout(60_000),
  });

  if (!respuesta.ok) throw new Error(`OpenAI ${respuesta.status}`);

  const json = (await respuesta.json()) as {
    choices?: { message?: { content?: string } }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };

  return {
    ok: true,
    content: json.choices?.[0]?.message?.content?.trim() ?? "",
    provider: "openai",
    model: modelo,
    promptTokens: json.usage?.prompt_tokens ?? 0,
    completionTokens: json.usage?.completion_tokens ?? 0,
  };
}

/**
 * Registro de consumo (§54).
 *
 * Se guarda SIEMPRE, también cuando la llamada falla: un proveedor caído que
 * cobra por intento sale más caro si nadie lo mira. No se guarda el contenido
 * del prompt aquí; eso vive en la conversación, con su propia retención.
 */
async function registrarConsumo(datos: {
  request: AiRequest;
  proveedor: string;
  modelo: string;
  promptTokens: number;
  completionTokens: number;
  latencia: number;
  ok: boolean;
  errorCode?: string;
}) {
  const tarifa =
    COSTE_POR_MILLON[datos.proveedor as keyof typeof COSTE_POR_MILLON] ??
    COSTE_POR_MILLON.openai;

  const coste = Math.round(
    (datos.promptTokens / 1_000_000) * tarifa.entrada +
      (datos.completionTokens / 1_000_000) * tarifa.salida,
  );

  await prismaBase.aIUsage
    .create({
      data: {
        academyId: datos.request.academyId,
        memberId: datos.request.memberId ?? null,
        feature: datos.request.feature,
        provider: datos.proveedor,
        model: datos.modelo,
        promptTokens: datos.promptTokens,
        completionTokens: datos.completionTokens,
        costMilliCents: coste,
        latencyMs: datos.latencia,
        success: datos.ok,
        errorCode: datos.errorCode ?? null,
      },
    })
    .catch((error) => {
      console.error("[ia] no se ha podido registrar el consumo", error);
    });
}

/** ¿Está la IA disponible en esta instalación? */
export function aiDisponible(): boolean {
  if (env.AI_PROVIDER === "none") return false;
  return Boolean(
    env.AI_PROVIDER === "anthropic" ? env.ANTHROPIC_API_KEY : env.OPENAI_API_KEY,
  );
}
