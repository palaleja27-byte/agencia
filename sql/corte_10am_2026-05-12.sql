-- ══════════════════════════════════════════════════════════════════
-- CORTE 10:00 AM — 2026-05-12  (Jornada: Mañana)
-- DELTA-SHIFT™: puntos_neto = puntos_total(ahora) - puntos_baseline(6am)
-- INSTRUCCIÓN: Actualiza puntos_total con los valores "En Curso" de la imagen.
-- puntos_baseline NO se toca (ya fijado por el watcher a las 6am).
-- puntos_neto se RECALCULA: puntos_total - puntos_baseline.
-- ══════════════════════════════════════════════════════════════════

-- ── PANEL 1 ───────────────────────────────────────────────────────
UPDATE operaciones SET
  puntos_total = 2817.96,
  puntos_neto  = GREATEST(0, 2817.96 - COALESCE(puntos_baseline, 2817.96))
WHERE id_perfil = '88243516' AND fecha_dia = '2026-05-12' AND jornada = 'Mañana';

UPDATE operaciones SET
  puntos_total = 992.88,
  puntos_neto  = GREATEST(0, 992.88 - COALESCE(puntos_baseline, 992.88))
WHERE id_perfil = '95956014' AND fecha_dia = '2026-05-12' AND jornada = 'Mañana';

UPDATE operaciones SET
  puntos_total = 709.08,
  puntos_neto  = GREATEST(0, 709.08 - COALESCE(puntos_baseline, 709.08))
WHERE id_perfil = '91360720' AND fecha_dia = '2026-05-12' AND jornada = 'Mañana';

UPDATE operaciones SET
  puntos_total = 268.86,
  puntos_neto  = GREATEST(0, 268.86 - COALESCE(puntos_baseline, 268.86))
WHERE id_perfil = '143017065' AND fecha_dia = '2026-05-12' AND jornada = 'Mañana';

UPDATE operaciones SET
  puntos_total = 3509.76,
  puntos_neto  = GREATEST(0, 3509.76 - COALESCE(puntos_baseline, 3509.76))
WHERE id_perfil = '91733663' AND fecha_dia = '2026-05-12' AND jornada = 'Mañana';

UPDATE operaciones SET
  puntos_total = 128.76,
  puntos_neto  = GREATEST(0, 128.76 - COALESCE(puntos_baseline, 128.76))
WHERE id_perfil = '153039388' AND fecha_dia = '2026-05-12' AND jornada = 'Mañana';

UPDATE operaciones SET
  puntos_total = 394.26,
  puntos_neto  = GREATEST(0, 394.26 - COALESCE(puntos_baseline, 394.26))
WHERE id_perfil = '706679999' AND fecha_dia = '2026-05-12' AND jornada = 'Mañana';

UPDATE operaciones SET
  puntos_total = 220.14,
  puntos_neto  = GREATEST(0, 220.14 - COALESCE(puntos_baseline, 220.14))
WHERE id_perfil = '108551682' AND fecha_dia = '2026-05-12' AND jornada = 'Mañana';

UPDATE operaciones SET
  puntos_total = 880.80,
  puntos_neto  = GREATEST(0, 880.80 - COALESCE(puntos_baseline, 880.80))
WHERE id_perfil = '131130713' AND fecha_dia = '2026-05-12' AND jornada = 'Mañana';

UPDATE operaciones SET
  puntos_total = 20.40,
  puntos_neto  = GREATEST(0, 20.40 - COALESCE(puntos_baseline, 20.40))
WHERE id_perfil = '101652076' AND fecha_dia = '2026-05-12' AND jornada = 'Mañana';

UPDATE operaciones SET
  puntos_total = 1743.72,
  puntos_neto  = GREATEST(0, 1743.72 - COALESCE(puntos_baseline, 1743.72))
WHERE id_perfil = '108018336' AND fecha_dia = '2026-05-12' AND jornada = 'Mañana';

