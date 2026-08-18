require('dotenv').config({ path: '.env.local' });
const { chromium } = require('playwright');
const { createClient } = require('@supabase/supabase-js');
// ws requerido por @supabase/supabase-js v2 en Node.js 18 (sin WebSocket nativo)
const WebSocket = require('ws');

// ═══════════════════════════════════════════════════════════════
// ⚡ WATCHER MODE — Agencia RR 2026
// ─ Usa rango MENSUAL en Datame (para total_mes preciso)
// ─ Rastrea baseline por turno (reset cada vez que cambia jornada)
// ─ Almacena: puntos_total (acumulado mes), puntos_neto (solo el turno)
// ═══════════════════════════════════════════════════════════════

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = (process.env.SUPABASE_URL || '').trim();
const SUPABASE_SERVICE_KEY = (process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || '').trim();

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) { 
  console.error('❌ Faltan credenciales de Supabase (SUPABASE_URL y SUPABASE_SERVICE_KEY). Por favor verifica los Secrets en GitHub.'); 
  process.exit(1); 
}

console.log(`📡 Conectando Watcher a Supabase URL: ${SUPABASE_URL.substring(0, 30)}...`);

// Pasar WebSocket explícitamente y deshabilitar Realtime (el watcher solo usa REST)
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  global: { headers: {} },
  realtime: { transport: WebSocket },
  db: { schema: 'public' },
});

