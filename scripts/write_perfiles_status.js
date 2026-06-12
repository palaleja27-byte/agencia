const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://vpyzpjgctidqmhqjboxq.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_SERVICE_KEY) {
  console.error("Error: SUPABASE_SERVICE_KEY is not defined.");
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function run() {
  console.log("=== WRITING DATABASE PROFILES STATUS ===");
  const { data: perfiles, error } = await sb.from('datame_perfiles').select('*');
  if (error) {
    console.error("Error fetching perfiles:", error);
    process.exit(1);
  }
  
  // Sort by ID
  perfiles.sort((a, b) => a.id - b.id);
  
  let md = `# Production Database Profiles (\`datame_perfiles\`)\n\n`;
  md += `Last updated: ${new Date().toISOString()}\n\n`;
  md += `Total profiles: ${perfiles.length}\n\n`;
  md += `| ID | Datame ID | Modelo | Panel ID | Activo |\n`;
  md += `|---|---|---|---|---|\n`;
  
  perfiles.forEach(p => {
    md += `| ${p.id} | ${p.id_datame} | ${p.modelo} | ${p.panel_id} | ${p.activo} |\n`;
  });
  
  fs.writeFileSync('perfiles_status.md', md, 'utf8');
  console.log("Successfully wrote perfiles_status.md!");
}

run();
