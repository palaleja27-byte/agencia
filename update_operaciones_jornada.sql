-- ======================================================================
-- 🛠️ SCRIPT DE EMERGENCIA: REPARACIÓN DE PUNTOS MAÑANA
-- Ejecutar en el SQL Editor de Supabase
-- ======================================================================

-- 1. Copiar los puntos legacy a la nueva columna puntos_total si están nulos
-- y reconstruir el baseline basándose en los netos actuales
UPDATE operaciones
SET 
  puntos_total = puntos,
  puntos_baseline = GREATEST(0, puntos - puntos_neto)
WHERE fecha_dia = CURRENT_DATE 
  AND puntos > 0 
  AND (puntos_total IS NULL OR puntos_baseline IS NULL OR puntos_baseline = 0);

-- 2. Recalcular el neto usando la fórmula oficial DELTA-SHIFT (total - baseline)
-- Esto arregla el "0.0 pts" si el query anterior de limpieza los borró por error
UPDATE operaciones
SET puntos_neto = GREATEST(0, puntos_total - puntos_baseline)
WHERE fecha_dia = CURRENT_DATE 
  AND puntos_total > 0 
  AND puntos_baseline > 0;
