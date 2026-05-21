-- ============================================================
-- CREAR TABLAS TABLEAU EN SUPABASE
-- Ejecutar en: Supabase Dashboard > SQL Editor
-- Proyecto: vpyzpjgctidqmhqjboxq
-- ============================================================

-- 1. Tabla principal de datos Tableau
CREATE TABLE IF NOT EXISTS public.tableau_data (
  perfil_id   TEXT        NOT NULL,
  valor       NUMERIC     DEFAULT 0,
  data_json   JSONB       DEFAULT '{}',
  updated_at  TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (perfil_id)
);

-- 2. Tabla alternativa (alias/legada)
CREATE TABLE IF NOT EXISTS public.tableau_perfiles (
  perfil_id   TEXT        NOT NULL,
  valor       NUMERIC     DEFAULT 0,
  data_json   JSONB       DEFAULT '{}',
  updated_at  TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (perfil_id)
);

-- 3. Habilitar RLS (Row Level Security)
ALTER TABLE public.tableau_data     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tableau_perfiles ENABLE ROW LEVEL SECURITY;

-- 4. Permitir lectura pública (anon) — necesario para que el frontend lea
CREATE POLICY IF NOT EXISTS "Lectura publica tableau_data"
  ON public.tableau_data
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY IF NOT EXISTS "Lectura publica tableau_perfiles"
  ON public.tableau_perfiles
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- 5. Permitir escritura desde service_role (GitHub Actions / sync robot)
CREATE POLICY IF NOT EXISTS "Escritura service tableau_data"
  ON public.tableau_data
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY IF NOT EXISTS "Escritura service tableau_perfiles"
  ON public.tableau_perfiles
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 6. Verificar que quedaron bien
SELECT tablename, rowsecurity
FROM pg_tables
WHERE tablename IN ('tableau_data', 'tableau_perfiles');
