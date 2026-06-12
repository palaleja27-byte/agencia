const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://vpyzpjgctidqmhqjboxq.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_SERVICE_KEY) {
  console.error("Error: SUPABASE_SERVICE_KEY environment variable is not defined.");
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const profilesToInsert = [
  { id_datame: '101652076', modelo: 'CARINA', panel_id: 1, activo: true },
  { id_datame: '167279664', modelo: 'JOSE ROBERTO', panel_id: 2, activo: true },
  { id_datame: '167273716', modelo: 'ARIEL HERNAN', panel_id: 2, activo: true },
  { id_datame: '153037229', modelo: 'Horacio', panel_id: 2, activo: true },
  { id_datame: '160951610', modelo: 'GUSTAVO', panel_id: 3, activo: true },
  { id_datame: '168486464', modelo: 'GUSTAVO', panel_id: 2, activo: true },
  { id_datame: '118404407', modelo: 'MILENA', panel_id: 2, activo: true },
  { id_datame: '132062039', modelo: 'BEATRIZ', panel_id: 4, activo: true },
  { id_datame: '166575347', modelo: 'MAX', panel_id: 2, activo: true }
];

async function run() {
  console.log("=== INSERTING MISSING PROFILES VIA SERVICE ROLE ===");
  
  for (const p of profilesToInsert) {
    const { data: existing, error: fetchErr } = await sb.from('datame_perfiles')
      .select('*')
      .eq('id_datame', p.id_datame)
      .maybeSingle();
      
    if (fetchErr) {
      console.error(`Error checking profile ${p.modelo} (${p.id_datame}):`, fetchErr);
      continue;
    }
      
    if (existing) {
      console.log(`Profile ${p.modelo} (${p.id_datame}) already exists (ID: ${existing.id}). Updating active state and panel...`);
      const { error } = await sb.from('datame_perfiles')
        .update({ panel_id: p.panel_id, modelo: p.modelo, activo: true })
        .eq('id', existing.id);
      if (error) {
        console.error("Error updating:", error);
      } else {
        console.log("Update successful!");
      }
    } else {
      console.log(`Inserting new profile ${p.modelo} (${p.id_datame})...`);
      const { error } = await sb.from('datame_perfiles')
        .insert(p);
      if (error) {
        console.error("Error inserting:", error);
      } else {
        console.log("Insert successful!");
      }
    }
  }
  
  console.log("Insertion run complete!");
}

run();
