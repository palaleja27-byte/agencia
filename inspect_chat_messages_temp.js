const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://vpyzpjgctidqmhqjboxq.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZweXpwamdjdGlkcW1ocWpib3hxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI3NTk3MDcsImV4cCI6MjA4ODMzNTcwN30.84hij4AgUD_ughF-xocWVFisq4niL2YsSI9yPfbFPj0';

const sb = createClient(SUPABASE_URL, SUPABASE_ANON);

async function run() {
  const key = 'rr_chat_messages_op_ANAZARED RODRIGUEZ CAMPOS';
  const { data, error } = await sb.from('kv_store').select('*').eq('key', key);
  if (error) {
    console.error("Error:", error);
    return;
  }
  
  console.log(`Key: ${key}`);
  if (data[0]) {
    console.log("Type of value:", typeof data[0].value);
    console.log("Value sample (first 1500 chars):");
    console.log(JSON.stringify(data[0].value, null, 2).slice(0, 1500));
  } else {
    console.log("No data found for key");
  }
}

run();
