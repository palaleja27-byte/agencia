from supabase import create_client
import os
from dotenv import load_dotenv

load_dotenv('.env')
sb = create_client(os.environ['SUPABASE_URL'], os.environ['SUPABASE_SERVICE_KEY'])

# Check AGUSTIN points for today
result = sb.table('operaciones').select('*').eq('id_perfil', '138130329').eq('fecha_dia', '2026-07-30').execute()
print("AGUSTIN:", result.data)

# Panel ID 4 profiles
panel4 = sb.table('datame_perfiles').select('id_datame, modelo').eq('panel_id', 4).execute()
print("Panel 4 perfiles:", len(panel4.data))
