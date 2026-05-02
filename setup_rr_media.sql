-- ═══════════════════════════════════════════════════════════════
-- AGENCIA RR: MEDIA SYNC — Schema y Datos para Fotos y Banners
-- Ejecutar en Supabase → SQL Editor → Run
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS rr_media (
    nombre TEXT NOT NULL,
    tipo TEXT NOT NULL, -- 'avatar' o 'banner'
    data TEXT NOT NULL, -- Base64 data
    updated_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (nombre, tipo)
);

ALTER TABLE rr_media ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_anon_select_media" ON rr_media;
DROP POLICY IF EXISTS "allow_anon_insert_media" ON rr_media;
DROP POLICY IF EXISTS "allow_anon_update_media" ON rr_media;

CREATE POLICY "allow_anon_select_media" ON rr_media FOR SELECT USING (true);
CREATE POLICY "allow_anon_insert_media" ON rr_media FOR INSERT WITH CHECK (true);
CREATE POLICY "allow_anon_update_media" ON rr_media FOR UPDATE USING (true);

-- Agregar a Realtime
DO $$
BEGIN
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE rr_media;
    EXCEPTION WHEN others THEN
        RAISE NOTICE 'rr_media ya está en supabase_realtime, OK';
    END;
END $$;

SELECT 'OK: Tabla rr_media creada y lista para sincronizar avatares en tiempo real.' AS status;
