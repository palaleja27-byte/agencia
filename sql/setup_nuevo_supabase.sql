-- ============================================================
-- SCRIPT MAESTRO DE INICIALIZACIÓN - AGENCIA RR (SUPABASE 2026)
-- Proyecto: https://kgemlmwamowjwcskcpcu.supabase.co
-- Copiar y Pegar en: Supabase Dashboard > SQL Editor > Run
-- ============================================================

-- 1. TABLA KV_STORE (Persistencia de configuración, operadores, chat y cachés)
CREATE TABLE IF NOT EXISTS public.kv_store (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.kv_store ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_kv_store" ON public.kv_store;
CREATE POLICY "allow_all_kv_store" ON public.kv_store FOR ALL USING (true) WITH CHECK (true);

-- 2. TABLA DATAME_PANELS (Credenciales de acceso a paneles)
CREATE TABLE IF NOT EXISTS public.datame_panels (
  id SERIAL PRIMARY KEY,
  nombre TEXT NOT NULL,
  email TEXT NOT NULL,
  password TEXT NOT NULL,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.datame_panels ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_datame_panels" ON public.datame_panels;
CREATE POLICY "allow_all_datame_panels" ON public.datame_panels FOR ALL USING (true) WITH CHECK (true);

-- Paneles predeterminados
INSERT INTO public.datame_panels (id, nombre, email, password) VALUES
  (1, 'PANEL-1', 'thinkedagency@gmail.com', 'Millon2026'),
  (2, 'PANEL-2', 'thinkedagency2@gmail.com', 'Millon2026'),
  (3, 'PANEL-3', 'Nuevopaneladmi4@gmail.com', 'Nuevopaneladmi4@gmail.com'),
  (4, 'PANEL-4', 'Ameliapenaloza40@gmail.com', 'GroupPremium/*7263458%$')
ON CONFLICT (id) DO NOTHING;

-- 3. TABLA DATAME_PERFILES (Mapeo de modelos y perfiles de Datame)
CREATE TABLE IF NOT EXISTS public.datame_perfiles (
  id SERIAL PRIMARY KEY,
  panel_id INTEGER REFERENCES public.datame_panels(id) ON DELETE CASCADE,
  id_datame TEXT NOT NULL,
  modelo TEXT NOT NULL,
  activo BOOLEAN DEFAULT true,
  CONSTRAINT datame_perfiles_id_datame_key UNIQUE (id_datame)
);

ALTER TABLE public.datame_perfiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_datame_perfiles" ON public.datame_perfiles;
CREATE POLICY "allow_all_datame_perfiles" ON public.datame_perfiles FOR ALL USING (true) WITH CHECK (true);

-- Perfiles predeterminados
INSERT INTO public.datame_perfiles (panel_id, id_datame, modelo) VALUES
  (1, '91360720', 'SANDRA'),
  (2, '95956014', 'PABLO'),
  (2, '91733663', 'DANIEL'),
  (2, '153039388', 'AGUSTIN FERNANDO'),
  (2, '95955130', 'HECTOR'),
  (2, '103289167', 'LUIS'),
  (2, '98389135', 'RAUL'),
  (2, '98540781', 'LEANDRO'),
  (2, '157067734', 'VALDEMIR'),
  (2, '103291980', 'ARMANDO'),
  (2, '130431310', 'RAFAEL'),
  (2, '151070498', 'VALQUIMAR'),
  (2, '143014129', 'RENEE'),
  (2, '156716207', 'AGNALDO'),
  (2, '157112125', 'LUIZ'),
  (2, '160352260', 'JUVENAL'),
  (3, '88243516', 'RICARDO'),
  (3, '79679899', 'NORBERTO'),
  (3, '118692242', 'FRANCISCO'),
  (3, '109551682', 'RENATO'),
  (3, '108018336', 'LUCAS'),
  (3, '118179794', 'HORACIO'),
  (3, '130338853', 'IVALDO'),
  (3, '137163229', 'SEBASTIAN'),
  (3, '120720195', 'MARCOS'),
  (3, '139247498', 'DAMIAN'),
  (3, '139245989', 'ALFREDO'),
  (3, '120275229', 'GERMAN'),
  (3, '156881990', 'RALPH'),
  (3, '130422416', 'RAONI'),
  (3, '143017065', 'MARIO'),
  (3, '145211163', 'FERMIN'),
  (3, '145834230', 'MURILO'),
  (3, '145844971', 'RODRIGO'),
  (4, '131130713', 'LUIS JOAO'),
  (4, '138130329', 'AGUSTIN'),
  (4, '133085188', 'MARCOS ANTONIO'),
  (4, '144863124', 'FERNANDO')
ON CONFLICT (id_datame) DO NOTHING;

-- 4. TABLA OPERACIONES (Registro de puntos, baselines y turnos de operadores)
CREATE TABLE IF NOT EXISTS public.operaciones (
  id BIGSERIAL PRIMARY KEY,
  id_perfil TEXT NOT NULL,
  agencia TEXT,
  puntos NUMERIC(12,2) DEFAULT 0,
  puntos_total NUMERIC(12,2) DEFAULT 0,
  puntos_baseline NUMERIC(12,2) DEFAULT 0,
  puntos_neto NUMERIC(12,2) DEFAULT 0,
  fecha_corte TIMESTAMPTZ NOT NULL DEFAULT now(),
  fecha_dia DATE NOT NULL DEFAULT CURRENT_DATE,
  jornada TEXT NOT NULL DEFAULT 'Mañana',
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT operaciones_id_perfil_fecha_dia_jornada_key UNIQUE (id_perfil, fecha_dia, jornada)
);

CREATE INDEX IF NOT EXISTS idx_operaciones_fecha_dia ON public.operaciones(fecha_dia);
CREATE INDEX IF NOT EXISTS idx_operaciones_id_perfil ON public.operaciones(id_perfil);
ALTER TABLE public.operaciones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_operaciones" ON public.operaciones;
CREATE POLICY "allow_all_operaciones" ON public.operaciones FOR ALL USING (true) WITH CHECK (true);

-- 5. TABLA OP_SESSIONS (Sesiones activas e historial de operadores en tiempo real)
CREATE TABLE IF NOT EXISTS public.op_sessions (
  id BIGSERIAL PRIMARY KEY,
  operador TEXT NOT NULL,
  perfil_ids TEXT[],
  inicio_ts TIMESTAMPTZ DEFAULT now(),
  fin_ts TIMESTAMPTZ,
  baseline_total NUMERIC(12,2) DEFAULT 0,
  puntos_sesion NUMERIC(10,2) DEFAULT 0,
  jornada TEXT,
  fecha_dia DATE DEFAULT CURRENT_DATE
);

CREATE INDEX IF NOT EXISTS idx_ops_fecha ON public.op_sessions(fecha_dia);
CREATE INDEX IF NOT EXISTS idx_ops_activa ON public.op_sessions(fin_ts) WHERE fin_ts IS NULL;
ALTER TABLE public.op_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_op_sessions" ON public.op_sessions;
CREATE POLICY "allow_all_op_sessions" ON public.op_sessions FOR ALL USING (true) WITH CHECK (true);

-- 6. TABLA RR_MEDIA (Fotos de perfil y banners sincronizados)
CREATE TABLE IF NOT EXISTS public.rr_media (
  nombre TEXT NOT NULL,
  tipo TEXT NOT NULL,
  data TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (nombre, tipo)
);

ALTER TABLE public.rr_media ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_rr_media" ON public.rr_media;
CREATE POLICY "allow_all_rr_media" ON public.rr_media FOR ALL USING (true) WITH CHECK (true);

-- 7. TABLAS TABLEAU (Tableau Data & Perfiles)
CREATE TABLE IF NOT EXISTS public.tableau_data (
  perfil_id TEXT NOT NULL PRIMARY KEY,
  valor NUMERIC DEFAULT 0,
  data_json JSONB DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tableau_perfiles (
  perfil_id TEXT NOT NULL PRIMARY KEY,
  valor NUMERIC DEFAULT 0,
  data_json JSONB DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.tableau_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tableau_perfiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_tableau_data" ON public.tableau_data;
CREATE POLICY "allow_all_tableau_data" ON public.tableau_data FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "allow_all_tableau_perfiles" ON public.tableau_perfiles;
CREATE POLICY "allow_all_tableau_perfiles" ON public.tableau_perfiles FOR ALL USING (true) WITH CHECK (true);

-- 8. TABLAS DE CRECIMIENTO HISTÓRICO (Hora a hora y Día a día - Reporte Operación)
CREATE TABLE IF NOT EXISTS public.growth_metrics (
  id BIGSERIAL PRIMARY KEY,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  fecha_dia DATE NOT NULL,
  hora INT NOT NULL CHECK (hora >= 0 AND hora <= 23),
  id_perfil TEXT NOT NULL,
  modelo TEXT,
  operador TEXT,
  jornada TEXT NOT NULL DEFAULT 'Mañana',
  agencia TEXT NOT NULL DEFAULT 'General',
  puntos_total NUMERIC NOT NULL DEFAULT 0,
  puntos_neto_turno NUMERIC NOT NULL DEFAULT 0,
  puntos_delta_hora NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uk_growth_perfil_fecha_hora UNIQUE (id_perfil, fecha_dia, hora)
);

CREATE TABLE IF NOT EXISTS public.growth_daily_summary (
  id BIGSERIAL PRIMARY KEY,
  fecha_dia DATE NOT NULL,
  agencia TEXT NOT NULL DEFAULT 'Global',
  puntos_total_dia NUMERIC NOT NULL DEFAULT 0,
  puntos_neto_dia NUMERIC NOT NULL DEFAULT 0,
  turnos_detalle JSONB NOT NULL DEFAULT '{}',
  operadores_detalle JSONB NOT NULL DEFAULT '{}',
  perfiles_detalle JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uk_growth_daily_fecha_agencia UNIQUE (fecha_dia, agencia)
);

CREATE INDEX IF NOT EXISTS idx_growth_fecha_dia ON public.growth_metrics(fecha_dia);
CREATE INDEX IF NOT EXISTS idx_growth_perfil ON public.growth_metrics(id_perfil);
CREATE INDEX IF NOT EXISTS idx_growth_operador ON public.growth_metrics(operador);
CREATE INDEX IF NOT EXISTS idx_growth_fecha_hora ON public.growth_metrics(fecha_dia, hora);
CREATE INDEX IF NOT EXISTS idx_growth_daily_fecha ON public.growth_daily_summary(fecha_dia);

ALTER TABLE public.growth_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.growth_daily_summary ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_growth_metrics" ON public.growth_metrics;
CREATE POLICY "allow_all_growth_metrics" ON public.growth_metrics FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "allow_all_growth_daily_summary" ON public.growth_daily_summary;
CREATE POLICY "allow_all_growth_daily_summary" ON public.growth_daily_summary FOR ALL USING (true) WITH CHECK (true);

-- 9. FUNCIÓN RPC: Agrupación horaria eficiente de hoy
CREATE OR REPLACE FUNCTION get_growth_hourly_today(p_fecha_dia DATE)
RETURNS TABLE (
  hora INT,
  puntos_hora NUMERIC,
  puntos_acumulado NUMERIC,
  perfiles_activos INT
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  WITH horas_base AS (
    SELECT generate_series(0, 23) AS h
  ),
  totales_hora AS (
    SELECT 
      gm.hora,
      COALESCE(SUM(gm.puntos_delta_hora), 0) AS pts_delta,
      COUNT(DISTINCT gm.id_perfil) AS activos
    FROM public.growth_metrics gm
    WHERE gm.fecha_dia = p_fecha_dia
    GROUP BY gm.hora
  )
  SELECT 
    hb.h AS hora,
    COALESCE(th.pts_delta, 0) AS puntos_hora,
    SUM(COALESCE(th.pts_delta, 0)) OVER (ORDER BY hb.h) AS puntos_acumulado,
    COALESCE(th.activos, 0)::INT AS perfiles_activos
  FROM horas_base hb
  LEFT JOIN totales_hora th ON hb.h = th.hora
  ORDER BY hb.h;
$$;
GRANT EXECUTE ON FUNCTION get_growth_hourly_today(DATE) TO anon, authenticated, service_role;

-- 10. FUNCIÓN RPC: Batch upsert para perfiles Datame
CREATE OR REPLACE FUNCTION upsert_datame_perfiles_batch(records jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    rec jsonb;
    counter int := 0;
    v_id_datame text;
    v_modelo text;
    v_panel_id bigint;
    v_activo boolean;
BEGIN
    FOR rec IN SELECT * FROM jsonb_array_elements(records)
    LOOP
        v_id_datame := rec->>'id_datame';
        v_modelo := rec->>'modelo';
        v_panel_id := (rec->>'panel_id')::bigint;
        v_activo := (rec->>'activo')::boolean;

        IF v_id_datame IS NOT NULL AND v_id_datame <> '' THEN
            IF EXISTS (SELECT 1 FROM public.datame_perfiles WHERE id_datame = v_id_datame) THEN
                UPDATE public.datame_perfiles
                SET modelo = v_modelo,
                    panel_id = v_panel_id,
                    activo = v_activo
                WHERE id_datame = v_id_datame;
            ELSE
                INSERT INTO public.datame_perfiles (id_datame, modelo, panel_id, activo)
                VALUES (v_id_datame, v_modelo, v_panel_id, v_activo);
            END IF;
            counter := counter + 1;
        END IF;
    END LOOP;
    RETURN jsonb_build_object('inserted', counter, 'status', 'ok');
END;
$$;
GRANT EXECUTE ON FUNCTION upsert_datame_perfiles_batch(jsonb) TO anon, authenticated, service_role;

-- 11. HABILITAR REALTIME (Para que el dashboard y operadores se enteren al instante)
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE kv_store, operaciones, op_sessions, rr_media, growth_metrics;
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END $$;

-- 12. MENSAJE FINAL DE ÉXITO
SELECT '¡SISTEMA AGENCIA RR INICIALIZADO EXITOSAMENTE AL 100%!' AS estado;
