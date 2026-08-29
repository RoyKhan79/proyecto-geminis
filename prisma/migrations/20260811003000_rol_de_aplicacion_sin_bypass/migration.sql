-- ROL DE APLICACIÓN SIN PRIVILEGIOS DE SUPERUSUARIO
--
-- Por qué existe esta migración, dicho sin rodeos: la migración anterior activó
-- Row Level Security en las 50 tablas de academia, y **no protegía nada**. La
-- aplicación se conectaba con el rol dueño de las tablas, que además era
-- superusuario, y un superusuario se salta RLS siempre, incluso con FORCE.
--
-- Se detectó al escribir la prueba que intentaba leer datos de otra academia
-- con una consulta cruda: los leía todos. Es exactamente el motivo por el que
-- una medida de seguridad no se da por buena hasta que se ha intentado romper.
--
-- La solución es separar dos roles:
--
--   · el DUEÑO de las tablas, que ejecuta las migraciones y no toca datos en
--     caliente;
--   · el rol de APLICACIÓN, que es con el que se conecta el servidor web y que
--     NO es superusuario, NO es dueño y NO tiene BYPASSRLS. Sobre él sí actúan
--     las políticas.
--
-- La contraseña del rol se fija fuera de la migración: aquí no se escriben
-- secretos. En desarrollo la pone `scripts/dev-db.sh`; en producción, quien
-- despliega.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'geminis_app') THEN
    CREATE ROLE "geminis_app" WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE
      NOINHERIT NOREPLICATION NOBYPASSRLS;
  ELSE
    -- Si ya existía, se le quitan los privilegios que anulan RLS. Que exista no
    -- garantiza que esté bien configurado.
    ALTER ROLE "geminis_app" WITH NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
  END IF;
END
$$;

-- Permisos mínimos: leer y escribir datos, nada de cambiar la estructura.
DO $$
BEGIN
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO %I', current_database(), 'geminis_app');
END
$$;
GRANT USAGE ON SCHEMA "public" TO "geminis_app";
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA "public" TO "geminis_app";
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA "public" TO "geminis_app";

-- Y lo mismo para las tablas que creen las migraciones futuras, para que nadie
-- tenga que acordarse de repetir este GRANT.
ALTER DEFAULT PRIVILEGES IN SCHEMA "public"
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO "geminis_app";
ALTER DEFAULT PRIVILEGES IN SCHEMA "public"
  GRANT USAGE, SELECT ON SEQUENCES TO "geminis_app";

-- La tabla de migraciones de Prisma no la toca la aplicación. Va dentro de un
-- DO porque en la base de sombra que usa `prisma migrate dev` esa tabla todavía
-- no existe cuando se aplica esta migración.
DO $$
BEGIN
  IF to_regclass('public._prisma_migrations') IS NOT NULL THEN
    REVOKE ALL ON TABLE "_prisma_migrations" FROM "geminis_app";
  END IF;
END
$$;
