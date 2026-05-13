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
-- PASO 7: CALIBRACIÓN MASIVA (EJECUTAR PARA REPARAR HOY)
-- Actualiza el baseline al valor "Comienza" de la imagen de las 12:00 PM
-- Esto forzará que puntos_neto = puntos_total - baseline_imagen
-- ──────────────────────────────────────────────────────────────────────
-- PANEL 1
UPDATE operaciones SET puntos_baseline = 3165.84 WHERE fecha_dia = '2026-05-13' AND jornada = 'Mañana' AND id_perfil = '88243516';
UPDATE operaciones SET puntos_baseline = 1047.72 WHERE fecha_dia = '2026-05-13' AND jornada = 'Mañana' AND id_perfil = '95956014';
UPDATE operaciones SET puntos_baseline = 711.00  WHERE fecha_dia = '2026-05-13' AND jornada = 'Mañana' AND id_perfil = '91360720';
UPDATE operaciones SET puntos_baseline = 276.06  WHERE fecha_dia = '2026-05-13' AND jornada = 'Mañana' AND id_perfil = '143017065';
UPDATE operaciones SET puntos_baseline = 3682.98 WHERE fecha_dia = '2026-05-13' AND jornada = 'Mañana' AND id_perfil = '91733663';
UPDATE operaciones SET puntos_baseline = 136.92  WHERE fecha_dia = '2026-05-13' AND jornada = 'Mañana' AND id_perfil = '153039388';
UPDATE operaciones SET puntos_baseline = 399.66  WHERE fecha_dia = '2026-05-13' AND jornada = 'Mañana' AND id_perfil = '79679899';
UPDATE operaciones SET puntos_baseline = 239.10  WHERE fecha_dia = '2026-05-13' AND jornada = 'Mañana' AND id_perfil = '109551682';
UPDATE operaciones SET puntos_baseline = 1076.58 WHERE fecha_dia = '2026-05-13' AND jornada = 'Mañana' AND id_perfil = '131130713';
UPDATE operaciones SET puntos_baseline = 21.00   WHERE fecha_dia = '2026-05-13' AND jornada = 'Mañana' AND id_perfil = '101652076';
UPDATE operaciones SET puntos_baseline = 1830.96 WHERE fecha_dia = '2026-05-13' AND jornada = 'Mañana' AND id_perfil = '108018336';
UPDATE operaciones SET puntos_baseline = 1632.42 WHERE fecha_dia = '2026-05-13' AND jornada = 'Mañana' AND id_perfil = '103289167';
UPDATE operaciones SET puntos_baseline = 1019.58 WHERE fecha_dia = '2026-05-13' AND jornada = 'Mañana' AND id_perfil = '118179794';
UPDATE operaciones SET puntos_baseline = 247.44  WHERE fecha_dia = '2026-05-13' AND jornada = 'Mañana' AND id_perfil = '160352260';
UPDATE operaciones SET puntos_baseline = 108.12  WHERE fecha_dia = '2026-05-13' AND jornada = 'Mañana' AND id_perfil = '145834230';
UPDATE operaciones SET puntos_baseline = 669.72  WHERE fecha_dia = '2026-05-13' AND jornada = 'Mañana' AND id_perfil = '120720195';
UPDATE operaciones SET puntos_baseline = 1081.44 WHERE fecha_dia = '2026-05-13' AND jornada = 'Mañana' AND id_perfil = '139247498';
UPDATE operaciones SET puntos_baseline = 136.20  WHERE fecha_dia = '2026-05-13' AND jornada = 'Mañana' AND id_perfil = '120275229';
UPDATE operaciones SET puntos_baseline = 1416.30 WHERE fecha_dia = '2026-05-13' AND jornada = 'Mañana' AND id_perfil = '157067734';
UPDATE operaciones SET puntos_baseline = 283.74  WHERE fecha_dia = '2026-05-13' AND jornada = 'Mañana' AND id_perfil = '103291980';
UPDATE operaciones SET puntos_baseline = 628.98  WHERE fecha_dia = '2026-05-13' AND jornada = 'Mañana' AND id_perfil = '130431310';
UPDATE operaciones SET puntos_baseline = 253.14  WHERE fecha_dia = '2026-05-13' AND jornada = 'Mañana' AND id_perfil = '98389135';
UPDATE operaciones SET puntos_baseline = 620.28  WHERE fecha_dia = '2026-05-13' AND jornada = 'Mañana' AND id_perfil = '139245989';
UPDATE operaciones SET puntos_baseline = 183.24  WHERE fecha_dia = '2026-05-13' AND jornada = 'Mañana' AND id_perfil = '98540781';
UPDATE operaciones SET puntos_baseline = 481.50  WHERE fecha_dia = '2026-05-13' AND jornada = 'Mañana' AND id_perfil = '156881990';
UPDATE operaciones SET puntos_baseline = 93.72   WHERE fecha_dia = '2026-05-13' AND jornada = 'Mañana' AND id_perfil = '151070498';
UPDATE operaciones SET puntos_baseline = 1661.52 WHERE fecha_dia = '2026-05-13' AND jornada = 'Mañana' AND id_perfil = '130422416';
UPDATE operaciones SET puntos_baseline = 843.90  WHERE fecha_dia = '2026-05-13' AND jornada = 'Mañana' AND id_perfil = '138130329';
UPDATE operaciones SET puntos_baseline = 866.94  WHERE fecha_dia = '2026-05-13' AND jornada = 'Mañana' AND id_perfil = '133085188';
UPDATE operaciones SET puntos_baseline = 89.40   WHERE fecha_dia = '2026-05-13' AND jornada = 'Mañana' AND id_perfil = '118692242';
UPDATE operaciones SET puntos_baseline = 82.68   WHERE fecha_dia = '2026-05-13' AND jornada = 'Mañana' AND id_perfil = '143014129';
UPDATE operaciones SET puntos_baseline = 222.42  WHERE fecha_dia = '2026-05-13' AND jornada = 'Mañana' AND id_perfil = '95955130';
UPDATE operaciones SET puntos_baseline = 86.16   WHERE fecha_dia = '2026-05-13' AND jornada = 'Mañana' AND id_perfil = '145211163';
UPDATE operaciones SET puntos_baseline = 1245.78 WHERE fecha_dia = '2026-05-13' AND jornada = 'Mañana' AND id_perfil = '144863124';
UPDATE operaciones SET puntos_baseline = 1398.06 WHERE fecha_dia = '2026-05-13' AND jornada = 'Mañana' AND id_perfil = '145844971';
UPDATE operaciones SET puntos_baseline = 181.74  WHERE fecha_dia = '2026-05-13' AND jornada = 'Mañana' AND id_perfil = '156716207';
UPDATE operaciones SET puntos_baseline = 133.44  WHERE fecha_dia = '2026-05-13' AND jornada = 'Mañana' AND id_perfil = '137163229';
UPDATE operaciones SET puntos_baseline = 1373.52 WHERE fecha_dia = '2026-05-13' AND jornada = 'Mañana' AND id_perfil = '157112125';

