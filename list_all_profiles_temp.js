const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://vpyzpjgctidqmhqjboxq.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZweXpwamdjdGlkcW1ocWpib3hxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI3NTk3MDcsImV4cCI6MjA4ODMzNTcwN30.84hij4AgUD_ughF-xocWVFisq4niL2YsSI9yPfbFPj0';

const sb = createClient(SUPABASE_URL, SUPABASE_ANON);

async function run() {
  const { data, error } = await sb.from('tableau_perfiles').select('*');
  if (error) {
    console.error("Error:", error);
    return;
  }
  console.log("All profiles in tableau_perfiles:", data);
}

run();
