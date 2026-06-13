-- Sprint 4.1B — Seguridad documental
-- Owner-only policies sobre storage.objects para los buckets sensibles legacy.

DO $$
DECLARE
  b text;
  buckets text[] := ARRAY[
    'facturas',
    'contratos',
    'incidencia-documentos',
    'incidencia-archivos',
    'inquilino-documentos'
  ];
BEGIN
  FOREACH b IN ARRAY buckets LOOP
    -- SELECT
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', 'owner_' || replace(b,'-','_') || '_select');
    EXECUTE format($pol$
      CREATE POLICY %I ON storage.objects
      FOR SELECT TO authenticated
      USING (bucket_id = %L AND (storage.foldername(name))[1] = auth.uid()::text)
    $pol$, 'owner_' || replace(b,'-','_') || '_select', b);

    -- INSERT
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', 'owner_' || replace(b,'-','_') || '_insert');
    EXECUTE format($pol$
      CREATE POLICY %I ON storage.objects
      FOR INSERT TO authenticated
      WITH CHECK (bucket_id = %L AND (storage.foldername(name))[1] = auth.uid()::text)
    $pol$, 'owner_' || replace(b,'-','_') || '_insert', b);

    -- UPDATE
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', 'owner_' || replace(b,'-','_') || '_update');
    EXECUTE format($pol$
      CREATE POLICY %I ON storage.objects
      FOR UPDATE TO authenticated
      USING (bucket_id = %L AND (storage.foldername(name))[1] = auth.uid()::text)
      WITH CHECK (bucket_id = %L AND (storage.foldername(name))[1] = auth.uid()::text)
    $pol$, 'owner_' || replace(b,'-','_') || '_update', b, b);

    -- DELETE
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', 'owner_' || replace(b,'-','_') || '_delete');
    EXECUTE format($pol$
      CREATE POLICY %I ON storage.objects
      FOR DELETE TO authenticated
      USING (bucket_id = %L AND (storage.foldername(name))[1] = auth.uid()::text)
    $pol$, 'owner_' || replace(b,'-','_') || '_delete', b);
  END LOOP;
END $$;
