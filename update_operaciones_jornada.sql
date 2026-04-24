-- ═══════════════════════════════════════════════════════════════
-- AGENCIA RR: LIMPIEZA Y MIGRACIÓN COMPLETA de operaciones
-- Ejecutar en Supabase → SQL Editor → Run
-- ═══════════════════════════════════════════════════════════════

-- 1. Agregar columnas nuevas (seguro si ya existen)
ALTER TABLE operaciones ADD COLUMN IF NOT EXISTS jornada     TEXT DEFAULT 'Auto';
ALTER TABLE operaciones ADD COLUMN IF NOT EXISTS fecha_dia   DATE;
ALTER TABLE operaciones ADD COLUMN IF NOT EXISTS puntos_neto NUMERIC(10,2) DEFAULT 0;

-- 2. Rellenar fecha_dia desde fecha_corte en registros existentes
UPDATE operaciones SET fecha_dia = fecha_corte::DATE WHERE fecha_dia IS NULL;

-- 3. LIMPIAR DUPLICADOS — conservar solo el registro con MÁS puntos
--    por combinación (id_perfil, fecha_dia, jornada)
DELETE FROM operaciones
WHERE id IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY id_perfil, fecha_dia, jornada
             ORDER BY puntos DESC, created_at DESC
           ) AS rn
    FROM operaciones
  ) ranked
  WHERE rn > 1
);

-- 4. Verificar que no quedan duplicados (debe devolver 0 filas)
-- SELECT id_perfil, fecha_dia, jornada, COUNT(*)
-- FROM operaciones GROUP BY id_perfil, fecha_dia, jornada HAVING COUNT(*) > 1;

-- 5. Eliminar constraint antiguo (si existe)
ALTER TABLE operaciones DROP CONSTRAINT IF EXISTS operaciones_id_perfil_fecha_corte_key;

-- 6. Crear nuevo constraint único (ahora sin duplicados ya es seguro)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_perfil_dia_jornada'
  ) THEN
    ALTER TABLE operaciones
      ADD CONSTRAINT uq_perfil_dia_jornada
      UNIQUE(id_perfil, fecha_dia, jornada);
  END IF;
END $$;

-- 7. Política de escritura completa para service key
DROP POLICY IF EXISTS "write_ops" ON operaciones;
CREATE POLICY "write_ops" ON operaciones FOR ALL USING (true);

-- 8. Habilitar Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE operaciones;

-- 9. Confirmación
SELECT
  COUNT(*) AS total_registros,
  COUNT(DISTINCT id_perfil) AS perfiles_unicos,
  'OK: Migración completada sin duplicados' AS estado
FROM operaciones;
