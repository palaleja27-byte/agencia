import os
import requests
import pandas as pd
import json
import io
import re

# ═══════════════════════════════════════════════════════════════════
# CONFIGURACIÓN TABLEAU
# ═══════════════════════════════════════════════════════════════════
TABLEAU_SERVER = "https://prod-uk-a.online.tableau.com"
TABLEAU_SITE   = "partnerdata"
TOKEN_NAME     = "Analytics"
TOKEN_SECRET   = os.getenv("TABLEAU_TOKEN_SECRET")

VIEW_NAME    = "GRUPOROMERO"
FALLBACK_VIEW = "Revenuedetailed"

# ═══════════════════════════════════════════════════════════════════
# CONFIGURACIÓN SUPABASE
# — Usamos requests directamente para BYPASSEAR RLS al 100%
#   (el cliente de Python v2 a veces no envía el rol correcto)
# ═══════════════════════════════════════════════════════════════════
SUPABASE_URL = os.getenv("SUPABASE_URL", "").rstrip("/")
SUPABASE_KEY = (
    os.getenv("SUPABASE_SERVICE_KEY") or
    os.getenv("SUPABASE_SERVICE_ROLE_KEY") or
    os.getenv("SUPABASE_KEY") or ""
)

# ─── Headers con service_role explícito ──────────────────────────
def sb_headers():
    """Headers que le dicen a Supabase: 'soy service_role, ignora RLS'."""
    return {
        "apikey":        SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type":  "application/json",
        "Prefer":        "resolution=merge-duplicates,return=minimal",
    }

BATCH_SIZE = 500   # Supabase acepta hasta 500 registros por llamada

# ═══════════════════════════════════════════════════════════════════
# HELPERS
# ═══════════════════════════════════════════════════════════════════
def check_creds():
    print("📡 Verificando credenciales...")
    print(f"   URL: {SUPABASE_URL[:20]}..." if SUPABASE_URL else "   URL: ❌ FALTANTE")
    key_preview = SUPABASE_KEY[:6] + "***" if SUPABASE_KEY else "❌ FALTANTE"
    print(f"   KEY: {key_preview}")

    # Determinar si es service_role o anon (la service_role tiene 'service_role' en el payload JWT)
    if SUPABASE_KEY:
        try:
            import base64
            payload_part = SUPABASE_KEY.split(".")[1]
            padding = 4 - len(payload_part) % 4
            decoded = base64.b64decode(payload_part + "=" * padding).decode()
            if "service_role" in decoded:
                print("   ROL: ✅ service_role (bypass RLS activo)")
            else:
                print("   ROL: ⚠️  anon/user — NO puede escribir con RLS activo")
        except Exception:
            print("   ROL: (no se pudo decodificar el JWT)")

    return bool(SUPABASE_URL and SUPABASE_KEY)


def sb_upsert_batch(records: list) -> bool:
    """
    Hace upsert directo vía REST a Supabase usando requests.
    Bypassea completamente el cliente de Python (que a veces pierde el rol).
    Divide en lotes de BATCH_SIZE para evitar límites de payload.
    """
    url = f"{SUPABASE_URL}/rest/v1/tableau_data"
    headers = sb_headers()
    total = len(records)
    uploaded = 0

    for i in range(0, total, BATCH_SIZE):
        batch = records[i : i + BATCH_SIZE]
        resp = requests.post(url, headers=headers, json=batch, timeout=30)

        if resp.status_code in (200, 201):
            uploaded += len(batch)
            print(f"   ✅ Lote {i//BATCH_SIZE + 1}: {len(batch)} registros subidos OK")
        else:
            print(f"   ❌ Lote {i//BATCH_SIZE + 1} falló — HTTP {resp.status_code}: {resp.text[:300]}")
            return False

    print(f"💾 Total: {uploaded}/{total} registros sincronizados con Supabase.")
    return True


def sb_delete_debug_log():
    url = f"{SUPABASE_URL}/rest/v1/tableau_data?perfil_id=eq.DEBUG_LOG"
    requests.delete(url, headers=sb_headers(), timeout=10)


def sb_log_error(msg: str):
    url = f"{SUPABASE_URL}/rest/v1/tableau_data"
    payload = [{
        "perfil_id":  "DEBUG_LOG",
        "valor":      0,
        "data_json":  {"error": msg},
        "updated_at": "now()"
    }]
    try:
        requests.post(url, headers=sb_headers(), json=payload, timeout=10)
    except Exception:
        pass


