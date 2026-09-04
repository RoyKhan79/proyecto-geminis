/**
 * Crea o actualiza el superadministrador de la plataforma.
 *
 *   npm run superadmin -- correo@ejemplo.com
 *
 * La contraseña NO se pasa como argumento. Se pide por teclado y no se ve al
 * escribirla, por tres motivos que no son teóricos:
 *
 *   · queda en el historial del intérprete de órdenes (`~/.bash_history`),
 *   · la ve cualquiera que haga `ps` mientras el proceso corre, y en un
 *     servidor compartido eso es todo el mundo,
 *   · acaba en los registros de auditoría del sistema y en las herramientas de
 *     monitorización, que suelen guardar la línea de órdenes entera.
 *
 * Para automatizar (CI, aprovisionamiento), se admite pasarla por la variable
 * SUPERADMIN_PASSWORD, que sí es un canal razonable: no se imprime ni se queda
 * en el historial.
 *
 * Es el nivel de arriba del todo: da de alta academias y da soporte, pero NO
 * pertenece a ninguna academia, así que no ve el contenido de ninguna. Para
 * entrar en una tiene que impersonar, y eso queda registrado (§3).
 */
import { createInterface } from "node:readline";
import { prismaBase } from "@/lib/db/client";
import { hashPassword, PASSWORD_MIN_LENGTH } from "@/lib/auth/password";

/**
 * Pide algo por teclado sin que se vea al escribirlo.
 *
 * No hay una forma limpia de hacer esto en Node: se apaga el eco de la
 * terminal a mano y se vuelve a encender al terminar, pase lo que pase. El
 * `finally` importa, porque si esto falla a mitad la terminal se queda muda y
 * quien la usa no entiende por qué no ve lo que escribe.
 *
 * @param pregunta Lo que se muestra antes de leer.
 * @returns Lo escrito, sin el salto de línea final.
 */
async function pedirEnSecreto(pregunta: string): Promise<string> {
  const entrada = process.stdin;

  if (!entrada.isTTY) {
    throw new Error(
      "No hay terminal interactiva. Usa la variable SUPERADMIN_PASSWORD para automatizar.",
    );
  }

  process.stdout.write(pregunta);

  const rl = createInterface({ input: entrada, output: process.stdout, terminal: true });

  // `readline` en modo terminal escribe lo que se teclea; se intercepta la
  // escritura para no pintar nada mientras dure la pregunta.
  const salidaReal = (
    rl as unknown as { _writeToOutput?: (texto: string) => void }
  )._writeToOutput;
  (rl as unknown as { _writeToOutput: (texto: string) => void })._writeToOutput = () => {};

  try {
    return await new Promise<string>((resolver) => {
      rl.question("", (respuesta) => resolver(respuesta));
    });
  } finally {
    if (salidaReal) {
      (rl as unknown as { _writeToOutput: typeof salidaReal })._writeToOutput = salidaReal;
    }
    rl.close();
    process.stdout.write("\n");
  }
}

/**
 * ¿Es un correo con forma de correo?
 *
 * Sin florituras: una arroba, algo a cada lado, un punto en el dominio y ni un
 * espacio. Las expresiones regulares exhaustivas para correos son famosas por
 * rechazar direcciones válidas, y aquí lo que importa es no dar de alta un
 * superadministrador con una cadena que nadie podrá usar para entrar.
 */
function correoValido(valor: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(valor);
}

/**
 * Comprueba que la contraseña vale la pena.
 *
 * Es la cuenta más poderosa del producto, así que se le exige más que a las
 * demás: la longitud mínima del proyecto y, además, que no sea una sola cosa
 * repetida ni una de las de siempre.
 *
 * @returns El motivo del rechazo, o `null` si es aceptable.
 */
function motivoDeRechazo(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres.`;
  }
  if (password.length > 512) return "Es demasiado larga.";
  if (new Set(password).size < 5) return "Tiene demasiados caracteres repetidos.";

  const habituales = [
    "contraseña", "password", "123456", "qwerty", "admin", "catedria",
    "superadmin", "academia",
  ];
  const minusculas = password.toLowerCase();
  if (habituales.some((mala) => minusculas.includes(mala))) {
    return "Contiene una palabra demasiado previsible.";
  }
  return null;
}

async function main() {
  const email = (process.argv[2] ?? "").trim().toLowerCase();

  if (!correoValido(email)) {
    console.error("Uso: npm run superadmin -- correo@ejemplo.com");
    console.error("La contraseña se pide después; no se pasa por la línea de órdenes.");
    process.exit(1);
  }

  // Nadie escribe una contraseña larga sin equivocarse alguna vez, así que se
  // pide dos veces. Por el entorno, una sola: quien automatiza no puede repetir.
  let password = process.env.SUPERADMIN_PASSWORD ?? "";

  if (password) {
    console.log("· Contraseña tomada de SUPERADMIN_PASSWORD.");
  } else {
    password = await pedirEnSecreto("Contraseña del superadministrador: ");
    const repetida = await pedirEnSecreto("Repítela: ");
    if (password !== repetida) {
      console.error("✗ Las dos contraseñas no coinciden.");
      process.exit(1);
    }
  }

  const rechazo = motivoDeRechazo(password);
  if (rechazo) {
    console.error(`✗ ${rechazo}`);
    process.exit(1);
  }

  const passwordHash = await hashPassword(password);

  const previo = await prismaBase.user.findUnique({
    where: { email },
    select: { id: true, isPlatformAdmin: true },
  });

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

  // Que quede escrito en alguna parte que alguien se ha dado el nivel más alto.
  // No hay academia a la que asociarlo —el superadmin no pertenece a ninguna—,
  // así que la traza es esta línea y el propio `updatedAt` de la fila.
  console.log(
    previo
      ? previo.isPlatformAdmin
        ? `✓ Superadministrador actualizado: ${usuario.email} (contraseña cambiada)`
        : `✓ ${usuario.email} ASCIENDE a superadministrador de la plataforma`
      : `✓ Superadministrador creado: ${usuario.email}`,
  );

  const otros = await prismaBase.user.count({
    where: { isPlatformAdmin: true, deletedAt: null },
  });
  console.log(`  Superadministradores en la plataforma: ${otros}`);

  const membresias = await prismaBase.membership.count({
    where: { userId: usuario.id },
  });
  if (membresias === 0) {
    console.log(
      "  Correcto: no pertenece a ninguna academia, así que no ve el contenido de ninguna.",
    );
  } else {
    console.log(
      `  OJO: pertenece a ${membresias} academia(s). Ahí entra como miembro, no como superadmin.`,
    );
  }
  console.log("  Entra en /plataforma.");
}

main()
  .catch((error) => {
    // Nunca se imprime el error entero por si arrastrara la contraseña dentro
    // de un objeto de Prisma; solo el mensaje.
    console.error("✗", (error as Error).message);
    process.exit(1);
  })
  .finally(() => prismaBase.$disconnect());
