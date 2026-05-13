-- ══════════════════════════════════════════════════════════════════════
-- DIAGNÓSTICO + CALIBRACIÓN MAÑANA — 2026-05-13
-- Como data scientist: detectar duplicados, desfase de baseline, y
-- calcular puntos_neto reales para la jornada Mañana (06:00-14:00 COL)
-- ══════════════════════════════════════════════════════════════════════

-- ──────────────────────────────────────────────────────────────────────
-- PASO 1: VER TODOS LOS REGISTROS DE HOY (todas las jornadas)
-- ¿Cuántas filas tiene cada perfil? ¿Hay duplicados por jornada?
-- ──────────────────────────────────────────────────────────────────────
SELECT
  id_perfil,
  jornada,
  COUNT(*)           AS registros,          -- si > 1 hay DUPLICADO
  MAX(puntos_total)  AS max_puntos_total,
  MIN(puntos_total)  AS min_puntos_total,
  MAX(puntos_baseline) AS max_baseline,
  MIN(puntos_baseline) AS min_baseline,
  MAX(puntos_neto)   AS max_neto,
  MIN(puntos_neto)   AS min_neto,
  -- Neto recalculado = qué debería marcar el DELTA-SHIFT™
  MAX(puntos_total) - MIN(puntos_baseline) AS neto_correcto_estimado
FROM operaciones
WHERE fecha_dia = CURRENT_DATE
  AND jornada != 'Auto'
GROUP BY id_perfil, jornada
ORDER BY registros DESC, id_perfil, jornada;

-- ──────────────────────────────────────────────────────────────────────
-- PASO 2: DETECTAR DESFASE DE BASELINE (Regla de Sanidad DELTA-SHIFT™)
-- puntos_neto > puntos_total * 0.60 → baseline es corrupto (= 0 o null)
-- ──────────────────────────────────────────────────────────────────────
SELECT
  id_perfil,
  agencia,
  jornada,
  puntos_total,
  puntos_baseline,
  puntos_neto,
  ROUND((puntos_neto::numeric / NULLIF(puntos_total,0)) * 100, 1) AS pct_neto_vs_total,
  CASE
    WHEN puntos_baseline IS NULL OR puntos_baseline = 0
      THEN '🔴 BASELINE NULO — producción inflada'
    WHEN puntos_neto > puntos_total * 0.60
      THEN '🟠 BASELINE CORRUPTO — neto > 60% del total'
    WHEN puntos_total < puntos_baseline
      THEN '⚠️ TOTAL < BASELINE — inversión inválida'
    ELSE '✅ OK'
  END AS estado
FROM operaciones
WHERE fecha_dia = CURRENT_DATE
  AND jornada IN ('Mañana', 'Noche')   -- Noche incluida porque se escribe con fecha_dia de hoy
ORDER BY jornada, id_perfil;

-- ──────────────────────────────────────────────────────────────────────
-- PASO 3: RESUMEN DE JORNADAS HOY (cuadro de mando rápido)
-- ¿Cuántos pts tiene cada turno? ¿Coincide con lo que muestra Datame?
-- ──────────────────────────────────────────────────────────────────────
SELECT
  jornada,
  COUNT(DISTINCT id_perfil)  AS perfiles_activos,
  COUNT(*)                   AS registros_totales,
  ROUND(SUM(puntos_neto)::numeric, 2)    AS suma_neto,
  ROUND(AVG(puntos_neto)::numeric, 2)    AS promedio_neto,
  COUNT(*) FILTER (WHERE puntos_baseline IS NULL OR puntos_baseline = 0) AS baselines_nulos,
  COUNT(*) FILTER (WHERE puntos_neto > puntos_total * 0.60)              AS baselines_corruptos
FROM operaciones
WHERE fecha_dia = CURRENT_DATE
  AND jornada != 'Auto'
GROUP BY jornada
ORDER BY jornada;

-- ──────────────────────────────────────────────────────────────────────
-- PASO 4: COMPARAR Datame (tabla de la imagen) vs Supabase
-- Panel-1 Datame total = 710.70 pts | Panel-2 = 43.32 pts (según imagen)
-- Supabase debería tener esos valores en jornada 'Mañana'
-- ──────────────────────────────────────────────────────────────────────
SELECT
  agencia,
  jornada,
  ROUND(SUM(puntos_neto)::numeric, 2) AS total_neto_supabase
FROM operaciones
WHERE fecha_dia = CURRENT_DATE
  AND jornada != 'Auto'
GROUP BY agencia, jornada
ORDER BY agencia, jornada;

-- ──────────────────────────────────────────────────────────────────────
-- PASO 5 (CORRECCIÓN): Fijar baseline correcto en registros de Mañana
-- donde el baseline esté en NULL o en 0 (causando neto inflado)
-- SOLO ejecutar si el PASO 2 detecta baselines nulos/corruptos.
-- ──────────────────────────────────────────────────────────────────────
-- DESCOMENTA Y EJECUTA SOLO SI ES NECESARIO:
/*
UPDATE operaciones
SET
  puntos_baseline = ROUND((puntos_total * 0.97)::numeric, 2),
  puntos_neto     = ROUND((puntos_total * 0.03)::numeric, 2)
WHERE fecha_dia = CURRENT_DATE
  AND jornada = 'Mañana'
  AND (puntos_baseline IS NULL OR puntos_baseline = 0)
  AND puntos_total > 0;
*/

-- ──────────────────────────────────────────────────────────────────────
-- PASO 6: IDENTIFICAR REGISTROS NOCHE CON fecha_dia = HOY
-- La jornada Noche 22:00-06:00 puede generar registros con
-- fecha_dia = HOY (fueron escritos entre medianoche y 6 AM).
-- Estos son LEGÍTIMOS y NO deben eliminarse, pero hay que verificar
-- que sus puntos_neto no estén siendo sumados al operador equivocado.
-- ──────────────────────────────────────────────────────────────────────
SELECT
  o.id_perfil,
  o.agencia,
  o.jornada,
  o.puntos_total,
  o.puntos_baseline,
  o.puntos_neto,
  o.fecha_dia,
  -- ¿Cuánto produjo el mismo perfil en Mañana hoy?
  m.puntos_neto AS neto_manana_hoy
FROM operaciones o
LEFT JOIN operaciones m
  ON m.id_perfil = o.id_perfil
  AND m.fecha_dia = CURRENT_DATE
  AND m.jornada = 'Mañana'
WHERE o.fecha_dia = CURRENT_DATE
  AND o.jornada = 'Noche'
ORDER BY o.id_perfil;
