-- ═══════════════════════════════════════════════════════════════
-- AGENCIA RR: Añadir puntos_total y puntos_baseline a operaciones
-- Ejecutar en Supabase → SQL Editor → Run
-- ═══════════════════════════════════════════════════════════════

-- 1. Añadir puntos_total (total acumulado del mes desde Datame)
ALTER TABLE operaciones ADD COLUMN IF NOT EXISTS puntos_total    NUMERIC(12,2) DEFAULT 0;

-- 2. Añadir puntos_baseline (total al INICIO del turno = punto de referencia 0)
ALTER TABLE operaciones ADD COLUMN IF NOT EXISTS puntos_baseline NUMERIC(12,2) DEFAULT 0;

-- 3. Migrar: columna vieja 'puntos' era el total mensual → copiar a puntos_total
UPDATE operaciones
SET puntos_total = puntos
WHERE puntos_total = 0 AND puntos > 0;

-- 4. Calcular puntos_neto real para registros históricos (donde neto era 0 o igual al total)
-- NOTA: Para datos históricos con jornada='Auto', el neto diario se calcula con LAG
WITH ranked AS (
  SELECT id, id_perfil, fecha_dia, puntos_total,
         LAG(puntos_total, 1, 0) OVER (
           PARTITION BY id_perfil
           ORDER BY fecha_dia ASC, jornada ASC
         ) AS baseline_prev
  FROM operaciones
  WHERE jornada = 'Auto'
)
UPDATE operaciones o
SET puntos_neto     = GREATEST(0, r.puntos_total - r.baseline_prev),
    puntos_baseline = r.baseline_prev
FROM ranked r
WHERE o.id = r.id AND o.jornada = 'Auto';

-- 5. Confirmación
SELECT
  COUNT(*) AS total_registros,
  COUNT(DISTINCT id_perfil) AS perfiles,
  ROUND(AVG(puntos_neto), 2) AS neto_promedio,
  MAX(puntos_total) AS total_max_perfil,
  'OK: puntos_total y puntos_baseline listos' AS estado
FROM operaciones;
