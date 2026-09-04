-- El índice de trigramas pasa a llamarse como Prisma lo nombra.
--
-- Se creó a mano en la migración de la búsqueda, y eso lo dejaba fuera del
-- esquema: `prisma migrate diff` proponía un DROP INDEX, así que la primera
-- vez que alguien ejecutara `prisma migrate dev` la búsqueda aproximada se
-- habría quedado sin índice sin que saltara nada.
--
-- Ahora está declarado en `ai.prisma` y solo hacía falta que el nombre
-- coincidiera con el que Prisma genera.
ALTER INDEX IF EXISTS "document_chunks_trigramas_idx"
  RENAME TO "document_chunks_content_idx";
