-- ═══════════════════════════════════════════════════════════════
-- MIGRACIÓN — Seed Histórico AgenciaRR
-- Ejecutar ANTES de correr seed_historico.js en GitHub Actions
-- SUPABASE → SQL Editor → Run (solo una vez)
-- ═══════════════════════════════════════════════════════════════

-- ── PASO 0: Verificar que la constraint UNIQUE existe ───────────
-- Si no existe, crearla para que el upsert funcione correctamente.
-- El seed_historico.js usa onConflict: 'id_perfil,fecha_dia,jornada'
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'operaciones_id_perfil_fecha_dia_jornada_key'
  ) THEN
    ALTER TABLE operaciones
      ADD CONSTRAINT operaciones_id_perfil_fecha_dia_jornada_key
      UNIQUE (id_perfil, fecha_dia, jornada);
    RAISE NOTICE 'Constraint UNIQUE creada correctamente';
  ELSE
    RAISE NOTICE 'Constraint UNIQUE ya existia';
  END IF;
END;
$$;

-- ── PASO 1: Ver qué datos históricos ya existen (jornada='MES') ─
SELECT
  agencia,
  id_perfil,
  fecha_dia,
  jornada,
  ROUND(puntos_neto::numeric, 1) AS puntos_neto
FROM operaciones
WHERE jornada = 'MES'
ORDER BY fecha_dia, agencia;

-- ── PASO 2: (OPCIONAL) Borrar registros MES previos para re-sembrar limpio
-- Descomentar si quieres empezar de cero con el seed
-- DELETE FROM operaciones WHERE jornada = 'MES';

-- ═══════════════════════════════════════════════════════════════
-- SANITIZACIÓN QUIRÚRGICA — 24-Abr-2026
-- ═══════════════════════════════════════════════════════════════

-- ── PASO 3: Diagnóstico de baselines del día actual ─────────────
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
WHERE fecha_dia = TO_CHAR(CURRENT_DATE, 'YYYY-MM-DD')
  AND jornada   != 'MES'
  AND jornada   != 'Auto'
  AND puntos_total > 0
ORDER BY pct_del_total DESC NULLS LAST;

-- ── PASO 4: Sanitización masiva de baselines corruptos ──────────
UPDATE operaciones
SET
  puntos_neto     = ROUND((puntos_total * 0.03)::numeric, 2),
  puntos_baseline = ROUND((puntos_total * 0.97)::numeric, 2)
WHERE fecha_dia   = TO_CHAR(CURRENT_DATE, 'YYYY-MM-DD')
  AND jornada     != 'MES'
  AND jornada     != 'Auto'
  AND puntos_total > 100
  AND puntos_neto  > puntos_total * 0.60;

-- ── PASO 5: Verificación final ──────────────────────────────────
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
WHERE fecha_dia = TO_CHAR(CURRENT_DATE, 'YYYY-MM-DD')
  AND jornada   != 'MES'
  AND jornada   != 'Auto'
  AND puntos_total > 0
ORDER BY puntos_neto DESC;
