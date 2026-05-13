-- ══════════════════════════════════════════════════════════════════
-- AGREGAR 10 PERFILES NUEVOS A PANEL-2 — 2026-05-13
-- ══════════════════════════════════════════════════════════════════

-- 1. Verificar qué panel_id corresponde a PANEL-2
-- SELECT id, nombre FROM datame_panels WHERE nombre = 'PANEL-2';

-- 2. Insertar los 10 perfiles nuevos en datame_perfiles
--    panel_id = (SELECT id FROM datame_panels WHERE nombre = 'PANEL-2')
--    Si ya existen, actualizar el modelo y activar
INSERT INTO datame_perfiles (id_datame, modelo, panel_id, activo)
VALUES
  ('113579174', 'RONALDO',  (SELECT id FROM datame_panels WHERE nombre = 'PANEL-2'), true),
  ('93461947',  'MARIANO',  (SELECT id FROM datame_panels WHERE nombre = 'PANEL-2'), true),
  ('164812184', 'MARCO',    (SELECT id FROM datame_panels WHERE nombre = 'PANEL-2'), true),
  ('158644203', 'SERGIO',   (SELECT id FROM datame_panels WHERE nombre = 'PANEL-2'), true),
  ('99611942',  'PAOLA',    (SELECT id FROM datame_panels WHERE nombre = 'PANEL-2'), true),
  ('113752797', 'ROMARIO',  (SELECT id FROM datame_panels WHERE nombre = 'PANEL-2'), true),
  ('101245945', 'PABLO',    (SELECT id FROM datame_panels WHERE nombre = 'PANEL-2'), true),
  ('114851358', 'JOHANNA',  (SELECT id FROM datame_panels WHERE nombre = 'PANEL-2'), true),
  ('151410237', 'EZEQUIEL', (SELECT id FROM datame_panels WHERE nombre = 'PANEL-2'), true),
  ('145839775', 'BRUNO',    (SELECT id FROM datame_panels WHERE nombre = 'PANEL-2'), true)
ON CONFLICT (id_datame) DO UPDATE SET
  modelo   = EXCLUDED.modelo,
  panel_id = EXCLUDED.panel_id,
  activo   = true;

-- 3. VERIFICAR: Todos los perfiles del PANEL-2 deben aparecer activos
SELECT dp.id_datame, dp.modelo, dp.activo, p.nombre AS panel
FROM datame_perfiles dp
JOIN datame_panels p ON dp.panel_id = p.id
WHERE p.nombre = 'PANEL-2'
ORDER BY dp.modelo;

-- 4. VERIFICAR: Estado de operaciones HOY para los nuevos perfiles
SELECT
  id_perfil,
  agencia,
  jornada,
  puntos_baseline,
  puntos_total,
  puntos_neto,
  CASE
    WHEN puntos_baseline > puntos_total THEN '🔴 BASELINE CORRUPTO'
    WHEN puntos_neto IS NULL OR puntos_total IS NULL THEN '⚠️ SIN DATOS'
    WHEN ABS(puntos_neto - (puntos_total - puntos_baseline)) < 0.10 THEN '✅ OK'
    ELSE '❌ DESINCRONIZADO'
  END AS status
FROM operaciones
WHERE fecha_dia = CURRENT_DATE
  AND id_perfil IN (
    '113579174','93461947','164812184','158644203','99611942',
    '113752797','101245945','114851358','151410237','145839775'
  )
ORDER BY jornada, id_perfil;

-- 5. DIAGNÓSTICO: Verificar todas las jornadas de HOY
SELECT jornada, COUNT(*) AS registros, 
  SUM(puntos_neto) AS total_neto,
  MIN(puntos_neto) AS min_neto,
  MAX(puntos_neto) AS max_neto
FROM operaciones
WHERE fecha_dia = CURRENT_DATE
GROUP BY jornada
ORDER BY jornada;