const MAX_RUNTIME_MS  = 5.5 * 60 * 60 * 1000;
const CICLO_PAUSA_MS  = 5 * 60 * 1000;    // 5 min entre ciclos
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
  // Rango: inicio del mes → hoy + 2 días al futuro (Basado en la hora lógica de Colombia)
  // Los 2 días extra garantizan que Datame incluya TODOS los datos actuales
  const dt = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Bogota' }));
  const logical = new Date(dt.getTime() - (6 * 3600000)); // Ajuste de turno de noche
  
  const y = logical.getFullYear();
  const m = String(logical.getMonth() + 1).padStart(2, '0');
  
  const endDate = new Date(logical);
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
const lastUpsertTotals = {}; // FIX CUOTA: Evita upserts redundantes si no hay cambios

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

  // Re-sincronizar siempre con el baseline de la DB si ya existe
  const { data: rec } = await dbSelectBaseline(idPerfil, fechaDia, jornada);
  if (rec && rec.puntos_baseline !== undefined && rec.puntos_baseline !== null) {
    // Si la DB tiene un baseline antiguo pre-reset (ej: 14794 pts) pero Datame ya reinició el mes (ej: 119 pts), corregir la DB a 0
    if (rec.puntos_baseline > monthlyTotal && (monthlyTotal < rec.puntos_baseline * 0.5 || new Date().getDate() === 1)) {
      log(`  🔄 RESET EN DB DETECTADO ${modelo}: baseline DB era ${rec.puntos_baseline.toFixed(1)}, pero Datame reporta ${monthlyTotal.toFixed(1)} → Corrigiendo DB baseline a 0.0 pts`);
      shiftBaselines[key] = 0;
      await dbUpdateBaseline(idPerfil, fechaDia, jornada, 0, monthlyTotal);
    } else {
      shiftBaselines[key] = rec.puntos_baseline;
    }
  } else if (shiftBaselines[key] === undefined) {
    if (rec) {
      shiftBaselines[key] = monthlyTotal;
      log(`  📍 Baseline nuevo (sin registro previo): ${modelo} [${jornada}] = ${monthlyTotal.toFixed(2)} pts`);
    } else {
      // DATA SCIENCE FIX: Heredar puntos_total de la jornada anterior como baseline.
      let inheritedBaseline = 0;
      
      let prevRec = null;
      if (jornada === 'Noche') {
        const { data: tardeRec } = await dbSelectBaseline(idPerfil, fechaDia, 'Tarde');
        if (tardeRec) {
          prevRec = tardeRec;
        } else {
          const { data: mananaRec } = await dbSelectBaseline(idPerfil, fechaDia, 'Mañana');
          if (mananaRec) prevRec = mananaRec;
        }
      } else if (jornada === 'Tarde') {
        const { data: mananaRec } = await dbSelectBaseline(idPerfil, fechaDia, 'Mañana');
        if (mananaRec) prevRec = mananaRec;
      }
      
      if (prevRec && prevRec.puntos_total > 0 && prevRec.puntos_total <= monthlyTotal) {
        inheritedBaseline = prevRec.puntos_total;
        log(`  🔗 Baseline heredado de turno previo hoy: ${modelo} [${jornada}] = ${inheritedBaseline.toFixed(2)} pts`);
      } else if (prevRec && prevRec.puntos_total > monthlyTotal) {
        inheritedBaseline = 0;
        log(`  🔄 Reset de Mes Detectado en ${modelo}: baseline fijado en 0.00 pts (cierre anterior fue ${prevRec.puntos_total.toFixed(2)})`);
      } else {
        const { data: ultimo } = await supabase.from('operaciones')
          .select('puntos_total, fecha_dia')
          .eq('id_perfil', idPerfil)
          .lt('fecha_dia', fechaDia)
          .order('fecha_dia', { ascending: false })
          .order('fecha_corte', { ascending: false })
          .limit(1).maybeSingle();

        const esNuevoMes = ultimo && ultimo.fecha_dia && (ultimo.fecha_dia.substring(0, 7) !== fechaDia.substring(0, 7));
        if (!esNuevoMes && ultimo && ultimo.puntos_total > 0 && ultimo.puntos_total <= monthlyTotal) {
          inheritedBaseline = ultimo.puntos_total;
          log(`  🔗 Baseline heredado de día anterior (${ultimo.fecha_dia}): ${modelo} [${jornada}] = ${inheritedBaseline.toFixed(2)} pts`);
        } else {
          inheritedBaseline = 0;
          log(`  📍 Inicio de Mes o turno sin herencia: ${modelo} [${jornada}] = 0.00 pts`);
        }
      }
      shiftBaselines[key] = inheritedBaseline;
    }
  }

  const baseline  = shiftBaselines[key];
  let netoTurno   = Math.max(0, monthlyTotal - baseline);

  // 🔬 DELTA-SHIFT™ SANITY CHECK (60% Rule):
  // Si el neto representa más del 60% del total (para totales significativos > 10 pts)
  // y el baseline es 0 (o sospechosamente bajo), consideramos que el baseline es corrupto.
  if (netoTurno > monthlyTotal * 0.60 && monthlyTotal > 100 && baseline === 0 && new Date().getDate() > 3) {
    const baselineCorr = parseFloat((monthlyTotal * 0.97).toFixed(2));
    const netoCorr     = parseFloat((monthlyTotal - baselineCorr).toFixed(2));
    log(`  🔴 SANITY ${modelo}: baseline corrupto (0.0 pts y neto ${netoTurno.toFixed(1)} > 60% de total ${monthlyTotal.toFixed(1)}) → Estableciendo baseline del 97% (${baselineCorr})`);
    shiftBaselines[key] = baselineCorr;
    netoTurno = netoCorr;
  }

  // ── SANIDAD: Control de picos irracionales ──
  if (netoTurno > 1500) {
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

  // Ignorar si el total bajó (lag de Datame), A MENOS que sea un Reset de Mes en Datame
  if (monthlyTotal < baseline) {
    if (monthlyTotal < baseline * 0.5 || new Date().getDate() === 1) {
      log(`  🔄 RECONCILIACIÓN MES ${modelo}: Datame reinició mes (${monthlyTotal.toFixed(1)} < baseline ${baseline.toFixed(1)}) → Fijando baseline a 0.0 pts`);
      shiftBaselines[key] = 0;
      netoTurno = monthlyTotal;
      await dbUpdateBaseline(idPerfil, fechaDia, jornada, 0, netoTurno);
    } else {
      log(`  ⚠️ ${modelo}: total_mes (${monthlyTotal.toFixed(1)}) < baseline (${baseline.toFixed(1)}), ignorando`);
      return;
    }
  }

  // FIX CUOTA: Ignorar si los puntos no han cambiado desde el último upsert
  if (lastUpsertTotals[key] === monthlyTotal) {
    return;
  }
  lastUpsertTotals[key] = monthlyTotal;

  const { error } = await dbUpsertTurno({
    id_perfil:       idPerfil,
    agencia:         panelNombre,
    puntos:          monthlyTotal,
    puntos_total:    monthlyTotal,
    puntos_baseline: shiftBaselines[key],
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

  let browser;
  try {
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
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

          // Extraer ID del perfil con prioridad a campos específicos
          let id = String(item.member_id || item.profile_id || item.studio_id || item.id || '');
          if (!id || id.length < 7) id = (response.url().match(/\d{7,10}/) || [])[0];
          if (!id || id.length < 7) id = (JSON.stringify(item).match(/\d{7,10}/) || [])[0];
          if (!id || id.length < 7) continue;

          const perfil = perfiles.find(p => p.id_datame === id);
          if (!perfil) {
            // Perfil no registrado — ignorar silenciosamente.
            // El registro de perfiles se hace UNA SOLA VEZ via scripts/insert_profiles_prod.js
            // (GitHub Actions workflow: db_insert.yml → workflow_dispatch)
            continue;
          }

          await upsertTurno(id, pts, perfil.modelo, nombre);
        }
      } catch (err) {
        // Ignorar errores silenciosos de JSON parsing pero reportar si hay algo inusual
      }
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

      // Inyectar rango del mes de forma nativa para actualizar el v-model de Quasar
      const dateInputsIds = await page.evaluate(() => {
        const ins = Array.from(document.querySelectorAll('input[type="text"],input.q-field__native'));
        let dateInputs = ins.filter(i => i.value && /^\\d{4}-\\d{2}-\\d{2}$/.test(i.value.trim()));
        if (dateInputs.length < 2) dateInputs = ins.slice(0, 2);
        
        if (dateInputs.length >= 2) {
          dateInputs[0].id = dateInputs[0].id || 'temp-start-date';
          dateInputs[1].id = dateInputs[1].id || 'temp-end-date';
          return ['#' + dateInputs[0].id, '#' + dateInputs[1].id];
        }
        return [];
      });

      if (dateInputsIds.length === 2) {
        await page.fill(dateInputsIds[0], ''); // Limpiar
        await page.type(dateInputsIds[0], start, { delay: 50 });
        await page.press(dateInputsIds[0], 'Enter');
        await page.waitForTimeout(300);
        
        await page.fill(dateInputsIds[1], ''); // Limpiar
        await page.type(dateInputsIds[1], end, { delay: 50 });
        await page.press(dateInputsIds[1], 'Enter');
        await page.waitForTimeout(800);
      }

      for (const perfil of perfiles) {
        try {
          // Playwright robust locator for Quasar (where label text is in a sibling/parent element)
          const searchLocator = page.locator('label:has-text("Search"), label:has-text("Buscar"), label:has-text("Perfil"), label:has-text("Profile"), label:has-text("ID"), .q-field:has-text("Search"), .q-field:has-text("Buscar"), .q-field:has-text("Perfil")').locator('input').first();
          
          let filled = false;
          if (await searchLocator.isVisible().catch(() => false)) {
            await searchLocator.fill('');
            await searchLocator.type(perfil.id_datame, { delay: 30 });
            await searchLocator.press('Enter');
            filled = true;
          }
          
          if (!filled) {
            // Fallback: try standard DOM attributes
            const backupSelectors = ['input[type="search"]', 'input[placeholder*="search" i]', 'input[placeholder*="buscar" i]', 'input[aria-label*="search" i]'];
            for (const sel of backupSelectors) {
              if (await page.isVisible(sel).catch(() => false)) {
                await page.fill(sel, '');
                await page.type(sel, perfil.id_datame, { delay: 30 });
                await page.press(sel, 'Enter');
                filled = true;
                break;
              }
            }
          }
          
          if (!filled) {
            // Fallback: try to type in the 3rd input using native Playwright locator
            try {
              const inputs = await page.$$('input');
              if (inputs.length >= 3) {
                await inputs[2].fill('');
                await inputs[2].type(perfil.id_datame, { delay: 30 });
                await inputs[2].press('Enter');
                filled = true;
              }
            } catch (e) {
              log(`  ⚠️ Fallback input error: ${e.message}`);
            }
          }
          
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
  } catch (err) {
    log(`❌ Error al inicializar o ejecutar watcher para ${nombre}: ${err.message}`);
    if (browser) {
      try {
        await browser.close();
      } catch (_) {}
    }
  }
}

// ─────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────
(async () => {
  log('⚡ WATCHER MODE iniciado — Agencia RR 2026');
  log(`⏱️  Runtime máx: ${MAX_RUNTIME_MS / 3600000}h | Ciclo: ${CICLO_PAUSA_MS / 60000} min`);
  log(`📅 Rango Datame: ${rangoMesActual().start} → ${rangoMesActual().end} (total mes)`);

  while (Date.now() - startTime < MAX_RUNTIME_MS) {
    const cycleStart = Date.now();
    
    let { data: panels, error: panelsErr } = await supabase.from('datame_panels').select('*').eq('activo', true).order('id');
    
    // 🧠 DELTA-SHIFT™: Cargar perfiles activos, incluyendo aquellos sin panel_id asignado (panel_id is null)
    const { data: allPerfiles, error: perfErr } = await supabase.from('datame_perfiles')
      .select('*')
      .eq('activo', true)
      .order('id');

    if (panelsErr) log(`❌ Error consultando paneles: ${panelsErr.message}`);
    if (perfErr) log(`❌ Error consultando perfiles: ${perfErr.message}`);

    if (panels?.length) {
      // Mapear y sobreescribir con las variables de entorno de GitHub Actions (si existen)
      panels = panels.map(p => {
        const envUser = process.env[`PANEL${p.id}_USER`];
        const envPass = process.env[`PANEL${p.id}_PASS`];
        if (envUser && envPass) {
          return { ...p, email: envUser.trim(), password: envPass.trim() };
        }
        return p;
      }).filter(p => {
        const hasCreds = p.email && p.password;
        if (!hasCreds) {
          log(`[SKIP] ${p.nombre} — Sin credenciales activas configuradas`);
        }
        return hasCreds;
      });

      log(`📡 ${panels.length} paneles activos | ${allPerfiles?.length || 0} perfiles`);

      // 4. Asignar cada perfil a su respectivo watcher/navegador
      log(`🔘 Preparando Watchers...`);
      const panelsPromise = Promise.all(panels.map(panel => {
        // Pasar todos los perfiles activos para garantizar extracción multiplataforma
        const perfiles = (allPerfiles || []).filter(p => p.activo);
      
        if (perfiles.length === 0) {
          log(`📋 PANEL-${panel.id}: 0 perfiles (Omitiendo)`);
          return Promise.resolve();
        }
        log(`📋 PANEL-${panel.id}: Escaneando ${perfiles.length} perfiles activos`);
        return watchPanel(panel, perfiles);
        }));

    } else {
      log('❌ Sin paneles activos en Supabase (o tabla vacía/inactiva)');
    }

    const elapsed = Date.now() - cycleStart;
    const waitTime = Math.max(1000, CICLO_PAUSA_MS - (elapsed % CICLO_PAUSA_MS));
    
    if (Date.now() - startTime + waitTime < MAX_RUNTIME_MS) {
      log(`⏳ Ciclo terminado en ${Math.round(elapsed/1000)}s. Esperando ${Math.round(waitTime/1000)}s para el próximo...`);
      await new Promise(r => setTimeout(r, waitTime));
    } else {
      break;
    }
  }

  log('🏁 WATCHER MODE completado por límite de tiempo. GitHub Actions lo reiniciará automáticamente.');
})();
