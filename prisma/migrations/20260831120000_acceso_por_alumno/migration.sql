-- Acceso concedido a mano, por alumno y por convocatoria.
--
-- Hasta aquí el acceso solo se podía derivar de una matrícula: la academia no
-- tenía forma de decir «a este alumno le abro los tests de Administrativo 2026»
-- sin matricularlo en un curso. El alcance de un derecho ya podía apuntar a un
-- tema suelto o a un curso; le faltaba poder apuntar a la convocatoria entera,
-- que es justo como razona el motor de acceso.

-- DropIndex
DROP INDEX "entitlement_scopes_entitlementId_nodeId_courseId_capability_key";

-- AlterTable
ALTER TABLE "entitlement_scopes" ADD COLUMN     "editionId" TEXT;

-- CreateIndex
CREATE INDEX "entitlement_scopes_editionId_idx" ON "entitlement_scopes"("editionId");

-- CreateIndex
CREATE UNIQUE INDEX "entitlement_scopes_entitlementId_nodeId_courseId_editionId__key" ON "entitlement_scopes"("entitlementId", "nodeId", "courseId", "editionId", "capability");

-- AddForeignKey
ALTER TABLE "entitlement_scopes" ADD CONSTRAINT "entitlement_scopes_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "opposition_editions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

