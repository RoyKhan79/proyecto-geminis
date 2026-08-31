-- Avisos de impago: cuándo reclamar y cuándo cortar.
--
-- Reclamar un recibo era un trabajo manual que nadie hace todos los días, y el
-- acceso se cortaba a mano o no se cortaba. Los ajustes van por academia porque
-- una que cobra 30 € al mes y otra que cobra 300 no esperan lo mismo antes de
-- insistir, y las marcas van en el recibo para no mandar el mismo aviso a
-- diario al mismo alumno.

-- AlterTable
ALTER TABLE "academies" ADD COLUMN     "dunningEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "dunningEveryDays" INTEGER NOT NULL DEFAULT 7,
ADD COLUMN     "dunningFirstDays" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN     "dunningSuspendDays" INTEGER NOT NULL DEFAULT 30;

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "lastReminderAt" TIMESTAMP(3),
ADD COLUMN     "reminderCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "suspendedAt" TIMESTAMP(3);

