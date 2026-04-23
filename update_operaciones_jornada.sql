-- ═══════════════════════════════════════════════════════════════
-- AGENCIA RR: UPDATE — Agregar jornada + fecha_dia a operaciones
-- Ejecutar en Supabase → SQL Editor → Run
-- ═══════════════════════════════════════════════════════════════

-- Añadir columnas si no existen
ALTER TABLE operaciones ADD COLUMN IF NOT EXISTS jornada    TEXT DEFAULT 'Auto';
ALTER TABLE operaciones ADD COLUMN IF NOT EXISTS fecha_dia  DATE;
ALTER TABLE operaciones ADD COLUMN IF NOT EXISTS puntos_neto NUMERIC(10,2) DEFAULT 0;

-- Rellenar fecha_dia desde fecha_corte para registros existentes
UPDATE operaciones SET fecha_dia = fecha_corte::DATE WHERE fecha_dia IS NULL;

-- Eliminar el unique antiguo y crear uno nuevo por perfil+día+jornada
ALTER TABLE operaciones DROP CONSTRAINT IF EXISTS operaciones_id_perfil_fecha_corte_key;
ALTER TABLE operaciones ADD CONSTRAINT IF NOT EXISTS uq_perfil_dia_jornada
  UNIQUE(id_perfil, fecha_dia, jornada);

-- Política de escritura para el service key
DROP POLICY IF EXISTS "write_ops" ON operaciones;
CREATE POLICY "write_ops" ON operaciones FOR ALL USING (true);

-- Habilitar Realtime (por si no estaba)
ALTER PUBLICATION supabase_realtime ADD TABLE operaciones;

SELECT 'OK: Columnas jornada, fecha_dia, puntos_neto agregadas' AS resultado;
