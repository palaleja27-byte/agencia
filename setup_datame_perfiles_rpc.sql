-- ═══════════════════════════════════════════════════════════════
-- AGENCIA RR: RPC SECURITY DEFINER PARA SINCRONIZAR PERFILES (CORREGIDA)
-- ─ Remueve la columna 'created_at' que no existe en datame_perfiles.
-- ─ Ejecutar en Supabase → SQL Editor → Run
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION upsert_datame_perfiles_batch(records jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER                  -- ← Permite bypass de RLS al correr como owner
SET search_path = public
AS $$
DECLARE
    rec     jsonb;
    counter int := 0;
BEGIN
    FOR rec IN SELECT * FROM jsonb_array_elements(records)
    LOOP
        INSERT INTO datame_perfiles (id_datame, modelo, panel_id, activo)
        VALUES (
            rec->>'id_datame',
            rec->>'modelo',
            (rec->>'panel_id')::bigint,
            (rec->>'activo')::boolean
        )
        ON CONFLICT (id_datame) DO UPDATE SET
            modelo     = EXCLUDED.modelo,
            panel_id   = EXCLUDED.panel_id,
            activo     = EXCLUDED.activo;
        counter := counter + 1;
    END LOOP;

    RETURN jsonb_build_object('inserted', counter, 'status', 'ok');
END;
$$;

-- Otorgar permisos de ejecución al rol público/anon
GRANT EXECUTE ON FUNCTION upsert_datame_perfiles_batch(jsonb) TO anon;
GRANT EXECUTE ON FUNCTION upsert_datame_perfiles_batch(jsonb) TO authenticated;

SELECT 'OK: Función upsert_datame_perfiles_batch corregida y expuesta.' AS status;
