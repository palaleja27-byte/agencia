-- ═══════════════════════════════════════════════════════════════
-- AGENCIA RR: Baseline Manual Turno MAÑANA 24-Abr-2026 (6:00 AM)
-- Datos capturados manualmente a las 8:00 AM
-- Comienza = puntos_baseline (total acumulado mes al inicio del turno 6am)
-- En curso  = puntos_total   (total acumulado mes a las 8am)
-- Total     = puntos_neto    (diferencia = puntos reales del turno)
-- ═══════════════════════════════════════════════════════════════

-- PASO 1: Asegurarse de que existen las columnas necesarias
ALTER TABLE operaciones ADD COLUMN IF NOT EXISTS puntos_total    NUMERIC(12,2) DEFAULT 0;
ALTER TABLE operaciones ADD COLUMN IF NOT EXISTS puntos_baseline NUMERIC(12,2) DEFAULT 0;

-- PASO 2: Limpiar datos incorrectos de HOY (valores históricos acumulados ~220k)
DELETE FROM operaciones
WHERE fecha_dia = '2026-04-24' AND jornada = 'Mañana' AND puntos_total > 10000;

-- PASO 3: Insertar datos reales con baseline correcto
-- ON CONFLICT: si ya existe registro, actualizar puntos_total y neto pero NO el baseline
INSERT INTO operaciones
  (id_perfil, agencia, puntos, puntos_total, puntos_baseline, puntos_neto, fecha_corte, fecha_dia, jornada)
VALUES
-- ── PANEL-3 ────────────────────────────────────────────────
  (88243516,  'RICARDO',          7343.18, 7343.18, 7257.90,   85.28, '2026-04-24T08:00:00', '2026-04-24', 'Mañana'),
  (95956014,  'PABLO',            1371.36, 1371.36, 1366.44,    4.92, '2026-04-24T08:00:00', '2026-04-24', 'Mañana'),
  (91360720,  'SANDRA MARIA',      971.82,  971.82,  969.42,    2.40, '2026-04-24T08:00:00', '2026-04-24', 'Mañana'),
  (79679899,  'NORBERTO',          592.38,  592.38,  592.26,    0.12, '2026-04-24T08:00:00', '2026-04-24', 'Mañana'),
  (91733663,  'DANIEL 68',        6653.64, 6653.64, 6636.48,   17.16, '2026-04-24T08:00:00', '2026-04-24', 'Mañana'),
  (153039388, 'AGUSTIN FERNANDO',  491.52,  491.52,  491.52,    0.00, '2026-04-24T08:00:00', '2026-04-24', 'Mañana'),
  (118692242, 'FRANCISCO',         220.94,  220.94,  219.74,    1.20, '2026-04-24T08:00:00', '2026-04-24', 'Mañana'),
  (108553902, 'RENATO',            488.64,  488.64,  488.12,    0.52, '2026-04-24T08:00:00', '2026-04-24', 'Mañana'),
  (131130713, 'LUIS JOAO',        1545.18, 1545.18, 1544.34,    0.84, '2026-04-24T08:00:00', '2026-04-24', 'Mañana'),
  (95955130,  'HECTOR',            237.18,  237.18,  237.06,    0.12, '2026-04-24T08:00:00', '2026-04-24', 'Mañana'),
  (108018336, 'LUCAS',            4436.88, 4436.88, 4429.56,    7.32, '2026-04-24T08:00:00', '2026-04-24', 'Mañana'),
  (103289167, 'LUIS DAROSA',      2820.90, 2820.90, 2798.82,   22.08, '2026-04-24T08:00:00', '2026-04-24', 'Mañana'),
  (118179794, 'HORACIO',          2252.76, 2252.76, 2249.88,    2.88, '2026-04-24T08:00:00', '2026-04-24', 'Mañana'),
  (103338853, 'IVALDO',           2724.48, 2724.48, 2721.84,    2.64, '2026-04-24T08:00:00', '2026-04-24', 'Mañana'),
  (137163229, 'SEBASTIAN',         240.78,  240.78,  240.78,    0.00, '2026-04-24T08:00:00', '2026-04-24', 'Mañana'),
  (160352260, 'JUVENAL',            25.56,   25.56,   23.16,    2.40, '2026-04-24T08:00:00', '2026-04-24', 'Mañana'),
  (98389135,  'RAUL',              491.10,  491.10,  491.10,    0.00, '2026-04-24T08:00:00', '2026-04-24', 'Mañana'),
  (120720195, 'MARCOS',           2534.16, 2534.16, 2534.16,    0.00, '2026-04-24T08:00:00', '2026-04-24', 'Mañana'),
  (138247498, 'DAMIAN',           4684.08, 4684.08, 4670.82,   13.26, '2026-04-24T08:00:00', '2026-04-24', 'Mañana'),
  (92695554,  'KETY',               32.32,   32.32,   32.32,    0.00, '2026-04-24T08:00:00', '2026-04-24', 'Mañana'),
  (154604791, 'LEANDRO',           840.54,  840.54,  830.34,   10.20, '2026-04-24T08:00:00', '2026-04-24', 'Mañana'),
  (157067734, 'VALDEMIR',         2189.34, 2189.34, 2179.14,   10.20, '2026-04-24T08:00:00', '2026-04-24', 'Mañana'),
  (103291980, 'ARMANDO',           656.82,  656.82,  656.10,    0.72, '2026-04-24T08:00:00', '2026-04-24', 'Mañana'),
  (130431310, 'RAFAEL',           1364.58, 1364.58, 1359.90,    4.68, '2026-04-24T08:00:00', '2026-04-24', 'Mañana'),
  (101652076, 'CARINA',             26.97,   26.97,   26.97,    0.00, '2026-04-24T08:00:00', '2026-04-24', 'Mañana'),
  (139245989, 'ALFREDO',          1816.56, 1816.56, 1815.84,    0.72, '2026-04-24T08:00:00', '2026-04-24', 'Mañana'),
  (120275229, 'GERMAN',            211.38,  211.38,  211.38,    0.00, '2026-04-24T08:00:00', '2026-04-24', 'Mañana'),
  (156881990, 'RALPH',             686.45,  686.45,  685.58,    0.87, '2026-04-24T08:00:00', '2026-04-24', 'Mañana'),
  (151070498, 'VALQUIMAR',         247.92,  247.92,  246.96,    0.96, '2026-04-24T08:00:00', '2026-04-24', 'Mañana'),
  (130422416, 'RAONI',            5428.02, 5428.02, 5393.58,   34.44, '2026-04-24T08:00:00', '2026-04-24', 'Mañana'),
  (138130329, 'AGUSTIN',          1329.84, 1329.84, 1326.00,    3.84, '2026-04-24T08:00:00', '2026-04-24', 'Mañana'),
  (133085188, 'MARCOS ANTONIO',   2951.88, 2951.88, 2947.44,    4.44, '2026-04-24T08:00:00', '2026-04-24', 'Mañana'),
  (143014129, 'BEATRIZ',            18.69,   18.69,   18.69,    0.00, '2026-04-24T08:00:00', '2026-04-24', 'Mañana'),
  (143010846, 'RENEE',             219.60,  219.60,  219.60,    0.00, '2026-04-24T08:00:00', '2026-04-24', 'Mañana'),
  (143015945, 'MARLO',             375.08,  375.08,  369.68,    5.40, '2026-04-24T08:00:00', '2026-04-24', 'Mañana'),
  (145211163, 'FERMIN',            439.26,  439.26,  439.26,    0.00, '2026-04-24T08:00:00', '2026-04-24', 'Mañana'),
  (144863124, 'FERNANDO',         4481.10, 4481.10, 4480.50,    0.60, '2026-04-24T08:00:00', '2026-04-24', 'Mañana'),
  (145834230, 'MURILO',            185.22,  185.22,  184.98,    0.24, '2026-04-24T08:00:00', '2026-04-24', 'Mañana'),
  (145844971, 'RODRIGO',          3737.22, 3737.22, 3734.22,    3.00, '2026-04-24T08:00:00', '2026-04-24', 'Mañana'),
  (156716207, 'AGNALDO',           411.42,  411.42,  408.18,    3.24, '2026-04-24T08:00:00', '2026-04-24', 'Mañana'),
  (157121225, 'LUIZ',              531.24,  531.24,  530.64,    0.60, '2026-04-24T08:00:00', '2026-04-24', 'Mañana'),
