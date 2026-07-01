const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://vpyzpjgctidqmhqjboxq.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZweXpwamdjdGlkcW1ocWpib3hxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI3NTk3MDcsImV4cCI6MjA4ODMzNTcwN30.84hij4AgUD_ughF-xocWVFisq4niL2YsSI9yPfbFPj0';

const sb = createClient(SUPABASE_URL, SUPABASE_ANON);

async function run() {
  const keys = ['primeOperatorsData2026', 'rr_action_map_open'];
  for (const k of keys) {
    const { data, error } = await sb.from('kv_store').select('*').eq('key', k);
    if (error) {
      console.error(`Error fetching ${k}:`, error);
    } else {
      console.log(`\nKey: ${k}`);
      console.log(JSON.stringify(data[0] ? data[0].value : null, null, 2).slice(0, 1000));
    }
  }
  
  // Also check if there is an active session or logged in operators in any kv key
  const { data: allKV, error: kvErr } = await sb.from('kv_store').select('key');
  if (allKV) {
    // Find keys related to today's date (2026-06-18)
    const todayKeys = allKV.map(d => d.key).filter(k => k.includes('2026-06-18') || k.includes('active') || k.includes('session') || k.includes('asistencia'));
    console.log("\nToday's / session keys:", todayKeys);
    if (todayKeys.length > 0) {
      const { data: val } = await sb.from('kv_store').select('*').eq('key', todayKeys[0]);
      console.log(`Sample value for ${todayKeys[0]}:`, JSON.stringify(val[0] ? val[0].value : null, null, 2).slice(0, 500));
    }
  }
}

run();
