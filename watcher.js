const { chromium } = require('playwright');
const { createClient } = require('@supabase/supabase-js');

// ═══════════════════════════════════════════════════════════════
// ⚡ WATCHER MODE — Agencia RR 2026
// ─ Usa rango MENSUAL en Datame (para total_mes preciso)
// ─ Rastrea baseline por turno (reset cada vez que cambia jornada)
// ─ Almacena: puntos_total (acumulado mes), puntos_neto (solo el turno)
// ═══════════════════════════════════════════════════════════════

const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) { console.error('❌ Faltan credenciales'); process.exit(1); }
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const MAX_RUNTIME_MS  = 5.5 * 60 * 60 * 1000;
const CICLO_PAUSA_MS  = 30 * 60 * 1000;    // 30 min entre ciclos
const PAUSA_PERFIL_MS = 3000;              // 3 seg por perfil (más rápido)
const startTime       = Date.now();

// ─────────────────────────────────────────────────────────────────
// UTILIDADES
// ─────────────────────────────────────────────────────────────────
function detectarJornada() {
  const h = parseInt(new Date().toLocaleString('en-US', {
    timeZone: 'America/Bogota', hour12: false, hour: 'numeric'
  }));
  if (h >= 6  && h < 14) return 'Mañana';
  if (h >= 14 && h < 22) return 'Tarde';
  return 'Noche';
}

function fechaHoyColombia() {
  // 🧠 LOGICAL DATE (v2026): El día cambia a las 6:00 AM, no a medianoche.
  // Esto evita que el turno de NOCHE (10pm-6am) se parta en dos registros.
  const dt = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Bogota' }));
  const logical = new Date(dt.getTime() - (6 * 3600000));
  return logical.toLocaleDateString('en-CA');
}

function rangoMesActual() {
  // Rango: inicio del mes → hoy + 2 días al futuro
  // Los 2 días extra garantizan que Datame incluya TODOS los datos actuales
  // (algunos paneles tienen lag de 24-48h en su cierre contable)
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const endDate = new Date(d);
  endDate.setDate(endDate.getDate() + 2);  // ← +2 días al futuro
  const eY = endDate.getFullYear();
  const eM = String(endDate.getMonth() + 1).padStart(2, '0');
  const eD = String(endDate.getDate()).padStart(2, '0');
  return { start: `${y}-${m}-01`, end: `${eY}-${eM}-${eD}` };
}

function log(msg) {
  const ts = new Date().toLocaleTimeString('es-CO', { timeZone: 'America/Bogota', hour12: false });
  console.log(`[${ts}] ${msg}`);
}

// ─────────────────────────────────────────────────────────────────
// BASELINES EN MEMORIA
// Clave: `${id_perfil}__${fecha_dia}__${jornada}`
// Valor: total_mensual al inicio del turno
// ─────────────────────────────────────────────────────────────────
const shiftBaselines = {};

function bKey(id, fecha, jornada) { return `${id}__${fecha}__${jornada}`; }

// ─────────────────────────────────────────────────────────────────
// FUNCIONES DB CON REINTENTOS (TOLERANCIA A FALLOS DE RED / 502)
// ─────────────────────────────────────────────────────────────────
async function dbSelectBaseline(idPerfil, fechaDia, jornada) {
  let attempt = 0;
  while (attempt < 5) {
    const res = await supabase.from('operaciones')
      .select('puntos_total, puntos_baseline, puntos_neto')
      .eq('id_perfil', idPerfil)
      .eq('fecha_dia', fechaDia)
      .eq('jornada', jornada)
      .maybeSingle();
    
    if (!res.error) return res;
    
    if (res.error.message.includes('fetch') || res.error.message.includes('502') || res.error.message.includes('timeout') || res.error.message.includes('Gateway')) {
      attempt++;
      await new Promise(r => setTimeout(r, 3000 * attempt));
    } else {
      return res;
    }
  }
  return { error: { message: 'Max retries reached (fetch failed)' }, data: null };
}

async function dbUpsertTurno(payload) {
  let attempt = 0;
  while (attempt < 5) {
    const res = await supabase.from('operaciones')
      .upsert(payload, { onConflict: 'id_perfil,fecha_dia,jornada' });
      
    if (!res.error) return res;
    
    if (res.error.message.includes('fetch') || res.error.message.includes('502') || res.error.message.includes('timeout') || res.error.message.includes('Gateway')) {
      attempt++;
      await new Promise(r => setTimeout(r, 3000 * attempt));
    } else {
      return res;
    }
  }
  return { error: { message: 'Max retries reached (fetch failed)' } };
}

async function dbUpdateBaseline(idPerfil, fechaDia, jornada, baselineCorr, netoCorr) {
  let attempt = 0;
  while (attempt < 5) {
    const res = await supabase.from('operaciones')
      .update({ puntos_baseline: baselineCorr, puntos_neto: netoCorr })
      .eq('id_perfil', idPerfil)
      .eq('fecha_dia', fechaDia)
      .eq('jornada', jornada);
      
    if (!res.error) return res;
    
    if (res.error.message.includes('fetch') || res.error.message.includes('502') || res.error.message.includes('timeout') || res.error.message.includes('Gateway')) {
      attempt++;
      await new Promise(r => setTimeout(r, 3000 * attempt));
    } else {
      return res;
    }
  }
  return { error: { message: 'Max retries reached (fetch failed)' } };
}

