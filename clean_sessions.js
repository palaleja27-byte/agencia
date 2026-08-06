const SUPABASE_URL = 'https://vpyzpjgctidqmhqjboxq.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZweXpwamdjdGlkcW1ocWpib3hxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI3NTk3MDcsImV4cCI6MjA4ODMzNTcwN30.84hij4AgUD_ughF-xocWVFisq4niL2YsSI9yPfbFPj0';

async function forceLogoutPreviousShift() {
  const headers = {
    'apikey': SUPABASE_ANON,
    'Authorization': 'Bearer ' + SUPABASE_ANON,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  };

  try {
    let hasMore = true;
    let totalClosed = 0;

    while (hasMore) {
       // Fetch up to 1000 sessions at a time
       const res = await fetch(`${SUPABASE_URL}/rest/v1/op_sessions?fin_ts=is.null&limit=1000`, {
         method: 'GET',
         headers
       });
       const sessions = await res.json();
       
       if (sessions.length === 0) {
         hasMore = false;
         break;
       }
       
       console.log(`Fetched ${sessions.length} active sessions to process.`);
       let closedThisBatch = 0;

       for (const session of sessions) {
          const inicioTs = new Date(session.inicio_ts);
          // Only close sessions that started more than 30 mins ago
          const cutoff = new Date(Date.now() - 30 * 60000);
          
          if (inicioTs < cutoff) {
             await fetch(`${SUPABASE_URL}/rest/v1/op_sessions?id=eq.${session.id}`, {
                method: 'PATCH',
                headers,
                body: JSON.stringify({
                   fin_ts: new Date().toISOString()
                })
             });
             closedThisBatch++;
             totalClosed++;
          }
       }

       console.log(`Closed ${closedThisBatch} sessions in this batch.`);
       
       // If we didn't close all 1000, it means the remaining ones are newer than our cutoff.
       // So we can stop.
       if (closedThisBatch < sessions.length) {
          hasMore = false;
       }
    }
    
    console.log(`Successfully closed a total of ${totalClosed} ghost sessions from previous shifts.`);
  } catch (err) {
    console.error('Error during fetch:', err);
  }
}

forceLogoutPreviousShift();
