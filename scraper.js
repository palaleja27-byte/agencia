const { chromium } = require('playwright');
const { createClient } = require('@supabase/supabase-js');

// ═══════════════════════════════════════════════════════════════
// ⚡ CYBER-SCRAPE PROTOCOL 2026 — MULTI-PANEL EDITION ⚡
// Agencia RR: 4 Paneles | Infiltración Total Activada
// ═══════════════════════════════════════════════════════════════

const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ ERROR CRÍTICO: Faltan SUPABASE_URL o SUPABASE_SERVICE_KEY.');
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ── Rango de fechas ──────────────────────────────────────────
const now = new Date();
const START_DATE = process.env.START_DATE || new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
const END_DATE   = process.env.END_DATE   || new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
console.log(`\x1b[35m [WARP] Período objetivo: ${START_DATE} → ${END_DATE} \x1b[0m`);

// ── Definición de los 4 Paneles con sus perfiles ─────────────
const PANELS = [
  {
    name: 'PANEL-1 (thinkedagency)',
    user: process.env.PANEL1_USER,
    pass: process.env.PANEL1_PASS,
    perfiles: [
      { id: '91360720', modelo: 'SANDRA' },
    ]
  },
  {
    name: 'PANEL-2 (thinkedagency2)',
    user: process.env.PANEL2_USER,
    pass: process.env.PANEL2_PASS,
    perfiles: [
      { id: '95956014',  modelo: 'PABLO' },
      { id: '91733663',  modelo: 'DANIEL' },
      { id: '153039388', modelo: 'AGUSTIN FERNANDO' },
      { id: '95955130',  modelo: 'HECTOR' },
      { id: '103289167', modelo: 'LUIS' },
      { id: '98389135',  modelo: 'RAUL' },
      { id: '98540781',  modelo: 'LEANDRO' },
      { id: '157067734', modelo: 'VALDEMIR' },
      { id: '103291980', modelo: 'ARMANDO' },
      { id: '130431310', modelo: 'RAFAEL' },
      { id: '151070498', modelo: 'VALQUIMAR' },
      { id: '143014129', modelo: 'RENEE' },
      { id: '156716207', modelo: 'AGNALDO' },
    ]
  },
  {
    name: 'PANEL-3 (Nuevopaneladmi4)',
    user: process.env.PANEL3_USER,
    pass: process.env.PANEL3_PASS,
    perfiles: [
      { id: '88243516',  modelo: 'RICARDO' },
      { id: '79679899',  modelo: 'NORBERTO' },
      { id: '118692242', modelo: 'FRANCISCO' },
      { id: '109551682', modelo: 'RENATO' },
      { id: '108018336', modelo: 'LUCAS' },
      { id: '118179794', modelo: 'HORACIO' },
      { id: '130338853', modelo: 'IVALDO' },
      { id: '137163229', modelo: 'SEBASTIAN' },
      { id: '120720195', modelo: 'MARCOS' },
      { id: '139247498', modelo: 'DAMIAN' },
      { id: '139245989', modelo: 'ALFREDO' },
      { id: '120275229', modelo: 'GERMAN' },
      { id: '156881990', modelo: 'RALPH' },
      { id: '130422416', modelo: 'RAONI' },
      { id: '143017065', modelo: 'MARIO' },
      { id: '145211163', modelo: 'FERMIN' },
      { id: '145834230', modelo: 'MURILO' },
      { id: '145844971', modelo: 'RODRIGO' },
      { id: '157112125', modelo: 'LUIS' },
    ]
  },
  {
    name: 'PANEL-4 (Ameliapenaloza40)',
    user: process.env.PANEL4_USER,
    pass: process.env.PANEL4_PASS,
    perfiles: [
      { id: '131130713', modelo: 'LUIS JOAO' },
      { id: '138130329', modelo: 'AGUSTIN' },
      { id: '133085188', modelo: 'MARCOS ANTONIO' },
      { id: '144863124', modelo: 'FERNANDO' },
    ]
  }
];