// ─────────────────────────────────────────────────────────────────
// PERSISTIR TURNO EN SUPABASE
// puntos_total   = acumulado del mes (lo que trae Datame con rango mensual)
// puntos_baseline= acumulado al INICIO de este turno  (referencia del 0)
// puntos_neto    = puntos hechos EN ESTE TURNO = total - baseline
// ─────────────────────────────────────────────────────────────────
async function upsertTurno(idPerfil, monthlyTotal, modelo, panelNombre) {
  const jornada  = detectarJornada();
  const fechaDia = fechaHoyColombia();
  const ts       = new Date().toISOString();
  const key      = bKey(idPerfil, fechaDia, jornada);

  // Si no tenemos baseline en memoria, buscar en Supabase (watcher se reinició)
  if (shiftBaselines[key] === undefined) {
    const { data: rec } = await dbSelectBaseline(idPerfil, fechaDia, jornada);

    if (rec) {
      const dbBaseline = rec.puntos_baseline || 0;
      if (dbBaseline > 0) {
        shiftBaselines[key] = dbBaseline;
        log(`  📥 Baseline recuperado de DB: ${modelo} [${jornada}] = ${dbBaseline.toFixed(2)} pts`);
      } else {
        shiftBaselines[key] = monthlyTotal;
        log(`  📍 Baseline nuevo (sin registro previo): ${modelo} [${jornada}] = ${monthlyTotal.toFixed(2)} pts`);
      }
    } else {
      // DATA SCIENCE FIX: Heredar puntos_total de la jornada anterior como baseline.
      // Esto cierra la "brecha temporal" si el watcher se retrasa en el cambio de turno.
      let inheritedBaseline = monthlyTotal;
      if (jornada === 'Tarde' || jornada === 'Noche') {
        const prevJornada = jornada === 'Tarde' ? 'Mañana' : 'Tarde';
        const { data: prevRec } = await dbSelectBaseline(idPerfil, fechaDia, prevJornada);
        // Si el turno anterior tiene puntos, usamos SU CIERRE como nuestro INICIO.
        if (prevRec && prevRec.puntos_total > 0) {
          inheritedBaseline = prevRec.puntos_total;
          log(`  🔗 Baseline heredado de ${prevJornada}: ${modelo} [${jornada}] = ${inheritedBaseline.toFixed(2)} pts`);
        } else {
          log(`  📍 Baseline fijado (sin herencia): ${modelo} [${jornada}] = ${monthlyTotal.toFixed(2)} pts`);
        }
      } else {
        log(`  📍 Baseline fijado: ${modelo} [${jornada}] = ${monthlyTotal.toFixed(2)} pts`);
      }
      shiftBaselines[key] = inheritedBaseline;
    }
  }

  const baseline  = shiftBaselines[key];
  let netoTurno   = Math.max(0, monthlyTotal - baseline);

  // ── SANIDAD: Control de picos irracionales ──
  // Si netoTurno > 1500, significa que el baseline en BD se perdió o es corrupto
  // (un operador no puede generar >1500 pts en una sola jornada).
  if (netoTurno > 1500) {
    // Estimación conservadora basada en horas trabajadas (aprox 15 pts/hr)
    const h = Math.max(1, new Date().getHours() % 8);
    const netoEstimado = h * 15;
    
    const baselineCorr = parseFloat((monthlyTotal - netoEstimado).toFixed(2));
    const netoCorr     = parseFloat(netoEstimado.toFixed(2));
    log(`  🔴 SANIDAD ${modelo}: neto irreal (${netoTurno.toFixed(1)} > 1500) → CORRIENDO baseline a ${baselineCorr}`);
    
    const { error: errCorr } = await dbUpdateBaseline(idPerfil, fechaDia, jornada, baselineCorr, netoCorr);
    if (!errCorr) {
      log(`  ✅ SANIDAD ${modelo}: baseline corregido → ${baselineCorr} | neto → ${netoCorr} pts`);
      shiftBaselines[key] = baselineCorr;
      netoTurno = netoCorr;
    } else {
      log(`  ❌ SANIDAD ${modelo}: no se pudo corregir en DB: ${errCorr.message}`);
      delete shiftBaselines[key];
      return;
    }
  }

  // Ignorar si el total bajó (lag de Datame)
  if (monthlyTotal < baseline) {
    log(`  ⚠️ ${modelo}: total_mes (${monthlyTotal.toFixed(1)}) < baseline (${baseline.toFixed(1)}), ignorando`);
    return;
  }

  const { error } = await dbUpsertTurno({
    id_perfil:       idPerfil,
    agencia:         panelNombre,
    puntos:          monthlyTotal,
    puntos_total:    monthlyTotal,
    puntos_baseline: baseline,
    puntos_neto:     netoTurno,
    fecha_corte:     ts,
    fecha_dia:       fechaDia,
    jornada:         jornada,
  });

  if (error) {
    log(`  ❌ DB Error ${modelo}: ${error.message}`);
  } else {
    log(`  ✅ ${modelo} [${jornada}] mes:${monthlyTotal.toFixed(1)} baseline:${baseline.toFixed(1)} turno:+${netoTurno.toFixed(2)} pts`);
  }
}

