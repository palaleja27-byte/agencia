-- ══════════════════════════════════════════════════════════════════════
-- CALIBRACIÓN MAESTRA (BASELINE + TOTAL) — 2026-05-13 12:40 COL
-- Objetivo: Sincronizar Supabase con el estado exacto de la imagen de las 12:00 PM
-- para forzar que el dashboard muestre los puntos reales.
-- ══════════════════════════════════════════════════════════════════════

-- PASO 0: ASEGURAR QUE LOS REGISTROS EXISTEN (Para los "8 fallidos")
-- Nota: id_datame es la columna de referencia en la tabla operaciones si se usa el scraper relacional,
-- pero el dashboard usa id_perfil. Ajustamos por id_perfil.
INSERT INTO operaciones (id_perfil, fecha_dia, jornada, agencia, puntos_total, puntos_baseline, puntos_neto)
VALUES
('151410237', '2026-05-13', 'Mañana', 'Panel 2', 191.10, 178.38, 12.72),
('158644203', '2026-05-13', 'Mañana', 'Panel 2', 80.88, 80.76, 0.12),
('160352260', '2026-05-13', 'Mañana', 'Panel 1', 249.60, 247.44, 2.16),
('164812184', '2026-05-13', 'Mañana', 'Panel 2', 14.64, 11.40, 3.24),
('99611942', '2026-05-13', 'Mañana', 'Panel 2', 9.54, 7.02, 2.52),
('101652076', '2026-05-13', 'Mañana', 'Panel 1', 21.00, 21.00, 0.00),
('113752797', '2026-05-13', 'Mañana', 'Panel 2', 306.54, 259.50, 47.04),
('114851358', '2026-05-13', 'Mañana', 'Panel 2', 45.72, 34.08, 11.64)
ON CONFLICT DO NOTHING;

-- PASO 1: ACTUALIZACIÓN MASIVA (Sincronizar con Excel 12:00 PM)
-- Formato: (id_perfil, baseline, total)
WITH data_calibracion (id, pb, pt) AS (
  VALUES
  ('88243516', 3165.84, 3289.86), ('95956014', 1047.72, 1058.88), ('91360720', 711.00, 711.12),
  ('143017065', 276.06, 276.90),   ('91733663', 3682.98, 3730.92), ('153039388', 136.92, 142.68),
  ('79679899', 399.66, 402.18),   ('109551682', 239.10, 241.02),  ('131130713', 1076.58, 1087.92),
  ('101652076', 21.00, 21.00),    ('108018336', 1830.96, 1860.24), ('103289167', 1632.42, 1688.28),
  ('118179794', 1019.58, 1040.22), ('160352260', 247.44, 249.60),  ('145834230', 108.12, 108.72),
  ('120720195', 669.72, 672.96),  ('139247498', 1081.44, 1128.48), ('120275229', 136.20, 136.32),
  ('157067734', 1416.30, 1478.34), ('103291980', 283.74, 295.38),  ('130431310', 628.98, 630.54),
  ('98389135', 253.14, 265.86),   ('139245989', 620.28, 639.96),  ('98540781', 183.24, 185.76),
  ('156881990', 481.50, 509.46),  ('151070498', 93.72, 93.96),    ('130422416', 1661.52, 1731.90),
  ('138130329', 843.90, 851.58),  ('133085188', 866.94, 872.22),  ('118692242', 89.40, 90.66),
  ('143014129', 82.68, 83.40),    ('95955130', 222.42, 224.58),   ('145211163', 86.16, 87.72),
  ('144863124', 1245.78, 1261.62), ('145844971', 1398.06, 1411.98), ('156716207', 181.74, 184.98),
  ('137163229', 133.44, 137.88),  ('157112125', 1373.52, 1415.70),
  -- PANEL 2
  ('113579174', 109.26, 116.22), ('93461947', 110.94, 112.26), ('164812184', 11.40, 14.64),
  ('158644203', 80.76, 80.88),   ('99611942', 7.02, 9.54),    ('113752797', 259.50, 306.54),
  ('101245945', 853.38, 854.88), ('114851358', 34.08, 45.72),  ('151410237', 178.38, 191.10),
  ('145839775', 972.60, 984.78)
)
UPDATE operaciones o
SET
  puntos_baseline = d.pb,
  puntos_total = d.pt,
  puntos_neto = ROUND((d.pt - d.pb)::numeric, 2)
FROM data_calibracion d
WHERE o.id_perfil = d.id
  AND o.fecha_dia = '2026-05-13'
  AND o.jornada = 'Mañana';

-- PASO 2: VERIFICAR RESULTADO PARA JESUS Y JHORIANNYS
SELECT agencia, id_perfil, puntos_baseline, puntos_total, puntos_neto
FROM operaciones
WHERE fecha_dia = '2026-05-13'
  AND jornada = 'Mañana'
  AND id_perfil IN ('88243516','95956014','91360720', -- Jhoriannys
                    '98389135','130422416','120720195','139247498' -- Jesus
                   );
