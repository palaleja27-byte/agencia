
import re, json, urllib.request
with open('index.html', 'r', encoding='utf-8') as f: html = f.read()
url = re.search(r"const SUPABASE_URL = '([^']+)'", html).group(1)
key = re.search(r"const SUPABASE_ANON = '([^']+)'", html).group(1)
ids = '143017065,137163229,138130329'
req = urllib.request.Request(url + f'/rest/v1/operaciones?fecha_dia=eq.2026-07-28&id_perfil=in.({ids})', headers={'apikey': key, 'Authorization': 'Bearer ' + key})
with urllib.request.urlopen(req) as r:
  data = json.loads(r.read().decode())
  total = sum(d['puntos_neto'] for d in data)
  print('Total for Kevin ops today:', total)