-- ── PANEL-4 / otro panel ───────────────────────────────────
  (113579174, 'RONALDO',           504.84,  504.84,  504.84,    0.00, '2026-04-24T08:00:00', '2026-04-24', 'Mañana'),
  (93461947,  'MARIANO',           272.88,  272.88,  272.88,    0.00, '2026-04-24T08:00:00', '2026-04-24', 'Mañana'),
  (158644203, 'SERGIO',             90.60,   90.60,   90.48,    0.12, '2026-04-24T08:00:00', '2026-04-24', 'Mañana'),
  (99611942,  'PAOLA',              32.64,   32.64,   32.64,    0.00, '2026-04-24T08:00:00', '2026-04-24', 'Mañana'),
  (113752797, 'ROMARIO',           854.22,  854.22,  839.82,   14.40, '2026-04-24T08:00:00', '2026-04-24', 'Mañana'),
  (101245945, 'PABLO 2',          1816.80, 1816.80, 1814.64,    2.16, '2026-04-24T08:00:00', '2026-04-24', 'Mañana'),
  (114851358, 'JOHANNA',           498.24,  498.24,  497.08,    1.16, '2026-04-24T08:00:00', '2026-04-24', 'Mañana'),
  (151410237, 'EZEQUIEL',          305.40,  305.40,  305.28,    0.12, '2026-04-24T08:00:00', '2026-04-24', 'Mañana'),
  (145839775, 'BRUNO',             963.42,  963.42,  958.62,    4.80, '2026-04-24T08:00:00', '2026-04-24', 'Mañana')
ON CONFLICT (id_perfil, fecha_dia, jornada) DO UPDATE SET
  puntos             = EXCLUDED.puntos_total,
  puntos_total       = EXCLUDED.puntos_total,
  -- NUNCA sobreescribir el baseline: conserva el de las 6am
  puntos_baseline    = CASE
                         WHEN operaciones.puntos_baseline = 0 THEN EXCLUDED.puntos_baseline
                         ELSE operaciones.puntos_baseline
                       END,
  puntos_neto        = EXCLUDED.puntos_total - CASE
                         WHEN operaciones.puntos_baseline = 0 THEN EXCLUDED.puntos_baseline
                         ELSE operaciones.puntos_baseline
                       END,
  fecha_corte        = EXCLUDED.fecha_corte;

-- PASO 4: Verificar
SELECT
  id_perfil, agencia, jornada,
  puntos_baseline AS inicio_6am,
  puntos_total    AS en_curso,
  puntos_neto     AS turno_neto,
  fecha_dia
FROM operaciones
WHERE fecha_dia = '2026-04-24' AND jornada = 'Mañana'
ORDER BY puntos_neto DESC
LIMIT 20;
