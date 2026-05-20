-- ══════════════════════════════════════════════════════════════════
-- AGREGAR 3 PERFILES NUEVOS A PANEL-2 — 2026-05-20
-- Esquema: datame_perfiles(id, panel_id, id_datame, modelo, activo)
-- ══════════════════════════════════════════════════════════════════

-- PASO 1: Eliminar si ya existen (evita duplicados)
DELETE FROM datame_perfiles
WHERE id_datame IN ('167279664', '167273716', '166575347');

-- PASO 2: Insertar los 3 perfiles vinculados a PANEL-2
INSERT INTO datame_perfiles (panel_id, id_datame, modelo, activo)
SELECT p.id, v.id_datame, v.modelo, true
FROM datame_panels p
CROSS JOIN (VALUES
  ('167279664', 'JOSE ROBERTO'),
  ('167273716', 'ARIEL HERNAN'),
  ('166575347', 'MAX')
) AS v(id_datame, modelo)
WHERE p.nombre = 'PANEL-2';

-- PASO 3: Verificar que los 3 quedaron registrados en PANEL-2
SELECT dp.id, dp.id_datame, dp.modelo, dp.activo, p.nombre AS panel
FROM datame_perfiles dp
JOIN datame_panels p ON dp.panel_id = p.id
WHERE dp.id_datame IN ('167279664', '167273716', '166575347')
ORDER BY dp.modelo;
