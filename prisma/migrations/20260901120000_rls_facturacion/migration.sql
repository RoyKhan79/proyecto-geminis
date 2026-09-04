-- LA SEGUNDA BARRERA LLEGA TAMBIÉN A LA FACTURACIÓN
--
-- En agosto de 2026 se activó Row Level Security sobre las 50 tablas que
-- entonces tenían datos de academia. Después llegaron la facturación, las
-- remesas y los cobros recurrentes, cada uno con su migración, y ninguna de
-- ellas activó RLS sobre las tablas nuevas.
--
-- Resultado: durante meses, las seis tablas con los datos MÁS sensibles del
-- producto —los números de cuenta del alumnado, los mandatos SEPA, las facturas
-- y su numeración— eran justamente las únicas que dependían de una sola
-- barrera. La guardia de aplicación seguía filtrando, así que no se llegó a
-- filtrar nada; pero la promesa escrita en docs/SECURITY_MODEL.md era de dos
-- barreras, y ahí había una.
--
-- Es un fallo previsible y por eso conviene decir cómo se evita en adelante:
-- una tabla con `academyId` sin política es algo que hay que poder detectar sin
-- acordarse. Hay una prueba que compara el esquema de Prisma con las políticas
-- reales y falla si aparece una tabla nueva sin cubrir (tests/rls.test.ts), y
-- la comprobación de despliegue cuenta las políticas antes de dejar arrancar.
--
-- Las políticas son idénticas a las de la migración original, con el mismo
-- criterio: cuando `catedria.academy_id` no está fijada —migraciones, semillas,
-- consola de plataforma, autenticación— se deja pasar, porque esos usos son
-- deliberados y se revisan uno a uno.
--
-- FORCE es imprescindible: el dueño de la tabla se salta RLS si no se fuerza.

DO $$
DECLARE
  tabla text;
BEGIN
  FOREACH tabla IN ARRAY ARRAY[
    'billing_profiles',
    'recurring_charges',
    'direct_debit_runs',
    'invoice_series',
    'invoices',
    'invoice_lines'
  ]
  LOOP
    -- Si una migración futura renombra una tabla, esto no puede tumbar el
    -- despliegue entero: se salta y la prueba de cobertura lo cantará.
    IF to_regclass(format('public.%I', tabla)) IS NULL THEN
      RAISE WARNING 'RLS: la tabla % no existe, se omite', tabla;
      CONTINUE;
    END IF;

    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tabla);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', tabla);
    EXECUTE format('DROP POLICY IF EXISTS "aislamiento_academia" ON %I', tabla);
    EXECUTE format($politica$
      CREATE POLICY "aislamiento_academia" ON %I
        USING (
          "academyId" = current_setting('catedria.academy_id', true)
          OR coalesce(current_setting('catedria.academy_id', true), '') = ''
        )
        WITH CHECK (
          "academyId" = current_setting('catedria.academy_id', true)
          OR coalesce(current_setting('catedria.academy_id', true), '') = ''
        )
    $politica$, tabla);
  END LOOP;
END
$$;

-- El rol de aplicación necesita poder leer y escribir en ellas. Los privilegios
-- por defecto de la migración del rol ya lo cubren para las tablas creadas
-- después, pero repetirlo aquí no cuesta nada y cierra el caso de una base
-- donde aquella migración se aplicara con otro rol.
GRANT SELECT, INSERT, UPDATE, DELETE ON
  "billing_profiles", "recurring_charges", "direct_debit_runs",
  "invoice_series", "invoices", "invoice_lines"
TO "catedria_app";
