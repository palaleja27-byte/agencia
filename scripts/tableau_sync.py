import os
import requests
import pandas as pd
import json
import io
import re
import base64

# ═══════════════════════════════════════════════════════════════════
# CONFIGURACIÓN TABLEAU
# ═══════════════════════════════════════════════════════════════════
TABLEAU_SERVER = "https://prod-uk-a.online.tableau.com"
TABLEAU_SITE   = "partnerdata"
TOKEN_NAME     = "Analytics"
TOKEN_SECRET   = os.getenv("TABLEAU_TOKEN_SECRET")

VIEW_NAME     = "GRUPOROMERO"
FALLBACK_VIEW = "Revenuedetailed"

# ═══════════════════════════════════════════════════════════════════
# CONFIGURACIÓN SUPABASE
# ═══════════════════════════════════════════════════════════════════
SUPABASE_URL = os.getenv("SUPABASE_URL", "").rstrip("/")
SUPABASE_KEY = (
    os.getenv("SUPABASE_SERVICE_KEY") or
    os.getenv("SUPABASE_SERVICE_ROLE_KEY") or
    os.getenv("SUPABASE_KEY") or ""
)

BATCH_SIZE = 200  # Registros por llamada a la función RPC

# IDs de tu agencia cargados desde Supabase (fallback hardcodeado si falla la consulta)
FALLBACK_IDS = {
    # PANEL-1
    "91360720",
    # PANEL-2
    "95956014", "91733663", "153039388", "95955130", "103289167",
    "98389135", "98540781", "157067734", "103291980", "130431310",
    "151070498", "143014129", "156716207",
    # PANEL-3
    "88243516", "79679899", "118692242", "109551682", "108018336",
    "118179794", "130338853", "137163229", "120720195", "139247498",
    "139245989", "120275229", "156881990", "130422416", "143017065",
    "145211163", "145834230", "145844971", "157112125",
    # PANEL-4
    "131130713", "138130329", "133085188", "144863124",
}


# ═══════════════════════════════════════════════════════════════════
# HELPERS
# ═══════════════════════════════════════════════════════════════════
def decode_jwt_role(token: str) -> str:
    """Decodifica el payload del JWT para mostrar el rol."""
    try:
        payload_b64 = token.split(".")[1]
        padding = 4 - len(payload_b64) % 4
        decoded = base64.b64decode(payload_b64 + "=" * padding).decode()
        payload = json.loads(decoded)
        return payload.get("role", "desconocido")
    except Exception:
        return "no decodificable"


def check_creds() -> bool:
    print("📡 Verificando credenciales...")
    print(f"   URL: {SUPABASE_URL[:25]}..." if SUPABASE_URL else "   URL: ❌ FALTANTE")

    if not SUPABASE_KEY:
        print("   KEY: ❌ FALTANTE")
        return False

    rol = decode_jwt_role(SUPABASE_KEY)
    icon = "✅" if rol == "service_role" else "⚠️ "
    print(f"   KEY: {SUPABASE_KEY[:6]}***")
    print(f"   ROL: {icon} {rol}")
    if rol != "service_role":
        print("   ℹ️  Usando modo CYBERPUNK: RPC SECURITY DEFINER (bypass RLS sin service_role)")
    return bool(SUPABASE_URL)


def sb_headers() -> dict:
    return {
        "apikey":        SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type":  "application/json",
    }


def fetch_agency_ids() -> set:
    """
    Obtiene desde Supabase los IDs de datame_perfiles (nuestra agencia).
    Si falla, usa el fallback hardcodeado para no detener la sincronización.
    """
    url = f"{SUPABASE_URL}/rest/v1/datame_perfiles?select=id_datame&activo=eq.true"
    try:
        resp = requests.get(url, headers=sb_headers(), timeout=15)
        if resp.status_code == 200:
            data = resp.json()
            ids  = {str(r["id_datame"]).strip() for r in data if r.get("id_datame")}
            if ids:
                print(f"   ✅ Whitelist cargada desde Supabase: {len(ids)} perfiles de la agencia")
                return ids
        print(f"   ⚠️  No se pudo cargar whitelist (HTTP {resp.status_code}) — usando fallback")
    except Exception as e:
        print(f"   ⚠️  Error al consultar datame_perfiles: {e} — usando fallback")

    print(f"   📋 Fallback: {len(FALLBACK_IDS)} IDs hardcodeados")
    return FALLBACK_IDS.copy()


