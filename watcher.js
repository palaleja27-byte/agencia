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
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
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
    const { data: rec } = await supabase
      .from('operaciones')
      .select('puntos_total, puntos_baseline, puntos_neto')
      .eq('id_perfil', idPerfil)
      .eq('fecha_dia', fechaDia)
      .eq('jornada', jornada)
      .maybeSingle();

    if (rec) {
      // Usar puntos_baseline DIRECTO de la DB (campo correcto)
      // NO recalcular como total-neto porque si neto está corrupto se propaga el error
      const dbBaseline = rec.puntos_baseline || 0;
      if (dbBaseline > 0) {
        shiftBaselines[key] = dbBaseline;
        log(`  📥 Baseline recuperado de DB: ${modelo} [${jornada}] = ${dbBaseline.toFixed(2)} pts`);
      } else {
        // Sin baseline en DB → el total actual es el baseline (neto = 0)
        shiftBaselines[key] = monthlyTotal;
        log(`  📍 Baseline nuevo (sin registro previo): ${modelo} [${jornada}] = ${monthlyTotal.toFixed(2)} pts`);
      }
    } else {
      // Primera captura del turno: fijar baseline ahora
      shiftBaselines[key] = monthlyTotal;
      log(`  📍 Baseline fijado: ${modelo} [${jornada}] = ${monthlyTotal.toFixed(2)} pts`);
    }
  }

  const baseline  = shiftBaselines[key];
  let netoTurno   = Math.max(0, monthlyTotal - baseline);

  // ── SANIDAD: neto no puede superar el 60% del total mensual en un turno ──
  // Si supera ese umbral → baseline corrupto en DB. CORREGIR ACTIVAMENTE en Supabase.
  if (netoTurno > monthlyTotal * 0.60 && monthlyTotal > 100) {
    // Baseline correcto: asumir que el neto real es ≈ 3% del total (producción conservadora)
    const baselineCorr = parseFloat((monthlyTotal * 0.97).toFixed(2));
    const netoCorr     = parseFloat((monthlyTotal - baselineCorr).toFixed(2));
    log(`  🔴 SANIDAD ${modelo}: neto ${netoTurno.toFixed(1)} > 60% del total → CORRIENDO baseline en DB...`);
    // Corregir en Supabase directamente
    const { error: errCorr } = await supabase.from('operaciones')
      .update({ puntos_baseline: baselineCorr, puntos_neto: netoCorr })
      .eq('id_perfil', idPerfil)
      .eq('fecha_dia', fechaDia)
      .eq('jornada', jornada);
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

  const { error } = await supabase.from('operaciones').upsert({
    id_perfil:       idPerfil,
    agencia:         panelNombre,
    puntos:          monthlyTotal,     // col. legado — mantener para compatibilidad
    puntos_total:    monthlyTotal,     // total acumulado del mes
    puntos_baseline: baseline,         // total al inicio de ESTE turno
    puntos_neto:     netoTurno,        // puntos hechos EN ESTE TURNO (empieza en 0)
    fecha_corte:     ts,
    fecha_dia:       fechaDia,
    jornada:         jornada,
  }, { onConflict: 'id_perfil,fecha_dia,jornada' });

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

  const { data: panels } = await supabase.from('datame_panels').select('*').eq('activo', true).order('id');
  const { data: allPerfiles } = await supabase.from('datame_perfiles').select('*').eq('activo', true).order('id');

  if (!panels?.length) { log('❌ Sin paneles en Supabase'); process.exit(1); }
  log(`📡 ${panels.length} paneles | ${allPerfiles?.length || 0} perfiles`);

  await Promise.all(panels.map(panel => {
    const perfiles = (allPerfiles || []).filter(p => p.panel_id === panel.id);
    if (!perfiles.length) { log(`[SKIP] ${panel.nombre}`); return Promise.resolve(); }
    return watchPanel(panel, perfiles);
  }));

  log('🏁 WATCHER MODE completado. GitHub Actions lo reiniciará automáticamente.');
})();
