const { chromium } = require('playwright');
const { createClient } = require('@supabase/supabase-js');

// ═══════════════════════════════════════════════════════════════
// ⚡ CYBER-SCRAPE PROTOCOL 2026 — SUPABASE-DRIVEN EDITION ⚡
// Lee credenciales y perfiles DESDE Supabase (no hardcoded)
// ═══════════════════════════════════════════════════════════════

const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ CRITICO: Faltan SUPABASE_URL o SUPABASE_SERVICE_KEY.');
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const now = new Date();
// Por defecto: desde 2026-02-01 para capturar TODO el historial desde el inicio
const START_DATE = process.env.START_DATE || '2026-02-01';
const END_DATE   = process.env.END_DATE   || new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
console.log(`\x1b[35m [WARP] Período: ${START_DATE} \u2192 ${END_DATE} \x1b[0m`);


// ════════════════════════════════════════════════════════════
// 🕐 DETECTOR DE JORNADA — Basado en hora Colombia (UTC-5)
// ════════════════════════════════════════════════════════════
function detectarJornada() {
  const hora = new Date().toLocaleString('en-US', { timeZone: 'America/Bogota', hour12: false, hour: 'numeric' });
  const h = parseInt(hora);
  if (h >= 6  && h < 14) return 'Mañana';
  if (h >= 14 && h < 22) return 'Tarde';
  return 'Noche';
}

// Fecha de hoy en Colombia
function fechaHoyColombia() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' }); // YYYY-MM-DD
}

