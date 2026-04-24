const { chromium } = require('playwright');
const { createClient } = require('@supabase/supabase-js');

// ═══════════════════════════════════════════════════════════════
// 🗄️  SEED HISTÓRICO — AgenciaRR 2026
// ─ Trae totales mensuales de Datame para Feb-2026, Mar-2026
//   y el acumulado de Abr 1-23 (hasta ayer).
// ─ Los guarda en `operaciones` con jornada = 'MES' (fijo, no
//   se sobreescribe por el watcher que usa Mañana/Tarde/Noche).
// ─ Ejecutar UNA SOLA VEZ. Idempotente (usa upsert).
// ═══════════════════════════════════════════════════════════════

const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Faltan SUPABASE_URL y SUPABASE_SERVICE_KEY');
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ── Periodos históricos a sembrar ───────────────────────────────
// Cada uno representa un mes completo. fecha_dia = último día del mes.
// El watcher no toca estos registros (jornada='MES' ≠ 'Mañana'/'Tarde'/'Noche').
const PERIODOS = [
  {
    label:     'Feb-2026',
    inicio:    '2026-02-01',
    fin:       '2026-02-28',
    jornada:   'MES',
    fecha_dia: '2026-02-28',   // último día del mes → agrupación por mes funciona
  },
  {
    label:     'Mar-2026',
    inicio:    '2026-03-01',
    fin:       '2026-03-31',
    jornada:   'MES',
    fecha_dia: '2026-03-31',
  },
  {
    label:     'Abr-2026 (1-23)',
    inicio:    '2026-04-01',
    fin:       '2026-04-23',   // hasta ayer (24 es hoy → watcher lo cubre)
    jornada:   'MES',
    fecha_dia: '2026-04-23',
  },
];

const PAUSA_PERFIL_MS = 4000;

function log(msg) {
  const ts = new Date().toLocaleTimeString('es-CO', { timeZone: 'America/Bogota', hour12: false });
  console.log(`[${ts}] ${msg}`);
}

// ── Resultados en memoria: { id_perfil → { periodo_label → total } } ─
const resultados = {};

