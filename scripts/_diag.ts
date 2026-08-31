import { chromium } from "playwright";

async function main() {
  const b = await chromium.launch({ channel: "chrome" });
  const c = await b.newContext({ viewport: { width: 1440, height: 950 }, locale: "es-ES" });
  const p = await c.newPage();

  const errores: string[] = [];
  const fallos: string[] = [];
  p.on("pageerror", (e) => errores.push(String(e).slice(0, 120)));
  p.on("response", (r) => {
    if (r.status() >= 400) fallos.push(`${r.status()} ${r.url().slice(0, 80)}`);
  });

  await p.goto("http://localhost:3100/entrar", { waitUntil: "networkidle" });
  await p.fill('input[name="email"]', "admin@academiademo.test");
  await p.fill('input[name="password"]', "Geminis2026!");
  await p.click('button[type="submit"]');
  await p.waitForURL((u) => !u.pathname.startsWith("/entrar"), { timeout: 20000 });

  for (const ruta of ["/gestion/alumnos", "/gestion/alumnos/nuevo", "/gestion/tareas"]) {
    errores.length = 0;
    fallos.length = 0;
    await p.goto("http://localhost:3100" + ruta, { waitUntil: "networkidle" });
    await p.waitForTimeout(900);
    const h1 = await p.locator("h1").first().textContent().catch(() => null);
    console.log(
      `${ruta.padEnd(24)} → ${new URL(p.url()).pathname} · h1="${(h1 ?? "").trim().slice(0, 30)}" · errores JS: ${errores.length} · 4xx/5xx: ${fallos.length}`,
    );
    for (const e of errores.slice(0, 2)) console.log("      JS:", e);
    for (const f of fallos.slice(0, 2)) console.log("      HTTP:", f);
  }

  // ¿Se puede pinchar en un alumno?
  await p.goto("http://localhost:3100/gestion/alumnos", { waitUntil: "networkidle" });
  const enlaces = await p.locator('a[href^="/gestion/alumnos/"]').count();
  console.log(`\nenlaces a fichas de alumno en el listado: ${enlaces}`);
  if (enlaces > 0) {
    await p.locator('a[href^="/gestion/alumnos/"]').first().click();
    await p.waitForLoadState("networkidle");
    console.log("tras pinchar →", new URL(p.url()).pathname);
  }

  await b.close();
}

main();
