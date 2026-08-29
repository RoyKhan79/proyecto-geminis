/**
 * Crea o actualiza el superadministrador de la plataforma.
 *
 *   npm run superadmin -- correo@ejemplo.com "contraseña"
 *
 * Es el nivel de arriba del todo: da de alta academias y da soporte, pero NO
 * pertenece a ninguna academia, así que no ve el contenido de ninguna. Para
 * entrar en una tiene que impersonar, y eso queda registrado (§3).
 */
import { prismaBase } from "@/lib/db/client";
import { hashPassword, PASSWORD_MIN_LENGTH } from "@/lib/auth/password";

async function main() {
  const email = (process.argv[2] ?? "").trim().toLowerCase();
  const password = process.argv[3] ?? "";

  if (!email.includes("@") || password.length < PASSWORD_MIN_LENGTH) {
    console.error(
      `Uso: npm run superadmin -- correo@ejemplo.com "contraseña de al menos ${PASSWORD_MIN_LENGTH} caracteres"`,
    );
    process.exit(1);
  }

  const passwordHash = await hashPassword(password);

  const usuario = await prismaBase.user.upsert({
    where: { email },
    update: { isPlatformAdmin: true, passwordHash },
    create: {
      email,
      firstName: "Superadmin",
      isPlatformAdmin: true,
      passwordHash,
      emailVerifiedAt: new Date(),
    },
    select: { id: true, email: true },
  });

  const membresias = await prismaBase.membership.count({
    where: { userId: usuario.id },
  });

  console.log(`✓ Superadministrador: ${usuario.email}`);
  console.log(`  Academias a las que pertenece: ${membresias}`);
  if (membresias === 0) {
    console.log(
      "  Correcto: no pertenece a ninguna, así que no ve el contenido de ninguna.",
    );
  } else {
    console.log(
      "  OJO: pertenece a alguna academia. Ahí entra como miembro, no como superadmin.",
    );
  }
  console.log("  Entra en /plataforma.");
}

main()
  .catch((error) => {
    console.error("✗", error);
    process.exit(1);
  })
  .finally(() => prismaBase.$disconnect());
