-- ═══════════════════════════════════════════════════════════════
-- AGENCIA RR: RPC SECURITY DEFINER PARA SINCRONIZAR PERFILES (V3 - IF EXISTS)
-- ─ Evita el error 42P10 (missing UNIQUE constraint en id_datame)
--   usando una estructura condicional IF EXISTS ... UPDATE / INSERT.
-- ─ Ejecutar en Supabase → SQL Editor → Run
-- ═══════════════════════════════════════════════════════════════

-- 1. Intentar agregar la restricción UNIQUE por si no existe (opcional)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'datame_perfiles_id_datame_key'
    ) THEN
        ALTER TABLE public.datame_perfiles ADD CONSTRAINT datame_perfiles_id_datame_key UNIQUE (id_datame);
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        NULL; -- Si falla por registros duplicados previos, continuar sin romper
END $$;

-- 2. Crear la función SECURITY DEFINER ultra-robusta
CREATE OR REPLACE FUNCTION upsert_datame_perfiles_batch(records jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER                  -- ← Permite bypass de RLS al correr como owner
SET search_path = public
AS $$
DECLARE
    rec         jsonb;
    counter     int := 0;
    v_id_datame text;
    v_modelo    text;
    v_panel_id  bigint;
    v_activo    boolean;
BEGIN
    FOR rec IN SELECT * FROM jsonb_array_elements(records)
    LOOP
        v_id_datame := rec->>'id_datame';
        v_modelo    := rec->>'modelo';
        v_panel_id  := (rec->>'panel_id')::bigint;
        v_activo    := (rec->>'activo')::boolean;

        IF v_id_datame IS NOT NULL AND v_id_datame <> '' THEN
            IF EXISTS (SELECT 1 FROM public.datame_perfiles WHERE id_datame = v_id_datame) THEN
                UPDATE public.datame_perfiles
                SET modelo   = v_modelo,
                    panel_id = v_panel_id,
                    activo   = v_activo
                WHERE id_datame = v_id_datame;
            ELSE
                INSERT INTO public.datame_perfiles (id_datame, modelo, panel_id, activo)
                VALUES (v_id_datame, v_modelo, v_panel_id, v_activo);
            END IF;

            counter := counter + 1;
        END IF;
    END LOOP;

    RETURN jsonb_build_object('inserted', counter, 'status', 'ok');
END;
$$;

-- Otorgar permisos de ejecución al rol público/anon
GRANT EXECUTE ON FUNCTION upsert_datame_perfiles_batch(jsonb) TO anon;
GRANT EXECUTE ON FUNCTION upsert_datame_perfiles_batch(jsonb) TO authenticated;

SELECT 'OK: Función upsert_datame_perfiles_batch v3 creada exitosamente.' AS status;
