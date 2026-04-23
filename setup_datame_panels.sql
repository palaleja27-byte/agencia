-- ═══════════════════════════════════════════════════════════════
-- AGENCIA RR: DATAME PANELS — Schema y Datos
-- Ejecutar en Supabase → SQL Editor → Run
-- ═══════════════════════════════════════════════════════════════

-- Tabla: configuración de paneles (credenciales)
CREATE TABLE IF NOT EXISTS datame_panels (
  id          SERIAL PRIMARY KEY,
  nombre      TEXT NOT NULL,
  email       TEXT NOT NULL,
  password    TEXT NOT NULL,
  activo      BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- Tabla: perfiles por panel
CREATE TABLE IF NOT EXISTS datame_perfiles (
  id          SERIAL PRIMARY KEY,
  panel_id    INTEGER REFERENCES datame_panels(id) ON DELETE CASCADE,
  id_datame   TEXT NOT NULL,
  modelo      TEXT NOT NULL,
  activo      BOOLEAN DEFAULT true,
  UNIQUE(panel_id, id_datame)
);

-- Tabla operaciones (si no existe — para los puntos scrapeados)
CREATE TABLE IF NOT EXISTS operaciones (
  id          BIGSERIAL PRIMARY KEY,
  id_perfil   TEXT NOT NULL,
  agencia     TEXT,
  puntos      NUMERIC(10,2) DEFAULT 0,
  fecha_corte TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(id_perfil, fecha_corte)
);

-- Políticas RLS (acceso público de lectura)
ALTER TABLE datame_panels   ENABLE ROW LEVEL SECURITY;
ALTER TABLE datame_perfiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE operaciones     ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_panels"   ON datame_panels;
DROP POLICY IF EXISTS "read_perfiles" ON datame_perfiles;
DROP POLICY IF EXISTS "read_ops"      ON operaciones;

CREATE POLICY "read_panels"   ON datame_panels   FOR SELECT USING (true);
CREATE POLICY "read_perfiles" ON datame_perfiles FOR SELECT USING (true);
CREATE POLICY "read_ops"      ON operaciones     FOR SELECT USING (true);

-- Insertar los 4 paneles
INSERT INTO datame_panels (nombre, email, password) VALUES
  ('PANEL-1', 'thinkedagency@gmail.com',   'Millon2026'),
  ('PANEL-2', 'thinkedagency2@gmail.com',  'Millon2026'),
  ('PANEL-3', 'Nuevopaneladmi4@gmail.com', 'Nuevopaneladmi4@gmail.com'),
  ('PANEL-4', 'Ameliapenaloza40@gmail.com','GroupPremium/*7263458%$')
ON CONFLICT DO NOTHING;

-- Insertar perfiles PANEL-1
INSERT INTO datame_perfiles (panel_id, id_datame, modelo) VALUES
  (1, '91360720',  'SANDRA')
ON CONFLICT DO NOTHING;

-- Insertar perfiles PANEL-2
INSERT INTO datame_perfiles (panel_id, id_datame, modelo) VALUES
  (2, '95956014',  'PABLO'),
  (2, '91733663',  'DANIEL'),
  (2, '153039388', 'AGUSTIN FERNANDO'),
  (2, '95955130',  'HECTOR'),
  (2, '103289167', 'LUIS'),
  (2, '98389135',  'RAUL'),
  (2, '98540781',  'LEANDRO'),
  (2, '157067734', 'VALDEMIR'),
  (2, '103291980', 'ARMANDO'),
  (2, '130431310', 'RAFAEL'),
  (2, '151070498', 'VALQUIMAR'),
  (2, '143014129', 'RENEE'),
  (2, '156716207', 'AGNALDO')
ON CONFLICT DO NOTHING;

-- Insertar perfiles PANEL-3
INSERT INTO datame_perfiles (panel_id, id_datame, modelo) VALUES
  (3, '88243516',  'RICARDO'),
  (3, '79679899',  'NORBERTO'),
  (3, '118692242', 'FRANCISCO'),
  (3, '109551682', 'RENATO'),
  (3, '108018336', 'LUCAS'),
  (3, '118179794', 'HORACIO'),
  (3, '130338853', 'IVALDO'),
  (3, '137163229', 'SEBASTIAN'),
  (3, '120720195', 'MARCOS'),
  (3, '139247498', 'DAMIAN'),
  (3, '139245989', 'ALFREDO'),
  (3, '120275229', 'GERMAN'),
  (3, '156881990', 'RALPH'),
  (3, '130422416', 'RAONI'),
  (3, '143017065', 'MARIO'),
  (3, '145211163', 'FERMIN'),
  (3, '145834230', 'MURILO'),
  (3, '145844971', 'RODRIGO'),
  (3, '157112125', 'LUIS')
ON CONFLICT DO NOTHING;

-- Insertar perfiles PANEL-4
INSERT INTO datame_perfiles (panel_id, id_datame, modelo) VALUES
  (4, '131130713', 'LUIS JOAO'),
  (4, '138130329', 'AGUSTIN'),
  (4, '133085188', 'MARCOS ANTONIO'),
  (4, '144863124', 'FERNANDO')
ON CONFLICT DO NOTHING;

-- Habilitar Realtime en operaciones
ALTER PUBLICATION supabase_realtime ADD TABLE operaciones;

SELECT 'OK: Setup Datame Panels completado' AS resultado;
