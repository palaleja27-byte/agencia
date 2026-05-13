-- ══════════════════════════════════════════════════════════════════
-- AGREGAR 12 PERFILES NUEVOS A PANEL-2 — 2026-05-13
-- Esquema real: datame_perfiles(id, panel_id, id_datame, modelo, activo)
-- ══════════════════════════════════════════════════════════════════

-- PASO 1: Eliminar si ya existen (evita duplicados)
DELETE FROM datame_perfiles
WHERE id_datame IN (
  '113579174','93461947','164812184','158644203','99611942',
  '113752797','101245945','114851358','151410237','145839775',
  '157112125','160352260'
);

-- PASO 2: Insertar los 10 perfiles vinculados a PANEL-2
INSERT INTO datame_perfiles (panel_id, id_datame, modelo, activo)
SELECT p.id, v.id_datame, v.modelo, true
FROM datame_panels p
CROSS JOIN (VALUES
  ('113579174', 'RONALDO'),
  ('93461947',  'MARIANO'),
  ('164812184', 'MARCO'),
  ('158644203', 'SERGIO'),
  ('99611942',  'PAOLA'),
  ('113752797', 'ROMARIO'),
  ('101245945', 'PABLO'),
  ('114851358', 'JOHANNA'),
  ('151410237', 'EZEQUIEL'),
  ('145839775', 'BRUNO'),
  ('157112125', 'LUIZ'),
  ('160352260', 'JUVENAL')
) AS v(id_datame, modelo)
WHERE p.nombre = 'PANEL-2';

-- PASO 3: Verificar que los 10 quedaron registrados en PANEL-2
SELECT dp.id, dp.id_datame, dp.modelo, dp.activo, p.nombre AS panel
FROM datame_perfiles dp
JOIN datame_panels p ON dp.panel_id = p.id
WHERE dp.id_datame IN (
  '113579174','93461947','164812184','158644203','99611942',
  '113752797','101245945','114851358','151410237','145839775',
  '157112125','160352260'
)
ORDER BY dp.modelo;

-- PASO 4: Diagnóstico de jornadas HOY en tabla operaciones
SELECT jornada, COUNT(*) AS registros,
  SUM(puntos_neto) AS total_neto,
  MIN(puntos_neto) AS min_neto,
  MAX(puntos_neto) AS max_neto
FROM operaciones
WHERE fecha_dia = CURRENT_DATE
GROUP BY jornada
ORDER BY jornada;
