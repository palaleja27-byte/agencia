const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://vpyzpjgctidqmhqjboxq.supabase.co';
// Si no hay SUPABASE_SERVICE_KEY, usamos la clave anónima para generar el reporte de perfiles, ya que SELECT es público
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZweXpwamdjdGlkcW1ocWpib3hxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI3NTk3MDcsImV4cCI6MjA4ODMzNTcwN30.84hij4AgUD_ughF-xocWVFisq4niL2YsSI9yPfbFPj0';

const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

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
