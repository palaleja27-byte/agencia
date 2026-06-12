const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://vpyzpjgctidqmhqjboxq.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_SERVICE_KEY) {
  console.error("Error: SUPABASE_SERVICE_KEY environment variable is not defined.");
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function run() {
  console.log("=== PRINTING ALL PROFILES IN datame_perfiles ===");
  const { data: perfiles, error } = await sb.from('datame_perfiles').select('*');
  if (error) {
    console.error("Error fetching perfiles:", error);
    return;
  }
  console.log(`Total profiles in datame_perfiles: ${perfiles.length}`);
  perfiles.forEach(p => {
    console.log(`- ID: ${p.id} | Datame ID: ${p.id_datame} | Modelo: ${p.modelo} | Panel: ${p.panel_id} | Activo: ${p.activo}`);
  });
}

run();
