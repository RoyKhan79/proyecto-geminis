"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { recordAudit } from "@/lib/audit";
import { requirePlatformAdmin } from "@/lib/auth/context";
import { prismaBase } from "@/lib/db/client";
import {
  CATALOGO,
  MODULOS,
  MODULOS_NUCLEO,
  calcularPresupuesto,
  resolverDependencias,
  type CodigoModulo,
} from "@/lib/modules/catalogo";

/**
 * QUÉ TIENE CONTRATADO CADA ACADEMIA
 *
 * Solo el superadministrador. Una academia no puede activarse módulos a sí
 * misma, por razones obvias, y por eso estas acciones no pasan por `tenantDb`:
 * quien las ejecuta no pertenece a ninguna academia.
 *
 * Todo lo que se toca aquí queda en la auditoría. Es dinero: cuando dentro de
 * seis meses alguien discuta una factura, la pregunta será qué tenía contratado
 * y desde cuándo, y esa pregunta tiene que tener respuesta.
 */

export type ModuloState =
  | { error?: string; ok?: string; añadidos?: string[] }
  | undefined;

const guardarSchema = z.object({
  academyId: z.string().uuid(),
  modulos: z.string(),
  notas: z.string().trim().max(500).optional(),
});

/**
 * Fija los módulos de una academia.
 *
 * @param formData `academyId`, `modulos` (códigos separados por comas) y unas
 *   notas opcionales que explican el porqué.
 * @returns Confirmación, con la lista de los que se han añadido solos por
 *   dependencia, o el motivo del fallo.
 * @remarks Los que se quitan se **desactivan**, no se borran: qué tuvo
 *   contratado una academia y hasta cuándo es justo lo que hay que poder
 *   consultar cuando se discute una factura. Y si vuelve a contratarlo, se
 *   reactiva la misma fila con su precio pactado intacto.
 */
export async function guardarModulosAction(
  _prev: ModuloState,
  formData: FormData,
): Promise<ModuloState> {
  const ctx = await requirePlatformAdmin();
  const parsed = guardarSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Revisa los datos." };
  }

  const academia = await prismaBase.academy.findUnique({
    where: { id: parsed.data.academyId },
    select: { id: true, name: true, deletedAt: true },
  });
  if (!academia || academia.deletedAt) return { error: "Esa academia no existe." };

  const codigosValidos = new Set(CATALOGO.map((m) => m.codigo));
  const pedidos = parsed.data.modulos
    .split(",")
    .map((c) => c.trim())
    .filter((c): c is CodigoModulo => codigosValidos.has(c as CodigoModulo));

  // Las dependencias se resuelven aquí y no solo en la pantalla: a esta acción
  // se puede llamar sin pasar por ella, y activar la facturación sin cobros
  // dejaría facturas que no se cruzan con ningún pago.
  const finales = resolverDependencias(pedidos);
  const añadidos = finales.filter(
    (c) => !pedidos.includes(c) && !MODULOS_NUCLEO.includes(c),
  );

  const antes = await prismaBase.academyModule.findMany({
    where: { academyId: academia.id },
    select: { module: true, active: true },
  });
  const activosAntes = new Set(antes.filter((m) => m.active).map((m) => m.module));

  const ahora = new Date();

  for (const codigo of finales) {
    await prismaBase.academyModule.upsert({
      where: { academyId_module: { academyId: academia.id, module: codigo } },
      create: {
        academyId: academia.id,
        module: codigo,
        active: true,
        notes: parsed.data.notas || null,
      },
      update: {
        active: true,
        deactivatedAt: null,
        // Solo se refresca la fecha de alta si estaba apagado: reactivar es un
        // alta nueva, pero volver a guardar sin cambios no debería mover nada.
        ...(activosAntes.has(codigo) ? {} : { activatedAt: ahora }),
        ...(parsed.data.notas ? { notes: parsed.data.notas } : {}),
      },
    });
  }

  const aQuitar = [...activosAntes].filter(
    (c) => !finales.includes(c as CodigoModulo),
  );

  if (aQuitar.length > 0) {
    await prismaBase.academyModule.updateMany({
      where: { academyId: academia.id, module: { in: aQuitar } },
      data: { active: false, deactivatedAt: ahora },
    });
  }

  await recordAudit({
    academyId: academia.id,
    actorId: ctx.user.id,
    action: "academy.modules.set",
    entityType: "Academy",
    entityId: academia.id,
    changes: {
      antes: [...activosAntes],
      despues: finales,
      quitados: aQuitar,
      total: calcularPresupuesto(finales).totalCents,
    },
    context: { notas: parsed.data.notas ?? null },
  });

  revalidatePath("/plataforma");
  revalidatePath(`/plataforma/academias/${academia.id}`);

  return {
    ok:
      aQuitar.length > 0
        ? `Guardado. ${finales.length} módulos activos, ${aQuitar.length} retirados.`
        : `Guardado. ${finales.length} módulos activos.`,
    añadidos: añadidos.map((c) => MODULOS[c].nombre),
  };
}

const precioSchema = z.object({
  academyId: z.string().uuid(),
  modulo: z.string(),
  /** En euros, con decimales, tal como se teclea. Vacío = precio de catálogo. */
  precio: z.string().trim(),
  notas: z.string().trim().max(500).optional(),
});

/**
 * Pacta un precio distinto del de catálogo para un módulo de una academia.
 *
 * @returns Confirmación, o el motivo.
 * @remarks Dejar el precio vacío vuelve al de catálogo. Se guarda en céntimos y
 *   como entero: con decimales, la suma de doce líneas no cuadra con el total y
 *   alguien acaba discutiendo un céntimo por teléfono.
 */
export async function pactarPrecioAction(
  _prev: ModuloState,
  formData: FormData,
): Promise<ModuloState> {
  const ctx = await requirePlatformAdmin();
  const parsed = precioSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: "Revisa los datos." };

  const codigo = parsed.data.modulo as CodigoModulo;
  if (!MODULOS[codigo]) return { error: "Ese módulo no existe." };

  let precioCents: number | null = null;
  if (parsed.data.precio) {
    const euros = Number(parsed.data.precio.replace(",", "."));
    if (!Number.isFinite(euros) || euros < 0) {
      return { error: "El precio no es un número válido." };
    }
    precioCents = Math.round(euros * 100);
  }

  const fila = await prismaBase.academyModule.findUnique({
    where: { academyId_module: { academyId: parsed.data.academyId, module: codigo } },
    select: { id: true, priceCents: true },
  });
  if (!fila) return { error: "Esa academia no tiene ese módulo." };

  await prismaBase.academyModule.update({
    where: { id: fila.id },
    data: {
      priceCents: precioCents,
      ...(parsed.data.notas ? { notes: parsed.data.notas } : {}),
    },
  });

  await recordAudit({
    academyId: parsed.data.academyId,
    actorId: ctx.user.id,
    action: "academy.modules.price",
    entityType: "AcademyModule",
    entityId: fila.id,
    changes: {
      modulo: codigo,
      antes: fila.priceCents,
      despues: precioCents,
      catalogo: MODULOS[codigo].precioCents,
    },
    context: { notas: parsed.data.notas ?? null },
  });

  revalidatePath(`/plataforma/academias/${parsed.data.academyId}`);
  return {
    ok: precioCents === null
      ? `«${MODULOS[codigo].nombre}» vuelve al precio de catálogo.`
      : `Precio pactado para «${MODULOS[codigo].nombre}».`,
  };
}
