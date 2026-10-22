-- ============================================================
-- CREACIÓN DE INFRAESTRUCTURA DE CRECIMIENTO HISTÓRICO
-- MÉTRICAS HORA A HORA Y DÍA A DÍA - AGENCIA RR (2026)
-- Ejecutar en: Supabase Dashboard > SQL Editor
-- Proyecto: hgdymxklyrwjzlwomncm
-- ============================================================

-- 1. Tabla de Instantáneas Horarias por Perfil / Operador
CREATE TABLE IF NOT EXISTS public.growth_metrics (
  id                  BIGSERIAL       PRIMARY KEY,
  timestamp           TIMESTAMPTZ     NOT NULL DEFAULT now(),
  fecha_dia           DATE            NOT NULL,
  hora                INT             NOT NULL CHECK (hora >= 0 AND hora <= 23),
  id_perfil           TEXT            NOT NULL,
  modelo              TEXT,
  operador            TEXT,
  jornada             TEXT            NOT NULL DEFAULT 'Mañana',
  agencia             TEXT            NOT NULL DEFAULT 'General',
  puntos_total        NUMERIC         NOT NULL DEFAULT 0,
  puntos_neto_turno   NUMERIC         NOT NULL DEFAULT 0,
  puntos_delta_hora   NUMERIC         NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ     NOT NULL DEFAULT now(),
  CONSTRAINT uk_growth_perfil_fecha_hora UNIQUE (id_perfil, fecha_dia, hora)
);

-- 2. Tabla de Resúmenes Diarios Consolidados
CREATE TABLE IF NOT EXISTS public.growth_daily_summary (
  id                  BIGSERIAL       PRIMARY KEY,
  fecha_dia           DATE            NOT NULL,
  agencia             TEXT            NOT NULL DEFAULT 'Global',
  puntos_total_dia    NUMERIC         NOT NULL DEFAULT 0,
  puntos_neto_dia     NUMERIC         NOT NULL DEFAULT 0,
  turnos_detalle      JSONB           NOT NULL DEFAULT '{}',
  operadores_detalle  JSONB           NOT NULL DEFAULT '{}',
  perfiles_detalle    JSONB           NOT NULL DEFAULT '{}',
  updated_at          TIMESTAMPTZ     NOT NULL DEFAULT now(),
  CONSTRAINT uk_growth_daily_fecha_agencia UNIQUE (fecha_dia, agencia)
);

-- 3. Índices para consultas de alta velocidad en el Dashboard Directivo
CREATE INDEX IF NOT EXISTS idx_growth_fecha_dia ON public.growth_metrics(fecha_dia);
CREATE INDEX IF NOT EXISTS idx_growth_perfil ON public.growth_metrics(id_perfil);
CREATE INDEX IF NOT EXISTS idx_growth_operador ON public.growth_metrics(operador);
CREATE INDEX IF NOT EXISTS idx_growth_fecha_hora ON public.growth_metrics(fecha_dia, hora);
CREATE INDEX IF NOT EXISTS idx_growth_daily_fecha ON public.growth_daily_summary(fecha_dia);

-- 4. Habilitar RLS (Row Level Security)
ALTER TABLE public.growth_metrics       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.growth_daily_summary ENABLE ROW LEVEL SECURITY;

-- 5. Políticas de Lectura Pública (anon y authenticated)
DROP POLICY IF EXISTS "Lectura publica growth_metrics" ON public.growth_metrics;
CREATE POLICY "Lectura publica growth_metrics"
  ON public.growth_metrics FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Lectura publica growth_daily_summary" ON public.growth_daily_summary;
CREATE POLICY "Lectura publica growth_daily_summary"
  ON public.growth_daily_summary FOR SELECT
  TO anon, authenticated
  USING (true);

-- 6. Políticas de Escritura y Actualización (service_role y anon para ingesta continua)
DROP POLICY IF EXISTS "Escritura service growth_metrics" ON public.growth_metrics;
CREATE POLICY "Escritura service growth_metrics"
  ON public.growth_metrics FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Escritura anon growth_metrics" ON public.growth_metrics;
CREATE POLICY "Escritura anon growth_metrics"
  ON public.growth_metrics FOR INSERT
  TO anon
  WITH CHECK (true);

DROP POLICY IF EXISTS "Actualizacion anon growth_metrics" ON public.growth_metrics;
CREATE POLICY "Actualizacion anon growth_metrics"
  ON public.growth_metrics FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Escritura service growth_daily_summary" ON public.growth_daily_summary;
CREATE POLICY "Escritura service growth_daily_summary"
  ON public.growth_daily_summary FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Escritura anon growth_daily_summary" ON public.growth_daily_summary;
CREATE POLICY "Escritura anon growth_daily_summary"
  ON public.growth_daily_summary FOR INSERT
  TO anon
  WITH CHECK (true);

DROP POLICY IF EXISTS "Actualizacion anon growth_daily_summary" ON public.growth_daily_summary;
CREATE POLICY "Actualizacion anon growth_daily_summary"
  ON public.growth_daily_summary FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

-- 7. Función RPC para obtener el desglose por hora de hoy en 1 sola llamada
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

-- 8. Verificación de creación
SELECT tablename, rowsecurity
FROM pg_tables
WHERE tablename IN ('growth_metrics', 'growth_daily_summary');
