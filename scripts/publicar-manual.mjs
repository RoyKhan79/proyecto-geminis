/**
 * PUBLICAR EL MANUAL EN UN ENLACE PÚBLICO
 *
 *   npm run manual:publicar
 *
 * Levanta un servidor mínimo que sirve **solo** el manual —ni la aplicación, ni
 * la base de datos, ni nada más— y abre un túnel de Cloudflare que le da una
 * dirección pública en `https://…trycloudflare.com`. Sin cuenta y sin
 * configurar nada.
 *
 * Que sirva un único archivo no es un detalle: exponer el servidor entero por
 * un túnel dejaría `/gestion` accesible desde internet, con su pantalla de
 * acceso por delante pero accesible. Aquí lo único que hay al otro lado del
 * enlace es un HTML.
 *
 * ⚠️ EL ENLACE ES TEMPORAL. Vive mientras este proceso esté en marcha; al
 * cerrarlo, muere. Es lo que se puede hacer sin contratar un alojamiento, y
 * sirve para enseñárselo a alguien ahora. Para algo permanente hace falta un
 * sitio donde dejarlo: GitHub Pages, Netlify o el propio dominio de la academia,
 * porque el manual también vive dentro del producto, en `/manual`.
 */
import { spawn } from "node:child_process";
import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { homedir, networkInterfaces } from "node:os";
import path from "node:path";

const ARCHIVO = path.resolve(process.cwd(), "Manual de Catedria.html");
const PUERTO = Number(process.env.PUERTO_MANUAL ?? 4173);
const CLOUDFLARED = path.join(homedir(), ".local", "bin", "cloudflared");

/** La dirección de esta máquina en la red local, para el enlace de la wifi. */
function direccionLocal() {
  for (const interfaces of Object.values(networkInterfaces())) {
    for (const red of interfaces ?? []) {
      if (red.family === "IPv4" && !red.internal) return red.address;
    }
  }
  return "localhost";
}

function servir() {
  const servidor = createServer((peticion, respuesta) => {
    // Cualquier ruta devuelve el manual. No hay nada más que servir, y así un
    // enlace con cualquier cosa detrás sigue llevando al sitio correcto.
    respuesta.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Length": statSync(ARCHIVO).size,
      // Que no se quede una versión vieja cacheada por el camino cuando el
      // manual se regenera.
      "Cache-Control": "no-cache",
    });
    if (peticion.method === "HEAD") return respuesta.end();
    createReadStream(ARCHIVO).pipe(respuesta);
  });

  return new Promise((listo) => servidor.listen(PUERTO, () => listo(servidor)));
}

function abrirTunel() {
  return new Promise((listo, fallo) => {
    if (!existsSync(CLOUDFLARED)) {
      fallo(
        new Error(
          `No encuentro cloudflared en ${CLOUDFLARED}.\n` +
            "  Descárgalo de https://github.com/cloudflare/cloudflared/releases",
        ),
      );
      return;
    }

    const proceso = spawn(CLOUDFLARED, [
      "tunnel",
      "--url",
      `http://localhost:${PUERTO}`,
      "--no-autoupdate",
    ]);

    let resuelto = false;

    // La dirección la escribe cloudflared en su salida de errores, no en la
    // estándar. Se busca ahí.
    const mirar = (datos) => {
      const texto = String(datos);
      const encontrada = texto.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
      if (encontrada && !resuelto) {
        resuelto = true;
        listo({ url: encontrada[0], proceso });
      }
    };

    proceso.stdout.on("data", mirar);
    proceso.stderr.on("data", mirar);

    proceso.on("exit", (codigo) => {
      if (!resuelto) fallo(new Error(`cloudflared ha terminado con código ${codigo}`));
    });

    setTimeout(() => {
      if (!resuelto) fallo(new Error("cloudflared no ha dado dirección en 45 segundos"));
    }, 45_000);
  });
}

async function main() {
  if (!existsSync(ARCHIVO)) {
    console.error(
      "\n✗ No hay manual que publicar.\n" +
        "  Genéralo primero, con la aplicación en marcha:\n\n" +
        "      npm run manual:local\n",
    );
    process.exit(1);
  }

  const megas = statSync(ARCHIVO).size / 1024 / 1024;

  await servir();
  console.log(`\nManual de Catedria · ${megas.toFixed(1)} MB`);
  console.log("=".repeat(62));
  console.log(`  En esta wifi   http://${direccionLocal()}:${PUERTO}`);

  try {
    const { url, proceso } = await abrirTunel();
    console.log(`  Enlace público ${url}`);
    console.log("=".repeat(62));
    console.log("\n  El enlace vive mientras esta ventana esté abierta.");
    console.log("  Ctrl+C para cerrarlo.\n");

    const cerrar = () => {
      proceso.kill();
      process.exit(0);
    };
    process.on("SIGINT", cerrar);
    process.on("SIGTERM", cerrar);
  } catch (error) {
    console.log("=".repeat(62));
    console.log(`\n  Sin enlace público: ${error.message}`);
    console.log("  El de la wifi de arriba sigue funcionando.\n");
  }
}

main();
