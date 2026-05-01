-- ═══════════════════════════════════════════════════════════════
-- AGENCIA RR: TABLEAU PANELS — Schema y Datos
-- Ejecutar en Supabase → SQL Editor → Run
-- ═══════════════════════════════════════════════════════════════

-- ─── 1. Tabla: configuración de fuentes Tableau ─────────────────
-- Cada fila = una vista de Tableau que queremos sincronizar
-- (como datame_panels pero para Tableau)
CREATE TABLE IF NOT EXISTS tableau_panels (
    id          SERIAL PRIMARY KEY,
    nombre      TEXT NOT NULL,          -- Nombre descriptivo, ej: "ROMERO OFICIAL"
    server      TEXT NOT NULL DEFAULT 'https://prod-uk-a.online.tableau.com',
    site        TEXT NOT NULL DEFAULT 'partnerdata',
    view_name   TEXT NOT NULL,          -- Fragmento del contentUrl a buscar
    token_name  TEXT NOT NULL DEFAULT 'Analytics',
    activo      BOOLEAN DEFAULT true,
    created_at  TIMESTAMPTZ DEFAULT now()
);

-- ─── 2. Tabla: perfiles por panel de Tableau ────────────────────
-- Whitelist: solo estos IDs se sincronizan de cada panel
CREATE TABLE IF NOT EXISTS tableau_perfiles (
    id          SERIAL PRIMARY KEY,
    panel_id    INTEGER REFERENCES tableau_panels(id) ON DELETE CASCADE,
    id_tableau  TEXT NOT NULL,          -- ID numérico del perfil en Tableau
    modelo      TEXT NOT NULL,          -- Nombre del modelo/perfil
    activo      BOOLEAN DEFAULT true,
    UNIQUE(panel_id, id_tableau)
);

-- ─── 3. Tabla de datos sincronizados (ya existe, recrear si falta) ─
CREATE TABLE IF NOT EXISTS tableau_data (
    perfil_id   TEXT          PRIMARY KEY,
    panel_id    INTEGER,                -- Panel de origen
    panel_nombre TEXT,                  -- Nombre del panel
    valor       NUMERIC(12,2) DEFAULT 0,
    data_json   JSONB,
    updated_at  TIMESTAMPTZ   DEFAULT now()
);

-- ─── 4. RLS ─────────────────────────────────────────────────────
ALTER TABLE tableau_panels   ENABLE ROW LEVEL SECURITY;
ALTER TABLE tableau_perfiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE tableau_data     ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_tableau_panels"   ON tableau_panels;
DROP POLICY IF EXISTS "read_tableau_perfiles" ON tableau_perfiles;
DROP POLICY IF EXISTS "anon_select_tableau"   ON tableau_data;

CREATE POLICY "read_tableau_panels"   ON tableau_panels   FOR SELECT USING (true);
CREATE POLICY "read_tableau_perfiles" ON tableau_perfiles FOR SELECT USING (true);
CREATE POLICY "anon_select_tableau"   ON tableau_data     FOR SELECT USING (true);

-- ─── 5. Insertar paneles de Tableau ─────────────────────────────
-- PANEL-T1: Vista "Revenuedetailed" con filtro automático GRUPOROMERO
-- NOTA TÉCNICA: En el link del usuario:
--   .../views/Passport_16741406948180/Revenuedetailed/.../GRUPOROMERO
-- "GRUPOROMERO" es un filtro de usuario (User Filter) aplicado por Tableau
-- según el token PAT. La vista real es "Revenuedetailed". El token Analytics
-- ya tiene el filtro de agencia — solo retorna los ~10 perfiles propios.
INSERT INTO tableau_panels (id, nombre, server, site, view_name, token_name) VALUES
  (1, 'ROMERO OFICIAL',
   'https://prod-uk-a.online.tableau.com',
   'partnerdata',
   'Revenuedetailed',
   'Analytics')
ON CONFLICT (id) DO UPDATE SET
    nombre     = EXCLUDED.nombre,
    view_name  = EXCLUDED.view_name,
    activo     = true;

