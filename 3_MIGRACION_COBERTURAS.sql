-- ==========================================
-- 3_MIGRACION_COBERTURAS.sql
-- Reestructuración basada 100% en la tabla "NOVEDADES PRIME MARZO 2026"
-- ==========================================

-- 1. Crear nueva tabla de Operadores
CREATE TABLE IF NOT EXISTS public.operadores_v3 (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre_real TEXT NOT NULL UNIQUE,
    grupo INTEGER NOT NULL,
    estado TEXT DEFAULT 'Activo'
);

-- 2. Crear nueva tabla de Perfiles Asignados
CREATE TABLE IF NOT EXISTS public.perfiles_asignados (
    id_perfil BIGINT PRIMARY KEY, -- ID Datame (asegura única asignación)
    id_operador_actual UUID NOT NULL REFERENCES public.operadores_v3(id) ON DELETE CASCADE,
    operador_original_id UUID NOT NULL REFERENCES public.operadores_v3(id) ON DELETE CASCADE,
    nombre_modelo TEXT NOT NULL,
    tipo_asignacion TEXT DEFAULT 'Propio' CHECK (tipo_asignacion IN ('Propio', 'Cobertura')),
    fecha_asignacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Habilitar RLS
ALTER TABLE public.operadores_v3 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.perfiles_asignados ENABLE ROW LEVEL SECURITY;

-- Políticas de lectura/escritura Operadores
DROP POLICY IF EXISTS "Permitir lectura publica operadores_v3" ON public.operadores_v3;
CREATE POLICY "Permitir lectura publica operadores_v3" ON public.operadores_v3 FOR SELECT USING (true);

DROP POLICY IF EXISTS "Permitir edicion operadores_v3" ON public.operadores_v3;
CREATE POLICY "Permitir edicion operadores_v3" ON public.operadores_v3 FOR ALL USING (true) WITH CHECK (true);

-- Políticas de lectura/escritura Perfiles
DROP POLICY IF EXISTS "Permitir lectura publica perfiles_asignados" ON public.perfiles_asignados;
CREATE POLICY "Permitir lectura publica perfiles_asignados" ON public.perfiles_asignados FOR SELECT USING (true);

DROP POLICY IF EXISTS "Permitir edicion perfiles_asignados" ON public.perfiles_asignados;
CREATE POLICY "Permitir edicion perfiles_asignados" ON public.perfiles_asignados FOR ALL USING (true) WITH CHECK (true);


-- ==============================================================
-- 3. INSERTAR DATA EXACTA SEGÚN IMAGEN "NOVEDADES PRIME MARZO 2026"
-- ==============================================================

-- a) Insertar Operadores (Se insertan uno por uno y capturamos sus IDs lógicos con CTEs)
WITH 
op_1 AS (INSERT INTO public.operadores_v3 (nombre_real, grupo) VALUES ('JHORIANNYS ESTHER MOSQUERA ROJANO', 1) RETURNING id),
op_2 AS (INSERT INTO public.operadores_v3 (nombre_real, grupo) VALUES ('ANAZARED GUTIERERZ', 2) RETURNING id),
op_3 AS (INSERT INTO public.operadores_v3 (nombre_real, grupo) VALUES ('JOSE MANUEL VARELA LEON', 3) RETURNING id),
op_4 AS (INSERT INTO public.operadores_v3 (nombre_real, grupo) VALUES ('BRIGITH DE LOS ANGELES FERNANDEZ MORA', 4) RETURNING id),
op_5 AS (INSERT INTO public.operadores_v3 (nombre_real, grupo) VALUES ('BORIS JUVENAL PATIÑO ESCORIHUELA', 5) RETURNING id),
op_6 AS (INSERT INTO public.operadores_v3 (nombre_real, grupo) VALUES ('JESUS ALBERTO AVILA BELISARIO', 6) RETURNING id),
op_7 AS (INSERT INTO public.operadores_v3 (nombre_real, grupo) VALUES ('ESPERANZA JIMENEZ', 7) RETURNING id),
op_8 AS (INSERT INTO public.operadores_v3 (nombre_real, grupo) VALUES ('ANDRI CALDERON', 8) RETURNING id),
op_9 AS (INSERT INTO public.operadores_v3 (nombre_real, grupo) VALUES ('YARELIS ESTHER SEVILLA PADILLA', 9) RETURNING id),
op_10 AS (INSERT INTO public.operadores_v3 (nombre_real, grupo) VALUES ('LUIS FELIPE JAIMES RODRIGUEZ', 10) RETURNING id),
op_11 AS (INSERT INTO public.operadores_v3 (nombre_real, grupo) VALUES ('ALEIKA ALEJANDRA PERALTA MENDOZA', 11) RETURNING id)