UPDATE operaciones SET
  puntos_total = 1535.76,
  puntos_neto  = GREATEST(0, 1535.76 - COALESCE(puntos_baseline, 1535.76))
WHERE id_perfil = '103288167' AND fecha_dia = '2026-05-12' AND jornada = 'Mañana';

UPDATE operaciones SET
  puntos_total = 936.06,
  puntos_neto  = GREATEST(0, 936.06 - COALESCE(puntos_baseline, 936.06))
WHERE id_perfil = '118179794' AND fecha_dia = '2026-05-12' AND jornada = 'Mañana';

UPDATE operaciones SET
  puntos_total = 933.42,
  puntos_neto  = GREATEST(0, 933.42 - COALESCE(puntos_baseline, 933.42))
WHERE id_perfil = '100338853' AND fecha_dia = '2026-05-12' AND jornada = 'Mañana';

UPDATE operaciones SET
  puntos_total = 128.88,
  puntos_neto  = GREATEST(0, 128.88 - COALESCE(puntos_baseline, 128.88))
WHERE id_perfil = '160352260' AND fecha_dia = '2026-05-12' AND jornada = 'Mañana';

UPDATE operaciones SET
  puntos_total = 105.24,
  puntos_neto  = GREATEST(0, 105.24 - COALESCE(puntos_baseline, 105.24))
WHERE id_perfil = '145834230' AND fecha_dia = '2026-05-12' AND jornada = 'Mañana';

UPDATE operaciones SET
  puntos_total = 557.52,
  puntos_neto  = GREATEST(0, 557.52 - COALESCE(puntos_baseline, 557.52))
WHERE id_perfil = '120720195' AND fecha_dia = '2026-05-12' AND jornada = 'Mañana';

UPDATE operaciones SET
  puntos_total = 332.76,
  puntos_neto  = GREATEST(0, 332.76 - COALESCE(puntos_baseline, 332.76))
WHERE id_perfil = '139247498' AND fecha_dia = '2026-05-12' AND jornada = 'Mañana';

UPDATE operaciones SET
  puntos_total = 127.80,
  puntos_neto  = GREATEST(0, 127.80 - COALESCE(puntos_baseline, 127.80))
WHERE id_perfil = '120275229' AND fecha_dia = '2026-05-12' AND jornada = 'Mañana';

UPDATE operaciones SET
  puntos_total = 1192.50,
  puntos_neto  = GREATEST(0, 1192.50 - COALESCE(puntos_baseline, 1192.50))
WHERE id_perfil = '157067734' AND fecha_dia = '2026-05-12' AND jornada = 'Mañana';

UPDATE operaciones SET
  puntos_total = 265.50,
  puntos_neto  = GREATEST(0, 265.50 - COALESCE(puntos_baseline, 265.50))
WHERE id_perfil = '103231993' AND fecha_dia = '2026-05-12' AND jornada = 'Mañana';

UPDATE operaciones SET
  puntos_total = 614.70,
  puntos_neto  = GREATEST(0, 614.70 - COALESCE(puntos_baseline, 614.70))
WHERE id_perfil = '104431310' AND fecha_dia = '2026-05-12' AND jornada = 'Mañana';

UPDATE operaciones SET
  puntos_total = 249.30,
  puntos_neto  = GREATEST(0, 249.30 - COALESCE(puntos_baseline, 249.30))
WHERE id_perfil = '98369135' AND fecha_dia = '2026-05-12' AND jornada = 'Mañana';

UPDATE operaciones SET
  puntos_total = 593.52,
  puntos_neto  = GREATEST(0, 593.52 - COALESCE(puntos_baseline, 593.52))
WHERE id_perfil = '139245989' AND fecha_dia = '2026-05-12' AND jornada = 'Mañana';

UPDATE operaciones SET
  puntos_total = 180.12,
  puntos_neto  = GREATEST(0, 180.12 - COALESCE(puntos_baseline, 180.12))
