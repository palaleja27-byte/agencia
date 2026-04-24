-- ═══════════════════════════════════════════════════════════════
-- SANITIZACIÓN QUIRÚRGICA — 24-Abr-2026 13:27
-- Corrige baselines corruptos donde neto > 60% del total mensual
-- EJECUTAR EN SUPABASE → SQL Editor → Run
-- ═══════════════════════════════════════════════════════════════

-- ── PASO 1: Diagnóstico — ver todos los perfiles con sus valores ──
SELECT
  agencia                                     AS nombre,
  id_perfil,
  ROUND(puntos_baseline::numeric,  2)         AS baseline_6am,
  ROUND(puntos_total::numeric,     2)         AS total_mensual,
  ROUND(puntos_neto::numeric,      2)         AS neto_turno,
  ROUND((puntos_neto / NULLIF(puntos_total,0) * 100)::numeric, 1) AS pct_del_total,
  CASE
    WHEN puntos_neto > puntos_total * 0.60 THEN '🔴 BASELINE CORRUPTO'
    WHEN puntos_baseline <= 0              THEN '⚠️ SIN BASELINE'
    ELSE '✅ OK'
  END AS estado
FROM operaciones
WHERE fecha_dia = '2026-04-24'
  AND jornada   = 'Mañana'
  AND puntos_total > 0
ORDER BY pct_del_total DESC NULLS LAST;

-- ── PASO 2: Corrección quirúrgica de RENEE (143014129) ──
-- Su baseline fue fijado en 18.69 por error (confundida con otro perfil)
-- Total actual: 220.4 → La producción real de mañana es ≈ 1.8 pts
UPDATE operaciones
SET
  puntos_baseline = 218.60,
  puntos_neto     = 1.80
WHERE id_perfil = 143014129
  AND fecha_dia = '2026-04-24'
  AND jornada   = 'Mañana';

-- ── PASO 3: Sanitización masiva de TODOS los baselines corruptos ──
-- Para perfiles con neto > 60% del total: el baseline estaba muy bajo
-- Se corrige fijando el baseline como total * 0.97 (neto = 3% del total ≈ producción conservadora)
UPDATE operaciones
SET
  puntos_neto     = ROUND((puntos_total * 0.03)::numeric, 2),
  puntos_baseline = ROUND((puntos_total * 0.97)::numeric, 2)
WHERE fecha_dia   = '2026-04-24'
  AND jornada     = 'Mañana'
  AND puntos_total > 100
  AND puntos_neto  > puntos_total * 0.60;

-- ── PASO 4: Verificación final ──
SELECT
  agencia                                     AS nombre,
  id_perfil,
  ROUND(puntos_baseline::numeric, 2)          AS baseline_6am,
  ROUND(puntos_total::numeric,    2)          AS total_mensual,
  ROUND(puntos_neto::numeric,     2)          AS neto_turno,
  ROUND((puntos_neto / NULLIF(puntos_total,0) * 100)::numeric, 1) AS pct_del_total,
  CASE
    WHEN puntos_neto > puntos_total * 0.60 THEN '🔴 AÚN CON ERROR'
    ELSE '✅ OK'
  END AS estado
FROM operaciones
WHERE fecha_dia = '2026-04-24'
  AND jornada   = 'Mañana'
  AND puntos_total > 0
ORDER BY puntos_neto DESC;
