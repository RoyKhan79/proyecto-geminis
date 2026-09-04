-- MÓDULOS CONTRATADOS POR CADA ACADEMIA
--
-- Una academia contrata las partes que necesita, y cada parte tiene su precio.
-- El catálogo vive en el código (src/lib/modules/catalogo.ts); aquí se guarda
-- qué tiene cada academia y a qué precio, que puede no ser el de catálogo
-- porque los precios se negocian.

-- CreateEnum
CREATE TYPE "ModuleCode" AS ENUM (
  'NUCLEO', 'CONTENIDO', 'EVALUACION', 'TAREAS', 'AGENDA', 'COBROS',
  'FACTURACION', 'COMUNICACION', 'CAMPUS', 'IA', 'ANALITICA', 'NORMATIVA'
);

-- CreateTable
CREATE TABLE "academy_modules" (
    "id" TEXT NOT NULL,
    "academyId" TEXT NOT NULL,
    "module" "ModuleCode" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "priceCents" INTEGER,
    "activatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deactivatedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "academy_modules_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "academy_modules_academyId_module_key"
  ON "academy_modules"("academyId", "module");
CREATE INDEX "academy_modules_academyId_active_idx"
  ON "academy_modules"("academyId", "active");

ALTER TABLE "academy_modules" ADD CONSTRAINT "academy_modules_academyId_fkey"
  FOREIGN KEY ("academyId") REFERENCES "academies"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- La segunda barrera, igual que en el resto de tablas con academyId. Aquí
-- además importa por otro motivo: si una academia pudiera escribir en esta
-- tabla, se activaría los módulos que quisiera.
ALTER TABLE "academy_modules" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "academy_modules" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "aislamiento_academia" ON "academy_modules";
CREATE POLICY "aislamiento_academia" ON "academy_modules"
  USING (
    "academyId" = current_setting('catedria.academy_id', true)
    OR coalesce(current_setting('catedria.academy_id', true), '') = ''
  )
  WITH CHECK (
    "academyId" = current_setting('catedria.academy_id', true)
    OR coalesce(current_setting('catedria.academy_id', true), '') = ''
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON "academy_modules" TO catedria_app;

-- ── Las academias que ya existen se quedan con todo ──────────────────────────
--
-- Es lo único honesto: nadie contrató módulos porque no existían, y quitarles
-- funciones que ya usaban por una migración sería cambiarles el trato sin
-- avisar. Desde ahora, lo que se contrata se elige.
INSERT INTO "academy_modules" ("id", "academyId", "module", "active", "notes", "updatedAt")
SELECT
  gen_random_uuid()::text,
  a."id",
  m."code"::"ModuleCode",
  true,
  'Activado en la migración: la academia ya usaba el producto completo.',
  CURRENT_TIMESTAMP
FROM "academies" a
CROSS JOIN (VALUES
  ('NUCLEO'), ('CONTENIDO'), ('EVALUACION'), ('TAREAS'), ('AGENDA'),
  ('COBROS'), ('FACTURACION'), ('COMUNICACION'), ('CAMPUS'), ('IA'),
  ('ANALITICA'), ('NORMATIVA')
) AS m("code")
WHERE a."deletedAt" IS NULL;
