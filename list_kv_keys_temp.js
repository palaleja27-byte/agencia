const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://bhewmidnkldjpdnvassj.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJoZXdtaWRua2xkanBkbnZhc3NqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU0NjMyNzAsImV4cCI6MjEwMTAzOTI3MH0.4DXjV8jH9Yj0jwNPg2DvRCqTgObiKULGCxFRf0lwIpI';

const sb = createClient(SUPABASE_URL, SUPABASE_ANON);

async function run() {
  const { data, error } = await sb.from('kv_store').select('key');
  if (error) {
    console.error("Error:", error);
    return;
  }
  console.log("Keys in kv_store:", data.map(d => d.key));
}

run();
