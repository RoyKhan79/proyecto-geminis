import { describe, expect, it } from "vitest";
import {
  ALL_PERMISSIONS,
  type Permission,
} from "@/lib/auth/permissions";
import {
  CATALOGO,
  MODULOS,
  MODULOS_NUCLEO,
  MODULO_DE_PERMISO,
  PACKS,
  anadidosPorDependencia,
  arrastraAlQuitar,
  calcularPresupuesto,
  descuentoPorVolumen,
  moduloDelPermiso,
  resolverDependencias,
  TRAMOS,
  TRAMO_DE_REFERENCIA,
  tramoDe,
  type CodigoModulo,
} from "@/lib/modules/catalogo";

/**
 * MÓDULOS Y PRECIOS
 *
 * Esto decide lo que paga una academia, así que un error aquí no es un fallo de
 * pantalla: es una factura mal emitida, o una función que se cobra y no
 * funciona. Se comprueban las dos direcciones.
 */

describe("el catálogo está bien formado", () => {
  it("no hay códigos repetidos ni órdenes repetidos", () => {
    const codigos = CATALOGO.map((m) => m.codigo);
    expect(new Set(codigos).size).toBe(codigos.length);

    const ordenes = CATALOGO.map((m) => m.orden);
    expect(new Set(ordenes).size).toBe(ordenes.length);
  });

  it("todas las dependencias apuntan a módulos que existen", () => {
    for (const modulo of CATALOGO) {
      for (const necesario of modulo.requiere ?? []) {
        expect(MODULOS[necesario], `${modulo.codigo} → ${necesario}`).toBeDefined();
      }
    }
  });

  it("ningún módulo depende de sí mismo", () => {
    for (const modulo of CATALOGO) {
      expect(modulo.requiere ?? []).not.toContain(modulo.codigo);
    }
  });

  it("todos los precios son enteros positivos de céntimos", () => {
    for (const modulo of CATALOGO) {
      expect(Number.isInteger(modulo.precioCents)).toBe(true);
      expect(modulo.precioCents).toBeGreaterThan(0);
    }
  });

  it("hay exactamente un módulo que no se puede quitar", () => {
    expect(MODULOS_NUCLEO).toEqual(["NUCLEO"]);
  });
});

describe("cada permiso pertenece a un módulo", () => {
  /**
   * Esta es la prueba que hace que el sistema de módulos no se quede atrás.
   *
   * Un permiso sin mapear se trata como del núcleo, o sea que su función queda
   * disponible para todo el mundo. Es la opción prudente —olvidarse no rompe
   * nada— pero significa que un módulo nuevo puede acabar regalado sin que
   * nadie lo note. Esto lo hace visible.
   */
  it("los permisos que no son del núcleo están mapeados a propósito", () => {
    const delNucleo: Permission[] = [
      // Personas y estructura: sin esto no hay ERP que vender.
      "students.read", "students.write", "students.delete", "students.notes",
      "teachers.read", "teachers.write", "members.invite",
      "roles.read", "roles.write",
      "oppositions.read", "oppositions.write",
      "courses.read", "courses.write",
      "groups.read", "groups.write",
      "enrollments.read", "enrollments.write",
      "products.read", "products.write", "entitlements.write",
      "imports.run", "imports.rollback",
      "audit.read", "settings.read", "settings.write", "data.export",
      "manager.access",
    ];

    const sinMapear = ALL_PERMISSIONS.filter((p) => !MODULO_DE_PERMISO[p]);
    const inesperados = sinMapear.filter((p) => !delNucleo.includes(p));

    expect(
      inesperados,
      `Permisos nuevos sin módulo: ${inesperados.join(", ")}. ` +
        "Añádelos a MODULO_DE_PERMISO o a la lista del núcleo de esta prueba.",
    ).toEqual([]);
  });

  it("lo no mapeado cae en el núcleo, que es lo prudente", () => {
    expect(moduloDelPermiso("students.read")).toBe("NUCLEO");
    expect(moduloDelPermiso("campus.access")).toBe("CAMPUS");
    expect(moduloDelPermiso("ai.copilot")).toBe("IA");
  });

  it("ningún módulo del catálogo se queda sin permisos que lo activen", () => {
    // Un módulo que no gobierna ningún permiso no se puede hacer cumplir: se
    // cobraría sin que quitarlo cambiara nada.
    const gobernados = new Set(Object.values(MODULO_DE_PERMISO));
    const huerfanos = CATALOGO.filter(
      (m) => !m.esNucleo && !gobernados.has(m.codigo),
    ).map((m) => m.codigo);

    // TAREAS y FACTURACION comparten permisos con AGENDA y COBROS: se
    // comprueban en sus propias acciones, no por el mapa de permisos.
    expect(huerfanos.filter((c) => !["TAREAS", "FACTURACION"].includes(c))).toEqual([]);
  });
});