-- PANEL 2
UPDATE operaciones SET puntos_baseline = 109.26  WHERE fecha_dia = '2026-05-13' AND jornada = 'Mañana' AND id_perfil = '113579174';
UPDATE operaciones SET puntos_baseline = 110.94  WHERE fecha_dia = '2026-05-13' AND jornada = 'Mañana' AND id_perfil = '93461947';
UPDATE operaciones SET puntos_baseline = 11.40   WHERE fecha_dia = '2026-05-13' AND jornada = 'Mañana' AND id_perfil = '164812184';
UPDATE operaciones SET puntos_baseline = 80.76   WHERE fecha_dia = '2026-05-13' AND jornada = 'Mañana' AND id_perfil = '158644203';
UPDATE operaciones SET puntos_baseline = 7.02    WHERE fecha_dia = '2026-05-13' AND jornada = 'Mañana' AND id_perfil = '99611942';
UPDATE operaciones SET puntos_baseline = 259.50  WHERE fecha_dia = '2026-05-13' AND jornada = 'Mañana' AND id_perfil = '113752797';
UPDATE operaciones SET puntos_baseline = 853.38  WHERE fecha_dia = '2026-05-13' AND jornada = 'Mañana' AND id_perfil = '101245945';
UPDATE operaciones SET puntos_baseline = 34.08   WHERE fecha_dia = '2026-05-13' AND jornada = 'Mañana' AND id_perfil = '114851358';
UPDATE operaciones SET puntos_baseline = 178.38  WHERE fecha_dia = '2026-05-13' AND jornada = 'Mañana' AND id_perfil = '151410237';
UPDATE operaciones SET puntos_baseline = 972.60  WHERE fecha_dia = '2026-05-13' AND jornada = 'Mañana' AND id_perfil = '145839775';

-- PASO FINAL: RECALCULAR PUNTOS_NETO PARA TODOS
UPDATE operaciones
SET puntos_neto = ROUND((puntos_total - puntos_baseline)::numeric, 2)
WHERE fecha_dia = '2026-05-13' AND jornada = 'Mañana';