WHERE id_perfil = '98540781' AND fecha_dia = '2026-05-12' AND jornada = 'Mañana';

UPDATE operaciones SET
  puntos_total = 431.58,
  puntos_neto  = GREATEST(0, 431.58 - COALESCE(puntos_baseline, 431.58))
WHERE id_perfil = '156881990' AND fecha_dia = '2026-05-12' AND jornada = 'Mañana';

UPDATE operaciones SET
  puntos_total = 88.32,
  puntos_neto  = GREATEST(0, 88.32 - COALESCE(puntos_baseline, 88.32))
WHERE id_perfil = '151070498' AND fecha_dia = '2026-05-12' AND jornada = 'Mañana';

UPDATE operaciones SET
  puntos_total = 1541.70,
  puntos_neto  = GREATEST(0, 1541.70 - COALESCE(puntos_baseline, 1541.70))
WHERE id_perfil = '130422416' AND fecha_dia = '2026-05-12' AND jornada = 'Mañana';

UPDATE operaciones SET
  puntos_total = 793.92,
  puntos_neto  = GREATEST(0, 793.92 - COALESCE(puntos_baseline, 793.92))
WHERE id_perfil = '138130329' AND fecha_dia = '2026-05-12' AND jornada = 'Mañana';

UPDATE operaciones SET
  puntos_total = 847.86,
  puntos_neto  = GREATEST(0, 847.86 - COALESCE(puntos_baseline, 847.86))
WHERE id_perfil = '130085188' AND fecha_dia = '2026-05-12' AND jornada = 'Mañana';

UPDATE operaciones SET
  puntos_total = 83.40,
  puntos_neto  = GREATEST(0, 83.40 - COALESCE(puntos_baseline, 83.40))
WHERE id_perfil = '118692242' AND fecha_dia = '2026-05-12' AND jornada = 'Mañana';

UPDATE operaciones SET
  puntos_total = 79.44,
  puntos_neto  = GREATEST(0, 79.44 - COALESCE(puntos_baseline, 79.44))
WHERE id_perfil = '143014129' AND fecha_dia = '2026-05-12' AND jornada = 'Mañana';

UPDATE operaciones SET
  puntos_total = 196.80,
  puntos_neto  = GREATEST(0, 196.80 - COALESCE(puntos_baseline, 196.80))
WHERE id_perfil = '95955130' AND fecha_dia = '2026-05-12' AND jornada = 'Mañana';

UPDATE operaciones SET
  puntos_total = 78.72,
  puntos_neto  = GREATEST(0, 78.72 - COALESCE(puntos_baseline, 78.72))
WHERE id_perfil = '145211163' AND fecha_dia = '2026-05-12' AND jornada = 'Mañana';

UPDATE operaciones SET
  puntos_total = 1164.24,
  puntos_neto  = GREATEST(0, 1164.24 - COALESCE(puntos_baseline, 1164.24))
WHERE id_perfil = '144863124' AND fecha_dia = '2026-05-12' AND jornada = 'Mañana';

UPDATE operaciones SET
  puntos_total = 1307.34,
  puntos_neto  = GREATEST(0, 1307.34 - COALESCE(puntos_baseline, 1307.34))
WHERE id_perfil = '155844971' AND fecha_dia = '2026-05-12' AND jornada = 'Mañana';

UPDATE operaciones SET
  puntos_total = 172.74,
  puntos_neto  = GREATEST(0, 172.74 - COALESCE(puntos_baseline, 172.74))
WHERE id_perfil = '156716207' AND fecha_dia = '2026-05-12' AND jornada = 'Mañana';

UPDATE operaciones SET
  puntos_total = 123.00,
  puntos_neto  = GREATEST(0, 123.00 - COALESCE(puntos_baseline, 123.00))
WHERE id_perfil = '137163229' AND fecha_dia = '2026-05-12' AND jornada = 'Mañana';

