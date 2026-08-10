import { describe, expect, it } from "vitest";
import {
  DEFAULT_FLAGS,
  ancestorIds,
  grantsCover,
  resolveFlags,
  studentCanAccessNode,
  studentNodeWhere,
  type NodeForAccess,
  type StudentGrants,
} from "@/lib/access/content-access";

/**
 * MOTOR DE ACCESO A CONTENIDO
 *
 * Comprueba el escenario que pide el negocio: packs distintos sobre el mismo
 * temario. Quien compra "solo tests" no puede llegar al temario ni por la
 * interfaz ni preguntándole a la IA, porque ambas usan estas mismas funciones.
 */

const TEMARIO = "temario";
const TESTS = "tests";

function nodo(
  id: string,
  path: string,
  extra: Partial<NodeForAccess> = {},
): NodeForAccess {
  return {
    id,
    path,
    editionId: "ed-1",
    isFree: false,
    visibleToStudents: true,
    status: "PUBLISHED",
    ...extra,
  };
}

function derechos(
  ramas: { nodeId: string; path: string; capabilities: string[] }[],
): StudentGrants {
  return {
    prefixes: ramas.map((rama) => ({
      nodeId: rama.nodeId,
      prefix: `${rama.path}${rama.nodeId}/`,
      capabilities: new Set(rama.capabilities as never[]),
    })),
    editionIds: new Set<string>(),
    editionCapabilities: new Map(),
  };
}

describe("cobertura por ramas", () => {
  const soloTests = derechos([
    { nodeId: TESTS, path: "/", capabilities: ["VIEW_CONTENT", "TAKE_TESTS"] },
  ]);

  it("da acceso al nodo concedido", () => {
    expect(grantsCover(soloTests, nodo(TESTS, "/"), "VIEW_CONTENT")).toBe(true);
  });

  it("da acceso a los descendientes del nodo concedido", () => {
    const hijo = nodo("test-tema-1", `/${TESTS}/`);
    expect(grantsCover(soloTests, hijo, "VIEW_CONTENT")).toBe(true);

    const nieto = nodo("pregunta-1", `/${TESTS}/test-tema-1/`);
    expect(grantsCover(soloTests, nieto, "VIEW_CONTENT")).toBe(true);
  });

  it("NO da acceso a una rama hermana no contratada", () => {
    const tema = nodo("tema-8", `/${TEMARIO}/bloque-2/`);
    expect(grantsCover(soloTests, tema, "VIEW_CONTENT")).toBe(false);
    expect(studentCanAccessNode(soloTests, tema)).toBe(false);
  });

  it("distingue entre capacidades sobre la misma rama", () => {
    const hijo = nodo("test-tema-1", `/${TESTS}/`);
    expect(grantsCover(soloTests, hijo, "TAKE_TESTS")).toBe(true);
    // Ver el contenido no implica poder descargarlo (§113).
    expect(grantsCover(soloTests, hijo, "DOWNLOAD_CONTENT")).toBe(false);
  });

  it("no confunde ramas cuyo identificador empieza igual", () => {
    // "/tests/" no debe cubrir un nodo colgado de "/tests-premium/".
    const otro = nodo("x", "/tests-premium/");
    expect(grantsCover(soloTests, otro, "VIEW_CONTENT")).toBe(false);
  });
});

describe("contenido de muestra", () => {
  const sinDerechos: StudentGrants = {
    prefixes: [],
    editionIds: new Set(),
    editionCapabilities: new Map(),
  };

  it("un nodo libre se puede ver sin haber pagado", () => {
    expect(studentCanAccessNode(sinDerechos, nodo("t1", "/x/", { isFree: true }))).toBe(
      true,
    );
  });

  it("un nodo libre NO se puede descargar por serlo", () => {
    const libre = nodo("t1", "/x/", { isFree: true });
    expect(studentCanAccessNode(sinDerechos, libre, "DOWNLOAD_CONTENT")).toBe(false);
  });

  it("un borrador nunca es visible aunque sea libre", () => {
    const borrador = nodo("t1", "/x/", { isFree: true, status: "DRAFT" });
    expect(studentCanAccessNode(sinDerechos, borrador)).toBe(false);
  });

  it("un nodo oculto al alumnado no se ve aunque haya derecho", () => {
    const oculto = nodo(TESTS, "/", { visibleToStudents: false });
    const conDerecho = derechos([
      { nodeId: TESTS, path: "/", capabilities: ["VIEW_CONTENT"] },
    ]);
    expect(studentCanAccessNode(conDerecho, oculto)).toBe(false);
  });
});

describe("filtro para consultas", () => {
  it("genera un filtro que exige publicación y visibilidad", () => {
    const filtro = studentNodeWhere(
      derechos([{ nodeId: TESTS, path: "/", capabilities: ["VIEW_CONTENT"] }]),
    );
    expect(filtro.status).toBe("PUBLISHED");
    expect(filtro.visibleToStudents).toBe(true);
    expect(filtro.OR.length).toBeGreaterThan(1);
  });

  it("sin derechos, solo deja pasar el contenido libre", () => {
    const filtro = studentNodeWhere({
      prefixes: [],
      editionIds: new Set(),
      editionCapabilities: new Map(),
    });
    expect(filtro.OR).toEqual([{ isFree: true }]);
  });
});

describe("banderas heredadas", () => {
  const base = {
    downloadable: null,
    aiEnabled: null,
    usableForTests: null,
    watermark: null,
    trackLegislation: null,
  };

  it("aplica los valores por defecto cuando nadie define nada", () => {
    const resultado = resolveFlags({ id: "n", path: "/", ...base }, []);
    expect(resultado).toEqual(DEFAULT_FLAGS);
  });

  it("hereda del ancestro más cercano", () => {
    const resultado = resolveFlags(
      { id: "tema", path: "/seccion/bloque/", ...base },
      [
        { id: "seccion", path: "/", ...base, downloadable: true },
        { id: "bloque", path: "/seccion/", ...base, downloadable: false },
      ],
    );
    expect(resultado.downloadable).toBe(false);
  });

  it("el propio nodo gana a sus ancestros", () => {
    const resultado = resolveFlags(
      { id: "tema", path: "/seccion/", ...base, aiEnabled: false },
      [{ id: "seccion", path: "/", ...base, aiEnabled: true }],
    );
    expect(resultado.aiEnabled).toBe(false);
  });

  it("por defecto no se puede descargar", () => {
    expect(DEFAULT_FLAGS.downloadable).toBe(false);
  });
});

describe("utilidades de ruta", () => {
  it("extrae los ancestros en orden", () => {
    expect(ancestorIds("/a/b/c/")).toEqual(["a", "b", "c"]);
    expect(ancestorIds("/")).toEqual([]);
  });
});