# ═══════════════════════════════════════════════════════════════════
# CYBERPUNK UPSERT — Llama a la función SECURITY DEFINER
# Funciona con anon key Y con service_role key
# ═══════════════════════════════════════════════════════════════════
def sb_rpc_upsert(records: list) -> bool:
    """
    Llama a la función Postgres `upsert_tableau_batch(jsonb)`.
    Al ser SECURITY DEFINER, corre como owner y bypasea RLS
    sin importar qué key esté usando el llamador.
    """
    url     = f"{SUPABASE_URL}/rest/v1/rpc/upsert_tableau_batch"
    headers = sb_headers()
    total   = len(records)
    uploaded = 0

    for i in range(0, total, BATCH_SIZE):
        batch   = records[i : i + BATCH_SIZE]
        payload = {"records": batch}

        resp = requests.post(url, headers=headers, json=payload, timeout=30)

        if resp.status_code in (200, 201):
            try:
                result = resp.json()
                count  = result.get("inserted", len(batch))
            except Exception:
                count = len(batch)
            uploaded += count
            print(f"   ✅ Lote {i//BATCH_SIZE + 1}: {count} registros escritos (SECURITY DEFINER)")
        else:
            print(f"   ❌ Lote {i//BATCH_SIZE + 1} falló — HTTP {resp.status_code}: {resp.text[:400]}")
            return False

    print(f"\n💾 Total: {uploaded}/{total} registros sincronizados.")
    return True


def sb_log_error(msg: str):
    """Graba error en la tabla para que el Dashboard lo muestre."""
    url     = f"{SUPABASE_URL}/rest/v1/rpc/upsert_tableau_batch"
    payload = {"records": [{
        "perfil_id":  "DEBUG_LOG",
        "valor":      0,
        "data_json":  {"error": msg},
        "updated_at": "now()"
    }]}
    try:
        requests.post(url, headers=sb_headers(), json=payload, timeout=10)
    except Exception:
        pass


def sb_delete_debug_log():
    """Limpia el log de error si la sincronización fue exitosa."""
    url = f"{SUPABASE_URL}/rest/v1/rpc/upsert_tableau_batch"
    payload = {"records": [{
        "perfil_id":  "DEBUG_LOG",
        "valor":      0,
        "data_json":  {"status": "cleared"},
        "updated_at": "now()"
    }]}
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
        res = requests.post(
            auth_url, json=auth_payload,
            headers={"Accept": "application/json"}, timeout=30
        )
        print(f"📡 Status Auth: {res.status_code}")

        if res.status_code != 200:
            msg = f"Error Auth Tableau: {res.text[:200]}"
            print(f"❌ {msg}")
            sb_log_error(msg)
            return

        data    = res.json()
        token   = data["credentials"]["token"]
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
        print(f"🎯 Columnas → ID='{col_id}' | Valor='{col_val}'")

        if not col_id or not col_val:
            msg = f"No se encontraron columnas clave en: {list(df.columns)}"
            print(f"❌ {msg}")
            sb_log_error(msg)
            return

        # ── 5. Cargar whitelist de IDs de la agencia ───────────
        print("\n🔍 Cargando whitelist de perfiles de la agencia...")
        agency_ids = fetch_agency_ids()

        # ── 6. Construir payload — solo IDs de nuestra agencia ──
        payload_batch = []
        skipped_zero  = 0
        skipped_ext   = 0
        seen_ids      = {}

        for _, row in df.iterrows():
            try:
                v_str = str(row[col_val]).replace("$", "").replace(",", "").replace(" ", "").strip()
                total = float(v_str) if v_str and v_str.lower() != "nan" else 0.0
                if total <= 0:
                    skipped_zero += 1
                    continue

                perfil_raw = str(row[col_id]).strip()
                if not perfil_raw or perfil_raw.lower() == "nan":
                    skipped_zero += 1
                    continue

                nums     = re.findall(r"\d{7,10}", perfil_raw)
                id_clean = nums[0] if nums else perfil_raw.split(" ")[0].split("_")[-1]

                # ── FILTRO AGENCIA: descartar IDs de otras sedes ──
                if id_clean not in agency_ids:
                    skipped_ext += 1
                    continue

                # Deduplicar: sumar valores del mismo ID
                if id_clean in seen_ids:
                    payload_batch[seen_ids[id_clean]]["valor"] = round(
                        payload_batch[seen_ids[id_clean]]["valor"] + total, 2
                    )
                    continue

                seen_ids[id_clean] = len(payload_batch)
                payload_batch.append({
                    "perfil_id":  id_clean,
                    "valor":      round(total, 2),
                    "data_json":  json.loads(row.to_json()),
                    "updated_at": "now()"
                })
            except Exception:
                skipped_zero += 1
                continue

        total_csv = len(df)
        print(f"\n📦 CSV total: {total_csv} filas")
        print(f"   ✅ Mi agencia (ROMERO): {len(payload_batch)} perfiles")
        print(f"   🚫 Otras sedes (filtrados): {skipped_ext}")
        print(f"   ⏭️  Sin valor / inválidos:  {skipped_zero}")

        if not payload_batch:
            print("⚠️  No hay datos válidos para subir.")
            return

        # ── 6. CYBERPUNK UPSERT vía RPC SECURITY DEFINER ───────
        print(f"\n⚡ CYBERPUNK MODE: RPC upsert_tableau_batch (bypass RLS)...")
        ok = sb_rpc_upsert(payload_batch)

        if ok:
            print("\n🏁 ¡SYNC COMPLETADO! Tableau → Supabase ✅")
        else:
            print("\n❌ Sync falló. Revisa los logs anteriores.")

    except Exception as e:
        msg = f"Error crítico: {str(e)}"
        print(f"\n❌ {msg}")
        sb_log_error(msg)


if __name__ == "__main__":
    sync_tableau()
