-- ===================================================================
-- INSERTAR 9 PERFILES FALTANTES EN LA BASE DE DATOS
-- Ejecutar en: Supabase Dashboard > SQL Editor (Proyecto: vpyzpjgctidqmhqjboxq)
-- ===================================================================

-- PASO 1: Eliminar registros previos para evitar duplicidad de conflictos
DELETE FROM public.datame_perfiles
WHERE id_datame IN (
  '101652076', -- CARINA
  '167279664', -- JOSE ROBERTO
  '167273716', -- ARIEL HERNAN
  '153037229', -- Horacio
  '160951610', -- GUSTAVO
  '168486464', -- GUSTAVO
  '118404407', -- MILENA
  '132062039', -- BEATRIZ
  '166575347'  -- MAX
);

-- PASO 2: Insertar perfiles asociados a sus respectivos paneles
INSERT INTO public.datame_perfiles (panel_id, id_datame, modelo, activo) VALUES
(1, '101652076', 'CARINA', true),       -- PANEL-1 (thinkedagency@gmail.com)
(2, '167279664', 'JOSE ROBERTO', true),  -- PANEL-2 (thinkedagency2@gmail.com)
(2, '167273716', 'ARIEL HERNAN', true),  -- PANEL-2 (thinkedagency2@gmail.com)
(2, '153037229', 'HORACIO', true),       -- PANEL-2 (thinkedagency2@gmail.com)
(3, '160951610', 'GUSTAVO', true),       -- PANEL-3 (Nuevopaneladmi4@gmail.com)
(2, '168486464', 'GUSTAVO', true),       -- PANEL-2 (thinkedagency2@gmail.com)
(2, '118404407', 'MILENA', true),        -- PANEL-2 (thinkedagency2@gmail.com)
(4, '132062039', 'BEATRIZ', true),       -- PANEL-4 (Ameliapenaloza40@gmail.com)
(2, '166575347', 'MAX', true);           -- PANEL-2 (thinkedagency2@gmail.com)

-- PASO 3: Verificar inserción
SELECT p.id, p.id_datame, p.modelo, p.activo, pan.nombre AS panel
FROM public.datame_perfiles p
JOIN public.datame_panels pan ON p.panel_id = pan.id
WHERE p.id_datame IN ('101652076', '167279664', '167273716', '153037229', '160951610', '168486464', '118404407', '132062039', '166575347')
ORDER BY pan.nombre, p.modelo;