describe("dependencias", () => {
  it("el núcleo entra siempre, aunque no se pida", () => {
    expect(resolverDependencias([])).toContain("NUCLEO");
  });

  it("facturación arrastra cobros", () => {
    const resuelto = resolverDependencias(["FACTURACION"]);
    expect(resuelto).toContain("COBROS");
    expect(anadidosPorDependencia(["FACTURACION"])).toEqual(["COBROS"]);
  });

  it("la IA arrastra el temario: sin él no tiene nada que citar", () => {
    expect(resolverDependencias(["IA"])).toContain("CONTENIDO");
  });

  it("quitar cobros avisa de que se lleva la facturación", () => {
    const actuales: CodigoModulo[] = ["NUCLEO", "COBROS", "FACTURACION"];
    expect(arrastraAlQuitar("COBROS", actuales)).toEqual(["FACTURACION"]);
  });

  it("quitar algo de lo que no depende nadie no arrastra nada", () => {
    expect(arrastraAlQuitar("ANALITICA", ["NUCLEO", "ANALITICA"])).toEqual([]);
  });

  it("el resultado sale en el orden del catálogo, no en el que se pidió", () => {
    const resuelto = resolverDependencias(["ANALITICA", "CONTENIDO"]);
    const ordenes = resuelto.map((c) => MODULOS[c].orden);
    expect([...ordenes].sort((a, b) => a - b)).toEqual(ordenes);
  });
});

describe("presupuesto", () => {
  it("suma las líneas y no se deja ninguna", () => {
    const p = calcularPresupuesto(["CONTENIDO", "AGENDA"]);
    const suma = p.lineas.reduce((s, l) => s + l.precioCents, 0);
    expect(p.subtotalCents).toBe(suma);
    expect(p.totalCents).toBe(p.subtotalCents - p.descuentoCents);
  });

  it("cobra lo que se va a activar de verdad, dependencias incluidas", () => {
    // Se pide solo facturación; se cobra facturación + cobros + núcleo.
    const p = calcularPresupuesto(["FACTURACION"]);
    expect(p.lineas.map((l) => l.codigo).sort()).toEqual(
      ["COBROS", "FACTURACION", "NUCLEO"].sort(),
    );
  });

  it("un precio pactado gana al de catálogo", () => {
    const p = calcularPresupuesto(["CONTENIDO"], { CONTENIDO: 1000 });
    const linea = p.lineas.find((l) => l.codigo === "CONTENIDO");
    expect(linea?.precioCents).toBe(1000);
    expect(linea?.precioCents).not.toBe(MODULOS.CONTENIDO.precioCents);
  });

  it("todo sale en céntimos enteros", () => {
    // Con decimales, la suma de doce líneas no cuadra con el total y alguien
    // acaba discutiendo un céntimo por teléfono.
    const p = calcularPresupuesto(CATALOGO.map((m) => m.codigo));
    expect(Number.isInteger(p.subtotalCents)).toBe(true);
    expect(Number.isInteger(p.descuentoCents)).toBe(true);
    expect(Number.isInteger(p.totalCents)).toBe(true);
  });

  it("el descuento sube por tramos y nunca baja", () => {
    expect(descuentoPorVolumen(1)).toBe(0);
    expect(descuentoPorVolumen(4)).toBe(0);
    expect(descuentoPorVolumen(5)).toBe(10);
    expect(descuentoPorVolumen(7)).toBe(15);
    expect(descuentoPorVolumen(12)).toBe(20);

    for (let n = 1; n < 20; n += 1) {
      expect(descuentoPorVolumen(n + 1)).toBeGreaterThanOrEqual(descuentoPorVolumen(n));
    }
  });

  it("contratar un módulo más nunca sale más barato que no contratarlo", () => {
    // El descuento por volumen podría, mal calibrado, hacer que añadir un
    // módulo BAJARA el total. Sería absurdo de explicar y regalaría dinero.
    const base: CodigoModulo[] = ["NUCLEO", "CONTENIDO", "EVALUACION", "AGENDA"];
    for (const modulo of CATALOGO) {
      if (base.includes(modulo.codigo)) continue;
      const sin = calcularPresupuesto(base).totalCents;
      const con = calcularPresupuesto([...base, modulo.codigo]).totalCents;
      expect(con, `añadir ${modulo.codigo} abarata el total`).toBeGreaterThanOrEqual(sin);
    }
  });
});

