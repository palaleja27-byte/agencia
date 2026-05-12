-- ══════════════════════════════════════════════════════════════════
-- FIX URGENTE — 2026-05-12 10:58 AM
-- ══════════════════════════════════════════════════════════════════

-- 1. CORREGIR DAMIAN (139247498) — baseline corrupto (915.96 > total 332.76)
--    Imagen corte 10AM: Comienza=310.20, En Curso=332.76, Total=22.56
UPDATE operaciones SET
  puntos_baseline = 310.20,
  puntos_total    = 332.76,
  puntos_neto     = 22.56
WHERE id_perfil = '139247498'
  AND fecha_dia = '2026-05-12'
  AND jornada   = 'Mañana';

-- 2. INSERTAR perfiles faltantes que el watcher aún no creó
--    (los que no aparecieron en la consulta anterior de 28 filas)
--    Usamos ON CONFLICT DO NOTHING para no duplicar los que ya existen.
INSERT INTO operaciones (id_perfil, agencia, puntos_baseline, puntos_total, puntos_neto, fecha_dia, jornada, puntos)
VALUES
  ('88243516',  'PANEL-1', 2723.10, 2817.96, 94.86,  '2026-05-12', 'Mañana', 2817.96),
  ('95956014',  'PANEL-1', 985.68,  992.88,  7.20,   '2026-05-12', 'Mañana', 992.88),
  ('143017065', 'PANEL-1', 267.18,  268.86,  1.68,   '2026-05-12', 'Mañana', 268.86),
  ('91733663',  'PANEL-1', 3446.28, 3509.76, 63.48,  '2026-05-12', 'Mañana', 3509.76),
  ('153039388', 'PANEL-1', 127.08,  128.76,  1.68,   '2026-05-12', 'Mañana', 128.76),
  ('706679999', 'PANEL-1', 394.26,  394.26,  0.00,   '2026-05-12', 'Mañana', 394.26),
  ('108551682', 'PANEL-1', 219.60,  220.14,  0.54,   '2026-05-12', 'Mañana', 220.14),
  ('131130713', 'PANEL-1', 859.92,  880.80,  20.88,  '2026-05-12', 'Mañana', 880.80),
  ('101652076', 'PANEL-1', 19.80,   20.40,   0.60,   '2026-05-12', 'Mañana', 20.40),
  ('108018336', 'PANEL-1', 1720.92, 1743.72, 22.80,  '2026-05-12', 'Mañana', 1743.72),
  ('103288167', 'PANEL-1', 1509.54, 1535.76, 26.22,  '2026-05-12', 'Mañana', 1535.76),
  ('118179794', 'PANEL-1', 921.30,  936.06,  14.76,  '2026-05-12', 'Mañana', 936.06),
  ('100338853', 'PANEL-1', 925.50,  933.42,  7.92,   '2026-05-12', 'Mañana', 933.42),
  ('160352260', 'PANEL-1', 128.88,  128.88,  0.00,   '2026-05-12', 'Mañana', 128.88),
  ('120720195', 'PANEL-1', 553.92,  557.52,  3.60,   '2026-05-12', 'Mañana', 557.52),
  ('120275229', 'PANEL-1', 127.80,  127.80,  0.00,   '2026-05-12', 'Mañana', 127.80),
  ('157067734', 'PANEL-1', 1160.94, 1192.50, 31.56,  '2026-05-12', 'Mañana', 1192.50),
  ('103231993', 'PANEL-1', 263.70,  265.50,  1.80,   '2026-05-12', 'Mañana', 265.50),
  ('104431310', 'PANEL-1', 614.58,  614.70,  0.12,   '2026-05-12', 'Mañana', 614.70),
  ('98369135',  'PANEL-1', 247.50,  249.30,  1.80,   '2026-05-12', 'Mañana', 249.30),
  ('139245989', 'PANEL-1', 590.40,  593.52,  3.12,   '2026-05-12', 'Mañana', 593.52),
  ('156881990', 'PANEL-1', 430.26,  431.58,  1.32,   '2026-05-12', 'Mañana', 431.58),
  ('151070498', 'PANEL-1', 87.48,   88.32,   0.84,   '2026-05-12', 'Mañana', 88.32),
  ('130422416', 'PANEL-1', 1509.54, 1541.70, 32.16,  '2026-05-12', 'Mañana', 1541.70),
  ('138130329', 'PANEL-4', 790.68,  793.92,  3.24,   '2026-05-12', 'Mañana', 793.92),
  ('130085188', 'PANEL-1', 846.54,  847.86,  1.32,   '2026-05-12', 'Mañana', 847.86),
  ('118692242', 'PANEL-1', 82.68,   83.40,   0.72,   '2026-05-12', 'Mañana', 83.40),
  ('143014129', 'PANEL-2', 79.44,   79.44,   0.00,   '2026-05-12', 'Mañana', 79.44),
  ('95955130',  'PANEL-1', 195.00,  196.80,  1.80,   '2026-05-12', 'Mañana', 196.80),
  ('144863124', 'PANEL-1', 1149.48, 1164.24, 14.76,  '2026-05-12', 'Mañana', 1164.24),
  ('155844971', 'PANEL-1', 1294.14, 1307.34, 13.20,  '2026-05-12', 'Mañana', 1307.34),
  ('156716207', 'PANEL-1', 170.46,  172.74,  2.28,   '2026-05-12', 'Mañana', 172.74),
  ('137163229', 'PANEL-1', 122.28,  123.00,  0.72,   '2026-05-12', 'Mañana', 123.00),
  ('157112125', 'PANEL-1', 1245.96, 1263.24, 17.28,  '2026-05-12', 'Mañana', 1263.24),
  -- Panel 2
  ('113579174', 'PANEL-2', 96.78,   97.26,   0.48,   '2026-05-12', 'Mañana', 97.26),
  ('93461947',  'PANEL-2', 100.32,  100.56,  0.24,   '2026-05-12', 'Mañana', 100.56),
  ('164812184', 'PANEL-2', 2.88,    3.00,    0.12,   '2026-05-12', 'Mañana', 3.00),
  ('158644203', 'PANEL-2', 66.36,   68.04,   1.68,   '2026-05-12', 'Mañana', 68.04),
  ('99611942',  'PANEL-2', 6.06,    6.06,    0.00,   '2026-05-12', 'Mañana', 6.06),
  ('113752797', 'PANEL-2', 249.18,  249.18,  0.00,   '2026-05-12', 'Mañana', 249.18),
  ('101245945', 'PANEL-2', 771.96,  798.30,  26.34,  '2026-05-12', 'Mañana', 798.30),
  ('114851358', 'PANEL-2', 27.72,   29.28,   1.56,   '2026-05-12', 'Mañana', 29.28),
  ('151410237', 'PANEL-2', 1629.24, 1629.36, 0.12,   '2026-05-12', 'Mañana', 1629.36),
  ('145833775', 'PANEL-2', 314.40,  321.96,  7.56,   '2026-05-12', 'Mañana', 321.96)