// ─────────────────────────────────────────────────────────────────
// SESIÓN DE UN PANEL
// ─────────────────────────────────────────────────────────────────
async function watchPanel(panel, perfiles) {
  const { nombre, email, password } = panel;
  log(`🟢 Iniciando watcher: ${nombre} (${email})`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page    = await context.newPage();

  // RADAR XHR — intercepta respuestas de Datame con mayor cobertura de campos
  page.on('response', async (response) => {
    const rType = response.request().resourceType();
    if (rType !== 'fetch' && rType !== 'xhr') return;
    try {
      const json = await response.json();
      let list = Array.isArray(json) ? json : (json.data || json.result || json.items || [json]);
      if (!Array.isArray(list)) list = [list];
      for (const item of list) {
        // Buscar el valor de puntos en todos los campos conocidos de Datame
        const rawPts = item.bonuses        ||
                       item.total          ||
                       item.total_points   ||
                       item.bonuses_total  ||
                       item.points         ||
                       item.amount         ||
                       item.tokens         ||
                       item.score          || 0;
        const pts = parseFloat(String(rawPts).replace(/[^\d.]/g, '')) || 0;
        if (pts <= 0 || pts > 1000000) continue;

        // Extraer ID del perfil de la URL o del cuerpo del JSON
        let id = (response.url().match(/\d{7,10}/) || [])[0];
        if (!id) id = (JSON.stringify(item).match(/\d{7,10}/) || [])[0];
        if (!id) id = String(item.member_id || item.profile_id || item.studio_id || item.id || '');
        if (!id || id.length < 7) continue;

        const perfil = perfiles.find(p => p.id_datame === id);
        if (!perfil) continue;

        await upsertTurno(id, pts, perfil.modelo, nombre);
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

  const { start, end } = rangoMesActual(); // Rango mensual para total del mes

  // ── EJECUCIÓN ÚNICA (30 min manejados por GitHub Actions) ──
  log(`\n🔄 Ciclo Único — ${nombre} | ${perfiles.length} perfiles | jornada: ${detectarJornada()}`);

  try {
    await page.goto('https://datame.cloud/statistics', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(4000);

    // Inyectar rango del mes (Datame devuelve el total acumulado del mes)
    await page.evaluate(({ s, e }) => {
      const ins = document.querySelectorAll('input[type="text"],input.q-field__native');
      if (ins[0]) { ins[0].value = s; ins[0].dispatchEvent(new Event('input', { bubbles: true })); }
      if (ins[1]) { ins[1].value = e; ins[1].dispatchEvent(new Event('input', { bubbles: true })); }
    }, { s: start, e: end });
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
    log(`✅ Ciclo completado — ${nombre}.`);
  } catch (err) {
    log(`❌ Error crítico ${nombre}: ${err.message}`);
  }

  log(`🏁 ${nombre} — Sesión finalizada tras ${((Date.now() - startTime) / 3600000).toFixed(1)}h`);
  await browser.close();
}

// ─────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────
(async () => {
  log('⚡ WATCHER MODE iniciado — Agencia RR 2026');
  log(`⏱️  Runtime máx: ${MAX_RUNTIME_MS / 3600000}h | Ciclo: ${CICLO_PAUSA_MS / 60000} min`);
  log(`📅 Rango Datame: ${rangoMesActual().start} → ${rangoMesActual().end} (total mes)`);

  const { data: panels, error: panelsErr } = await supabase.from('datame_panels').select('*').eq('activo', true).order('id');
  const { data: allPerfiles, error: perfErr } = await supabase.from('datame_perfiles').select('*').eq('activo', true).order('id');

  if (panelsErr) log(`❌ Error consultando paneles: ${panelsErr.message}`);
  if (perfErr) log(`❌ Error consultando perfiles: ${perfErr.message}`);

  if (!panels?.length) { 
    log('❌ Sin paneles en Supabase (o tabla vacía/inactiva)'); 
    process.exit(1); 
  }
  log(`📡 ${panels.length} paneles | ${allPerfiles?.length || 0} perfiles`);

  await Promise.all(panels.map(panel => {
    const perfiles = (allPerfiles || []).filter(p => p.panel_id === panel.id);
    if (!perfiles.length) { log(`[SKIP] ${panel.nombre}`); return Promise.resolve(); }
    return watchPanel(panel, perfiles);
  }));

  log('🏁 WATCHER MODE completado. GitHub Actions lo reiniciará automáticamente.');
})();
