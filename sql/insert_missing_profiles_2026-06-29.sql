-- ===================================================================
-- INSERTAR PERFILES AUSENTES EN LA BASE DE DATOS DE PRODUCCIÓN
-- Fecha: 2026-06-29
-- Ejecutar en: Supabase Dashboard > SQL Editor (Proyecto: vpyzpjgctidqmhqjboxq)
-- ===================================================================

-- PASO 1: Eliminar registros previos para evitar conflictos de claves únicas (UNIQUE constraint)
DELETE FROM public.datame_perfiles
WHERE id_datame IN (
  '101652076', -- CARINA
  '167279664', -- JOSE ROBERTO
  '167273716', -- ARIEL HERNAN
  '153037229', -- Horacio
  '160951610', -- GUSTAVO (Panel 3)
  '168486464', -- GUSTAVO (Panel 2)
  '118404407', -- MILENA
  '132062039', -- BEATRIZ
  '166575347', -- MAX
  '170740935', -- ROBERTO
  '171638277'  -- RONALT
);

-- PASO 2: Insertar perfiles asociados a sus respectivos paneles
INSERT INTO public.datame_perfiles (panel_id, id_datame, modelo, activo) VALUES
(1, '101652076', 'CARINA', true),
(2, '167279664', 'JOSE ROBERTO', true),
(2, '167273716', 'ARIEL HERNAN', true),
(2, '153037229', 'Horacio', true),
(3, '160951610', 'GUSTAVO', true),
(2, '168486464', 'GUSTAVO', true),
(2, '118404407', 'MILENA', true),
(4, '132062039', 'BEATRIZ', true),
(2, '166575347', 'MAX', true),
(2, '170740935', 'ROBERTO', true),
(2, '171638277', 'RONALT', true);

-- PASO 3: Verificar inserción exitosa
SELECT p.id, p.id_datame, p.modelo, p.activo, pan.nombre AS panel
FROM public.datame_perfiles p
JOIN public.datame_panels pan ON p.panel_id = pan.id
WHERE p.id_datame IN (
  '101652076', '167279664', '167273716', '153037229', '160951610', 
  '168486464', '118404407', '132062039', '166575347', '170740935', '171638277'
)
ORDER BY pan.nombre, p.modelo;
