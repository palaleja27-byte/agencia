import urllib.request
import re
import json

with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

url_match = re.search(r\"const SUPABASE_URL = '([^']+)'\", html)
key_match = re.search(r\"const SUPABASE_KEY = '([^']+)'\", html)

if url_match and key_match:
    req = urllib.request.Request(
        url_match.group(1) + '/rest/v1/kv_store?key=eq.primeOperatorsData2026',
        headers={'apikey': key_match.group(1), 'Authorization': 'Bearer ' + key_match.group(1)}
    )
    with urllib.request.urlopen(req) as response:
        data = json.loads(response.read().decode())
        if data:
            ops = json.loads(data[0]['value'])
            kevin = next((o for o in ops if 'KEVIN' in o['name'].upper()), None)
            print(json.dumps(kevin, indent=2))
