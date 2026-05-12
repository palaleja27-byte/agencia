-- ══════════════════════════════════════════════════════════════════
-- CORTE 12:00 PM — 2026-05-12  (Jornada: Mañana)
-- Colombia UTC-5 | Datame UK UTC+1 | Diferencia: 6 horas
-- ── Regla DELTA-SHIFT™ ────────────────────────────────────────────
-- puntos_baseline = "Comienza" (fijado a las 6AM Colombia = fijo todo el turno)
-- puntos_total    = "En Curso" (valor actual en Datame a las 12PM Colombia)
-- puntos_neto     = puntos_total - puntos_baseline
-- ── Nota Timezone ────────────────────────────────────────────────
-- 6 AM Colombia = 12 PM UK → El watcher debe usar fecha Colombia (UTC-5)
-- al guardar fecha_dia en Supabase. Verificar que el watcher use:
--   new Date().toLocaleDateString('en-CA',{timeZone:'America/Bogota'})
-- ══════════════════════════════════════════════════════════════════

-- PASO 1: UPSERT completo con los 39 perfiles del Panel 1
-- ON CONFLICT respeta el baseline existente si ya es correcto.
-- Solo actualiza puntos_total si el nuevo valor es MAYOR.

INSERT INTO operaciones (id_perfil, agencia, puntos_baseline, puntos_total, puntos_neto, fecha_dia, jornada, puntos)
VALUES
-- Panel 1 (Corte 12PM — "Comienza" = baseline 6AM, "En Curso" = total actual)
  ('88243516',  'PANEL-1', 2723.10, 2834.76, 111.66, '2026-05-12', 'Mañana', 2834.76),
  ('95956014',  'PANEL-1', 985.68,  1001.16, 15.48,  '2026-05-12', 'Mañana', 1001.16),
  ('91360720',  'PANEL-1', 708.96,  709.08,  0.12,   '2026-05-12', 'Mañana', 709.08),
  ('143017065', 'PANEL-1', 267.18,  270.30,  3.12,   '2026-05-12', 'Mañana', 270.30),
  ('91733663',  'PANEL-1', 3446.28, 3519.60, 73.32,  '2026-05-12', 'Mañana', 3519.60),
  ('153039388', 'PANEL-1', 127.08,  128.76,  1.68,   '2026-05-12', 'Mañana', 128.76),
  ('706679999', 'PANEL-1', 394.26,  395.22,  0.96,   '2026-05-12', 'Mañana', 395.22),
  ('108551682', 'PANEL-1', 219.60,  220.38,  0.78,   '2026-05-12', 'Mañana', 220.38),
  ('131130713', 'PANEL-1', 859.92,  912.00,  52.08,  '2026-05-12', 'Mañana', 912.00),
  ('101652076', 'PANEL-1', 19.80,   20.40,   0.60,   '2026-05-12', 'Mañana', 20.40),
  ('108018336', 'PANEL-1', 1720.92, 1755.00, 34.08,  '2026-05-12', 'Mañana', 1755.00),
  ('103288167', 'PANEL-1', 1509.54, 1561.86, 52.32,  '2026-05-12', 'Mañana', 1561.86),
  ('118179794', 'PANEL-1', 921.30,  945.42,  24.12,  '2026-05-12', 'Mañana', 945.42),
  ('100338853', 'PANEL-1', 925.50,  937.32,  11.82,  '2026-05-12', 'Mañana', 937.32),
  ('160352260', 'PANEL-1', 128.88,  128.88,  0.00,   '2026-05-12', 'Mañana', 128.88),
  ('145834230', 'PANEL-1', 105.24,  105.24,  0.00,   '2026-05-12', 'Mañana', 105.24),
  ('120720195', 'PANEL-1', 532.92,  573.42,  40.50,  '2026-05-12', 'Mañana', 573.42),
  ('139247498', 'PANEL-1', 910.20,  951.54,  41.34,  '2026-05-12', 'Mañana', 951.54),
  ('120275229', 'PANEL-1', 127.80,  129.00,  1.20,   '2026-05-12', 'Mañana', 129.00),
  ('157067734', 'PANEL-1', 1160.94, 1234.74, 73.80,  '2026-05-12', 'Mañana', 1234.74),
  ('103231993', 'PANEL-1', 263.70,  266.46,  2.76,   '2026-05-12', 'Mañana', 266.46),
  ('104431310', 'PANEL-1', 614.58,  615.18,  0.60,   '2026-05-12', 'Mañana', 615.18),
  ('98369135',  'PANEL-1', 247.50,  249.30,  1.80,   '2026-05-12', 'Mañana', 249.30),
  ('139245989', 'PANEL-1', 590.40,  594.84,  4.44,   '2026-05-12', 'Mañana', 594.84),
  ('98540781',  'PANEL-1', 180.12,  180.12,  0.00,   '2026-05-12', 'Mañana', 180.12),
  ('156881990', 'PANEL-1', 430.26,  432.30,  2.04,   '2026-05-12', 'Mañana', 432.30),
  ('151070498', 'PANEL-1', 87.48,   88.56,   1.08,   '2026-05-12', 'Mañana', 88.56),
  ('130422416', 'PANEL-1', 1509.54, 1567.98, 58.44,  '2026-05-12', 'Mañana', 1567.98),
  ('138130329', 'PANEL-4', 790.68,  798.12,  7.44,   '2026-05-12', 'Mañana', 798.12),
  ('130085188', 'PANEL-1', 846.54,  848.34,  1.80,   '2026-05-12', 'Mañana', 848.34),
  ('118692242', 'PANEL-1', 82.68,   83.40,   0.72,   '2026-05-12', 'Mañana', 83.40),
  ('143014129', 'PANEL-2', 79.44,   79.44,   0.00,   '2026-05-12', 'Mañana', 79.44),
  ('95955130',  'PANEL-1', 195.00,  198.24,  3.24,   '2026-05-12', 'Mañana', 198.24),
  ('145211163', 'PANEL-3', 78.48,   78.84,   0.36,   '2026-05-12', 'Mañana', 78.84),
  ('144863124', 'PANEL-1', 1143.78, 1180.74, 36.96,  '2026-05-12', 'Mañana', 1180.74),
  ('155844971', 'PANEL-1', 1294.14, 1325.04, 30.90,  '2026-05-12', 'Mañana', 1325.04),
  ('156716207', 'PANEL-1', 170.46,  174.06,  3.60,   '2026-05-12', 'Mañana', 174.06),
  ('137163229', 'PANEL-1', 122.28,  124.32,  2.04,   '2026-05-12', 'Mañana', 124.32),
  ('157112125', 'PANEL-1', 1245.96, 1266.36, 20.40,  '2026-05-12', 'Mañana', 1266.36)