# ═══════════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════════
def sync_tableau():
    if not check_creds():
        print("❌ Sincronización abortada: faltan credenciales.")
        return

    print("\n🚀 Iniciando sincronización con Tableau Cloud...")

    # ── 1. Autenticación Tableau ────────────────────────────────
    auth_url = f"{TABLEAU_SERVER}/api/3.4/auth/signin"
    auth_payload = {
        "credentials": {
            "personalAccessTokenName":   TOKEN_NAME,
            "personalAccessTokenSecret": TOKEN_SECRET,
            "site": {"contentUrl": TABLEAU_SITE}
        }
    }

    try:
        res = requests.post(auth_url, json=auth_payload,
                            headers={"Accept": "application/json"}, timeout=30)
        print(f"📡 Status Auth: {res.status_code}")

        if res.status_code != 200:
            msg = f"Error Auth Tableau: {res.text[:200]}"
            print(f"❌ {msg}")
            sb_log_error(msg)
            return

        data   = res.json()
        token  = data["credentials"]["token"]
        site_id = data["credentials"]["site"]["id"]
        t_headers = {"X-Tableau-Auth": token, "Accept": "application/json"}
        print("✅ Autenticado con éxito en Tableau.")

        # ── 2. Localizar la vista ───────────────────────────────
        views_url = f"{TABLEAU_SERVER}/api/3.4/sites/{site_id}/views"
        res = requests.get(views_url, headers=t_headers, timeout=30)
        all_views = res.json().get("views", {}).get("view", [])
        print(f"📡 Escaneando {len(all_views)} vistas...")

        target_view = next(
            (v for v in all_views if VIEW_NAME.upper() in v.get("contentUrl", "").upper()), None
        )
        if not target_view:
            target_view = next(
                (v for v in all_views if FALLBACK_VIEW.upper() in v.get("contentUrl", "").upper()), None
            )
        if not target_view:
            msg = f"Vistas '{VIEW_NAME}' o '{FALLBACK_VIEW}' no encontradas."
            print(f"❌ {msg}")
            sb_log_error(msg)
            return

        view_id = target_view["id"]
        print(f"✅ Vista seleccionada: '{target_view.get('name')}'")

        # ── 3. Descargar CSV ────────────────────────────────────
        data_url = f"{TABLEAU_SERVER}/api/3.15/sites/{site_id}/views/{view_id}/data"
        res = requests.get(data_url, headers=t_headers, timeout=60)
        if res.status_code != 200:
            msg = f"Error descarga CSV (HTTP {res.status_code})"
            print(f"❌ {msg}")
            sb_log_error(msg)
            return
        if len(res.text) < 10:
            msg = "El CSV de Tableau vino vacío."
            print(f"⚠️  {msg}")
            sb_log_error(msg)
            return

        # ── 4. Procesar con Pandas ──────────────────────────────
        df = pd.read_csv(io.StringIO(res.text))
        df.columns = [c.strip() for c in df.columns]
        print(f"📊 Columnas detectadas: {list(df.columns)}")

        col_id = (
            "ID Trusted User" if "ID Trusted User" in df.columns
            else next((c for c in df.columns if "ID" in c.upper()), None)
        )
        col_val = (
            "Revenue" if "Revenue" in df.columns
            else next(
                (c for c in df.columns if "REVENUE" in c.upper() and "TYPE" not in c.upper()), None
            )
        )
        print(f"🎯 Columnas mapeadas → ID='{col_id}' | Valor='{col_val}'")

        if not col_id or not col_val:
            msg = f"No se encontraron columnas clave en: {list(df.columns)}"
            print(f"❌ {msg}")
            sb_log_error(msg)
            return

        # ── 5. Construir payload ────────────────────────────────
        payload_batch = []
        skipped = 0
        seen_ids = set()

        for _, row in df.iterrows():
            try:
                v_str = str(row[col_val]).replace("$", "").replace(",", "").replace(" ", "").strip()
                total = float(v_str) if v_str and v_str.lower() != "nan" else 0.0
                if total <= 0:
                    skipped += 1
                    continue

                perfil_raw = str(row[col_id]).strip()
                if not perfil_raw or perfil_raw.lower() == "nan":
                    skipped += 1
                    continue

                # Extraer ID numérico de 7-10 dígitos (IDs de Datame/Tableau)
                nums = re.findall(r"\d{7,10}", perfil_raw)
                id_clean = nums[0] if nums else perfil_raw.split(" ")[0].split("_")[-1]

                # Deduplicar: si ya existe, sumamos el valor
                if id_clean in seen_ids:
                    for rec in payload_batch:
                        if rec["perfil_id"] == id_clean:
                            rec["valor"] = round(rec["valor"] + total, 2)
                    continue
                seen_ids.add(id_clean)

                payload_batch.append({
                    "perfil_id":  id_clean,
                    "valor":      round(total, 2),
                    "data_json":  json.loads(row.to_json()),
                    "updated_at": "now()"
                })
            except Exception:
                skipped += 1
                continue

        print(f"\n📦 Registros válidos: {len(payload_batch)} | Descartados: {skipped}")

        if not payload_batch:
            print("⚠️  No hay datos válidos para subir.")
            return

        # ── 6. Subir a Supabase (REST directo — bypass RLS) ────
        print(f"\n📤 Subiendo a Supabase vía REST (Service Role — bypass RLS)...")
        ok = sb_upsert_batch(payload_batch)

        if ok:
            sb_delete_debug_log()
            print("\n🏁 ¡Sincronización completada con éxito! ✅")
        else:
            print("\n❌ Sincronización falló en la subida. Revisa los logs anteriores.")

    except Exception as e:
        msg = f"Error crítico en script: {str(e)}"
        print(f"\n❌ {msg}")
        sb_log_error(msg)


if __name__ == "__main__":
    sync_tableau()
