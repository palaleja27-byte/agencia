import os
import requests
import pandas as pd
import json
import io
import re
import base64

# ═══════════════════════════════════════════════════════════════════
# CONFIGURACIÓN SUPABASE
# ═══════════════════════════════════════════════════════════════════
SUPABASE_URL = os.getenv("SUPABASE_URL", "").rstrip("/")
SUPABASE_KEY = (
    os.getenv("SUPABASE_SERVICE_KEY") or
    os.getenv("SUPABASE_SERVICE_ROLE_KEY") or
    os.getenv("SUPABASE_KEY") or ""
)
BATCH_SIZE = 200


# ═══════════════════════════════════════════════════════════════════
# HELPERS SUPABASE
# ═══════════════════════════════════════════════════════════════════
def decode_jwt_role(token: str) -> str:
    try:
        payload_b64 = token.split(".")[1]
        padding = 4 - len(payload_b64) % 4
        decoded = base64.b64decode(payload_b64 + "=" * padding).decode()
        return json.loads(decoded).get("role", "desconocido")
    except Exception:
        return "no decodificable"


def sb_headers() -> dict:
    return {
        "apikey":        SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type":  "application/json",
    }


def check_creds() -> bool:
    print("📡 Verificando credenciales...")
    print(f"   URL: {SUPABASE_URL[:25]}..." if SUPABASE_URL else "   URL: ❌ FALTANTE")
    if not SUPABASE_KEY:
        print("   KEY: ❌ FALTANTE")
        return False
    rol  = decode_jwt_role(SUPABASE_KEY)
    icon = "✅" if rol == "service_role" else "⚠️ "
    print(f"   KEY: {SUPABASE_KEY[:6]}***")
    print(f"   ROL: {icon} {rol} (modo CYBERPUNK activo: RPC SECURITY DEFINER)")
    return bool(SUPABASE_URL)


def sb_get(path: str) -> list:
    """GET a Supabase REST API, devuelve lista o []."""
    try:
        resp = requests.get(f"{SUPABASE_URL}/rest/v1/{path}", headers=sb_headers(), timeout=15)
        if resp.status_code == 200:
            return resp.json()
    except Exception as e:
        print(f"   ⚠️  sb_get error ({path}): {e}")
    return []


def sb_rpc_upsert(records: list) -> bool:
    """
    Llama a upsert_tableau_batch() (SECURITY DEFINER).
    Bypasea RLS sin importar qué key se use.
    """
    url      = f"{SUPABASE_URL}/rest/v1/rpc/upsert_tableau_batch"
    total    = len(records)
    uploaded = 0

    for i in range(0, total, BATCH_SIZE):
        batch = records[i : i + BATCH_SIZE]
        resp  = requests.post(url, headers=sb_headers(), json={"records": batch}, timeout=30)

        if resp.status_code in (200, 201):
            try:
                count = resp.json().get("inserted", len(batch))
            except Exception:
                count = len(batch)
            uploaded += count
            print(f"   ✅ Lote {i//BATCH_SIZE + 1}: {count} registros escritos")
        else:
            print(f"   ❌ Lote {i//BATCH_SIZE + 1} falló — HTTP {resp.status_code}: {resp.text[:300]}")
            return False

    print(f"   💾 Total: {uploaded}/{total} sincronizados.")
    return True


def sb_log_error(msg: str):
    try:
        requests.post(
            f"{SUPABASE_URL}/rest/v1/rpc/upsert_tableau_batch",
            headers=sb_headers(),
            json={"records": [{"perfil_id": "DEBUG_LOG", "panel_id": 0,
                                "panel_nombre": "system", "valor": 0,
                                "data_json": {"error": msg}, "updated_at": "now()"}]},
            timeout=10
        )
    except Exception:
        pass