UPDATE operaciones SET
  puntos_total = 1263.24,
  puntos_neto  = GREATEST(0, 1263.24 - COALESCE(puntos_baseline, 1263.24))
WHERE id_perfil = '157112125' AND fecha_dia = '2026-05-12' AND jornada = 'Mañana';

-- ── PANEL 2 ───────────────────────────────────────────────────────
UPDATE operaciones SET
  puntos_total = 97.26,
  puntos_neto  = GREATEST(0, 97.26 - COALESCE(puntos_baseline, 97.26))
WHERE id_perfil = '113579174' AND fecha_dia = '2026-05-12' AND jornada = 'Mañana';

UPDATE operaciones SET
  puntos_total = 100.56,
  puntos_neto  = GREATEST(0, 100.56 - COALESCE(puntos_baseline, 100.56))
WHERE id_perfil = '93461947' AND fecha_dia = '2026-05-12' AND jornada = 'Mañana';

UPDATE operaciones SET
  puntos_total = 3.00,
  puntos_neto  = GREATEST(0, 3.00 - COALESCE(puntos_baseline, 3.00))
WHERE id_perfil = '164812184' AND fecha_dia = '2026-05-12' AND jornada = 'Mañana';

UPDATE operaciones SET
  puntos_total = 68.04,
  puntos_neto  = GREATEST(0, 68.04 - COALESCE(puntos_baseline, 68.04))
WHERE id_perfil = '158644203' AND fecha_dia = '2026-05-12' AND jornada = 'Mañana';

UPDATE operaciones SET
  puntos_total = 6.06,
  puntos_neto  = GREATEST(0, 6.06 - COALESCE(puntos_baseline, 6.06))
WHERE id_perfil = '99611942' AND fecha_dia = '2026-05-12' AND jornada = 'Mañana';

UPDATE operaciones SET
  puntos_total = 249.18,
  puntos_neto  = GREATEST(0, 249.18 - COALESCE(puntos_baseline, 249.18))
WHERE id_perfil = '113752797' AND fecha_dia = '2026-05-12' AND jornada = 'Mañana';

UPDATE operaciones SET
  puntos_total = 798.30,
  puntos_neto  = GREATEST(0, 798.30 - COALESCE(puntos_baseline, 798.30))
WHERE id_perfil = '101245945' AND fecha_dia = '2026-05-12' AND jornada = 'Mañana';

UPDATE operaciones SET
  puntos_total = 29.28,
  puntos_neto  = GREATEST(0, 29.28 - COALESCE(puntos_baseline, 29.28))
WHERE id_perfil = '114851358' AND fecha_dia = '2026-05-12' AND jornada = 'Mañana';

UPDATE operaciones SET
  puntos_total = 1629.36,
  puntos_neto  = GREATEST(0, 1629.36 - COALESCE(puntos_baseline, 1629.36))
WHERE id_perfil = '151410237' AND fecha_dia = '2026-05-12' AND jornada = 'Mañana';

UPDATE operaciones SET
  puntos_total = 321.96,
  puntos_neto  = GREATEST(0, 321.96 - COALESCE(puntos_baseline, 321.96))
WHERE id_perfil = '145833775' AND fecha_dia = '2026-05-12' AND jornada = 'Mañana';

-- ══════════════════════════════════════════════════════════════════
-- VERIFICACIÓN: después de correr los UPDATEs, ejecuta esto para validar
-- ══════════════════════════════════════════════════════════════════
SELECT
  id_perfil,
  agencia,
  puntos_baseline,
  puntos_total,
  puntos_neto,
  ROUND(puntos_total::numeric - puntos_baseline::numeric, 2) AS neto_calculado,
  CASE
    WHEN ABS(puntos_neto - (puntos_total - puntos_baseline)) < 0.05 THEN '✅ OK'
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
ORDER BY puntos_neto DESC;
