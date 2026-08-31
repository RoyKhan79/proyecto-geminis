-- Cuándo y a quién se envió cada factura.
--
-- Hasta ahora emitir era el final del camino: la factura quedaba guardada y
-- nadie se enteraba. Al mandarla por correo hay que poder decir si salió y a
-- qué dirección, porque «no me ha llegado» es una conversación que ocurre.

-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "sentAt" TIMESTAMP(3),
ADD COLUMN     "sentTo" TEXT;

