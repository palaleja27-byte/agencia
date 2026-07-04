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
    Garantiza que tanto ROMERO OFICIAL (id: 1) como ROMERO ICES (id: 2) estén presentes en la lista.
    """
    rows = sb_get("tableau_panels?select=*&activo=eq.true&order=id")
    if not rows:
        rows = []
    
    # Asegurar que ROMERO OFICIAL (id: 1) esté en la lista
    if not any(r.get("id") == 1 for r in rows):
        rows.append({
            "id": 1,
            "nombre": "ROMERO OFICIAL",
            "server": "https://prod-uk-a.online.tableau.com",
            "site":   "partnerdata",
            "view_name": "Revenuedetailed",
            "token_name": "Analytics",
            "activo": True
        })
        
    # Asegurar que ROMERO ICES (id: 2) esté en la lista
    if not any(r.get("id") == 2 for r in rows):
        rows.append({
            "id": 2,
            "nombre": "ROMERO ICES",
            "server": "https://prod-uk-a.online.tableau.com",
            "site":   "partnerdata",
            "view_name": "Chaticeswithoutphoto",
            "token_name": "Analytics",
            "activo": True
        })
        
    print(f"   ✅ {len(rows)} paneles de Tableau a procesar (garantizados Oficial e Ices)")
    return rows


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
    ids = set()
    if rows:
        ids = {str(r["id_datame"]).strip() for r in rows if r.get("id_datame")}
        ids.discard("PENDING")

    # Asegurar que los perfiles nuevos (GUSTAVO 168486464, LUIZ 157112125, ROBERTO 170740935, RONALT 171638277)
    # estén siempre incluidos en el set de escaneo de Tableau, resolviendo limitaciones de RLS/sincronización de base de datos
    extra_ids = {"168486464", "157112125", "170740935", "171638277"}
    ids.update(extra_ids)

    print(f"   🔑 {len(ids)} IDs propios de Agencia Romero cargados:")
    print(f"      {sorted(ids)}")
    return ids



# ═══════════════════════════════════════════════════════════════════
# SINCRONIZACIÓN DE UN PANEL
# ═══════════════════════════════════════════════════════════════════
def sync_panel(panel: dict, token_secret: str, token_name: str = "Analytics") -> int:
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

    all_views_to_scan = []   # acumulador global (view, token, site_id) de TODOS los sitios
    KEYWORDS = ["andinas", "marketing", "romero", "revenue", "agencia", "partner", "passport"]

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

        # Listar VISTAS del sitio directamente (bypasseando workbooks)
        vws = requests.get(
            f"{server}/api/3.4/sites/{sid2}/views?pageSize=1000",
            headers=h2, timeout=30
        )
        if vws.status_code != 200:
            continue

        site_views = vws.json().get("views", {}).get("view", [])
        print(f"\n   📂 Sitio '{s_name}' ({s_content_url}): {len(site_views)} vistas encontradas directamente")

        for view in site_views:
            view_name = view.get("name", "").lower()
            view_url  = view.get("contentUrl", "").lower()
            match   = any(kw in view_name or kw in view_url for kw in KEYWORDS)
            marker  = "  ⭐" if match else ""
            
            # Acumular TODAS las vistas para el escaneo, pero podemos priorizar si queremos
            all_views_to_scan.append({"view": view, "token": t2, "sid": sid2, "site_name": s_name})

    # ── ESTRATEGIA DATAME: buscar IDs propios en TODOS los workbooks ──
    # Cargar los IDs de datame_perfiles (nuestros perfiles de agencia)
    datame_ids = fetch_datame_ids()
    if not datame_ids:
        print("   ❌ Sin IDs de datame_perfiles. Abortando.")
        return 0

    # Escanear TODAS las vistas buscando nuestros IDs
    print(f"\n   🔍 Escaneando {len(all_views_to_scan)} vistas buscando IDs de la agencia...")
    found_records = []      # acumulador de registros encontrados

    for entry in all_views_to_scan:
        view   = entry["view"]
        t2     = entry["token"]
        sid2   = entry["sid"]
        s_name = entry["site_name"]
        h2     = {"X-Tableau-Auth": t2, "Accept": "application/json"}
        
        view_id2   = view.get('id', '')
        view_name2 = view.get('name', '')
        view_curl  = view.get('contentUrl', '')

        # Filtrado rápido para no descargar 1000 CSVs: solo vistas que parezcan relevantes
        # Si el nombre tiene revenue, passport, kpi, usage, detail, etc.
        if not any(k in view_name2.lower() or k in view_curl.lower() for k in ["revenue", "passport", "kpi", "usage", "detail", "score", "romero", "ice", "breaker", "source", "reply", "response"]):
            continue

        # Descargar CSV de la vista (con manejo de timeout robusto)
        try:
            csv_res = requests.get(
                f"{server}/api/3.15/sites/{sid2}/views/{view_id2}/data",
                headers=h2, timeout=60
            )
            if csv_res.status_code != 200 or len(csv_res.text) < 10:
                continue
        except requests.exceptions.RequestException as e:
            print(f"      ⚠️  Timeout/Error descargando vista '{view_name2}': {e}")
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
            print(f"   ✅ MATCH! Vista '{view_curl}': {hits} IDs encontrados")
            source_info = {"workbook": view_curl.split('/')[0], "vista": view_name2,
                           "col_id": col_id, "df": df, "matched": matched}
            found_records.append(source_info)

    if not found_records:
        print(f"\n   ⚠️  Ningún workbook tiene IDs que coincidan con datame_perfiles.")
        print(f"   📄 IDs buscados: {sorted(datame_ids)}")
        return 0

    # Priorizar fuente que tenga columna de REVENUE sobre la que solo tiene IDs
    REVENUE_KEYS = ["REVENUE", "EARNINGS", "AMOUNT", "TOTAL", "COINS", "INCOME", "SCORE", "KPI"]

    def has_revenue(rec):
        return any(
            any(k in c.upper() for k in REVENUE_KEYS) and "TYPE" not in c.upper()
            for c in rec["df"].columns
        )

    # Priorizar la vista configurada en el panel (view_name)
    best = None
    if view_name:
        matched_views = [r for r in found_records if view_name.lower() in r["vista"].lower() or view_name.lower() in r["workbook"].lower()]
        if matched_views:
            best_with_revenue = [r for r in matched_views if has_revenue(r)]
            if best_with_revenue:
                best = max(best_with_revenue, key=lambda x: len(x["matched"]))
            else:
                best = max(matched_views, key=lambda x: len(x["matched"]))
            print(f"\n   🎯 FUENTE CONFIGURADA SELECCIONADA: '{best['workbook']}' / '{best['vista']}' — {len(best['matched'])} perfiles")

    if not best:
        # Fallback a la lógica original si no se encuentra coincidencia con la vista configurada
        best_with_revenue = [r for r in found_records if has_revenue(r)]
        if best_with_revenue:
            best = max(best_with_revenue, key=lambda x: len(x["matched"]))
            print(f"\n   🎯 FUENTE GANADORA POR DEFECTO (con revenue): '{best['workbook']}' / '{best['vista']}' — {len(best['matched'])} perfiles")
        else:
            best = max(found_records, key=lambda x: len(x["matched"]))
            print(f"\n   🎯 FUENTE GANADORA POR DEFECTO (sin revenue): '{best['workbook']}' / '{best['vista']}' — {len(best['matched'])} perfiles")
        
        print(f"      ⚠️  Todas las fuentes encontradas:")
        for r in found_records:
            cols = [c for c in r["df"].columns if any(k in c.upper() for k in REVENUE_KEYS)]
            print(f"         → {r['workbook']} / {r['vista']} | Cols revenue: {cols or 'ninguna'}")

    df       = best["df"]
    matched  = best["matched"]
    col_id   = best["col_id"]
    view_real = best["vista"]

    # ── Buscar columna de valor (revenue) ────────────────────────
    # 1. Buscar coincidencias exactas primero (según captura de pantalla del usuario)
    exact_keys = ["Total general", "Total", "Revenue", "Amount"]
    col_val = next(
        (c for c in df.columns if c.strip() in exact_keys),
        None
    )
    
    # 2. Si no hay exactas, buscar aproximadas excluyendo basura
    if not col_val:
        col_val = next(
            (c for c in df.columns
             if any(k in c.upper() for k in REVENUE_KEYS)
             and not any(exc in c.upper() for exc in ["TYPE", "TITLE", "SERVICE"])),
            None
        )

    print(f"   📊 {len(matched)} filas de la agencia | Col ID='{col_id}' | Col Valor='{col_val}'")
    print(f"   🔍 Columnas completas: {list(df.columns)}")
    print(f"   🔍 Primeras 5 filas de nuestros perfiles:")
    for i, row in matched.head(5).iterrows():
        print(f"      [{i}] ID={row[col_id]} | Valor={row.get(col_val, 'N/A')}")

    # ── EXTRAER CLIENTES PREMIUM (REGULAR USERS) DESDE VISTAS DE LÍMITES ──
    clients_by_profile = {}
    
    def get_regular_user_col(dataframe, exclude_c):
        return next(
            (col for col in dataframe.columns
             if col != exclude_c and any(k in col.upper() for k in ["REGULAR USER", "REGULAR_USER", "REGULARUSER", "REGULAR", "CLIENT"])),
            None
        )

    for rec in found_records:
        r_df = rec["df"]
        r_col_id = rec["col_id"]
        col_reg_user = get_regular_user_col(r_df, r_col_id)
        if not col_reg_user:
            continue
            
        print(f"      🔍 Procesando vista de clientes '{rec['workbook']}' / '{rec['vista']}'...")
        
        # Identificar columnas auxiliares
        resets_col = next((c for c in r_df.columns if any(k in c.upper() for k in ["DIALOGS_RESET", "RESET", "#DIALOGS", "RESETS"])), None)
        date_col = next((c for c in r_df.columns if any(k in c.upper() for k in ["DATE RESET", "DATE_RESET", "DATE", "FECHA"])), None)
        reason_col = next((c for c in r_df.columns if any(k in c.upper() for k in ["REASON", "MOTIVO"])), None)
        src_id_col = next((c for c in r_df.columns if any(k in c.upper() for k in ["SOURCE ID", "SOURCE_ID", "CAMP"])), None)

        for _, row in rec["matched"].iterrows():
            raw_id = str(row["_id_clean"]).strip()
            nums = re.findall(r"\d{7,10}", raw_id)
            profile_id = nums[0] if nums else raw_id
            
            client_raw = str(row[col_reg_user]).strip()
            if not client_raw or client_raw.lower() == "nan" or client_raw.lower() == "none":
                continue
                
            client_nums = re.findall(r"\d{7,10}", client_raw)
            client_id = client_nums[0] if client_nums else client_raw
            client_name = ""
            if " - " in client_raw:
                parts = client_raw.split(" - ")
                if parts[0].strip() == client_id:
                    client_name = " - ".join(parts[1:]).strip()
                else:
                    client_name = parts[0].strip()
            else:
                client_name = f"Cliente {client_id}"

            resets_val = 0
            if resets_col:
                try:
                    resets_val = int(float(str(row[resets_col]).replace(",","").replace(" ","").strip() or 0))
                except Exception:
                    pass
                    
            date_val = ""
            if date_col:
                date_val = str(row[date_col]).strip()
                if date_val.lower() == "nan":
                    date_val = ""
                    
            reason_val = ""
            if reason_col:
                reason_val = str(row[reason_col]).strip()
                if reason_val.lower() == "nan":
                    reason_val = ""

            src_val = ""
            if src_id_col:
                src_val = str(row[src_id_col]).strip()
                if src_val.lower() == "nan":
                    src_val = ""
                    
            if profile_id not in clients_by_profile:
                clients_by_profile[profile_id] = {}
                
            if client_id not in clients_by_profile[profile_id]:
                clients_by_profile[profile_id][client_id] = {
                    "client_id": client_id,
                    "name": client_name,
                    "resets": resets_val,
                    "last_date": date_val,
                    "reason": reason_val,
                    "source_id": src_val
                }
            else:
                existing = clients_by_profile[profile_id][client_id]
                existing["resets"] += resets_val
                if date_val:
                    existing["last_date"] = date_val
                if reason_val:
                    existing["reason"] = reason_val
                if src_val and not existing["source_id"]:
                    existing["source_id"] = src_val

    print(f"   👤 Total perfiles con clientes premium encontrados: {len(clients_by_profile)}")

    # ── Construir payload ─────────────────────────────────────────
    payload = []
    seen    = {}

    for _, row in matched.iterrows():
        raw_id = str(row["_id_clean"]).strip()
        nums   = re.findall(r"\d{7,10}", raw_id)
        id_clean = nums[0] if nums else raw_id

        # Sumatoria inteligente: Tableau a veces divide el revenue en multiples columnas (title_1, title_2, etc)
        valor = 0.0
        for c in df.columns:
            if any(k in c.upper() for k in ["REVENUE", "TOTAL", "AMOUNT", "EARNINGS", "TITLE", "SERVICE"]):
                if "TYPE" not in c.upper() and "ID" not in c.upper():
                    try:
                        v_str = str(row[c]).replace("$","").replace(",","").replace(" ","").strip()
                        if v_str and v_str.lower() != "nan":
                            valor += float(v_str)
                    except Exception:
                        pass

        row_json = json.loads(row.to_json())

        # Des-pivotar: Si Tableau envía filas por 'Revenue type', convertir ese tipo en llave
        type_col = next((c for c in df.columns if "TYPE" in c.upper() or "SERVICIO" in c.upper()), None)
        if type_col and col_val:
            rt = str(row[type_col]).strip()
            if rt and rt.lower() != "nan" and rt.lower() != "none":
                row_json[rt] = valor

        # Extract icebreaker Source ID and individual row revenue
        src_id_col = next((c for c in df.columns if "SOURCE ID" in c.upper() or "SOURCE_ID" in c.upper()), None)
        src_id_val = str(row[src_id_col]).strip() if src_id_col else "-1"
        if not src_id_val or src_id_val.lower() == "nan" or src_id_val.lower() == "none":
            src_id_val = "-1"
            
        row_rev_val = 0.0
        if col_val:
            try:
                row_rev_val = float(str(row[col_val]).replace("$","").replace(",","").replace(" ","").strip() or 0.0)
            except Exception:
                row_rev_val = valor
        else:
            row_rev_val = valor

        # Extract icebreaker message statistics (sent, replies, response rate)
        sent_col = next((c for c in df.columns if "SENT" in c.upper() or "ENVIADO" in c.upper()), None)
        replies_col = next((c for c in df.columns if "REPLIES" in c.upper() or "REPLY" in c.upper() or "RESPUESTAS" in c.upper() or "RESPONDI" in c.upper()), None)
        rate_col = next((c for c in df.columns if "RATE" in c.upper() or "PORCENTAJE" in c.upper() or "TASA" in c.upper() or "EFECTI" in c.upper()), None)

        sent_val = 0
        if sent_col:
            try:
                sent_val = int(float(str(row[sent_col]).replace(",","").replace(" ","").strip() or 0))
            except Exception:
                pass

        replies_val = 0
        if replies_col:
            try:
                replies_val = int(float(str(row[replies_col]).replace(",","").replace(" ","").strip() or 0))
            except Exception:
                pass

        rate_val = 0.0
        if rate_col:
            try:
                rate_val = float(str(row[rate_col]).replace("%","").replace(",","").replace(" ","").strip() or 0.0)
                if rate_val < 1.0 and rate_val > 0.0:
                    rate_val = round(rate_val * 100, 2)
            except Exception:
                pass

        if not rate_val and sent_val > 0:
            rate_val = round((replies_val / sent_val) * 100, 2)
            
        icebreaker_entry = {
            "source_id": src_id_val,
            "revenue": round(row_rev_val, 2),
            "sent": sent_val,
            "replies": replies_val,
            "response_rate": round(rate_val, 2)
        }

        if id_clean in seen:
            idx = seen[id_clean]
            payload[idx]["valor"] = round(payload[idx]["valor"] + valor, 2)
            
            # Accumulate in icebreakers list
            if "icebreakers" not in payload[idx]["data_json"]:
                payload[idx]["data_json"]["icebreakers"] = []
                
            # If there was a single icebreaker set previously, convert or append it
            existing_ib = next((ib for ib in payload[idx]["data_json"]["icebreakers"] if ib["source_id"] == src_id_val), None)
            if existing_ib:
                existing_ib["revenue"] = round(existing_ib["revenue"] + row_rev_val, 2)
                existing_ib["sent"] = existing_ib.get("sent", 0) + sent_val
                existing_ib["replies"] = existing_ib.get("replies", 0) + replies_val
                if existing_ib["sent"] > 0:
                    existing_ib["response_rate"] = round((existing_ib["replies"] / existing_ib["sent"]) * 100, 2)
                else:
                    existing_ib["response_rate"] = existing_ib.get("response_rate", 0.0) or round(rate_val, 2)
            else:
                payload[idx]["data_json"]["icebreakers"].append(icebreaker_entry)

            # Merge premium clients
            if id_clean in clients_by_profile:
                if "premium_clients" not in payload[idx]["data_json"]:
                    payload[idx]["data_json"]["premium_clients"] = []
                existing_clients = {c["client_id"]: c for c in payload[idx]["data_json"]["premium_clients"]}
                for c in clients_by_profile[id_clean].values():
                    cid = c["client_id"]
                    if cid in existing_clients:
                        existing_clients[cid]["resets"] += c["resets"]
                        if c["last_date"]:
                            existing_clients[cid]["last_date"] = c["last_date"]
                        if c["reason"]:
                            existing_clients[cid]["reason"] = c["reason"]
                        if c["source_id"] and not existing_clients[cid]["source_id"]:
                            existing_clients[cid]["source_id"] = c["source_id"]
                    else:
                        existing_clients[cid] = c
                payload[idx]["data_json"]["premium_clients"] = list(existing_clients.values())

            # Acumular numericos en data_json
            for k, v in row_json.items():
                if k not in payload[idx]["data_json"]:
                    payload[idx]["data_json"][k] = v
                else:
                    try:
                        curr_v = payload[idx]["data_json"][k]
                        if str(curr_v).replace(".","").replace("-","").isdigit():
                            v_num = float(str(v).replace("$","").replace(",","").replace(" ","").strip()) if v else 0.0
                            curr_num = float(str(curr_v).replace("$","").replace(",","").replace(" ","").strip()) if curr_v else 0.0
                            payload[idx]["data_json"][k] = round(curr_num + v_num, 2)
                    except Exception:
                        pass
            continue

        row_json["icebreakers"] = [icebreaker_entry]
        if id_clean in clients_by_profile:
            row_json["premium_clients"] = list(clients_by_profile[id_clean].values())
        else:
            row_json["premium_clients"] = []

        seen[id_clean] = len(payload)
        payload.append({
            "perfil_id":    id_clean,
            "panel_id":     panel_id,
            "panel_nombre": panel_nombre,
            "valor":        round(valor, 2),
            "data_json":    row_json,
            "updated_at":   "now()"
        })

    # Agregar perfiles que tienen clientes premium pero no tuvieron revenue hoy
    for profile_id, clients_dict in clients_by_profile.items():
        if profile_id not in seen:
            if profile_id in datame_ids:
                row_json = {
                    "ID Trusted User": f"{profile_id}",
                    "icebreakers": [],
                    "premium_clients": list(clients_dict.values())
                }
                payload.append({
                    "perfil_id":    profile_id,
                    "panel_id":     panel_id,
                    "panel_nombre": panel_nombre,
                    "valor":        0.0,
                    "data_json":    row_json,
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

    global_token_secret = os.getenv("TABLEAU_TOKEN_SECRET")
    
    print("\n🚀 Iniciando sincronización multi-panel Tableau...")
    print("🔍 Cargando paneles desde Supabase...")
    panels = fetch_tableau_panels()

    total_synced = 0
    for panel in panels:
        panel_id = panel.get("id")
        panel_nombre = panel.get("nombre", "?")
        
        # Buscar token dinámico para este panel en particular (ej: TABLEAU_TOKEN_SECRET_2)
        token_env_name = f"TABLEAU_TOKEN_SECRET_{panel_id}"
        token_secret = os.getenv(token_env_name) or global_token_secret

        token_name_env = f"TABLEAU_TOKEN_NAME_{panel_id}"
        token_name = os.getenv(token_name_env) or panel.get("token_name", "Analytics")

        if not token_secret:
            print(f"❌ Panel {panel_id} [{panel_nombre}] saltado: no se encontró {token_env_name} ni TABLEAU_TOKEN_SECRET global.")
            continue

        try:
            print(f"🔑 Usando token de: {token_env_name if os.getenv(token_env_name) else 'TABLEAU_TOKEN_SECRET (Global)'} | Nombre token: {token_name}")
            n = sync_panel(panel, token_secret, token_name)
            total_synced += n
        except Exception as e:
            msg = f"Error en panel {panel_nombre}: {str(e)}"
            print(f"   ❌ {msg}")
            sb_log_error(msg)

    print(f"\n{'═'*60}")
    print(f"🏁 SYNC COMPLETO — {total_synced} perfiles sincronizados en {len(panels)} paneles ✅")


if __name__ == "__main__":
    sync_tableau()

