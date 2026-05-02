import os, json, urllib.request

# Read .env file manually
env_file = "scripts/.env"
env_vars = {}
if os.path.exists(env_file):
    with open(env_file, "r") as f:
        for line in f:
            if "=" in line:
                k, v = line.strip().split("=", 1)
                env_vars[k] = v.strip("'\"")

url = env_vars.get("SUPABASE_URL")
key = env_vars.get("SUPABASE_KEY")

req = urllib.request.Request(f"{url}/rest/v1/tableau_data?select=*", headers={"apikey": key, "Authorization": f"Bearer {key}"})
try:
    with urllib.request.urlopen(req) as response:
        data = json.loads(response.read())
        print(json.dumps(data[:5], indent=2))
except Exception as e:
    print(f"Error: {e}")