# ═══════════════════════════════════════════════════════════════════
# LÓGICA DE PANELES — igual a datame_panels pero para Tableau
# ═══════════════════════════════════════════════════════════════════
def fetch_tableau_panels() -> list:
    """
    Lee tableau_panels desde Supabase.
    Si la tabla no existe todavía, usa el fallback hardcodeado.
    """
    rows = sb_get("tableau_panels?select=*&activo=eq.true&order=id")
    if rows:
        print(f"   ✅ {len(rows)} paneles de Tableau cargados desde Supabase")
        return rows

    # Fallback: panel ROMERO por defecto
    print("   📋 Usando fallback: 1 panel ROMERO hardcodeado")
    return [{
        "id": 1,
        "nombre": "ROMERO OFICIAL",
        "server": "https://prod-uk-a.online.tableau.com",
        "site":   "partnerdata",
        "view_name": "GRUPOROMERO",
        "token_name": "Analytics",
    }]


def fetch_panel_ids(panel_id: int) -> set:
    """
    Lee tableau_perfiles para un panel_id.
    Devuelve un set de id_tableau activos.
    """
    rows = sb_get(f"tableau_perfiles?select=id_tableau&panel_id=eq.{panel_id}&activo=eq.true")
    if rows:
        ids = {str(r["id_tableau"]).strip() for r in rows if r.get("id_tableau")}
        # Si solo hay la fila PENDING (placeholder), ignorarla
        ids.discard("PENDING")
        if ids:
            print(f"      🔑 {len(ids)} IDs en whitelist del panel {panel_id}")
            return ids
    print(f"      ⚠️  Sin whitelist definida para panel {panel_id} — se aceptarán TODOS los IDs de esta vista")
    return set()  # set vacío = sin restricción de ID (acepta todos los de la vista)


