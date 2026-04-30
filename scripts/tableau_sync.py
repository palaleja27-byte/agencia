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
    print(f"📊 Procesando {len(df)} filas de datos...")
    
    # Aquí mapeamos las columnas de Tableau (ajustar según el CSV real)
    # Buscamos columnas comunes: 'ID Trusted User', 'Total general'
    # Intentamos normalizar nombres de columnas
    df.columns = [c.strip() for c in df.columns]
    
    results = []
    for _, row in df.iterrows():
        # Ejemplo de mapeo - Ajustar según nombres reales en el CSV de Tableau
        perfil_raw = str(row.get('ID Trusted User', ''))
        total = float(row.get('Total general', 0))
        
        if perfil_raw and total > 0:
            results.append({
                "perfil_id": perfil_raw.split('/')[0].strip(), # Extraer ID numérico si viene como "ID - Nombre"
                "valor": total,
                "data_json": row.to_json(),
                "updated_at": "now()"
            })

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