ON CONFLICT (id_perfil, fecha_dia, jornada)
DO UPDATE SET
  -- Solo actualiza si el total es mayor (el watcher ya puede haber avanzado)
  puntos_total    = GREATEST(operaciones.puntos_total, EXCLUDED.puntos_total),
  -- Protege el baseline: solo lo toca si está corrupto (baseline > total)
  puntos_baseline = CASE
    WHEN operaciones.puntos_baseline > operaciones.puntos_total THEN EXCLUDED.puntos_baseline
    WHEN operaciones.puntos_baseline IS NULL OR operaciones.puntos_baseline = 0 THEN EXCLUDED.puntos_baseline
    ELSE operaciones.puntos_baseline
  END,
  puntos_neto = GREATEST(0,
    GREATEST(operaciones.puntos_total, EXCLUDED.puntos_total) -
    CASE
      WHEN operaciones.puntos_baseline > operaciones.puntos_total THEN EXCLUDED.puntos_baseline
      WHEN operaciones.puntos_baseline IS NULL OR operaciones.puntos_baseline = 0 THEN EXCLUDED.puntos_baseline
      ELSE operaciones.puntos_baseline
    END
  );

-- 3. VERIFICAR RESULTADO FINAL — debe mostrar 49 filas, todas ✅ OK
SELECT
  id_perfil,
  agencia,
  puntos_baseline,
  puntos_total,
  puntos_neto,
  ROUND(puntos_total::numeric - puntos_baseline::numeric, 2) AS neto_calculado,
  CASE
    WHEN puntos_baseline > puntos_total THEN '🔴 BASELINE CORRUPTO'
    WHEN ABS(puntos_neto - (puntos_total - puntos_baseline)) < 0.10 THEN '✅ OK'
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
    '155844971','156716207','137163229','157112125',
    '113579174','93461947','164812184','158644203','99611942',
    '113752797','101245945','114851358','151410237','145833775'
  )
ORDER BY status DESC, puntos_neto DESC;
