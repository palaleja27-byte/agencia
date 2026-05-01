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
# DIAGNÓSTICO CLAVE:
# El link del usuario es:
# https://prod-uk-a.online.tableau.com/#/site/partnerdata/views/
#   Passport_16741406948180/Revenuedetailed/.../GRUPOROMERO
#
# GRUPOROMERO es un FILTRO DE USUARIO (User Filter), NO una vista.
# La vista real = "Revenuedetailed" dentro del workbook
# "Passport_16741406948180".
# El token PAT de "Analytics" YA tiene el filtro de agencia aplicado.
# Al descargar /data de esa vista, Tableau devuelve SOLO los perfiles
# que el token tiene permitidos → los ~10 de Agencia Romero.
# ═══════════════════════════════════════════════════════════════════


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
    # NOTA: La vista real en Tableau es "Revenuedetailed" dentro del workbook
    # "Passport_16741406948180". GRUPOROMERO es el filtro de usuario que
    # Tableau aplica automáticamente según el token PAT — NO es una vista.
    print("   📋 Usando fallback: 1 panel ROMERO hardcodeado")
    return [{
        "id": 1,
        "nombre": "ROMERO OFICIAL",
        "server": "https://prod-uk-a.online.tableau.com",
        "site":   "partnerdata",
        "view_name": "Revenuedetailed",   # ← Vista real (no GRUPOROMERO)
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
        ids.discard("PENDING")
        if ids:
            print(f"      🔑 {len(ids)} IDs en whitelist del panel {panel_id}")
            return ids
    print(f"      ⚠️  Sin whitelist en tableau_perfiles — usando IDs de datame_perfiles como llave")
    return set()


def fetch_datame_ids() -> set:
    """
    Lee datame_perfiles desde Supabase.
    Devuelve un set de id_datame (los IDs propios de la agencia).
    Estos IDs son la LLAVE DE BÚSQUEDA en el CSV de Tableau.
    """
    rows = sb_get("datame_perfiles?select=id_datame&activo=eq.true")
    if rows:
        ids = {str(r["id_datame"]).strip() for r in rows if r.get("id_datame")}
        ids.discard("PENDING")
        print(f"   🔑 {len(ids)} IDs propios de Agencia Romero cargados desde datame_perfiles:")
        print(f"      {sorted(ids)}")
        return ids
    # Fallback hardcodeado con los IDs conocidos de la agencia
    fallback = {
        "7ROMERO", "ROMERO01", "ROMERO02"  # reemplazar con IDs reales si se conocen
    }
    print(f"   ⚠️  datame_perfiles vacío — usando fallback hardcodeado: {fallback}")
    return fallback



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

    # ── ESCANEO TOTAL: buscar en TODOS los sitios disponibles ────
    # Obtener lista de todos los sitios a los que tiene acceso el token
    all_sites_url = f"{server}/api/3.4/sites?pageSize=100"
    res_sites = requests.get(all_sites_url, headers=t_headers, timeout=30)
    all_sites = []
    if res_sites.status_code == 200:
        all_sites = res_sites.json().get("sites", {}).get("site", [])
        print(f"\n   🌐 SITIOS DISPONIBLES ({len(all_sites)} total):")
        for s in all_sites:
            print(f"      → contentUrl: '{s.get('contentUrl','')}' | name: '{s.get('name','')}'")
    else:
        print(f"   ⚠️  No se pudo listar sitios (HTTP {res_sites.status_code}) — usando sitio actual")
        all_sites = [{"contentUrl": site, "id": site_id, "name": site}]

    # Buscar en CADA sitio los workbooks que contengan palabras clave
    KEYWORDS = ["andinas", "marketing", "romero", "revenue", "agencia", "partner"]
    found_wb  = None
    found_site = None
    found_token = None
    found_site_id = None
    all_workbooks = []   # acumulador global (wb, token, site_id) de TODOS los sitios

    for s in all_sites:
        s_content_url = s.get("contentUrl", "")
        s_name        = s.get("name", "")

        # Re-autenticar en cada sitio
        auth2 = requests.post(
            f"{server}/api/3.4/auth/signin",
            json={"credentials": {
                "personalAccessTokenName":   token_name,
                "personalAccessTokenSecret": token_secret,
                "site": {"contentUrl": s_content_url}
            }},
            headers={"Accept": "application/json"}, timeout=20
        )
        if auth2.status_code != 200:
            print(f"      ⚠️  Sitio '{s_name}': no se pudo autenticar")
            continue

        auth2_data   = auth2.json()
        t2           = auth2_data["credentials"]["token"]
        sid2         = auth2_data["credentials"]["site"]["id"]
        h2           = {"X-Tableau-Auth": t2, "Accept": "application/json"}

        # Listar workbooks del sitio
        wbs = requests.get(
            f"{server}/api/3.4/sites/{sid2}/workbooks?pageSize=200",
            headers=h2, timeout=30
        )
        if wbs.status_code != 200:
            continue

        workbooks = wbs.json().get("workbooks", {}).get("workbook", [])
        print(f"\n   📂 Sitio '{s_name}' ({s_content_url}): {len(workbooks)} workbooks")

        for wb in workbooks:
            wb_name = wb.get("name", "").lower()
            wb_url  = wb.get("contentUrl", "").lower()
            match   = any(kw in wb_name or kw in wb_url for kw in KEYWORDS)
            marker  = "  ⭐" if match else ""
            print(f"      → {wb.get('contentUrl','')} | {wb.get('name','')}{marker}")
            # Acumular con su token y site_id para el escaneo datame
            all_workbooks.append({"wb": wb, "token": t2, "sid": sid2})
            if match and not found_wb:
                found_wb      = wb
                found_site    = s_name
                found_token   = t2
                found_site_id = sid2

    # ── ESTRATEGIA DATAME: buscar IDs propios en TODOS los workbooks ──
    # Cargar los IDs de datame_perfiles (nuestros perfiles de agencia)
    datame_ids = fetch_datame_ids()
    if not datame_ids:
        print("   ❌ Sin IDs de datame_perfiles. Abortando.")
        return 0

    # Escanear TODOS los workbooks buscando vistas que contengan nuestros IDs
    print(f"\n   🔍 Escaneando {len(all_workbooks)} workbooks buscando IDs de la agencia...")
    found_records = []      # acumulador de registros encontrados

    for entry in all_workbooks:
        wb     = entry["wb"]
        t2     = entry["token"]
        sid2   = entry["sid"]
        h2     = {"X-Tableau-Auth": t2, "Accept": "application/json"}
        wb_name = wb.get('name', '')
        wb_id2  = wb.get('id', '')

        # Obtener vistas del workbook
        vws_res = requests.get(
            f"{server}/api/3.4/sites/{sid2}/workbooks/{wb_id2}/views",
            headers=h2, timeout=20
        )
        if vws_res.status_code != 200:
            continue
        vws = vws_res.json().get("views", {}).get("view", [])

        for view in vws:
            view_id2  = view.get("id", "")
            view_name2 = view.get("name", "")

            # Descargar CSV de la vista
            csv_res = requests.get(
                f"{server}/api/3.15/sites/{sid2}/views/{view_id2}/data",
                headers=h2, timeout=30
            )
            if csv_res.status_code != 200 or len(csv_res.text) < 10:
                continue

            try:
                df = pd.read_csv(io.StringIO(csv_res.text))
                df.columns = [c.strip() for c in df.columns]
            except Exception:
                continue

            # Buscar columna de ID en el CSV
            col_id = next(
                (c for c in df.columns
                 if any(k in c.upper() for k in ["ID", "USER", "PERFIL", "PROFILE"])),
                None
            )
            if not col_id:
                continue

            # Cruzar IDs del CSV con los IDs de datame_perfiles
            df["_id_clean"] = df[col_id].astype(str).str.strip()
            matched = df[df["_id_clean"].isin(datame_ids)]

            if matched.empty:
                # Intentar con regex numérico
                df["_id_num"] = df[col_id].astype(str).apply(
                    lambda x: re.findall(r"\d{7,10}", x)[0] if re.findall(r"\d{7,10}", x) else ""
                )
                matched = df[df["_id_num"].isin(datame_ids)]
                if not matched.empty:
                    df["_id_clean"] = df["_id_num"]

            if not matched.empty:
                hits = len(matched)
                print(f"   ✅ MATCH! Workbook '{wb_name}' / Vista '{view_name2}': {hits} IDs encontrados")
                print(f"      IDs: {list(matched['_id_clean'].unique())}")
                source_info = {"workbook": wb_name, "vista": view_name2,
                               "col_id": col_id, "df": df, "matched": matched}
                found_records.append(source_info)
            # else: no mencionar en el log para no saturar

    if not found_records:
        print(f"\n   ⚠️  Ningún workbook tiene IDs que coincidan con datame_perfiles.")
        print(f"   📄 IDs buscados: {sorted(datame_ids)}")
        return 0

    # Usar la primera fuente encontrada con más matches
    best = max(found_records, key=lambda x: len(x["matched"]))
    print(f"\n   🎯 FUENTE GANADORA: '{best['workbook']}' / '{best['vista']}' — {len(best['matched'])} perfiles")
    df      = best["df"]
    matched = best["matched"]
    col_id  = best["col_id"]
    view_real = best["vista"
]

    # ── Buscar columna de valor (revenue) ────────────────────────
    col_val = next(
        (c for c in df.columns
         if any(k in c.upper() for k in ["REVENUE", "EARNINGS", "AMOUNT", "TOTAL", "COINS", "INCOME"])
         and "TYPE" not in c.upper()),
        None
    )

    print(f"   📊 {len(matched)} filas de la agencia | Col ID='{col_id}' | Col Valor='{col_val}'")
    print(f"   🔍 Primeras 5 filas de nuestros perfiles:")
    for i, row in matched.head(5).iterrows():
        print(f"      [{i}] ID={row[col_id]} | Valor={row.get(col_val, 'N/A')}")

    # ── Construir payload ─────────────────────────────────────────
    payload = []
    seen    = {}

    for _, row in matched.iterrows():
        id_clean = str(row["_id_clean"]).strip()
        valor    = 0.0
        if col_val:
            try:
                v_str = str(row[col_val]).replace("$","").replace(",","").replace(" ","").strip()
                valor = float(v_str) if v_str and v_str.lower() != "nan" else 0.0
            except Exception:
                valor = 0.0

        if id_clean in seen:
            payload[seen[id_clean]]["valor"] = round(payload[seen[id_clean]]["valor"] + valor, 2)
            continue

        seen[id_clean] = len(payload)
        payload.append({
            "perfil_id":    id_clean,
            "panel_id":     panel_id,
            "panel_nombre": panel_nombre,
            "valor":        round(valor, 2),
            "data_json":    json.loads(row.to_json()),
            "updated_at":   "now()"
        })

    print(f"   📦 {len(payload)} perfiles de la agencia listos para subir:")
    for rec in payload:
        print(f"      → {rec['perfil_id']} | ${rec['valor']:,.2f}")

    if not payload:
        print("   ⚠️  Sin datos válidos para subir.")
        return 0

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
