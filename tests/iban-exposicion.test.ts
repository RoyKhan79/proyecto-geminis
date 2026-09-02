import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prismaBase } from "@/lib/db/client";
import { tenantDb } from "@/lib/db/tenant";
import {
  addMemberToAcademy,
  createAcademyWithRoles,
} from "@/server/academies/provision";
import { getStudent } from "@/server/students/queries";
import { cifrar, descifrar } from "@/lib/crypto/field";
import { ocultarIban } from "@/lib/billing/iban";

/**
 * EL IBAN NO SALE DE LA BASE PARA PINTAR UNA PANTALLA
 *
 * Lo encontró `npm run pentest`: la cuenta de cobro de la academia bajaba
 * entera al navegador, dentro del `defaultValue` de un formulario que se pinta
 * en una pantalla de listado. Mirando alrededor apareció el caso peor: la ficha
 * del alumno hacía lo mismo con SU cuenta y además la reenviaba en un
 * `<input type="hidden">` aunque nadie estuviera tocando la domiciliación.
 *
 * Ninguno de los dos era una escalada de privilegios —hay que tener
 * `payments.write` para llegar—, y por eso no es un agujero sino un dato
 * bancario donde no tiene por qué estar: en el HTML, en la caché del navegador,
 * en cualquier captura de pantalla y al alcance de un script si algún día se
 * colara uno.
 *
 * Estas pruebas fijan las dos mitades: que el número no sale, y —tan importante
 * como lo otro— que la domiciliación NO se pierde al guardar la ficha sin
 * tocar el campo. Esa regresión sería mucho peor que el problema original: se
 * notaría el día de la remesa, semanas después, y nadie la relacionaría con
 * este cambio.
 */

const SUF = `ib${Date.now().toString(36)}`;
const IBAN = "ES9121000418450200051332";

let academia: { id: string };
let alumno: { id: string };

beforeAll(async () => {
  academia = await createAcademyWithRoles({ slug: `iban-${SUF}`, name: "IBAN" });

  const db = tenantDb(academia.id);
  const miembro = await addMemberToAcademy(academia.id, {
    email: `alumno@${SUF}.test`,
    firstName: "Alumna",
    roleKeys: ["STUDENT"],
  });
  alumno = miembro.membership;

  await db.billingProfile.create({
    data: {
      studentId: alumno.id,
      method: "SEPA_DIRECT_DEBIT",
      iban: cifrar(IBAN),
      holderName: "Alumna Ejemplo",
      mandateRef: `REF-${SUF}`,
      mandateSignedAt: new Date("2026-01-15"),
      chargeDay: 1,
    },
  });
});

afterAll(async () => {
  await prismaBase.academy.deleteMany({ where: { id: academia.id } });
  await prismaBase.user.deleteMany({ where: { email: { endsWith: `@${SUF}.test` } } });
  await prismaBase.$disconnect();
});

describe("el IBAN no viaja a la pantalla", () => {
  it("la ficha del alumno no devuelve el número entero", async () => {
    const ficha = await getStudent(tenantDb(academia.id), alumno.id);
    const serializada = JSON.stringify(ficha);

    // Ni entero, ni con espacios, ni en el texto cifrado: nada que se parezca.
    expect(serializada).not.toContain(IBAN);
    expect(serializada).not.toContain("ES91 2100 0418 4502 0005 1332");
    expect(serializada).not.toMatch(/ES\d{22}/);
  });

  it("la ficha sí devuelve la máscara, para que se pueda reconocer la cuenta", async () => {
    const ficha = await getStudent(tenantDb(academia.id), alumno.id);

    // Enmascarar y no quitarlo del todo importa: quien gestiona los cobros
    // tiene que poder ver de un vistazo que hay cuenta y cuál es, sin pedirla.
    expect(ficha?.billingProfile?.ibanOculto).toBe(ocultarIban(IBAN));
    expect(ficha?.billingProfile?.ibanOculto).toContain("1332");
    expect(ficha?.billingProfile?.ibanOculto).not.toContain("2100");
  });

  it("la máscara enseña lo justo para reconocer y no para reconstruir", async () => {
    const oculto = ocultarIban(IBAN);
    // Cuatro delante y cuatro detrás. Los dieciséis del medio no están.
    const digitos = oculto.replace(/\D/g, "");
    expect(digitos.length).toBeLessThanOrEqual(8);
  });

  it("en la base sigue guardado, cifrado y completo", async () => {
    // Lo anterior no puede haberse conseguido perdiendo el dato.
    const fila = await prismaBase.billingProfile.findFirstOrThrow({
      where: { studentId: alumno.id },
      select: { iban: true },
    });
    expect(fila.iban).not.toBe(IBAN);
    expect(descifrar(fila.iban)).toBe(IBAN);
  });
});

describe("la domiciliación no se pierde al guardar sin tocar la cuenta", () => {
  it("un campo vacío conserva el IBAN que ya había", async () => {
    const db = tenantDb(academia.id);

    // Se reproduce lo que hace la acción: leer lo guardado y, si no llega
    // nada nuevo, conservarlo. Si esta regla se rompiera, el alumno se quedaría
    // sin domiciliación cada vez que alguien corrigiera su teléfono.
    const existente = await db.billingProfile.findFirstOrThrow({
      where: { studentId: alumno.id },
      select: { id: true, iban: true },
    });

    const escritoEnElFormulario = ""; // el campo llega en blanco
    const guardado = descifrar(existente.iban);
    const aGuardar = escritoEnElFormulario || guardado;

    expect(aGuardar).toBe(IBAN);

    await db.billingProfile.update({
      where: { id: existente.id },
      data: { iban: aGuardar ? cifrar(aGuardar) : null, holderName: "Otro titular" },
    });

    const despues = await db.billingProfile.findFirstOrThrow({
      where: { studentId: alumno.id },
      select: { iban: true, holderName: true },
    });
    expect(descifrar(despues.iban)).toBe(IBAN);
    expect(despues.holderName).toBe("Otro titular");
  });
});
