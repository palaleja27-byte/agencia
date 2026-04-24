const { chromium } = require('playwright');
const { createClient } = require('@supabase/supabase-js');

// ═══════════════════════════════════════════════════════════════
// ⚡ WATCHER MODE — Agencia RR 2026
// Mantiene sesiones vivas en los 4 paneles de Datame
// Detecta cambios de puntos y los empuja a Supabase al instante
// ═══════════════════════════════════════════════════════════════

const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Faltan SUPABASE_URL o SUPABASE_SERVICE_KEY');
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Tiempo máximo de vida del watcher (5.5h para que GitHub no lo mate)
const MAX_RUNTIME_MS   = 5.5 * 60 * 60 * 1000;
const CICLO_PAUSA_MS   = 10 * 60 * 1000;  // 10 min entre ciclos completos
const PAUSA_PERFIL_MS  = 4000;             // 4 seg por perfil al hacer scrape
const startTime        = Date.now();

// ────────────────────────────────────────────────────────────────
// Funciones de soporte
// ────────────────────────────────────────────────────────────────
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

// Hora de inicio del turno actual (para delimitar el rango en Datame)
function rangoTurnoHoy() {
  const hoy = fechaHoyColombia();
  const h   = parseInt(new Date().toLocaleString('en-US', {
    timeZone: 'America/Bogota', hour12: false, hour: 'numeric'
  }));
  // ⚠️ Clave: rango = SOLO HOY, así Datame devuelve puntos de hoy únicamente
  // Datame suma puntos en el rango seleccionado, no es acumulado histórico
  return { start: hoy, end: hoy };
}

function log(msg) {
  const ts = new Date().toLocaleTimeString('es-CO', { timeZone: 'America/Bogota', hour12: false });
  console.log(`[${ts}] ${msg}`);
}

// ────────────────────────────────────────────────────────────────
// Estado en memoria: último valor conocido por perfil
// ────────────────────────────────────────────────────────────────
const ultimosValores = {}; // { id_datame: pts }

async function pushCambio(idPerfil, pts, modelo, panelNombre) {
  const jornada  = detectarJornada();
  const fechaDia = fechaHoyColombia();
  const tsAhora  = new Date().toISOString();

  // pts = puntos de HOY (rango Datame = solo hoy)
  // → puntos_neto = pts directamente (ya es el neto real del día)
  // Si hay registro previo y los puntos bajaron, ignorar
  const { data: prev } = await supabase
    .from('operaciones')
    .select('puntos')
    .eq('id_perfil', idPerfil)
    .eq('fecha_dia', fechaDia)
    .eq('jornada', jornada)
    .maybeSingle();

  const ptsPrev = prev?.puntos || 0;
  if (pts <= ptsPrev && ptsPrev > 0) {
    // Datame a veces devuelve valores menores (lag de API) — ignorar
    log(`  ⚠️ ${modelo}: pts (${pts}) ≤ prev (${ptsPrev}), ignorando`);
    return;
  }

  const { error } = await supabase.from('operaciones').upsert({
    id_perfil:   idPerfil,
    agencia:     panelNombre,
    puntos:      pts,       // total del día
    puntos_neto: pts,       // ← igual al total porque el rango es solo HOY
    fecha_corte: tsAhora,
    fecha_dia:   fechaDia,
    jornada:     jornada,
  }, { onConflict: 'id_perfil,fecha_dia,jornada' });

  if (error) {
    log(`  ❌ DB Error ${modelo}: ${error.message}`);
  } else {
    log(`  🔴 CAMBIO → ${modelo} (${idPerfil}) | prev:${ptsPrev.toFixed(1)} → hoy:${pts.toFixed(2)} pts | ${jornada}`);
  }
}


