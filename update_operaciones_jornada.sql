-- ═══════════════════════════════════════════════════════════════
-- SINCRONIZACIÓN PRECISA — 24-Abr-2026 (basado en watcher 12:31pm)
-- El watcher ya tiene los puntos_total correctos de Datame.
-- Solo corregimos baselines mal fijados y recalculamos netos.
-- ═══════════════════════════════════════════════════════════════

-- PASO 1: Corregir baselines incorrectos
--   RENATO mostraba 0.1 pts → su baseline quedó en ~491.7 en vez de 486.12
--   (La referencia 6am era 486.12 según corte manual de las 8am)
UPDATE operaciones SET
  puntos_baseline = b.baseline_correcto,
  puntos_neto     = GREATEST(0, puntos_total - b.baseline_correcto)
FROM (VALUES
  (109551682::bigint, 486.12),   -- RENATO     (neto correcto: ~5.7 pts a las 12:31pm)
  (154604791,         830.34),   -- LEANDRO    (desde 10am corte, comienza=830.34)
  (143047065,         364.68)    -- MARIO      (comienza=364.68 segun 12pm corte)
) AS b(id_perfil, baseline_correcto)
WHERE operaciones.id_perfil::bigint = b.id_perfil
  AND operaciones.fecha_dia = '2026-04-24'
  AND operaciones.jornada   = 'Mañana';

-- PASO 2: Recalcular puntos_neto para TODOS con el puntos_total real del watcher
--   Esto asegura que cualquier perfil actualizado por el watcher quede correcto
UPDATE operaciones
SET puntos_neto = GREATEST(0, puntos_total - puntos_baseline)
WHERE fecha_dia       = '2026-04-24'
  AND jornada         = 'Mañana'
  AND puntos_baseline > 0
  AND puntos_total    > 0;

-- PASO 3: Verificación — comparar con lo que muestra el dashboard (watcher 12:31pm)
-- Esperado según dashboard: RICARDO≈151.6, FRANCISCO≈112.8, LUCAS≈45.0, HORACIO≈30.2
SELECT
  agencia                                    AS operador_perfil,
  id_perfil,
  ROUND(puntos_baseline::numeric, 2)         AS inicio_6am,
  ROUND(puntos_total::numeric,    2)         AS total_datame_actual,
  ROUND(puntos_neto::numeric,     2)         AS neto_turno_manana,
  ROUND((puntos_neto * 1400)::numeric, 0)    AS valor_cop
FROM operaciones
WHERE fecha_dia = '2026-04-24'
  AND jornada   = 'Mañana'
  AND puntos_total > 0
ORDER BY puntos_neto DESC;
