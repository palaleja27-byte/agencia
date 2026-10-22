require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const WebSocket = require('ws');

const SUPABASE_URL = (process.env.SUPABASE_URL || 'https://hgdymxklyrwjzlwomncm.supabase.co').trim();
const SUPABASE_KEY = (process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhnZHlteGtseXJ3anpsd29tbmNtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI1OTM0MTksImV4cCI6MjEwODE2OTQxOX0.nYQQi-5eTTd5Gc2hPSF8M1sPEHTmyGalwqvSkUuxHW0').trim();

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  global: { headers: {} },
  realtime: { transport: WebSocket },
  db: { schema: 'public' },
});

async function backfillHistoricalDays() {
  console.log('🔄 [BACKFILL] Reconstruyendo histórico día a día para 2026...');

  let allOps = [];
  let page = 0;
  const pageSize = 1000;
  let hasMore = true;

  while (hasMore) {
    const from = page * pageSize;
    const to = (page + 1) * pageSize - 1;
    const { data, error } = await supabase
      .from('operaciones')
      .select('id_perfil, puntos_neto, puntos_total, jornada, fecha_dia, agencia')
      .gte('fecha_dia', '2026-01-01')
      .range(from, to)
      .order('fecha_dia', { ascending: false });

    if (error) {
      console.error('Error paginando:', error.message);
      break;
    }
    if (!data || data.length === 0) {
      hasMore = false;
    } else {
      allOps = allOps.concat(data);
      if (data.length < pageSize) hasMore = false;
      else page++;
    }
  }

  console.log(`📦 [BACKFILL] ${allOps.length} registros cargados para backfill.`);

  // Agrupar por fecha_dia
  const byDay = {};
  allOps.forEach(op => {
    if (!op.fecha_dia) return;
    const d = op.fecha_dia;
    if (!byDay[d]) {
      byDay[d] = {
        fecha_dia: d,
        agencia: 'Global',
        puntos_total_dia: 0,
        puntos_neto_dia: 0,
        turnos_detalle: {},
        perfiles_detalle: {}
      };
    }

    const net = Number(op.puntos_neto) || 0;
    if (net > 0 && net <= 1500) {
      byDay[d].puntos_neto_dia = parseFloat((byDay[d].puntos_neto_dia + net).toFixed(2));
      byDay[d].puntos_total_dia = byDay[d].puntos_neto_dia;
      const jn = op.jornada || 'General';
      byDay[d].turnos_detalle[jn] = parseFloat(((byDay[d].turnos_detalle[jn] || 0) + net).toFixed(2));
    }
  });

  const dailyRows = Object.values(byDay);
  console.log(`📊 [BACKFILL] Guardando ${dailyRows.length} días consolidados en 'growth_daily_summary'...`);

  // Insertar en lotes de 50
  for (let i = 0; i < dailyRows.length; i += 50) {
    const batch = dailyRows.slice(i, i + 50);
    const { error: insErr } = await supabase
      .from('growth_daily_summary')
      .upsert(batch, { onConflict: 'fecha_dia,agencia' });
    if (insErr) {
      console.error('Error en lote de backfill:', insErr.message);
    } else {
      console.log(`  ✅ Lote ${Math.floor(i / 50) + 1} insertado (${batch.length} días)`);
    }
  }

  console.log('🎉 [BACKFILL] ¡Histórico diario consolidado al 100%!');
}

backfillHistoricalDays()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error en backfill:', err);
    process.exit(1);
  });
