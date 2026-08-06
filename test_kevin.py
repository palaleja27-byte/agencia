
import re, json, urllib.request
with open('index.html', 'r', encoding='utf-8') as f: html = f.read()
url = re.search(r"const SUPABASE_URL = '([^']+)'", html).group(1)
key = re.search(r"const SUPABASE_ANON = '([^']+)'", html).group(1)
req = urllib.request.Request(url + '/rest/v1/kv_store?key=eq.primeOperatorsData2026', headers={'apikey': key, 'Authorization': 'Bearer ' + key})
with urllib.request.urlopen(req) as r:
  data = json.loads(r.read().decode())
  if data:
    ops = json.loads(data[0]['value'])
    kevins = [o for o in ops if 'KEVIN' in o['name'].upper()]
    print(json.dumps(kevins, indent=2))

