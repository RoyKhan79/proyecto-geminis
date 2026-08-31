-- Cobro con tarjeta por Redsys, con las credenciales de cada academia.
--
-- El TPV es de la academia, no de la plataforma: cada una cobra en su comercio
-- y el dinero cae en su cuenta. La clave del comercio se guarda cifrada en
-- columna, como el IBAN: con ella se firma cualquier cobro.

-- AlterTable
ALTER TABLE "academies" ADD COLUMN     "redsysLive" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "redsysMerchantCode" TEXT,
ADD COLUMN     "redsysSecretKey" TEXT,
ADD COLUMN     "redsysTerminal" TEXT DEFAULT '001';

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "gatewayOrder" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "payments_gatewayOrder_key" ON "payments"("gatewayOrder");