async function scrapePanel(panel, perfiles) {
  const { nombre, email, password } = panel;
  console.log(`\n\x1b[36m ═══ ${nombre} (${email}) | ${perfiles.length} perfiles ═══ \x1b[0m`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page    = await context.newPage();
  const capturedData = {};

  // 🛰️ Radar XHR
  page.on('response', async (response) => {
    if (!['fetch','xhr'].includes(response.request().resourceType())) return;
    try {
      const json = await response.json();
      let list = Array.isArray(json) ? json : (json.data || json.result || [json]);
      if (!Array.isArray(list)) list = [list];
      for (const item of list) {
        const rawPts = item.bonuses || item.total || item.points || item.amount || 0;
        const pts    = parseFloat(String(rawPts).replace(/[^\d.]/g, '')) || 0;
        if (pts <= 0) continue;
        let id = (response.url().match(/\d{7,9}/) || [])[0];
        if (!id) id = (JSON.stringify(item).match(/\d{7,9}/) || [])[0];
        if (!id) id = String(item.member_id || item.profile_id || item.id || '');
        if (id && id.length >= 7 && pts > (capturedData[id] || 0)) {
          capturedData[id] = pts;
          console.log(`\x1b[32m  [XHR] ${id} → ${pts} pts\x1b[0m`);
        }
      }
    } catch (_) {}
  });

  const results = [];
  try {
    // 1. LOGIN
    await page.goto('https://datame.cloud/login', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForSelector('input[type="text"],input[type="email"]', { timeout: 12000 });
    await page.fill('input[type="text"],input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    await page.click('button.q-btn,button:has-text("LOG IN")')
              .catch(() => page.press('input[type="password"]', 'Enter'));
    await page.waitForTimeout(7000);

    // 2. ESTADÍSTICAS
    await page.goto('https://datame.cloud/statistics', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(5000);

    // 3. FECHAS
    await page.evaluate(({ s, e }) => {
      const ins = document.querySelectorAll('input[type="text"],input.q-field__native');
      if (ins[0]) { ins[0].value = s; ins[0].dispatchEvent(new Event('input',{bubbles:true})); }
      if (ins[1]) { ins[1].value = e; ins[1].dispatchEvent(new Event('input',{bubbles:true})); }
    }, { s: START_DATE, e: END_DATE });
    await page.waitForTimeout(1500);

    // 4. ITERAR PERFILES
    for (const p of perfiles) {
      try {
        await page.evaluate((v) => {
          const ins = Array.from(document.querySelectorAll('input'));
          let t = ins.find(i => (i.getAttribute('aria-label')||'').toLowerCase().includes('profile')
                              ||(i.placeholder||'').toLowerCase().includes('profile'));
          if (!t && ins.length >= 3) t = ins[2];
          if (t) { t.value = v; t.dispatchEvent(new Event('input',{bubbles:true})); t.dispatchEvent(new Event('change',{bubbles:true})); }
        }, p.id_datame);
        await page.waitForTimeout(800);
        await page.click('button:has-text("SHOW"),.q-btn:has-text("SHOW")',{timeout:5000}).catch(()=>{});
        await page.waitForTimeout(5000);

        // DOM fallback
        const domPts = await page.evaluate(() => {
          const vals = Array.from(document.querySelectorAll('[class*="total"],[class*="point"],td,.text-h6,.text-h5,.text-h4'))
            .map(el => parseFloat((el.innerText||'').replace(/[^\d.]/g,''))).filter(n=>n>0&&n<500000);
          return vals.length ? Math.max(...vals) : 0;
        });

        const pts = Math.max(capturedData[p.id_datame] || 0, domPts);
        console.log(`\x1b[32m  [✓] ${p.modelo.padEnd(20)} ID:${p.id_datame} → ${pts} pts\x1b[0m`);
        results.push({ ...p, puntos: pts });

        // ─── Guardar en Supabase con jornada + día ───────────────
        const jornada  = detectarJornada();
        const fechaDia = fechaHoyColombia();
        const tsAhora  = new Date().toISOString();

        // Leer el registro anterior del mismo turno para mantener el baseline
        const { data: prevRec } = await supabase
          .from('operaciones')
          .select('puntos_total, puntos_baseline')
          .eq('id_perfil', p.id_datame)
          .eq('fecha_dia', fechaDia)
          .eq('jornada', jornada)
          .maybeSingle();

        // Si hay un baseline previo > 0, lo respetamos. Si no, este scrape FIJA el baseline.
        const dbBaseline = prevRec?.puntos_baseline;
        const baseline   = (dbBaseline > 0) ? dbBaseline : pts;
        const netoTurno  = Math.max(0, pts - baseline);

        const { error } = await supabase.from('operaciones').upsert({
          id_perfil:       p.id_datame,
          agencia:         nombre,
          puntos:          pts,               // legado
          puntos_total:    pts,               // total mensual acumulado
          puntos_baseline: baseline,          // total al inicio del turno
          puntos_neto:     netoTurno,         // neto de este turno
          fecha_corte:     tsAhora,
          fecha_dia:       fechaDia,
          jornada:         jornada,
        }, { onConflict: 'id_perfil,fecha_dia,jornada' });
        if (error) console.error(`  [DB ERR] ${p.modelo}:`, error.message);
        else console.log(`  [DB] ${p.modelo} jornada:${jornada} pts:${pts} neto:${netoTurno.toFixed(2)} pts ${!dbBaseline ? '(baseline)' : ''}`);


      } catch (err) {
        console.error(`\x1b[31m  [ERR] ${p.modelo}: ${err.message}\x1b[0m`);
        results.push({ ...p, puntos: 0 });
      }
    }
    await page.screenshot({ path: `debug_${nombre.replace(/\W/g,'_')}.png`, fullPage: true });
  } catch (err) {
    console.error(`\x1b[31m [CRITICO] ${nombre}: ${err.message}\x1b[0m`);
    await page.screenshot({ path: `debug_err_${nombre.replace(/\W/g,'_')}.png`, fullPage:true }).catch(()=>{});
  }
  await browser.close();
  return results;
}

// ═══════════════════════════════════════════════════════════════
// MAIN — Lee paneles y perfiles desde Supabase, luego scrapea
// ═══════════════════════════════════════════════════════════════
(async () => {
  console.log('\n\x1b[36m ⚡ CYBER-SCRAPE — SUPABASE-DRIVEN MODE ⚡\x1b[0m');

  // Leer paneles activos
  const { data: panels, error: pe } = await supabase
    .from('datame_panels').select('*').eq('activo', true).order('id');
  if (pe || !panels?.length) { console.error('❌ No se pudo leer datame_panels:', pe?.message); process.exit(1); }
  console.log(`\x1b[36m Paneles cargados desde Supabase: ${panels.length}\x1b[0m`);

  // Leer perfiles activos
  const { data: allPerfiles, error: fe } = await supabase
    .from('datame_perfiles').select('*').eq('activo', true).order('id');
  if (fe) { console.error('❌ No se pudo leer datame_perfiles:', fe?.message); process.exit(1); }

  const allResults = [];
  for (const panel of panels) {
    const perfiles = (allPerfiles || []).filter(p => p.panel_id === panel.id);
    if (!perfiles.length) { console.log(`[SKIP] ${panel.nombre}: sin perfiles activos`); continue; }
    const res = await scrapePanel(panel, perfiles);
    allResults.push(...res);
  }

  // Reporte final
  console.log('\n\x1b[36m ═══ REPORTE FINAL ═══\x1b[0m');
  allResults.forEach(r => console.log(`${r.puntos > 0 ? '✅' : '⚠️'} ${r.modelo?.padEnd(20)} ID:${r.id_datame} → ${r.puntos} pts`));
  console.log(`\n\x1b[32m [SUCCESS] ${allResults.length} perfiles procesados.\x1b[0m`);
})();