describe("tramo por tamaño de la academia", () => {
  it("cada número cae en un tramo, y en los bordes cae en el de abajo", () => {
    expect(tramoDe(0).codigo).toBe("hasta-50");
    expect(tramoDe(50).codigo).toBe("hasta-50");
    expect(tramoDe(51).codigo).toBe("51-150");
    expect(tramoDe(150).codigo).toBe("51-150");
    expect(tramoDe(151).codigo).toBe("151-350");
    expect(tramoDe(350).codigo).toBe("151-350");
    expect(tramoDe(351).codigo).toBe("351-700");
    expect(tramoDe(700).codigo).toBe("351-700");
    expect(tramoDe(701).codigo).toBe("mas-de-700");
    expect(tramoDe(99999).codigo).toBe("mas-de-700");
  });

  it("un dato corrupto cae en el tramo más barato, nunca en el más caro", () => {
    // Equivocarse cobrando de más por un número roto es mucho peor que
    // equivocarse cobrando de menos: lo segundo se corrige, lo primero se
    // descubre cuando el cliente se va.
    expect(tramoDe(-3).codigo).toBe("hasta-50");
    expect(tramoDe(Number.NaN).codigo).toBe("hasta-50");
    expect(tramoDe(Number.POSITIVE_INFINITY).codigo).toBe("hasta-50");
  });

  it("los tramos están ordenados y no dejan huecos", () => {
    let anterior = -1;
    for (const t of TRAMOS.slice(0, -1)) {
      expect(t.hasta).not.toBeNull();
      expect(t.hasta!).toBeGreaterThan(anterior);
      anterior = t.hasta!;
    }
    expect(TRAMOS[TRAMOS.length - 1].hasta).toBeNull();
  });

  it("sin decir cuántos alumnos hay, no se aplica tramo y se cobra lo de siempre", () => {
    // Es la garantía de que añadir los tramos no ha cambiado el precio de nadie
    // por sorpresa. Un olvido tiene que devolver el precio de referencia.
    const modulos = PACKS.find((p) => p.codigo === "online")!.modulos;
    const sinTramo = calcularPresupuesto(modulos);
    const referencia = calcularPresupuesto(modulos, {}, null, 100);

    expect(sinTramo.tramo).toBeNull();
    expect(sinTramo.baseCents).toBe(sinTramo.subtotalCents);
    expect(referencia.tramo?.codigo).toBe(TRAMO_DE_REFERENCIA.codigo);
    expect(sinTramo.totalCents).toBe(referencia.totalCents);
  });

  it("cuanto más grande la academia, más paga", () => {
    const modulos = CATALOGO.map((m) => m.codigo);
    const totales = [10, 100, 200, 500].map(
      (n) => calcularPresupuesto(modulos, {}, null, n).totalCents,
    );
    for (let i = 1; i < totales.length; i += 1) {
      expect(totales[i]).toBeGreaterThan(totales[i - 1]);
    }
  });

  it("por encima del último tramo el precio es a convenir, no un número inventado", () => {
    const p = calcularPresupuesto(CATALOGO.map((m) => m.codigo), {}, null, 5000);
    expect(p.aConvenir).toBe(true);
    expect(p.tramo?.coeficiente).toBeNull();
  });

  it("la resta cuadra al céntimo y el total sale en euros redondos", () => {
    // Si `base − descuento` no diera el total, la factura tendría un renglón
    // que no sale de los de arriba, y eso se nota.
    for (const n of [10, 100, 200, 500, 5000]) {
      for (const pack of PACKS) {
        const p = calcularPresupuesto(pack.modulos, {}, null, n);
        expect(p.baseCents - p.descuentoCents, `${pack.codigo} · ${n}`).toBe(p.totalCents);
        expect(p.totalCents % 100, `${pack.codigo} · ${n} no es euro redondo`).toBe(0);
      }
    }
  });

  it("los precios que anuncia el manual son los que cobra el programa", () => {
    /*
     * Las cifras de docs/manuales/manual-academias.html están escritas a mano.
     * Esta prueba las ata al código: si alguien cambia el precio de un módulo,
     * un coeficiente o el descuento por volumen, esto falla y avisa de que hay
     * un PDF ahí fuera diciendo otra cosa.
     */
    const esperado: Record<string, [number, number, number, number]> = {
      esencial: [76, 126, 189, 265],
      online: [124, 206, 309, 433],
      completo: [189, 314, 472, 660],
    };
    const alumnosPorTramo = [10, 100, 200, 500];

    for (const [codigo, euros] of Object.entries(esperado)) {
      const pack = PACKS.find((p) => p.codigo === codigo);
      expect(pack, `falta el pack ${codigo}`).toBeDefined();
      alumnosPorTramo.forEach((n, i) => {
        const p = calcularPresupuesto(pack!.modulos, {}, null, n);
        expect(p.totalCents / 100, `${codigo} con ${n} alumnos`).toBe(euros[i]);
      });
    }
  });

  it("la suma de los doce módulos es la que sale en la tarifa", () => {
    const suma = CATALOGO.reduce((s, m) => s + m.precioCents, 0);
    expect(suma).toBe(39300);
  });
});

describe("packs", () => {
  it("todos los packs traen módulos que existen", () => {
    for (const pack of PACKS) {
      for (const codigo of pack.modulos) {
        expect(MODULOS[codigo], `${pack.codigo} → ${codigo}`).toBeDefined();
      }
    }
  });

  it("ningún pack se queda a medias de sus dependencias", () => {
    for (const pack of PACKS) {
      expect(
        resolverDependencias(pack.modulos).sort(),
        `el pack ${pack.codigo} necesita módulos que no incluye`,
      ).toEqual([...new Set(pack.modulos)].sort());
    }
  });

  it("el pack completo es el catálogo entero", () => {
    const completo = PACKS.find((p) => p.codigo === "completo");
    expect(completo?.modulos.length).toBe(CATALOGO.length);
  });
});
