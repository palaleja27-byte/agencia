-- ═══════════════════════════════════════════════════════════════
-- AGENCIA RR: Tabla op_sessions — sesiones por operador
-- Registra exactamente cuándo se conectó, su baseline y sus puntos
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS op_sessions (
  id              BIGSERIAL PRIMARY KEY,
  operador        TEXT NOT NULL,           -- nombre del operador en el sistema
  perfil_ids      TEXT[],                  -- IDs de Datame del operador
  inicio_ts       TIMESTAMPTZ DEFAULT NOW(),
  fin_ts          TIMESTAMPTZ,             -- null = sesión activa
  baseline_total  NUMERIC(12,2) DEFAULT 0, -- total en Datame al momento del login
  puntos_sesion   NUMERIC(10,2) DEFAULT 0, -- puntos acumulados en la sesión
  jornada         TEXT,                    -- 'Mañana','Tarde','Noche'
  fecha_dia       DATE DEFAULT CURRENT_DATE
);

-- Índices para consultas rápidas
CREATE INDEX IF NOT EXISTS idx_ops_operador     ON op_sessions(operador);
CREATE INDEX IF NOT EXISTS idx_ops_fecha        ON op_sessions(fecha_dia);
CREATE INDEX IF NOT EXISTS idx_ops_activa       ON op_sessions(fin_ts) WHERE fin_ts IS NULL;

-- Habilitar Realtime en la tabla
ALTER PUBLICATION supabase_realtime ADD TABLE op_sessions;

-- RLS: acceso total con service key
ALTER TABLE op_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "all_ops_sessions" ON op_sessions;
CREATE POLICY "all_ops_sessions" ON op_sessions FOR ALL USING (true);

-- Verificar
SELECT 'Tabla op_sessions creada correctamente' AS estado;
