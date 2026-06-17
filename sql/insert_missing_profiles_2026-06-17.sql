-- ===================================================================
-- INSERTAR PERFILES DE ROBERTO, RONALT Y GUSTAVO EN LA BASE DE DATOS
-- Ejecutar en: Supabase Dashboard > SQL Editor (Proyecto: vpyzpjgctidqmhqjboxq)
-- ===================================================================

-- PASO 1: Eliminar registros previos para evitar conflictos de claves únicas
DELETE FROM public.datame_perfiles
WHERE id_datame IN ('168486464', '170740935', '171638277');

-- PASO 2: Insertar perfiles asociados al Panel 2 (thinkedagency2@gmail.com)
INSERT INTO public.datame_perfiles (panel_id, id_datame, modelo, activo) VALUES
(2, '168486464', 'GUSTAVO', true),
(2, '170740935', 'ROBERTO', true),
(2, '171638277', 'RONALT', true);

-- PASO 3: Verificar inserción exitosa
SELECT p.id, p.id_datame, p.modelo, p.activo, pan.nombre AS panel
FROM public.datame_perfiles p
JOIN public.datame_panels pan ON p.panel_id = pan.id
WHERE p.id_datame IN ('168486464', '170740935', '171638277')
ORDER BY p.modelo;