ON CONFLICT (id_perfil, fecha_dia, jornada)
DO UPDATE SET
  -- Actualizar total solo si el nuevo es mayor (el watcher puede estar más actualizado)
  puntos_total = GREATEST(operaciones.puntos_total, EXCLUDED.puntos_total),
  -- Baseline: usar el de la imagen SI el existente es corrupto (mayor que total)
  puntos_baseline = CASE
    WHEN operaciones.puntos_baseline IS NULL OR operaciones.puntos_baseline = 0
      THEN EXCLUDED.puntos_baseline
    WHEN operaciones.puntos_baseline > operaciones.puntos_total
      THEN EXCLUDED.puntos_baseline   -- corrupto: reemplazar
    ELSE operaciones.puntos_baseline  -- OK: proteger
  END,
  -- Recalcular neto con el total actualizado
  puntos_neto = GREATEST(0,
    GREATEST(operaciones.puntos_total, EXCLUDED.puntos_total) - CASE
      WHEN operaciones.puntos_baseline IS NULL OR operaciones.puntos_baseline = 0
        THEN EXCLUDED.puntos_baseline
      WHEN operaciones.puntos_baseline > operaciones.puntos_total
        THEN EXCLUDED.puntos_baseline
      ELSE operaciones.puntos_baseline
    END
  );

-- ── CORRECCIÓN CRÍTICA: DAMIAN ────────────────────────────────────
-- El fix anterior puso baseline=310.20 que era INCORRECTO.
-- El baseline real (6AM) de DAMIAN es 910.20 (confirmado en imagen 12PM).
UPDATE operaciones SET
  puntos_baseline = 910.20,
  puntos_total    = 951.54,
  puntos_neto     = 41.34
WHERE id_perfil = '139247498'
  AND fecha_dia = '2026-05-12'
  AND jornada   = 'Mañana';

-- ── VERIFICACIÓN FINAL ────────────────────────────────────────────
-- Debe mostrar 39 filas, todas ✅ OK, con puntos_neto correctos
SELECT
  id_perfil,
  agencia,
  ROUND(puntos_baseline::numeric, 2)   AS baseline,
  ROUND(puntos_total::numeric, 2)      AS total_actual,
  ROUND(puntos_neto::numeric, 2)       AS neto_db,
  ROUND((puntos_total - puntos_baseline)::numeric, 2) AS neto_calculado,
  CASE
    WHEN puntos_baseline > puntos_total              THEN '🔴 BASELINE CORRUPTO'
    WHEN ABS(puntos_neto - (puntos_total - puntos_baseline)) < 0.15 THEN '✅ OK'
    ELSE '❌ DESINCRONIZADO'
  END AS status
FROM operaciones
WHERE fecha_dia = '2026-05-12'
  AND jornada   = 'Mañana'
  AND id_perfil IN (
    '88243516','95956014','91360720','143017065','91733663',
    '153039388','706679999','108551682','131130713','101652076',
    '108018336','103288167','118179794','100338853','160352260',
    '145834230','120720195','139247498','120275229','157067734',
    '103231993','104431310','98369135','139245989','98540781',
    '156881990','151070498','130422416','138130329','130085188',
    '118692242','143014129','95955130','145211163','144863124',
    '155844971','156716207','137163229','157112125'
  )
ORDER BY neto_db DESC;
