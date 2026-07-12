#!/bin/bash
echo "=== Creando tablas de Tableau en base de datos local ==="

# Encontrar el ID del contenedor de la base de datos de Supabase
DB_CONTAINER=$(docker ps -q --filter name=db)

if [ -z "$DB_CONTAINER" ]; then
    echo "❌ No se encontró el contenedor de la base de datos (Supabase db)."
    echo "Intentando buscar por nombre alternativo..."
    DB_CONTAINER=$(docker ps -q --filter name=supabase)
fi

if [ -z "$DB_CONTAINER" ]; then
    echo "❌ ERROR: No se pudo localizar el contenedor de la base de datos Docker de Supabase."
    exit 1
fi

echo "✅ Contenedor encontrado: $DB_CONTAINER"

# Ejecutar el SQL directamente dentro de Docker
docker exec -i $DB_CONTAINER psql -U postgres -d postgres <<EOF
-- 1. Tabla principal de configuración de paneles de Tableau
CREATE TABLE IF NOT EXISTS public.tableau_panels (
  id          BIGINT      PRIMARY KEY,
  nombre      TEXT        NOT NULL,
  server      TEXT,
  site        TEXT,
  view_name   TEXT,
  token_name  TEXT,
  activo      BOOLEAN     DEFAULT true
);

-- 2. Tabla principal de datos de Tableau
CREATE TABLE IF NOT EXISTS public.tableau_data (
  perfil_id     TEXT        NOT NULL,
  valor         NUMERIC     DEFAULT 0,
  data_json     JSONB       DEFAULT '{}',
  updated_at    TIMESTAMPTZ DEFAULT now(),
  panel_id      BIGINT,
  panel_nombre  TEXT,
  PRIMARY KEY (perfil_id)
);

-- 3. Tabla de perfiles / whitelist (con estructura flexible para evitar fallos)
CREATE TABLE IF NOT EXISTS public.tableau_perfiles (
  id            bigserial   PRIMARY KEY,
  perfil_id     TEXT,
  id_tableau    TEXT,       
  panel_id      BIGINT,
  activo        BOOLEAN     DEFAULT true,
  valor         NUMERIC     DEFAULT 0,
  data_json     JSONB       DEFAULT '{}',
  updated_at    TIMESTAMPTZ DEFAULT now(),
  panel_nombre  TEXT
);

-- 4. Habilitar RLS (Row Level Security)
ALTER TABLE public.tableau_panels   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tableau_data     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tableau_perfiles ENABLE ROW LEVEL SECURITY;

-- 5. Permitir lectura pública (anon)
DROP POLICY IF EXISTS "Lectura publica tableau_panels" ON public.tableau_panels;
CREATE POLICY "Lectura publica tableau_panels" ON public.tableau_panels FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Lectura publica tableau_data" ON public.tableau_data;
CREATE POLICY "Lectura publica tableau_data" ON public.tableau_data FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Lectura publica tableau_perfiles" ON public.tableau_perfiles;
CREATE POLICY "Lectura publica tableau_perfiles" ON public.tableau_perfiles FOR SELECT TO anon, authenticated USING (true);

-- 6. Permitir todo desde service_role (GitHub Actions / sync robot)
DROP POLICY IF EXISTS "Escritura service tableau_panels" ON public.tableau_panels;
CREATE POLICY "Escritura service tableau_panels" ON public.tableau_panels FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Escritura service tableau_data" ON public.tableau_data;
CREATE POLICY "Escritura service tableau_data" ON public.tableau_data FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Escritura service tableau_perfiles" ON public.tableau_perfiles;
CREATE POLICY "Escritura service tableau_perfiles" ON public.tableau_perfiles FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 7. Conceder permisos al schema public
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

-- Refrescar la caché
NOTIFY pgrst, 'reload schema';
EOF

echo "✅ Tablas creadas y configuradas con éxito en PostgreSQL."
echo "=== Sincronizando perfiles iniciales ==="
node scripts/insert_profiles_prod.js
echo "🏁 Proceso completado. Listo para sincronizar Tableau."
