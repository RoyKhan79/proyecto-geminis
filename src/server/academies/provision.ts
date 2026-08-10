import { prismaBase } from "@/lib/db/client";
import { hashPassword } from "@/lib/auth/password";
import {
  SYSTEM_ROLES,
  type Permission,
  type SystemRoleKey,
} from "@/lib/auth/permissions";

/**
 * Alta de academias y de personas.
 *
 * Es el único sitio donde se crea una academia, para que ninguna nazca sin sus
 * roles del sistema. Una academia sin roles sería una academia en la que nadie
 * puede hacer nada, y el fallo aparecería mucho más tarde y lejos.
 */

export async function createAcademyWithRoles(input: {
  slug: string;
  name: string;
  legalName?: string;
  email?: string;
  planCode?: "STARTER" | "PRO" | "BUSINESS" | "ENTERPRISE";
  status?: "TRIAL" | "ACTIVE";
}) {
  const plan = input.planCode
    ? await prismaBase.plan.findUnique({ where: { code: input.planCode } })
    : null;

  const academy = await prismaBase.academy.create({
    data: {
      slug: input.slug,
      name: input.name,
      legalName: input.legalName,
      email: input.email,
      planId: plan?.id,
      status: input.status ?? "TRIAL",
    },
  });

  await createSystemRoles(academy.id);
  return academy;
}

export async function createSystemRoles(academyId: string) {
  for (const [key, definition] of Object.entries(SYSTEM_ROLES) as [
    SystemRoleKey,
    (typeof SYSTEM_ROLES)[SystemRoleKey],
  ][]) {
    await prismaBase.role.create({
      data: {
        academyId,
        key,
        name: definition.name,
        description: definition.description,
        isSystem: true,
        permissions: {
          create: definition.permissions.map((permission) => ({ permission })),
        },
      },
    });
  }
}

/** Sincroniza los permisos de los roles del sistema con el catálogo del código. */
export async function syncSystemRolePermissions(academyId: string) {
  for (const [key, definition] of Object.entries(SYSTEM_ROLES) as [
    SystemRoleKey,
    (typeof SYSTEM_ROLES)[SystemRoleKey],
  ][]) {
    const role = await prismaBase.role.findUnique({
      where: { academyId_key: { academyId, key } },
      include: { permissions: true },
    });
    if (!role || !role.isSystem) continue;

    const actuales = new Set(role.permissions.map((p) => p.permission));
    const deseados = new Set<string>(definition.permissions);

    const aCrear = [...deseados].filter((p) => !actuales.has(p));
    const aBorrar = [...actuales].filter((p) => !deseados.has(p));

    if (aCrear.length > 0) {
      await prismaBase.rolePermission.createMany({
        data: aCrear.map((permission) => ({ roleId: role.id, permission })),
        skipDuplicates: true,
      });
    }
    if (aBorrar.length > 0) {
      await prismaBase.rolePermission.deleteMany({
        where: { roleId: role.id, permission: { in: aBorrar } },
      });
    }
  }
}

export type NewMember = {
  email: string;
  firstName: string;
  lastName?: string;
  phone?: string;
  password?: string;
  roleKeys: SystemRoleKey[];
  isPlatformAdmin?: boolean;
};

/**
 * Da de alta a una persona en una academia.
 *
 * Si el correo ya existe en Geminis se reutiliza la identidad: la misma persona
 * puede ser alumna de una academia y profesora de otra sin duplicar cuentas
 * (ADR-0003). Nunca se sobrescribe la contraseña de una cuenta existente.
 */
export async function addMemberToAcademy(academyId: string, member: NewMember) {
  const email = member.email.trim().toLowerCase();

  const user = await prismaBase.user.upsert({
    where: { email },
    update: {
      firstName: member.firstName,
      lastName: member.lastName,
      ...(member.isPlatformAdmin ? { isPlatformAdmin: true } : {}),
    },
    create: {
      email,
      firstName: member.firstName,
      lastName: member.lastName,
      phone: member.phone,
      isPlatformAdmin: member.isPlatformAdmin ?? false,
      passwordHash: member.password ? await hashPassword(member.password) : null,
      emailVerifiedAt: member.password ? new Date() : null,
    },
  });

  const roles = await prismaBase.role.findMany({
    where: { academyId, key: { in: member.roleKeys } },
    select: { id: true, key: true },
  });

  if (roles.length !== member.roleKeys.length) {
    const encontrados = new Set(roles.map((r) => r.key));
    const faltan = member.roleKeys.filter((k) => !encontrados.has(k));
    throw new Error(`Roles inexistentes en la academia: ${faltan.join(", ")}`);
  }

  const membership = await prismaBase.membership.upsert({
    where: { academyId_userId: { academyId, userId: user.id } },
    update: { status: "ACTIVE" },
    create: { academyId, userId: user.id, status: "ACTIVE" },
  });

  await prismaBase.membershipRole.createMany({
    data: roles.map((role) => ({ membershipId: membership.id, roleId: role.id })),
    skipDuplicates: true,
  });

  return { user, membership };
}

export function permissionsOfRole(key: SystemRoleKey): Permission[] {
  return SYSTEM_ROLES[key].permissions;
}
