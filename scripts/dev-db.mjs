#!/usr/bin/env node
/**
 * Arranca `scripts/dev-db.sh` desde npm en cualquier sistema.
 *
 *   npm run db:start | db:stop | db:reset
 *
 * ── POR QUÉ EXISTE ESTO ────────────────────────────────────────────────────
 *
 * El guion de la base es un `.sh` y funciona bien, Windows incluido: ya detecta
 * Git Bash y añade el `.exe` a los binarios. El problema no era el guion, era
 * arrancarlo. npm ejecuta sus scripts con `cmd.exe`, que no sabe ejecutar un
 * archivo `.sh`, así que `npm run db:start` moría con «"." no se reconoce como
 * un comando interno o externo» y había que escribir `bash ./scripts/dev-db.sh`
 * a mano. Poner `bash` delante en el package.json tampoco vale: en una
 * instalación normal de Git para Windows, `bash.exe` no está en el PATH que ve
 * `cmd.exe`.
 *
 * Así que se busca. En Linux y en macOS está donde siempre; en Windows se mira
 * el PATH primero y después los sitios donde Git se instala, incluida la
 * instalación por usuario, que es la que hace el instalador cuando no se le dan
 * permisos de administrador y la que más se olvida.
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const GUION = join(RAIZ, "scripts", "dev-db.sh");

/** Dónde puede estar `bash` en Windows, en orden de preferencia. */
function candidatosEnWindows() {
  const programas = process.env.ProgramFiles ?? "C:\\Program Files";
  const programasX86 =
    process.env["ProgramFiles(x86)"] ?? "C:\\Program Files (x86)";
  const local = process.env.LOCALAPPDATA ?? "";
  return [
    join(programas, "Git", "bin", "bash.exe"),
    join(programasX86, "Git", "bin", "bash.exe"),
    local ? join(local, "Programs", "Git", "bin", "bash.exe") : "",
    // WSL: sirve para arrancar el guion, aunque la base quede dentro de Linux.
    join(process.env.SystemRoot ?? "C:\\Windows", "System32", "bash.exe"),
  ].filter(Boolean);
}

function buscarBash() {
  // En el PATH, que es lo normal fuera de Windows y lo mejor si está.
  const enPath = spawnSync(
    process.platform === "win32" ? "where" : "which",
    ["bash"],
    { encoding: "utf8" },
  );
  if (enPath.status === 0) {
    const primera = enPath.stdout.split(/\r?\n/).find((l) => l.trim());
    if (primera && existsSync(primera.trim())) return primera.trim();
  }

  if (process.platform !== "win32") {
    for (const ruta of ["/bin/bash", "/usr/bin/bash", "/usr/local/bin/bash"]) {
      if (existsSync(ruta)) return ruta;
    }
    return null;
  }

  for (const ruta of candidatosEnWindows()) if (existsSync(ruta)) return ruta;
  return null;
}

const bash = buscarBash();
if (!bash) {
  console.error(
    [
      "No encuentro `bash`, que es lo que necesita scripts/dev-db.sh.",
      "",
      process.platform === "win32"
        ? "En Windows viene con Git: https://git-scm.com/download/win"
        : "Instálalo con el gestor de paquetes del sistema.",
      "",
      "Mientras tanto, desde una terminal que tenga bash:",
      "  bash ./scripts/dev-db.sh start",
    ].join("\n"),
  );
  process.exit(1);
}

const r = spawnSync(bash, [GUION, ...process.argv.slice(2)], {
  stdio: "inherit",
  cwd: RAIZ,
});
process.exit(r.status ?? 1);
