-- DESCUENTO PACTADO CON UNA ACADEMIA
--
-- Por defecto el descuento sale del número de módulos contratados. Cuando se
-- llega a un acuerdo distinto, se escribe aquí y manda sobre el automático.
--
-- Es nullable y no cero por defecto a propósito: hay que poder distinguir «no
-- se ha pactado nada, aplica el de volumen» de «se pactó que no hubiera
-- descuento», que es un acuerdo real cuando los precios de línea ya se han
-- negociado a la baja.
ALTER TABLE "academies" ADD COLUMN "moduleDiscountPercent" INTEGER;
