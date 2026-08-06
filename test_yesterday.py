
import re, json, urllib.request
with open('index.html', 'r', encoding='utf-8') as f: html = f.read()
url = re.search(r"const SUPABASE_URL = '([^']+)'", html).group(1)
key = re.search(r"const SUPABASE_ANON = '([^']+)'", html).group(1)
req = urllib.request.Request(url + '/rest/v1/operaciones?fecha_dia=eq.2026-07-27&jornada=eq.Auto', headers={'apikey': key, 'Authorization': 'Bearer ' + key})
with urllib.request.urlopen(req) as r:
  data = json.loads(r.read().decode())
  print('Total Auto ops yesterday:', len(data))