-- (Agrega más paneles aquí cuando los tengas, igual que datame_panels)
-- INSERT INTO tableau_panels (id, nombre, server, site, view_name, token_name) VALUES
--   (2, 'OTRA AGENCIA', '...', '...', 'NOMBREAGENCIA2', 'Analytics')
-- ON CONFLICT (id) DO UPDATE SET view_name = EXCLUDED.view_name;

-- ─── 6. MIGRACIÓN: agregar columnas faltantes (idempotente) ─────
ALTER TABLE tableau_data
  ADD COLUMN IF NOT EXISTS panel_id     INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS panel_nombre TEXT    DEFAULT 'ROMERO OFICIAL';

-- ─── 7. Insertar los 14 perfiles CONFIRMADOS del panel Romero ───
-- ✅ IDs confirmados por ingeniería inversa del workbook "Limits usage"
-- El script cruzó datame_perfiles con todos los workbooks de Tableau
-- y encontró match exacto con estos 14 perfiles de la agencia.
INSERT INTO tableau_perfiles (panel_id, id_tableau, modelo, activo) VALUES
  (1, '91360720',  'Sandra Marina',  true),
  (1, '91733663',  'Daniel',         true),
  (1, '95955130',  'Hector',         true),
  (1, '95956014',  'Pablo',          true),
  (1, '98389135',  'Raul',           true),
  (1, '98540781',  'Leandro',        true),
  (1, '103289167', 'Luis',           true),
  (1, '103291980', 'Armando',        true),
  (1, '130431310', 'Rafael',         true),
  (1, '143014129', 'Renee',          true),
  (1, '151070498', 'Valquimar',      true),
  (1, '153839388', 'Agustin',        true),
  (1, '156716207', 'Agnaldo',        true),
  (1, '157067734', 'Valdemir',       true)
ON CONFLICT (panel_id, id_tableau) DO UPDATE SET
  modelo = EXCLUDED.modelo,
  activo = true;

-- Eliminar el placeholder PENDING si existe
DELETE FROM tableau_perfiles WHERE id_tableau = 'PENDING';

-- ─── 8. Función SECURITY DEFINER (actualizada con panel_id) ─────
DROP FUNCTION IF EXISTS upsert_tableau_batch(jsonb);

CREATE OR REPLACE FUNCTION upsert_tableau_batch(records jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    rec     jsonb;
    counter int := 0;
BEGIN
    FOR rec IN SELECT * FROM jsonb_array_elements(records)
    LOOP
        INSERT INTO tableau_data (perfil_id, panel_id, panel_nombre, valor, data_json, updated_at)
        VALUES (
            rec->>'perfil_id',
            COALESCE((rec->>'panel_id')::int, 1),
            COALESCE(rec->>'panel_nombre', 'ROMERO OFICIAL'),
            COALESCE((rec->>'valor')::numeric, 0),
            rec->'data_json',
            now()
        )
        ON CONFLICT (perfil_id) DO UPDATE SET
            panel_id     = EXCLUDED.panel_id,
            panel_nombre = EXCLUDED.panel_nombre,
            valor        = EXCLUDED.valor,
            data_json    = EXCLUDED.data_json,
            updated_at   = now();
        counter := counter + 1;
    END LOOP;

    RETURN jsonb_build_object('inserted', counter, 'status', 'ok');
END;
$$;

GRANT EXECUTE ON FUNCTION upsert_tableau_batch(jsonb) TO anon;
GRANT EXECUTE ON FUNCTION upsert_tableau_batch(jsonb) TO authenticated;

-- ─── 9. Realtime ────────────────────────────────────────────────
DO $$
BEGIN
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE tableau_data;
    EXCEPTION WHEN others THEN
        RAISE NOTICE 'tableau_data ya está en supabase_realtime, OK';
    END;
END $$;

SELECT 'OK: 14 perfiles Romero + migración panel_id completada' AS status;
