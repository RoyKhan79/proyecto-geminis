-- EL RADAR TAMBIÉN MIRA LA SECCIÓN I DEL BOE
--
-- Hasta ahora solo leía «II.B Oposiciones y concursos». Las leyes cambian en
-- «I. Disposiciones generales», que nadie miraba: una academia se enteraba de
-- que habían modificado la Ley 39/2015 cuando se lo decía un alumno.
--
-- La alerta de cambio necesita saber de qué anuncio del BOE viene, y no por
-- trazabilidad: por repetición. El sumario de un día no cambia, así que sin un
-- identificador una modificación publicada el lunes abriría una alerta nueva
-- cada vez que se reprocesara ese día.

ALTER TABLE "legislation_change_alerts"
  ADD COLUMN "officialId" TEXT,
  ADD COLUMN "officialUrl" TEXT;

-- Una alerta por norma y anuncio. En PostgreSQL dos filas con NULL no chocan
-- entre sí, así que esto no limita en absoluto las alertas que registra una
-- persona a mano, que llevan el identificador vacío.
CREATE UNIQUE INDEX "legislation_change_alerts_legislationId_officialId_key"
  ON "legislation_change_alerts" ("legislationId", "officialId");
