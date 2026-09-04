-- BÚSQUEDA DE TEXTO EN ESPAÑOL PARA CATEDRIA IA
--
-- Hasta ahora la recuperación traía 400 fragmentos a la aplicación y los
-- puntuaba en JavaScript comparando palabras sueltas. Dos problemas:
--
--   1. Con más de 400 fragmentos indexados se buscaba en un trozo arbitrario
--      del material y nadie se enteraba. Una academia con temario de verdad
--      pasa de 400 enseguida.
--   2. La comparación era por palabra exacta, con un apaño de prefijo de cinco
--      letras. «plazos» no encontraba «plazo», «recurrir» no encontraba
--      «recurso» y «administracion» sin tilde no encontraba nada.
--
-- Se resuelve dentro de la base, que es donde están los datos: PostgreSQL trae
-- un lematizador de español y sabe ordenar por relevancia.

CREATE EXTENSION IF NOT EXISTS unaccent;

-- Una configuración propia: la de español que trae PostgreSQL, más `unaccent`
-- delante del lematizador. Sin eso, escribir sin tildes —que es lo que hace
-- todo el mundo con prisa— no encuentra nada.
DROP TEXT SEARCH CONFIGURATION IF EXISTS catedria_es;
CREATE TEXT SEARCH CONFIGURATION catedria_es (COPY = spanish);
ALTER TEXT SEARCH CONFIGURATION catedria_es
  ALTER MAPPING FOR
    asciiword, asciihword, hword_asciipart, word, hword, hword_part
  WITH unaccent, spanish_stem;

-- El índice va sobre la expresión y no sobre una columna generada, para no
-- meter en la tabla una columna que Prisma no sabe representar.
CREATE INDEX IF NOT EXISTS document_chunks_busqueda_idx
  ON document_chunks
  USING GIN (to_tsvector('catedria_es', content));

-- Y trigramas para los nombres propios y los números de artículo, donde el
-- lematizador no ayuda y una errata sí duele: «articulo 103» / «art. 103».
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS document_chunks_trigramas_idx
  ON document_chunks
  USING GIN (content gin_trgm_ops);
