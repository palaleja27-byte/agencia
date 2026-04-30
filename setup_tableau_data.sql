-- ═══════════════════════════════════════════════════════════════
-- AGENCIA RR: TABLEAU DATA — Schema + RLS
-- Ejecutar en Supabase → SQL Editor → Run
-- ═══════════════════════════════════════════════════════════════

-- 1. Crear tabla si no existe
CREATE TABLE IF NOT EXISTS tableau_data (
    perfil_id  TEXT        PRIMARY KEY,
    valor      NUMERIC(12,2) DEFAULT 0,
    data_json  JSONB,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Habilitar RLS
ALTER TABLE tableau_data ENABLE ROW LEVEL SECURITY;

-- 3. Política: lectura pública (Dashboard puede leer sin auth)
DROP POLICY IF EXISTS "anon_select_tableau"  ON tableau_data;
CREATE POLICY "anon_select_tableau" ON tableau_data
    FOR SELECT USING (true);

-- 4. Política: escritura total para service_role (el robot de GitHub Actions)
DROP POLICY IF EXISTS "service_role_all_tableau" ON tableau_data;
CREATE POLICY "service_role_all_tableau" ON tableau_data
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 5. Habilitar Realtime (cards del Dashboard se actualizan solas)
DO $$
BEGIN
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE tableau_data;
    EXCEPTION WHEN others THEN
        RAISE NOTICE 'supabase_realtime ya incluye tableau_data, OK';
    END;
END $$;

SELECT 'OK: tableau_data lista con RLS configurada correctamente' AS resultado;
