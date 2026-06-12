const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://vpyzpjgctidqmhqjboxq.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZweXpwamdjdGlkcW1ocWpib3hxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI3NTk3MDcsImV4cCI6MjA4ODMzNTcwN30.84hij4AgUD_ughF-xocWVFisq4niL2YsSI9yPfbFPj0';

const sb = createClient(SUPABASE_URL, SUPABASE_ANON);

async function run() {
  console.log("=== COMPARING OPERATORS PROFILES VS datame_perfiles ===");
  
  // 1. Fetch profiles from datame_perfiles
  const { data: dbPerfiles, error } = await sb.from('datame_perfiles')
    .select('*');
    
  if (error) {
    console.error("Error:", error);
    return;
  }
  
  const dbProfileIds = new Set(dbPerfiles.map(p => String(p.id_datame)));
  
  // 2. Load index.html hardcoded operators
  const htmlPath = 'C:\\Users\\ADMIN\\Documents\\AgenciaRR\\AgenciaRROriginal\\agencia\\index.html';
  const html = fs.readFileSync(htmlPath, 'utf8');
  
  const opsMatch = html.match(/let\s+operatorsData\s*=\s*([\s\S]*?);/);
  if (!opsMatch) {
    console.log("Could not find operatorsData definition in index.html");
    return;
  }
  
  let localOps = [];
  try {
    localOps = eval(opsMatch[1]);
  } catch (e) {
    console.error("Error parsing local operators:", e);
    return;
  }
  
  console.log(`Loaded ${localOps.length} operators from index.html.`);
  console.log(`Loaded ${dbPerfiles.length} profiles from database.`);
  
  const missingProfiles = [];
  
  localOps.forEach(op => {
    (op.profiles || []).forEach(p => {
      const pid = String(p.id);
      if (!dbProfileIds.has(pid)) {
        missingProfiles.push({
          operator: op.name,
          profileId: pid,
          modelName: p.model,
          plataforma: op.plataforma
        });
      }
    });
  });
  
  if (missingProfiles.length === 0) {
    console.log("✅ No profiles from index.html are missing in datame_perfiles.");
  } else {
    console.log(`⚠️ Found ${missingProfiles.length} profiles from index.html that are missing in datame_perfiles:`);
    missingProfiles.forEach(m => {
      console.log(`- Operator: ${m.operator} | Profile ID: ${m.profileId} | Model: ${m.modelName} | Platform: ${m.plataforma}`);
    });
  }
}

run();