-- b) Insertar Perfiles Asignados
INSERT INTO public.perfiles_asignados (id_perfil, id_operador_actual, operador_original_id, nombre_modelo, tipo_asignacion)
VALUES 
-- GRUPO 1: JHORIANNYS ESTHER MOSQUERA ROJANO
(88243516, (SELECT id FROM op_1), (SELECT id FROM op_1), 'RICARDO', 'Propio'),
(95956014, (SELECT id FROM op_1), (SELECT id FROM op_1), 'PABLO', 'Propio'),
(91360720, (SELECT id FROM op_1), (SELECT id FROM op_1), 'SANDRA MARIA', 'Propio'),

-- GRUPO 2: ANAZARED GUTIERERZ
(79679899, (SELECT id FROM op_2), (SELECT id FROM op_2), 'NORBERTO', 'Propio'),
(91733663, (SELECT id FROM op_2), (SELECT id FROM op_2), 'DANIEL 68', 'Propio'),

-- GRUPO 3: JOSE MANUEL VARELA LEON
(131130713, (SELECT id FROM op_3), (SELECT id FROM op_3), 'LUIS JOAO', 'Propio'),
(109551682, (SELECT id FROM op_3), (SELECT id FROM op_3), 'RENATO', 'Propio'),
(118692242, (SELECT id FROM op_3), (SELECT id FROM op_3), 'FRANCISCO', 'Propio'),

-- GRUPO 4: BRIGITH DE LOS ANGELES FERNANDEZ MORA
(95955130, (SELECT id FROM op_4), (SELECT id FROM op_4), 'HECTOR', 'Propio'),
(108018336, (SELECT id FROM op_4), (SELECT id FROM op_4), 'LUCAS', 'Propio'),
(103289167, (SELECT id FROM op_4), (SELECT id FROM op_4), 'LUIS', 'Propio'),

-- GRUPO 5: BORIS JUVENAL PATIÑO ESCORIHUELA
(118179794, (SELECT id FROM op_5), (SELECT id FROM op_5), 'HORACIO', 'Propio'),
(137163229, (SELECT id FROM op_5), (SELECT id FROM op_5), 'SEBASTIAN', 'Propio'),
(130338853, (SELECT id FROM op_5), (SELECT id FROM op_5), 'IVALDO', 'Propio'),

-- GRUPO 6: JESUS ALBERTO AVILA BELISARIO
(98389135, (SELECT id FROM op_6), (SELECT id FROM op_6), 'RAUL', 'Propio'),
(120720195, (SELECT id FROM op_6), (SELECT id FROM op_6), 'MARCOS', 'Propio'),
(139247498, (SELECT id FROM op_6), (SELECT id FROM op_6), 'DAMIAN', 'Propio'),

-- GRUPO 7: ESPERANZA JIMENEZ
(103291980, (SELECT id FROM op_7), (SELECT id FROM op_7), 'ARMANDO', 'Propio'),
(118404407, (SELECT id FROM op_7), (SELECT id FROM op_7), 'MILENA', 'Propio'),
(130431310, (SELECT id FROM op_7), (SELECT id FROM op_7), 'RAFAEL', 'Propio'),
(98540781, (SELECT id FROM op_7), (SELECT id FROM op_7), 'LEANDRO', 'Propio'),

-- GRUPO 8: ANDRI CALDERON
(130422416, (SELECT id FROM op_8), (SELECT id FROM op_8), 'KETY', 'Propio'),
(139245989, (SELECT id FROM op_8), (SELECT id FROM op_8), 'ALFREDO', 'Propio'),
(120275229, (SELECT id FROM op_8), (SELECT id FROM op_8), 'GERMAN', 'Propio'),
(101652076, (SELECT id FROM op_8), (SELECT id FROM op_8), 'CARINA', 'Propio'),

-- GRUPO 9: YARELIS ESTHER SEVILLA PADILLA
(133085188, (SELECT id FROM op_9), (SELECT id FROM op_9), 'MARCOS (2)', 'Propio'),
(132062039, (SELECT id FROM op_9), (SELECT id FROM op_9), 'BEATRIZ', 'Propio'),
(138130329, (SELECT id FROM op_9), (SELECT id FROM op_9), 'AGUSTIN', 'Propio'),

-- GRUPO 10: LUIS FELIPE JAIMES RODRIGUEZ
(143014129, (SELECT id FROM op_10), (SELECT id FROM op_10), 'RENEE', 'Propio'),
(143017065, (SELECT id FROM op_10), (SELECT id FROM op_10), 'MARIO', 'Propio'),
(145211163, (SELECT id FROM op_10), (SELECT id FROM op_10), 'FERMIN', 'Propio'),

-- GRUPO 11: ALEIKA ALEJANDRA PERALTA MENDOZA
(144863124, (SELECT id FROM op_11), (SELECT id FROM op_11), 'FERNANDO', 'Propio'),
(145834230, (SELECT id FROM op_11), (SELECT id FROM op_11), 'MURILO', 'Propio'),
(145844971, (SELECT id FROM op_11), (SELECT id FROM op_11), 'RODRIGO', 'Propio');
