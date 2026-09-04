/**
 * EMPAQUETAR EL PROYECTO PARA LLEVÁRSELO
 *
 *   npm run zip                 deja el ZIP en el Escritorio
 *   npm run zip -- --sin-secretos   sin .env y sin la conversación
 *   npm run zip -- --destino /ruta/carpeta
 *
 * Mete el código, el histórico de git, la documentación, las capturas y la
 * transcripción del trabajo. Deja fuera lo que se regenera solo —`node_modules`,
 * `.next`, la base de datos local y el cliente de Prisma—, que son cuatro gigas
 * que además no son portables entre sistemas.
 *
 * ⚠️ POR DEFECTO EL ZIP LLEVA SECRETOS: el `.env`, con la clave de cifrado de
 * los datos bancarios, y la conversación, donde se escribieron contraseñas.
 * Van dentro porque el ZIP es para seguir trabajando en otro ordenador y sin
 * ellos hay que reconstruir la configuración a mano. Pero eso significa que
 * **no se puede compartir por enlace**. Si va a verlo alguien más, `--sin-secretos`.
 */
import { execFileSync, spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { homedir, tmpdir } from "node:os";
import path from "node:path";

const args = process.argv.slice(2);
const sinSecretos = args.includes("--sin-secretos");
const destinoArg = args[args.indexOf("--destino") + 1];
const DESTINO =
  args.includes("--destino") && destinoArg
    ? path.resolve(destinoArg)
    : path.join(homedir(), "Desktop");

const RAIZ = process.cwd();
const NOMBRE = "proyecto-catedria";

/**
 * Busca la carpeta de Google Drive sincronizada en este ordenador.
 *
 * Si Drive para escritorio está instalado, dejar el ZIP dentro **es** subirlo:
 * lo sincroniza él. Es la única forma de que la subida sea automática sin
 * credenciales ni tokens de por medio.
 *
 * @returns La ruta de la carpeta, o `null` si Drive no está instalado.
 */
function carpetaDeDrive() {
  const candidatas = [
    path.join(homedir(), "Library", "CloudStorage"),
    path.join(homedir(), "Google Drive"),
    path.join(homedir(), "GoogleDrive"),
  ];

  for (const base of candidatas) {
    if (!existsSync(base)) continue;

    // En macOS moderno cuelga de CloudStorage con el correo en el nombre:
    // «GoogleDrive-alguien@gmail.com».
    if (base.endsWith("CloudStorage")) {
      const drive = readdirSync(base).find((d) => d.startsWith("GoogleDrive-"));
      if (!drive) continue;
      const miUnidad = path.join(base, drive, "Mi unidad");
      const myDrive = path.join(base, drive, "My Drive");
      if (existsSync(miUnidad)) return miUnidad;
      if (existsSync(myDrive)) return myDrive;
      return path.join(base, drive);
    }

    return base;
  }

  return null;
}

/** Lo que no viaja: se regenera con `npm run setup` y ocupa cuatro gigas. */
const FUERA = [
  "node_modules",
  ".next",
  ".dev",
  "coverage",
  ".DS_Store",
  "src/generated",
  "docs/api",
  "*.tsbuildinfo",
];

/** Dónde guarda Claude Code las conversaciones de este proyecto. */
function carpetaDeConversaciones() {
  const clave = RAIZ.replace(/[/\\ ]/g, "-").replace(/^-/, "");
  return path.join(homedir(), ".claude", "projects", `-${clave}`);
}

/** La transcripción más reciente, que es la de esta sesión. */
function transcripcionMasReciente() {
  const carpeta = carpetaDeConversaciones();
  if (!existsSync(carpeta)) return null;

  const archivos = readdirSync(carpeta)
    .filter((f) => f.endsWith(".jsonl"))
    .map((f) => ({ ruta: path.join(carpeta, f), mtime: statSync(path.join(carpeta, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);

  return archivos[0]?.ruta ?? null;
}

/**
 * Saca de la transcripción lo que se ha ido pidiendo, en orden.
 *
 * Veinte megas de JSON no los lee nadie. Esta lista sí: es el encargo entero en
 * diez minutos, y es lo que hace falta para retomar el trabajo en otro sitio.
 */
function extraerPeticiones(rutaJsonl, destino) {
  const lineas = readFileSync(rutaJsonl, "utf8").split("\n").filter(Boolean);
  const vistos = new Set();
  const peticiones = [];

  for (const linea of lineas) {
    let objeto;
    try {
      objeto = JSON.parse(linea);
    } catch {
      continue;
    }
    if (objeto.type !== "user" || !objeto.message) continue;

    const contenido = objeto.message.content;
    const textos =
      typeof contenido === "string"
        ? [contenido]
        : Array.isArray(contenido)
          ? contenido.filter((c) => c.type === "text").map((c) => c.text)
          : [];

    for (const bruto of textos) {
      const texto = (bruto ?? "").trim();
      if (!texto || texto.length < 3) continue;
      // Fuera lo que no escribió una persona: recordatorios del sistema,
      // resultados de herramientas y avisos automáticos.
      if (texto.startsWith("<") || texto.startsWith("Caveat:")) continue;
      if (texto.includes("system-reminder") || texto.includes("tool_result")) continue;
      if (vistos.has(texto)) continue;
      vistos.add(texto);
      peticiones.push(texto);
    }
  }

  writeFileSync(
    destino,
    "# Todo lo que se ha pedido, en orden\n\n" +
      "Extraído de la conversación. Sirve para ver el encargo completo sin leer\n" +
      "los veinte megas de transcripción.\n\n" +
      peticiones.map((t, i) => `${i + 1}. ${t.replace(/\n+/g, " ")}`).join("\n\n") +
      "\n",
    "utf8",
  );

  return peticiones.length;
}

function main() {
  const fecha = new Date().toISOString().slice(0, 10);
  const sufijo = sinSecretos ? "-sin-secretos" : "";
  const zip = path.join(DESTINO, `${NOMBRE}-${fecha}${sufijo}.zip`);

  console.log(`\nEmpaquetando Catedria`);
  console.log("=".repeat(58));

  const temporal = mkdtempSync(path.join(tmpdir(), "catedria-zip-"));
  const raizTemporal = path.join(temporal, NOMBRE);

  try {
    // ── Copiar el proyecto sin lo que se regenera ──────────────────────────
    const excluir = FUERA.flatMap((patron) => ["--exclude", patron]);
    if (sinSecretos) excluir.push("--exclude", ".env");

    execFileSync("rsync", ["-a", ...excluir, `${RAIZ}/`, `${raizTemporal}/`], {
      stdio: "inherit",
    });
    console.log("  ✓ código, documentación, capturas e histórico de git");

    // ── La conversación ────────────────────────────────────────────────────
    if (!sinSecretos) {
      const transcripcion = transcripcionMasReciente();
      if (transcripcion) {
        const carpeta = path.join(raizTemporal, "conversacion");
        mkdirSync(carpeta, { recursive: true });
        copyFileSync(transcripcion, path.join(carpeta, "conversacion-completa.jsonl"));

        const cuantas = extraerPeticiones(
          transcripcion,
          path.join(carpeta, "peticiones-del-usuario.md"),
        );

        writeFileSync(
          path.join(carpeta, "LEEME.md"),
          [
            "# La conversación",
            "",
            "| Archivo | Qué es |",
            "| --- | --- |",
            `| \`peticiones-del-usuario.md\` | **Empieza por aquí.** Las ${cuantas} peticiones en orden, incluido el encargo original |`,
            "| `conversacion-completa.jsonl` | La transcripción entera. Una línea por mensaje |",
            "",
            "## Cómo seguir en el ordenador nuevo",
            "",
            "**La conversación no se recupera sola.** Claude Code la guarda en una",
            "carpeta ligada a la ruta del proyecto, y en Windows esa ruta es otra. Abre",
            "Claude Code en la carpeta del proyecto y dile:",
            "",
            "> Lee `docs/ESTADO_DEL_PROYECTO.md` y",
            "> `conversacion/peticiones-del-usuario.md`. Es un proyecto que veníamos",
            "> haciendo en otro ordenador y quiero seguir desde donde lo dejamos.",
            "",
            "## ⚠️ Contiene contraseñas",
            "",
            "Durante la conversación se escribieron credenciales. **No compartas esta",
            "carpeta.** Si el proyecto va a verlo otra persona, bórrala: nada del código",
            "depende de ella.",
            "",
          ].join("\n"),
          "utf8",
        );
        console.log(`  ✓ conversación · ${cuantas} peticiones extraídas`);
      } else {
        console.log("  ~ sin conversación: no he encontrado la transcripción");
      }
    }

    // ── Comprimir ──────────────────────────────────────────────────────────
    rmSync(zip, { force: true });
    const resultado = spawnSync("zip", ["-qr", zip, NOMBRE, "-x", "*.DS_Store"], {
      cwd: temporal,
      stdio: "inherit",
    });
    if (resultado.status !== 0) throw new Error("zip ha fallado");

    const megas = statSync(zip).size / 1024 / 1024;
    console.log("=".repeat(58));
    console.log(`✓ ${zip}`);
    console.log(`  ${megas.toFixed(1)} MB`);

    // ── A Drive, si está instalado ─────────────────────────────────────────
    const drive = carpetaDeDrive();
    if (drive && !args.includes("--destino")) {
      const carpeta = path.join(drive, "Catedria");
      mkdirSync(carpeta, { recursive: true });
      const copia = path.join(carpeta, path.basename(zip));
      copyFileSync(zip, copia);
      console.log(`✓ copiado a Drive · ${copia}`);
      console.log("  Drive lo sube solo; puede tardar un rato según el tamaño.");
    } else if (!drive) {
      console.log("");
      console.log("  · Sin subida a Drive: no hay Google Drive para escritorio");
      console.log("    instalado. Instálalo desde google.com/drive/download y este");
      console.log("    comando dejará el ZIP dentro, que es subirlo.");
    }

    if (!sinSecretos) {
      console.log("");
      console.log("  ⚠️  Lleva el .env y la conversación, y ahí dentro hay claves.");
      console.log("      Súbelo a tu Drive privado y NO lo compartas por enlace.");
      console.log("      Para una copia que se pueda enseñar: npm run zip -- --sin-secretos");
    }
    console.log("");
  } finally {
    rmSync(temporal, { recursive: true, force: true });
  }
}

main();