// ────────────────────────────────────────────────────────────────
// Sesión de un panel: login + ciclo de scrape perpetuo
// ────────────────────────────────────────────────────────────────
async function watchPanel(panel, perfiles) {
  const { nombre, email, password } = panel;
  log(`🟢 Iniciando sesión watcher: ${nombre} (${email})`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page    = await context.newPage();

  // Radar XHR — detecta cambios de puntos sin necesidad de parsear DOM
  page.on('response', async (response) => {
    const rType = response.request().resourceType();
    if (rType !== 'fetch' && rType !== 'xhr') return;
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
        if (!id || id.length < 7) continue;

        // ¿Es un perfil que nos interesa?
        const perfil = perfiles.find(p => p.id_datame === id);
        if (!perfil) continue;

        const anterior = ultimosValores[id] || 0;
        if (pts !== anterior) {
          ultimosValores[id] = pts;
          // Push inmediato a Supabase → Realtime notifica al dashboard
          await pushCambio(id, pts, perfil.modelo, nombre);
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
    log(`❌ Login FAILED: ${nombre}: ${err.message}`);
    await browser.close();
    return;
  }

  const { start, end } = rangoTurnoHoy(); // 🔑 SOLO HOY — puntos reales del turno

  // ── CICLO PRINCIPAL ──
  while (Date.now() - startTime < MAX_RUNTIME_MS) {
    log(`\n🔄 Ciclo de escaneo — ${nombre} | ${perfiles.length} perfiles | rango: ${start}`);

    try {
      await page.goto('https://datame.cloud/statistics', { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(4000);

      // Inyectar fechas de HOY (no del mes) → Datame muestra solo puntos de hoy
      await page.evaluate(({ s, e }) => {
        const ins = document.querySelectorAll('input[type="text"],input.q-field__native');
        if (ins[0]) { ins[0].value = s; ins[0].dispatchEvent(new Event('input', { bubbles: true })); }
        if (ins[1]) { ins[1].value = e; ins[1].dispatchEvent(new Event('input', { bubbles: true })); }
      }, { s: start, e: end });
      await page.waitForTimeout(1000);

      // Escanear cada perfil
      for (const perfil of perfiles) {
        if (Date.now() - startTime >= MAX_RUNTIME_MS) break;
        try {
          await page.evaluate((v) => {
            const ins = Array.from(document.querySelectorAll('input'));
            let t = ins.find(i => (i.getAttribute('aria-label')||'').toLowerCase().includes('profile')
                                ||(i.placeholder||'').toLowerCase().includes('profile'));
            if (!t && ins.length >= 3) t = ins[2];
            if (t) {
              t.value = v;
              t.dispatchEvent(new Event('input',  { bubbles: true }));
              t.dispatchEvent(new Event('change', { bubbles: true }));
            }
          }, perfil.id_datame);
          await page.waitForTimeout(600);
          await page.click('button:has-text("SHOW"),.q-btn:has-text("SHOW")', { timeout: 5000 }).catch(() => {});
          await page.waitForTimeout(PAUSA_PERFIL_MS);
          // El XHR radar captura la respuesta automáticamente ↑
        } catch (e) {
          log(`  ⚠️ ${perfil.modelo}: ${e.message.slice(0,60)}`);
        }
      }

      log(`✅ Ciclo completado — ${nombre}. Pausa ${CICLO_PAUSA_MS/60000} min...`);
    } catch (err) {
      log(`⚠️ Error en ciclo ${nombre}: ${err.message}. Reintentando en 30 seg...`);
      await page.waitForTimeout(30000);
    }

    // Esperar antes del próximo ciclo
    const elapsed = Date.now() - startTime;
    if (elapsed + CICLO_PAUSA_MS < MAX_RUNTIME_MS) {
      await page.waitForTimeout(CICLO_PAUSA_MS);
    } else {
      break; // No hay tiempo para otro ciclo
    }
  }

  log(`🏁 ${nombre} — Sesión watcher finalizada tras ${((Date.now()-startTime)/3600000).toFixed(1)}h`);
  await browser.close();
}

// ────────────────────────────────────────────────────────────────
// MAIN — Leer paneles desde Supabase y lanzar watchers en paralelo
// ────────────────────────────────────────────────────────────────
(async () => {
  log('⚡ WATCHER MODE iniciado — Agencia RR 2026');
  log(`⏱️  Tiempo máximo: ${MAX_RUNTIME_MS / 3600000}h | Ciclo: ${CICLO_PAUSA_MS / 60000} min`);

  const { data: panels } = await supabase
    .from('datame_panels').select('*').eq('activo', true).order('id');
  const { data: allPerfiles } = await supabase
    .from('datame_perfiles').select('*').eq('activo', true).order('id');

  if (!panels?.length) { log('❌ Sin paneles en Supabase'); process.exit(1); }
  log(`📡 ${panels.length} paneles cargados | ${allPerfiles?.length || 0} perfiles totales`);

  // Pre-cargar últimos valores conocidos de Supabase
  const hoy = fechaHoyColombia();
  const { data: hoyOps } = await supabase
    .from('operaciones').select('id_perfil, puntos').eq('fecha_dia', hoy);
  (hoyOps || []).forEach(op => { ultimosValores[op.id_perfil] = op.puntos; });
  log(`📦 ${Object.keys(ultimosValores).length} valores previos de hoy cargados como baseline`);

  // Lanzar todos los paneles en paralelo
  await Promise.all(panels.map(panel => {
    const perfiles = (allPerfiles || []).filter(p => p.panel_id === panel.id);
    if (!perfiles.length) { log(`[SKIP] ${panel.nombre}: sin perfiles`); return Promise.resolve(); }
    return watchPanel(panel, perfiles);
  }));

  log('🏁 WATCHER MODE completado. GitHub Actions lo reiniciará automáticamente.');
})();
