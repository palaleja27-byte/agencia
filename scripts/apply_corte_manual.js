/**
 * apply_corte_manual.js
 * ==========================================================
 * PARA QUÉ: Inyectar el corte manual de las 12:00pm en la DB
 * de Supabase. Esto garantiza que todos los operadores de
 * Agencia Romero reciban los puntos EXACTOS del Excel de corte,
 * usando el DELTA-SHIFT™ oficial (puntos_neto = Total - Comienza).
 *
 * POR QUÉ: El watcher corre cada 5min pero puede tener pequeñas
 * diferencias vs el corte oficial de Datame. Este script fuerza
 * los valores oficiales del screenshot/Excel de las 12pm.
 *
 * USO:
 *   node scripts/apply_corte_manual.js
 *
 * REQUISITOS:
 *   - Variables de entorno: SUPABASE_URL, SUPABASE_SERVICE_KEY
 *   - npm install @supabase/supabase-js
 * ==========================================================
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Faltan variables de entorno: SUPABASE_URL y SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

// ─── DATOS DEL CORTE MANUAL 12:00pm — 2026-06-13 ───────────────────
// Fuente: Screenshot del panel Datame (Agencia Romero)
// Columnas: modelo (nombre perfil), comienza (baseline), en_curso (total actual)
// total = en_curso - comienza = puntos netos del turno Mañana
const CORTE_12PM = [
  { modelo: 'RICARDO',          comienza: 3292.38, en_curso: 3469.38 }, // 177.00
  { modelo: 'PABLO',            comienza:  946.08, en_curso:  957.00 }, //  10.92
  { modelo: 'SANDRA MARIA',     comienza:  554.04, en_curso:  576.12 }, //  22.08
  { modelo: 'MURILO',           comienza:   64.80, en_curso:   65.28 }, //   0.48
  { modelo: 'DANIEL 68',        comienza: 3654.14, en_curso: 3812.88 }, // 158.74
  { modelo: 'NORBERTO',         comienza:  410.46, en_curso:  412.62 }, //   2.16
  { modelo: 'RENATA',           comienza:  718.26, en_curso:  739.52 }, //  21.26
  { modelo: 'GUSTAVO',          comienza:   20.46, en_curso:   24.96 }, //   4.50
  { modelo: 'LUCAS',            comienza: 1670.22, en_curso: 1728.78 }, //  58.56
  { modelo: 'LUIS DAROSA',      comienza: 3493.98, en_curso: 3528.66 }, //  34.68
  { modelo: 'HORACIO',          comienza: 1027.26, en_curso: 1064.40 }, //  37.14
  { modelo: 'IVALDO',           comienza: 1027.02, en_curso: 1034.10 }, //   7.08
  { modelo: 'JUVENAL',          comienza:   42.96, en_curso:   43.56 }, //   0.60
  { modelo: 'MARCOS',           comienza:  452.22, en_curso:  454.62 }, //   2.40
  { modelo: 'DAMIAN',           comienza: 4264.44, en_curso: 4380.36 }, // 115.92
  { modelo: 'GERMAN',           comienza:  158.76, en_curso:  172.32 }, //  13.56
  { modelo: 'VALDEMIR',         comienza:  376.08, en_curso:  376.80 }, //   0.72
  { modelo: 'RAFAEL',           comienza:  455.04, en_curso:  474.96 }, //  19.92
  { modelo: 'RAUL',             comienza: 1855.08, en_curso: 1860.24 }, //   5.16
  { modelo: 'ALFREDO',          comienza:  530.88, en_curso:  538.56 }, //   7.68
  { modelo: 'RALPH',            comienza: 1188.90, en_curso: 1227.96 }, //  39.06
  { modelo: 'RAONI',            comienza: 2136.36, en_curso: 2176.68 }, //  40.32
  { modelo: 'VALQUIMAR',        comienza:  132.96, en_curso:  137.04 }, //   4.08
  { modelo: 'MARIO',            comienza:  217.44, en_curso:  220.56 }, //   3.12
  { modelo: 'AGUSTIN',          comienza:   20.76, en_curso:   37.92 }, //  17.16
  { modelo: 'RENEE',            comienza:  102.12, en_curso:  102.12 }, //   0.00
  { modelo: 'HECTOR',           comienza:  265.32, en_curso:  270.36 }, //   5.04
  { modelo: 'FERMIN',           comienza:  236.16, en_curso:  237.96 }, //   1.80
  { modelo: 'FRANCISCO',        comienza:  120.78, en_curso:  121.26 }, //   0.48
  { modelo: 'RODRIGO',          comienza: 1673.88, en_curso: 1704.84 }, //  30.96
  { modelo: 'ROBERTO',          comienza:  153.54, en_curso:  174.42 }, //  20.88
  { modelo: 'AGNALDO',          comienza:  138.84, en_curso:  145.32 }, //   6.48
  { modelo: 'SEBASTIAN',        comienza:  181.80, en_curso:  190.44 }, //   8.64
  { modelo: 'LUIZ',             comienza: 2692.08, en_curso: 2772.66 }, //  80.58
  { modelo: 'AGUSTIN FERNANDO', comienza:  175.14, en_curso:  177.06 }, //   1.92
  { modelo: 'ARMANDO',          comienza:  296.10, en_curso:  308.16 }, //  12.06
  { modelo: 'LEANDRO',          comienza:  314.28, en_curso:  348.24 }, //  33.96
  { modelo: 'FERNANDO',         comienza:  287.28, en_curso:  287.28 }, //   0.00
  { modelo: 'MARCOS ANTONIO',   comienza:  128.52, en_curso:  128.52 }, //   0.00
  { modelo: 'LUIS JOAO',        comienza:  311.22, en_curso:  311.22 }, //   0.00
];

// ─── FECHA Y JORNADA ────────────────────────────────────────────────
function localDateStr() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
}

const HOY     = localDateStr();
const JORNADA = 'Mañana'; // el corte es de 12pm = turno Mañana

// ─── UTILIDADES ─────────────────────────────────────────────────────
function normalizar(s) {
  return (s || '').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ').trim();
}

function round2(n) {
  return Math.round(Number(n) * 100) / 100;
}

// ─── MAIN ────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n🔧 [CORTE MANUAL] Inyectando datos del corte 12pm — ${HOY} [${JORNADA}]`);
  console.log(`📊 Total perfiles en el corte: ${CORTE_12PM.length}`);

  // 1. Cargar todos los perfiles de datame_perfiles (id_datame + modelo)
  const { data: perfiles, error: errPerfiles } = await sb
    .from('datame_perfiles')
    .select('id_datame, modelo, panel_id')
    .eq('activo', true);

  if (errPerfiles || !perfiles) {
    console.error('❌ Error cargando datame_perfiles:', errPerfiles);
    process.exit(1);
  }
  console.log(`✅ ${perfiles.length} perfiles cargados desde datame_perfiles`);

  // Mapa normalizado: nombre → id_datame
  const mapaPerfiles = {};
  perfiles.forEach(p => {
    const clave = normalizar(p.modelo || '');
    if (clave) mapaPerfiles[clave] = p.id_datame;
  });

  // 2. Procesar cada fila del corte
  let ok = 0, sinMatch = 0, errCount = 0;
  const noEncontrados = [];

  for (const fila of CORTE_12PM) {
    const neto = round2(fila.en_curso - fila.comienza);

    // Buscar ID del perfil
    const clave = normalizar(fila.modelo);
    const idPerfil = mapaPerfiles[clave];

    if (!idPerfil) {
      // Intentar búsqueda parcial
      const clavesPosibles = Object.keys(mapaPerfiles).filter(k =>
        k.includes(clave) || clave.includes(k)
      );
      if (clavesPosibles.length === 1) {
        console.log(`⚠️  Match parcial: "${fila.modelo}" → "${clavesPosibles[0]}" (ID: ${mapaPerfiles[clavesPosibles[0]]})`);
        const idFallback = mapaPerfiles[clavesPosibles[0]];
        // Aplicar con el ID fallback
        const r = await upsertOperacion(idFallback, fila, neto);
        if (r) { ok++; } else { errCount++; }
        continue;
      }
      console.warn(`⚠️  SIN MATCH: "${fila.modelo}" | neto=${neto} | Claves similares: ${clavesPosibles.join(', ') || 'ninguna'}`);
      noEncontrados.push(fila.modelo);
      sinMatch++;
      continue;
    }

    const r = await upsertOperacion(idPerfil, fila, neto);
    if (r) { ok++; } else { errCount++; }
  }

  // 3. Reporte final
  console.log('\n════════════════════════════════════════');
  console.log(`✅ Aplicados: ${ok}/${CORTE_12PM.length}`);
  console.log(`⚠️  Sin match: ${sinMatch}`);
  console.log(`❌ Errores:   ${errCount}`);
  const totalNeto = CORTE_12PM.reduce((s, f) => s + round2(f.en_curso - f.comienza), 0);
  console.log(`📊 Total neto corte: ${round2(totalNeto)} pts (esperado ≈965.22)`);

  if (noEncontrados.length > 0) {
    console.log('\n📋 Perfiles SIN MATCH (verificar nombre en datame_perfiles):');
    noEncontrados.forEach(n => console.log(`   - "${n}"`));
    console.log('\nEjecuta esto en Supabase para ver los nombres exactos:');
    console.log('  SELECT id_datame, modelo FROM datame_perfiles WHERE activo = true ORDER BY modelo;');
  }
}

async function upsertOperacion(idPerfil, fila, neto) {
  const payload = {
    id_perfil:        String(idPerfil),
    fecha_dia:        HOY,
    jornada:          JORNADA,
    puntos_total:     round2(fila.en_curso),
    puntos_baseline:  round2(fila.comienza),
    puntos_neto:      Math.max(0, neto),
    agencia:          'ROMERO',
    // Preservar fecha_corte actual si ya existe
    fecha_corte:      new Date().toISOString(),
  };

  const { error } = await sb
    .from('operaciones')
    .upsert(payload, {
      onConflict: 'id_perfil,fecha_dia,jornada',
      ignoreDuplicates: false, // ACTUALIZAR si ya existe
    });

  if (error) {
    console.error(`❌ Error upsert "${fila.modelo}" (${idPerfil}):`, error.message);
    return false;
  }

  const signo = neto > 0 ? '+' : '';
  console.log(`✅ ${fila.modelo.padEnd(18)} | baseline=${fila.comienza} | total=${fila.en_curso} | neto=${signo}${neto}`);
  return true;
}

main().catch(e => {
  console.error('❌ Error fatal:', e);
  process.exit(1);
});
