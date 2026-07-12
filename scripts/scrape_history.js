require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env' });
require('dotenv').config({ path: '../supabase/docker/.env' });

const { chromium } = require('playwright');
const { createClient } = require('@supabase/supabase-js');
const WebSocket = require('ws');

const SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:8080';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Faltan credenciales de Supabase');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  global: { headers: {} },
  realtime: { transport: WebSocket },
  db: { schema: 'public' },
});

const PAUSA_PERFIL_MS = 2500;

function log(msg) {
  const ts = new Date().toLocaleTimeString('es-CO', { timeZone: 'America/Bogota', hour12: false });
  console.log(`[${ts}] ${msg}`);
}

const MONTHS_TO_SCRAPE = [
  { name: 'Enero', start: '2026-01-01', end: '2026-01-31', date: '2026-01-31' },
  { name: 'Febrero', start: '2026-02-01', end: '2026-02-28', date: '2026-02-28' },
  { name: 'Marzo', start: '2026-03-01', end: '2026-03-31', date: '2026-03-31' },
  { name: 'Abril', start: '2026-04-01', end: '2026-04-30', date: '2026-04-30' },
  { name: 'Mayo', start: '2026-05-01', end: '2026-05-31', date: '2026-05-31' },
  { name: 'Junio', start: '2026-06-01', end: '2026-06-30', date: '2026-06-30' }
];

async function dbUpsertHistorico(payload) {
  return await supabase.from('operaciones')
    .upsert(payload, { onConflict: 'id_perfil,fecha_dia,jornada' });
}

async function scrapeMonthForPanel(panel, perfiles, month) {
  const { nombre, email, password } = panel;
  log(`🟢 [${month.name}] Iniciando raspado para ${nombre}`);

  let browser;
  try {
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
    const context = await browser.newContext();
    const page = await context.newPage();

    // Map para guardar los resultados capturados
    const captured = {};

    page.on('response', async (response) => {
      const rType = response.request().resourceType();
      if (rType !== 'fetch' && rType !== 'xhr') return;
      try {
        const json = await response.json();
        let list = Array.isArray(json) ? json : (json.data || json.result || json.items || [json]);
        if (!Array.isArray(list)) list = [list];
        for (const item of list) {
          const rawPts = item.bonuses || item.total || item.total_points || item.bonuses_total || item.points || item.amount || item.tokens || item.score || 0;
          const pts = parseFloat(String(rawPts).replace(/[^\d.]/g, '')) || 0;
          if (pts <= 0 || pts > 1000000) continue;

          let id = (response.url().match(/\d{7,10}/) || [])[0];
          if (!id) id = (JSON.stringify(item).match(/\d{7,10}/) || [])[0];
          if (!id) id = String(item.member_id || item.profile_id || item.studio_id || item.id || '');
          if (!id || id.length < 7) continue;

          const perfil = perfiles.find(p => p.id_datame === id);
          if (perfil) {
            captured[id] = pts;
          }
        }
      } catch (err) {}
    });

    // LOGIN
    await page.goto('https://datame.cloud/login', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForSelector('input[type="text"],input[type="email"]', { timeout: 12000 });
    await page.fill('input[type="text"],input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    await page.click('button.q-btn,button:has-text("LOG IN")').catch(() => page.press('input[type="password"]', 'Enter'));
    await page.waitForTimeout(7000);

    // Ir a Estadísticas
    await page.goto('https://datame.cloud/statistics', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(4000);

    // Definir rango de fechas histórico
    await page.evaluate(({ s, e }) => {
      const ins = document.querySelectorAll('input[type="text"],input.q-field__native');
      if (ins[0]) { ins[0].value = s; ins[0].dispatchEvent(new Event('input', { bubbles: true })); }
      if (ins[1]) { ins[1].value = e; ins[1].dispatchEvent(new Event('input', { bubbles: true })); }
    }, { s: month.start, e: month.end });
    await page.waitForTimeout(1200);

    // Iterar por perfiles
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
            t.dispatchEvent(new Event('input', { bubbles: true }));
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

    // Subir datos capturados a Supabase para este mes
    for (const perfil of perfiles) {
      const pts = captured[perfil.id_datame] || 0;
      if (pts > 0) {
        const { error } = await dbUpsertHistorico({
          id_perfil: perfil.id_datame,
          agencia: nombre,
          puntos: pts,
          puntos_total: pts,
          puntos_baseline: 0,
          puntos_neto: pts,
          fecha_corte: new Date().toISOString(),
          fecha_dia: month.date,
          jornada: 'Historico'
        });
        if (error) {
          log(`  ❌ Error DB [${month.name}] ${perfil.modelo}: ${error.message}`);
        } else {
          log(`  ✅ [${month.name}] ${perfil.modelo}: ${pts} pts guardados.`);
        }
      } else {
        log(`  ℹ️ [${month.name}] ${perfil.modelo}: 0 pts (no registrado en este mes).`);
      }
    }

    await browser.close();
  } catch (err) {
    log(`❌ Error ejecutando watcher para ${nombre} en ${month.name}: ${err.message}`);
    if (browser) {
      try { await browser.close(); } catch (_) {}
    }
  }
}

(async () => {
  log('🚀 Iniciando script de extracción histórica Datame (Ene-Jun 2026)');

  // 1. Obtener paneles y perfiles
  let { data: panels, error: panelsErr } = await supabase.from('datame_panels').select('*').eq('activo', true).order('id');
  const { data: allPerfiles, error: perfErr } = await supabase.from('datame_perfiles').select('*').eq('activo', true).order('id');

  if (panelsErr || perfErr) {
    console.error('❌ Error cargando metadata desde Supabase:', panelsErr?.message || perfErr?.message);
    process.exit(1);
  }

  // Mapear con variables de entorno si existen
  panels = panels.map(p => {
    const envUser = process.env[`PANEL${p.id}_USER`];
    const envPass = process.env[`PANEL${p.id}_PASS`];
    if (envUser && envPass) {
      return { ...p, email: envUser.trim(), password: envPass.trim() };
    }
    return p;
  }).filter(p => p.email && p.password && !p.email.includes('Ameliapenaloza'));

  log(`📊 ${panels.length} paneles listos para raspado histórico.`);

  // 2. Procesar mes por mes de forma secuencial
  for (const month of MONTHS_TO_SCRAPE) {
    log(`\n📅 ==============================================`);
    log(`📅 PROCESANDO MES DE: ${month.name.toUpperCase()} (${month.start} -> ${month.end})`);
    log(`📅 ==============================================`);

    for (const panel of panels) {
      const perfiles = (allPerfiles || []).filter(p => p.panel_id === panel.id);
      if (perfiles.length > 0) {
        await scrapeMonthForPanel(panel, perfiles, month);
      }
    }
  }

  log('\n🏁 Raspado histórico completado.');
})();
