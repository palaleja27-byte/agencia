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

def log_error_to_supabase(msg):
    try:
        supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
        supabase.table("tableau_data").upsert({
            "perfil_id": "DEBUG_LOG",
            "valor": 0,
            "data_json": json.dumps({"error": msg, "timestamp": "now()"}),
            "updated_at": "now()"
        }, on_conflict="perfil_id").execute()
    except:
        pass

def sync_tableau():
    print("🚀 Iniciando sincronización con Tableau Cloud...")
    
    # Cabeceras base para forzar JSON
    base_headers = {"Accept": "application/json"}
    
    # 1. Autenticación en Tableau
    auth_url = f"{TABLEAU_SERVER}/api/3.4/auth/signin"
    auth_payload = {
        "credentials": {
            "personalAccessTokenName": TOKEN_NAME,
            "personalAccessTokenSecret": TOKEN_SECRET,
            "site": {"contentUrl": TABLEAU_SITE}
        }
    }
    
    try:
        res = requests.post(auth_url, json=auth_payload, headers=base_headers, timeout=30)
        print(f"📡 Status Code Auth: {res.status_code}")
        
        if res.status_code != 200:
            msg = f"Error Auth Tableau: {res.text[:200]}"
            print(f"❌ {msg}")
            log_error_to_supabase(msg)
            return

        try:
            data = res.json()
        except Exception as e:
            msg = f"Tableau no envió JSON válido. Revisa logs de Git."
            print(f"❌ {msg}")
            log_error_to_supabase(msg)
            return

        token = data["credentials"]["token"]
        site_id = data["credentials"]["site"]["id"]
        headers = {"X-Tableau-Auth": token, "Accept": "application/json"}
        print("✅ Autenticado con éxito.")

        # 2. Buscar la vista de forma flexible
        # Traemos todas las vistas del sitio para no fallar por un espacio o mayúscula
        views_url = f"{TABLEAU_SERVER}/api/3.4/sites/{site_id}/views"
        res = requests.get(views_url, headers=headers, timeout=30)
        all_views = res.json().get("views", {}).get("view", [])
        
        print(f"📡 Escaneando {len(all_views)} vistas en el sitio...")
        
        # Buscamos la que coincida con Revenuedetailed en nombre o URL
        target_view = next((v for v in all_views if 
                           VIEW_NAME.upper() in v.get('name','').upper() or 
                           VIEW_NAME.upper() in v.get('contentUrl','').upper()), None)

        if not target_view:
            msg = f"Vista '{VIEW_NAME}' no encontrada. Vistas disponibles: " + ", ".join([v.get('name') for v in all_views[:10]])
            print(f"❌ {msg}")
            log_error_to_supabase(msg)
            return
        
        view_id = target_view["id"]
        print(f"✅ Vista encontrada: '{target_view.get('name')}' (ID: {view_id})")

        # 3. Descargar datos (CSV)
        data_url = f"{TABLEAU_SERVER}/api/3.15/sites/{site_id}/views/{view_id}/data"
        res = requests.get(data_url, headers=headers, timeout=60)
        if res.status_code != 200:
            msg = f"Error descarga CSV (Status {res.status_code})"
            print(f"❌ {msg}")
            log_error_to_supabase(msg)
            return

        if len(res.text) < 10:
            msg = "El CSV de Tableau vino vacío"
            print(f"⚠️ {msg}")
            log_error_to_supabase(msg)
            return

        # 4. Procesar CSV con Pandas
        df = pd.read_csv(io.StringIO(res.text))
        df.columns = [c.strip() for c in df.columns]
        print(f"📊 Columnas detectadas: {list(df.columns)}")
        
        # Mapeo Específico según el reporte real detectado
        col_id = 'ID Trusted User' if 'ID Trusted User' in df.columns else next((c for c in df.columns if 'ID' in c.upper()), None)
        col_val = 'Revenue' if 'Revenue' in df.columns else next((c for c in df.columns if 'REVENUE' in c.upper() and 'TYPE' not in c.upper()), None)

        print(f"🎯 Usando columnas: ID='{col_id}', Valor='{col_val}'")

        if not col_id or not col_val:
            msg = f"No se mapearon columnas en: {list(df.columns)}"
            log_error_to_supabase(msg)
            return

        results = []
        for _, row in df.iterrows():
            try:
                # Limpiar valor (quitar $, comas, espacios)
                v_str = str(row[col_val]).replace('$','').replace(',','').replace(' ','').strip()
                total = float(v_str) if v_str and v_str != 'nan' else 0
                
                perfil_raw = str(row[col_id]).strip()
                
                if perfil_raw and total > 0:
                    # El ID suele ser la primera parte antes de un guión o espacio
                    id_clean = perfil_raw.split('-')[0].split('/')[0].split(' ')[0].strip()
                    results.append({
                        "perfil_id": id_clean,
                        "valor": total,
                        "data_json": row.to_json(),
                        "updated_at": "now()"
                    })
            except Exception as e:
                print(f"⚠️ Error procesando fila: {e}")
                continue

        print(f"💾 Subiendo {len(results)} registros a Supabase...")
        if results:
            supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
            for item in results:
                # Log de lo que estamos subiendo para auditoría
                print(f"   -> Perfil: {item['perfil_id']} | Valor: {item['valor']}")
                supabase.table("tableau_data").upsert(item, on_conflict="perfil_id").execute()
            
            # Limpiar error anterior
            supabase.table("tableau_data").delete().eq("perfil_id", "DEBUG_LOG").execute()
            
        print("🏁 Sincronización completada con éxito.")

    except Exception as e:
        msg = f"Error crítico en script: {str(e)}"
        print(f"❌ {msg}")
        log_error_to_supabase(msg)

if __name__ == "__main__":
    sync_tableau()
