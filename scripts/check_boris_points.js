const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://vpyzpjgctidqmhqjboxq.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZweXpwamdjdGlkcW1ocWpib3hxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI3NTk3MDcsImV4cCI6MjA4ODMzNTcwN30.84hij4AgUD_ughF-xocWVFisq4niL2YsSI9yPfbFPj0';

const sb = createClient(SUPABASE_URL, SUPABASE_ANON);

async function run() {
  console.log("=== CHECKING BORIS POINTS IN DB ===");
  const profileIds = ['118179794', '130338853', '160352260'];
  const today = '2026-06-13';
  
  const { data: ops, error } = await sb.from('operaciones')
    .select('*')
    .in('id_perfil', profileIds)
    .eq('fecha_dia', today);
    
  if (error) {
    console.error("Error fetching operations:", error);
    return;
  }
  
  console.log(`Found ${ops.length} records in 'operaciones' for Boris profiles on ${today}:`);
  ops.forEach(o => {
    console.log(`- Perfil ID: ${o.id_perfil} | Jornada: ${o.jornada} | Puntos Neto: ${o.puntos_neto} | Puntos Total: ${o.puntos_total} | Baseline: ${o.puntos_baseline}`);
  });
}

run();
