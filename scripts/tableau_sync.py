import os
import requests
import pandas as pd
import json
import io
from supabase import create_client, Client

# --- CONFIGURACIÓN TABLEAU ---
TABLEAU_SERVER = "https://prod-uk-a.online.tableau.com"
TABLEAU_SITE = "partnerdata"
TOKEN_NAME = "Analytics"
TOKEN_SECRET = os.getenv("TABLEAU_TOKEN_SECRET") # Secreto desde GitHub
WORKBOOK_NAME = "Passport_16741406948180"
VIEW_NAME = "Revenuedetailed"

# --- CONFIGURACIÓN SUPABASE ---
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

def sync_tableau():
    print("🚀 Iniciando sincronización con Tableau Cloud...")
    
    # 1. Autenticación en Tableau
    auth_url = f"{TABLEAU_SERVER}/api/3.15/auth/signin"
    auth_payload = {
        "credentials": {
            "personalAccessTokenName": TOKEN_NAME,
            "personalAccessTokenSecret": TOKEN_SECRET,
            "site": {"contentUrl": TABLEAU_SITE}
        }
    }
    
    res = requests.post(auth_url, json=auth_payload)
    if res.status_code != 200:
        print(f"❌ Error de auth en Tableau: {res.text}")
        return

    token = res.json()["credentials"]["token"]
    site_id = res.json()["credentials"]["site"]["id"]
    headers = {"X-Tableau-Auth": token}
    print("✅ Autenticado en Tableau Site:", TABLEAU_SITE)

    # 2. Buscar el ID de la vista
    views_url = f"{TABLEAU_SERVER}/api/3.15/sites/{site_id}/views?filter=name:eq:{VIEW_NAME}"
    res = requests.get(views_url, headers=headers)
    views = res.json().get("views", {}).get("view", [])
    if not views:
        print("❌ No se encontró la vista Revenuedetailed")
        return
    
    view_id = views[0]["id"]
    print(f"✅ Vista encontrada ID: {view_id}")

    # 3. Descargar datos (CSV)
    data_url = f"{TABLEAU_SERVER}/api/3.15/sites/{site_id}/views/{view_id}/data"
    res = requests.get(data_url, headers=headers)
    if res.status_code != 200:
        print(f"❌ Error al descargar CSV: {res.text}")
        return

    # 4. Procesar CSV con Pandas
    df = pd.read_csv(io.StringIO(res.text))
    df.columns = [c.strip() for c in df.columns]
    print(f"📊 Columnas detectadas: {list(df.columns)}")
    print(f"📊 Procesando {len(df)} filas de datos...")
    
    # Mapeo Inteligente de Columnas
    col_id = next((c for c in df.columns if any(x in c.upper() for x in ['ID','PERFIL','USER','MODELO'])), None)
    col_val = next((c for c in df.columns if any(x in c.upper() for x in ['TOTAL','VALOR','REVENUE','MONTO','GENERAL'])), None)

    if not col_id or not col_val:
        print(f"❌ No se pudieron mapear las columnas. Columnas: {df.columns}")
        return

    results = []
    for _, row in df.iterrows():
        try:
            val_raw = str(row[col_val]).replace('$','').replace(',','').strip()
            total = float(val_raw) if val_raw else 0
            perfil_raw = str(row[col_id]).strip()
            
            if perfil_raw and total > 0:
                # Extraer solo el ID si viene como "12345 - Nombre" o similar
                id_clean = perfil_raw.split('-')[0].split('/')[0].strip()
                results.append({
                    "perfil_id": id_clean,
                    "valor": total,
                    "data_json": row.to_json(),
                    "updated_at": "now()"
                })
        except Exception as e:
            continue

    print(f"💾 Subiendo {len(results)} registros a Supabase...")
    
    # 5. Guardar en Supabase
    if results:
        supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
        # Upsert por perfil_id
        for item in results:
            supabase.table("tableau_data").upsert(item, on_conflict="perfil_id").execute()
            
    print("🏁 Sincronización completada con éxito.")

if __name__ == "__main__":
    sync_tableau()