// ═══════════════════════════════════════════════════════════════
// 🔧 FUNCIÓN: Extraer puntos de UN panel completo
// ═══════════════════════════════════════════════════════════════
async function scrapePanel(panelDef) {
  const { name, user, pass, perfiles } = panelDef;

  if (!user || !pass) {
    console.error(`\x1b[31m [SKIP] ${name}: Sin credenciales. Configura los Secrets en GitHub. \x1b[0m`);
    return [];
  }

  console.log(`\n\x1b[36m ═══ INICIANDO ${name} ═══ \x1b[0m`);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page    = await context.newPage();

  // 🛰️ Radar XHR — escuchar respuestas de la red
  const capturedData = {}; // { id_perfil: pts_acumulado }
  page.on('response', async (response) => {
    const rType = response.request().resourceType();
    if (rType !== 'fetch' && rType !== 'xhr') return;
    try {
      const json = await response.json();
      let dataList = Array.isArray(json) ? json : (json.data || json.result || [json]);
      if (!Array.isArray(dataList)) dataList = [dataList];
      for (const item of dataList) {
        const rawPts = item.bonuses || item.total || item.points || item.amount || 0;
        const pts    = parseFloat(String(rawPts).replace(/[^\d.]/g, '')) || 0;
        if (pts <= 0) continue;

        // Buscar ID en URL primero, luego en el objeto
        let id = null;
        const urlMatch = response.url().match(/\d{8,9}/);
        if (urlMatch) id = urlMatch[0];
        if (!id) {
          const strMatch = JSON.stringify(item).match(/\d{8,9}/);
          if (strMatch) id = strMatch[0];
        }
        if (!id) {
          id = String(item.member_id || item.member_profile_id || item.profile_id || item.id || '');
        }
        if (id && id.length >= 7) {
          const prev = capturedData[id] || 0;
          if (pts > prev) capturedData[id] = pts;
          console.log(`\x1b[32m [XHR✓] ID ${id} → ${pts} pts \x1b[0m`);
        }
      }
    } catch (_) {}
  });

  const results = [];
  try {
    // 1. LOGIN
    console.log(`\x1b[33m [AUTH] Accediendo como ${user}... \x1b[0m`);
    await page.goto('https://datame.cloud/login', { waitUntil: 'networkidle', timeout: 30000 });
    const userSel = 'input[type="text"], input[type="email"], input[name="username"]';
    await page.waitForSelector(userSel, { timeout: 15000 });
    await page.fill(userSel, user);
    await page.fill('input[type="password"]', pass);
    await page.click('button.q-btn, button:has-text("LOG IN"), .q-btn__content')
              .catch(() => page.press('input[type="password"]', 'Enter'));
    await page.waitForTimeout(7000);

    // 2. NAVEGAR A ESTADÍSTICAS
    console.log(`\x1b[33m [NAV] → statistics \x1b[0m`);
    await page.goto('https://datame.cloud/statistics', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(5000);

    // 3. INYECTAR FECHAS
    await page.evaluate(({ start, end }) => {
      const inputs = document.querySelectorAll('input[type="text"], input.q-field__native');
      if (inputs.length >= 2) {
        inputs[0].value = start; inputs[0].dispatchEvent(new Event('input', { bubbles: true }));
        inputs[1].value = end;   inputs[1].dispatchEvent(new Event('input', { bubbles: true }));
      }
    }, { start: START_DATE, end: END_DATE });
    await page.waitForTimeout(1500);

    // 4. ITERAR PERFILES
    for (const perfil of perfiles) {
      console.log(`\n\x1b[35m [SCAN] Perfil ${perfil.modelo} (${perfil.id}) \x1b[0m`);
      try {
        await page.evaluate((idVal) => {
          const allInputs = Array.from(document.querySelectorAll('input'));
          let target = allInputs.find(i =>
            (i.getAttribute('aria-label') || '').toLowerCase().includes('profile') ||
            (i.placeholder || '').toLowerCase().includes('profile') ||
            (i.closest('label') && i.closest('label').innerText.toLowerCase().includes('profile'))
          );
          if (!target && allInputs.length >= 3) target = allInputs[2];
          if (target) {
            target.value = idVal;
            target.dispatchEvent(new Event('input',  { bubbles: true }));
            target.dispatchEvent(new Event('change', { bubbles: true }));
          }
        }, perfil.id);
        await page.waitForTimeout(800);
        await page.click('button:has-text("SHOW"), .q-btn:has-text("SHOW")', { timeout: 6000 }).catch(() => {});
        await page.waitForTimeout(5000);

        // Leer puntos del DOM como fallback
        const domPts = await page.evaluate(() => {
          const nums = Array.from(document.querySelectorAll('[class*="total"], [class*="points"], [class*="score"], td, .text-h6, .text-h5'))
            .map(el => parseFloat(el.innerText.replace(/[^\d.]/g, '')))
            .filter(n => n > 0 && n < 500000);
          return nums.length > 0 ? Math.max(...nums) : 0;
        });

        const xhrPts  = capturedData[perfil.id] || 0;
        const finalPts = Math.max(xhrPts, domPts);
        console.log(`\x1b[32m [OK] ${perfil.modelo} → XHR:${xhrPts} DOM:${domPts} → FINAL: ${finalPts} \x1b[0m`);
        results.push({ id: perfil.id, modelo: perfil.modelo, puntos: finalPts, panel: name });

        // Persistir en Supabase
        await supabase.from('operaciones').upsert({
          id_perfil:   parseInt(perfil.id),
          agencia:     name,
          puntos:      finalPts,
          fecha_corte: END_DATE + 'T23:59:00'
        }, { onConflict: 'id_perfil,fecha_corte' });

      } catch (err) {
        console.error(`\x1b[31m [ERR] ${perfil.modelo}: ${err.message} \x1b[0m`);
        results.push({ id: perfil.id, modelo: perfil.modelo, puntos: 0, panel: name, error: err.message });
      }
    }

    await page.screenshot({ path: `debug_${name.replace(/[^a-z0-9]/gi, '_')}.png`, fullPage: true });
    console.log(`\x1b[36m [✓] ${name} completado. ${results.length} perfiles procesados. \x1b[0m`);

  } catch (err) {
    console.error(`\x1b[31m [CRITICAL] ${name}: ${err.message} \x1b[0m`);
    await page.screenshot({ path: `debug_error_${name.replace(/[^a-z0-9]/gi, '_')}.png`, fullPage: true }).catch(() => {});
  }

  await browser.close();
  return results;
}

// ═══════════════════════════════════════════════════════════════
// 🚀 MAIN — Procesar todos los paneles secuencialmente
// ═══════════════════════════════════════════════════════════════
(async () => {
  console.log('\n\x1b[36m ⚡ CYBER-SCRAPE PROTOCOL 2026 — MULTI-PANEL ⚡ \x1b[0m');
  console.log(`\x1b[36m Paneles objetivo: ${PANELS.length} \x1b[0m\n`);

  const allResults = [];
  for (const panel of PANELS) {
    const res = await scrapePanel(panel);
    allResults.push(...res);
  }

  // Reporte final
  console.log('\n\x1b[36m ═══ REPORTE FINAL ═══ \x1b[0m');
  console.log(`Total perfiles procesados: ${allResults.length}`);
  allResults.forEach(r => {
    const icon = r.error ? '❌' : (r.puntos > 0 ? '✅' : '⚠️');
    console.log(`${icon} ${r.modelo.padEnd(20)} ID:${r.id} → ${r.puntos} pts`);
  });

  console.log('\n\x1b[32m [SUCCESS] Infiltración Multi-Panel completada. \x1b[0m');
})();