// ── Scraper de un panel para UN periodo específico ─────────────────
async function scrapearPeriodo(panel, perfiles, periodo) {
  const { nombre, email, password } = panel;
  log(`\n📅 [${periodo.label}] Panel: ${nombre} — ${perfiles.length} perfiles`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page    = await context.newPage();

  // RADAR XHR — mismo que el watcher
  page.on('response', async (response) => {
    const rType = response.request().resourceType();
    if (rType !== 'fetch' && rType !== 'xhr') return;
    try {
      const json = await response.json();
      let list = Array.isArray(json) ? json : (json.data || json.result || json.items || [json]);
      if (!Array.isArray(list)) list = [list];
      for (const item of list) {
        const rawPts = item.bonuses       ||
                       item.total         ||
                       item.total_points  ||
                       item.bonuses_total ||
                       item.points        ||
                       item.amount        ||
                       item.tokens        ||
                       item.score         || 0;
        const pts = parseFloat(String(rawPts).replace(/[^\d.]/g, '')) || 0;
        if (pts <= 0 || pts > 1000000) continue;

        let id = (response.url().match(/\d{7,10}/) || [])[0];
        if (!id) id = (JSON.stringify(item).match(/\d{7,10}/) || [])[0];
        if (!id) id = String(item.member_id || item.profile_id || item.studio_id || item.id || '');
        if (!id || id.length < 7) continue;

        const perfil = perfiles.find(p => p.id_datame === id);
        if (!perfil) continue;

        if (!resultados[id]) resultados[id] = {};
        // Quedarse con el valor más alto capturado para este perfil+periodo
        const previo = resultados[id][periodo.label] || 0;
        if (pts > previo) {
          resultados[id][periodo.label] = pts;
          log(`  📥 ${perfil.modelo} [${periodo.label}]: ${pts.toFixed(1)} pts`);
        }
      }
    } catch (_) {}
  });

  // LOGIN
  try {
    await page.goto('https://datame.cloud/login', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForSelector('input[type="text"],input[type="email"]', { timeout: 12000 });
    await page.fill('input[type="text"],input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    await page.click('button.q-btn,button:has-text("LOG IN")')
              .catch(() => page.press('input[type="password"]', 'Enter'));
    await page.waitForTimeout(7000);
    log(`✅ Login OK: ${nombre}`);
  } catch (err) {
    log(`❌ Login FAILED ${nombre}: ${err.message}`);
    await browser.close();
    return;
  }

  // ── Navegar a /statistics e inyectar rango del periodo ─────────
  try {
    await page.goto('https://datame.cloud/statistics', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(4000);

    await page.evaluate(({ s, e }) => {
      const ins = document.querySelectorAll('input[type="text"],input.q-field__native');
      if (ins[0]) { ins[0].value = s; ins[0].dispatchEvent(new Event('input', { bubbles: true })); }
      if (ins[1]) { ins[1].value = e; ins[1].dispatchEvent(new Event('input', { bubbles: true })); }
    }, { s: periodo.inicio, e: periodo.fin });
    await page.waitForTimeout(1200);

    for (const perfil of perfiles) {
      try {
        await page.evaluate((v) => {
          const ins = Array.from(document.querySelectorAll('input'));
          let t = ins.find(i =>
            (i.getAttribute('aria-label') || '').toLowerCase().includes('profile') ||
            (i.placeholder || '').toLowerCase().includes('profile')
          );
          if (!t && ins.length >= 3) t = ins[2];
          if (t) {
            t.value = v;
            t.dispatchEvent(new Event('input',  { bubbles: true }));
            t.dispatchEvent(new Event('change', { bubbles: true }));
          }
        }, perfil.id_datame);
        await page.waitForTimeout(500);
        await page.click('button:has-text("SHOW"),.q-btn:has-text("SHOW")', { timeout: 5000 }).catch(() => {});
        await page.waitForTimeout(PAUSA_PERFIL_MS);
      } catch (e) {
        log(`  ⚠️ ${perfil.modelo}: ${e.message.slice(0, 60)}`);
      }
    }

    log(`✅ Scraping [${periodo.label}] ${nombre} — ${perfiles.length} perfiles procesados`);
  } catch (err) {
    log(`⚠️ Error scraping [${periodo.label}] ${nombre}: ${err.message}`);
  }

  await browser.close();
}

// ── Guardar en Supabase todos los resultados capturados ────────────
async function sembrarEnSupabase(perfiles) {
  log('\n💾 Guardando resultados en Supabase...');
  let guardados = 0, omitidos = 0;

  for (const [idDatame, periodoMap] of Object.entries(resultados)) {
    const perfil = perfiles.find(p => p.id_datame === idDatame);
    if (!perfil) continue;

    for (const periodo of PERIODOS) {
      const total = periodoMap[periodo.label];
      if (!total || total <= 0) {
        omitidos++;
        log(`  ⏭️  ${perfil.modelo} [${periodo.label}]: sin datos — saltando`);
        continue;
      }

      const { error } = await supabase.from('operaciones').upsert({
        id_perfil:       idDatame,
        agencia:         perfil.modelo,
        puntos:          total,           // col. legado
        puntos_total:    total,           // acumulado del periodo
        puntos_baseline: 0,              // fijo: el neto del mes = total del mes
        puntos_neto:     total,           // neto = total (no hay turno anterior)
        fecha_dia:       periodo.fecha_dia,
        jornada:         periodo.jornada, // 'MES' — el watcher no toca esto
        fecha_corte:     new Date().toISOString(),
      }, { onConflict: 'id_perfil,fecha_dia,jornada' });

      if (error) {
        log(`  ❌ DB ${perfil.modelo} [${periodo.label}]: ${error.message}`);
      } else {
        log(`  ✅ ${perfil.modelo} [${periodo.label}]: ${total.toFixed(1)} pts guardado`);
        guardados++;
      }
    }
  }

  log(`\n📊 Resumen: ${guardados} registros guardados | ${omitidos} sin datos`);
}

// ── MAIN ────────────────────────────────────────────────────────────
(async () => {
  log('🗄️  SEED HISTÓRICO — Agencia RR 2026');
  log('📅 Periodos: Feb-2026, Mar-2026, Abr 1-23');

  const { data: panels } = await supabase
    .from('datame_panels').select('*').eq('activo', true).order('id');
  const { data: allPerfiles } = await supabase
    .from('datame_perfiles').select('*').eq('activo', true).order('id');

  if (!panels?.length) { log('❌ Sin paneles en Supabase'); process.exit(1); }
  log(`📡 ${panels.length} paneles | ${allPerfiles?.length || 0} perfiles totales`);

  // Para cada periodo, iterar sobre todos los paneles en SERIE
  // (no en paralelo para no saturar Datame con múltiples sesiones)
  for (const periodo of PERIODOS) {
    log(`\n══════════════════════════════════════════`);
    log(`📅 PERIODO: ${periodo.label} (${periodo.inicio} → ${periodo.fin})`);
    log(`══════════════════════════════════════════`);

    for (const panel of panels) {
      const perfiles = (allPerfiles || []).filter(p => p.panel_id === panel.id);
      if (!perfiles.length) { log(`[SKIP] ${panel.nombre} sin perfiles activos`); continue; }
      await scrapearPeriodo(panel, perfiles, periodo);
      // Pausa entre paneles del mismo periodo
      if (panels.indexOf(panel) < panels.length - 1) {
        log(`⏸️  Pausa 5s entre paneles...`);
        await new Promise(r => setTimeout(r, 5000));
      }
    }
  }

  // Guardar todo en Supabase
  await sembrarEnSupabase(allPerfiles || []);

  log('\n🏁 SEED HISTÓRICO completado.');
  log('✅ Los datos de Feb/Mar/Abr 1-23 ya están fijos en Supabase.');
  log('📌 El watcher (Mañana/Tarde/Noche) no sobreescribirá estos registros (jornada="MES").');
})();
