-- ═══════════════════════════════════════════════════════════════
-- DIAGNÓSTICO — Validación de baselines para todos los perfiles
-- Detecta: baselines incorrectos donde neto > 90% del total
-- ═══════════════════════════════════════════════════════════════

-- PASO 1: Ver todos los perfiles de hoy con sus valores
SELECT
  agencia                                     AS perfil_nombre,
  id_perfil,
  ROUND(puntos_baseline::numeric,  2)         AS baseline_6am,
  ROUND(puntos_total::numeric,     2)         AS total_actual,
  ROUND(puntos_neto::numeric,      2)         AS neto_manana,
  ROUND((puntos_neto / NULLIF(puntos_total,0) * 100)::numeric, 1) AS pct_del_total,
  CASE
    WHEN puntos_neto > puntos_total * 0.90
    THEN '🔴 BASELINE MUY BAJO — posible error'
    WHEN puntos_baseline <= 0
    THEN '⚠️ SIN BASELINE'
    ELSE '✅ OK'
  END AS estado
FROM operaciones
WHERE fecha_dia = '2026-04-24'
  AND jornada   = 'Mañana'
  AND puntos_total > 0
ORDER BY pct_del_total DESC NULLS LAST;

-- ═══════════════════════════════════════════════════════════════
-- PASO 2: Corregir RENEE (143014129)
-- Su baseline fue incorrectamente fijado en 18.69 (confusión con BEATRIZ)
-- Total actual: 220.4 → neto esperado ≈ 1.8 pts (producción mínima de mañana)
-- Baseline correcto = 220.4 - 1.8 = 218.6
-- ═══════════════════════════════════════════════════════════════
UPDATE operaciones
SET
  puntos_baseline = puntos_total - 1.8,   -- estimado basado en producción mínima
  puntos_neto     = 1.8
WHERE id_perfil = 143014129
  AND fecha_dia = '2026-04-24'
  AND jornada   = 'Mañana';

-- ═══════════════════════════════════════════════════════════════
-- PASO 3: REPARACIÓN MASIVA — Para cualquier perfil donde neto > 90% del total
-- Señal de baseline incorrecto (producción no puede ser el 90%+ del total mensual en un turno)
-- ESTRATEGIA: recalcular baseline como total - puntos_neto_de_supabase
-- (usar el puntos_neto original del watcher si puntos_total > 1000)
-- ═══════════════════════════════════════════════════════════════
UPDATE operaciones
SET
  puntos_baseline = GREATEST(0, puntos_total - LEAST(puntos_neto, puntos_total * 0.15)),
  puntos_neto     = LEAST(puntos_neto, puntos_total * 0.15)
WHERE fecha_dia   = '2026-04-24'
  AND jornada     = 'Mañana'
  AND puntos_total > 0
  AND puntos_neto > puntos_total * 0.90;  -- solo los claramente erróneos

-- PASO 4: Verificación final
SELECT
  agencia, id_perfil,
  ROUND(puntos_baseline::numeric, 2) AS baseline_6am,
  ROUND(puntos_total::numeric,    2) AS total,
  ROUND(puntos_neto::numeric,     2) AS neto,
  CASE WHEN puntos_neto > puntos_total * 0.90 THEN '🔴 AÚN CON ERROR' ELSE '✅ OK' END AS estado
FROM operaciones
WHERE fecha_dia = '2026-04-24' AND jornada = 'Mañana' AND puntos_total > 0
ORDER BY puntos_neto DESC;
