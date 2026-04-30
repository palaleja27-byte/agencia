-- ═══════════════════════════════════════════════════════════════
-- AGENCIA RR: PRIVILEGE ESCALATION VÍA SECURITY DEFINER
-- ─ Esta función corre como OWNER (superuser) sin importar
--   qué key la invoca. Bypassea RLS al 100%.
-- ─ Ejecutar en Supabase → SQL Editor → Run
-- ═══════════════════════════════════════════════════════════════

-- 1. Asegurar que la tabla existe
CREATE TABLE IF NOT EXISTS tableau_data (
    perfil_id  TEXT          PRIMARY KEY,
    valor      NUMERIC(12,2) DEFAULT 0,
    data_json  JSONB,
    updated_at TIMESTAMPTZ   DEFAULT now()
);

-- 2. Habilitar RLS (para el público general)
ALTER TABLE tableau_data ENABLE ROW LEVEL SECURITY;

-- 3. Política: solo lectura para anon/usuario normal
DROP POLICY IF EXISTS "anon_select_tableau" ON tableau_data;
CREATE POLICY "anon_select_tableau" ON tableau_data
    FOR SELECT USING (true);

-- 4. ══════════════════════════════════════════════════════════
--    FUNCIÓN CYBERPUNK: SECURITY DEFINER
--    — Acepta un array JSON de registros
--    — Corre como owner (postgress / admin)
--    — RLS no aplica a funciones SECURITY DEFINER
--    ════════════════════════════════════════════════════════
DROP FUNCTION IF EXISTS upsert_tableau_batch(jsonb);

CREATE OR REPLACE FUNCTION upsert_tableau_batch(records jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER                  -- ← El hack: siempre corre como owner
SET search_path = public
AS $$
DECLARE
    rec     jsonb;
    counter int := 0;
BEGIN
    FOR rec IN SELECT * FROM jsonb_array_elements(records)
    LOOP
        INSERT INTO tableau_data (perfil_id, valor, data_json, updated_at)
        VALUES (
            rec->>'perfil_id',
            (rec->>'valor')::numeric,
            rec->'data_json',
            now()
        )
        ON CONFLICT (perfil_id) DO UPDATE SET
            valor      = EXCLUDED.valor,
            data_json  = EXCLUDED.data_json,
            updated_at = now();
        counter := counter + 1;
    END LOOP;

    RETURN jsonb_build_object('inserted', counter, 'status', 'ok');
END;
$$;

-- 5. Dar permiso a anon/authenticated para EJECUTAR la función
--    (no para escribir en la tabla directamente)
GRANT EXECUTE ON FUNCTION upsert_tableau_batch(jsonb) TO anon;
GRANT EXECUTE ON FUNCTION upsert_tableau_batch(jsonb) TO authenticated;

-- 6. Habilitar Realtime
DO $$
BEGIN
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE tableau_data;
    EXCEPTION WHEN others THEN
        RAISE NOTICE 'supabase_realtime ya incluye tableau_data, OK';
    END;
END $$;

SELECT 'CYBERPUNK MODE ACTIVADO: upsert_tableau_batch lista' AS status;