# ═══════════════════════════════════════════════════════════════════
# SINCRONIZACIÓN DE UN PANEL
# ═══════════════════════════════════════════════════════════════════
def sync_panel(panel: dict, token_secret: str) -> int:
    """
    Descarga el CSV de la vista de Tableau de este panel,
    filtra por la whitelist de IDs y sube a Supabase.
    Devuelve número de registros subidos.
    """
    panel_id     = panel["id"]
    panel_nombre = panel["nombre"]
    server       = panel.get("server", "https://prod-uk-a.online.tableau.com")
    site         = panel.get("site", "partnerdata")
    view_name    = panel["view_name"]
    token_name   = panel.get("token_name", "Analytics")

    print(f"\n{'═'*60}")
    print(f"📋 Panel {panel_id}: {panel_nombre} → vista: {view_name}")

    # Cargar whitelist de IDs de este panel
    whitelist = fetch_panel_ids(panel_id)

    # ── Autenticación Tableau ────────────────────────────────────
    auth_url = f"{server}/api/3.4/auth/signin"
    auth_payload = {
        "credentials": {
            "personalAccessTokenName":   token_name,
            "personalAccessTokenSecret": token_secret,
            "site": {"contentUrl": site}
        }
    }
    res = requests.post(auth_url, json=auth_payload,
                        headers={"Accept": "application/json"}, timeout=30)

    if res.status_code != 200:
        print(f"   ❌ Auth Tableau falló ({res.status_code}): {res.text[:150]}")
        return 0

    data    = res.json()
    token   = data["credentials"]["token"]
    site_id = data["credentials"]["site"]["id"]
    t_headers = {"X-Tableau-Auth": token, "Accept": "application/json"}
    print(f"   ✅ Auth OK en Tableau.")

    # ── Localizar la vista ───────────────────────────────────────
    views_url = f"{server}/api/3.4/sites/{site_id}/views"
    res = requests.get(views_url, headers=t_headers, timeout=30)
    all_views = res.json().get("views", {}).get("view", [])

    target = next(
        (v for v in all_views if view_name.upper() in v.get("contentUrl", "").upper()), None
    )
    if not target:
        print(f"   ❌ Vista '{view_name}' no encontrada en {len(all_views)} vistas del sitio.")
        print(f"      Vistas disponibles: {[v.get('contentUrl','') for v in all_views[:10]]}")
        return 0

    view_id   = target["id"]
    view_real = target.get("name", view_name)
    print(f"   ✅ Vista encontrada: '{view_real}' (id={view_id})")

    # ── Descargar CSV ────────────────────────────────────────────
    data_url = f"{server}/api/3.15/sites/{site_id}/views/{view_id}/data"
    res = requests.get(data_url, headers=t_headers, timeout=60)
    if res.status_code != 200:
        print(f"   ❌ CSV falló (HTTP {res.status_code})")
        return 0
    if len(res.text) < 10:
        print("   ⚠️  CSV vacío")
        return 0

    # ── Procesar CSV ─────────────────────────────────────────────
    df = pd.read_csv(io.StringIO(res.text))
    df.columns = [c.strip() for c in df.columns]
    print(f"   📊 CSV: {len(df)} filas | Columnas: {list(df.columns)}")

    col_id = (
        "ID Trusted User" if "ID Trusted User" in df.columns
        else next((c for c in df.columns if "ID" in c.upper()), None)
    )
    col_val = (
        "Revenue" if "Revenue" in df.columns
        else next((c for c in df.columns if "REVENUE" in c.upper() and "TYPE" not in c.upper()), None)
    )
    if not col_id or not col_val:
        print(f"   ❌ Columnas clave no encontradas. Disponibles: {list(df.columns)}")
        return 0

    print(f"   🎯 Mapeado → ID='{col_id}' | Valor='{col_val}'")

    # ── Construir payload con filtro de whitelist ─────────────────
    payload = []
    seen    = {}
    skip_ext = 0
    skip_bad = 0

    for _, row in df.iterrows():
        try:
            v_str = str(row[col_val]).replace("$","").replace(",","").replace(" ","").strip()
            valor = float(v_str) if v_str and v_str.lower() != "nan" else 0.0
            if valor <= 0:
                skip_bad += 1
                continue

            perfil_raw = str(row[col_id]).strip()
            if not perfil_raw or perfil_raw.lower() == "nan":
                skip_bad += 1
                continue

            nums     = re.findall(r"\d{7,10}", perfil_raw)
            id_clean = nums[0] if nums else perfil_raw.split(" ")[0].split("_")[-1]

            # Filtro whitelist (si está vacía = acepta todo lo de la vista)
            if whitelist and id_clean not in whitelist:
                skip_ext += 1
                continue

            if id_clean in seen:
                payload[seen[id_clean]]["valor"] = round(payload[seen[id_clean]]["valor"] + valor, 2)
                continue

            seen[id_clean] = len(payload)
            payload.append({
                "perfil_id":   id_clean,
                "panel_id":    panel_id,
                "panel_nombre": panel_nombre,
                "valor":       round(valor, 2),
                "data_json":   json.loads(row.to_json()),
                "updated_at":  "now()"
            })
        except Exception:
            skip_bad += 1

    print(f"   📦 De la vista: {len(payload)} perfiles válidos | {skip_ext} de otra sede | {skip_bad} sin datos")

    if not payload:
        print("   ⚠️  Sin datos para subir en este panel.")
        return 0

    # Loguear qué IDs se detectaron (útil para configurar la whitelist)
    print(f"   🔍 IDs detectados en esta vista:")
    for rec in payload:
        print(f"      → {rec['perfil_id']} | ${rec['valor']:,.2f}")

    # ── Subir a Supabase ─────────────────────────────────────────
    print(f"\n   ⚡ CYBERPUNK UPSERT → {len(payload)} registros...")
    sb_rpc_upsert(payload)
    return len(payload)


# ═══════════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════════
def sync_tableau():
    if not check_creds():
        print("❌ Abortado: faltan credenciales.")
        return

    token_secret = os.getenv("TABLEAU_TOKEN_SECRET")
    if not token_secret:
        print("❌ Abortado: TABLEAU_TOKEN_SECRET no está configurado.")
        return

    print("\n🚀 Iniciando sincronización multi-panel Tableau...")
    print("🔍 Cargando paneles desde Supabase...")
    panels = fetch_tableau_panels()

    total_synced = 0
    for panel in panels:
        try:
            n = sync_panel(panel, token_secret)
            total_synced += n
        except Exception as e:
            msg = f"Error en panel {panel.get('nombre','?')}: {str(e)}"
            print(f"   ❌ {msg}")
            sb_log_error(msg)

    print(f"\n{'═'*60}")
    print(f"🏁 SYNC COMPLETO — {total_synced} perfiles sincronizados en {len(panels)} paneles ✅")


if __name__ == "__main__":
    sync_tableau()
