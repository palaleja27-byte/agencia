/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  REGISTRO MAESTRO DE PERFILES — AgenciaRR 2026              ║
 * ║  Usa SUPABASE_SERVICE_KEY con bypass de RLS                  ║
 * ║  Ejecutar UNA SOLA VEZ via GitHub Actions (workflow_dispatch) ║
 * ╚══════════════════════════════════════════════════════════════╝
 *
 * PANEL MAP (Datame → Supabase panel_id):
 *   PANEL-1 → panel_id: 1  (env: PANEL1_USER / PANEL1_PASS)
 *   PANEL-2 → panel_id: 2  (env: PANEL2_USER / PANEL2_PASS)
 *   PANEL-3 → panel_id: 3  (env: PANEL3_USER / PANEL3_PASS)
 *   PANEL-4 → panel_id: 4  (env: PANEL4_USER / PANEL4_PASS)
 */

const SUPABASE_URL         = process.env.SUPABASE_URL         || 'https://vpyzpjgctidqmhqjboxq.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || '';

if (!SUPABASE_SERVICE_KEY) {
  console.error('❌ FATAL: SUPABASE_SERVICE_KEY is not set. Aborting.');
  process.exit(1);
}

// ─── VERIFICAR ROL DE LA CLAVE ────────────────────────────────────────────────
function decodeJwtPayload(token) {
  try {
    const b64 = token.split('.')[1];
    return JSON.parse(Buffer.from(b64, 'base64url').toString('utf8'));
  } catch {
    return {};
  }
}

const payload = decodeJwtPayload(SUPABASE_SERVICE_KEY);
console.log(`🔑 JWT role: ${payload.role || 'unknown'} | iss: ${payload.iss || 'unknown'}`);

if (payload.role !== 'service_role') {
  console.error(`⚠️  WARNING: La clave JWT tiene rol "${payload.role}" en lugar de "service_role".`);
  console.error(`   Los inserts podrían fallar por RLS. Verifica el secret SUPABASE_SERVICE_KEY en GitHub.`);
}

// ─── HELPERS REST DIRECTOS (fetch nativo, sin SDK Supabase) ──────────────────
// Usamos fetch directo para garantizar los headers correctos de bypass RLS
const baseHeaders = {
  'Content-Type':   'application/json',
  'apikey':         SUPABASE_SERVICE_KEY,
  'Authorization':  `Bearer ${SUPABASE_SERVICE_KEY}`,
  'Prefer':         'return=representation'
};

async function sbSelect(table, filters = {}) {
  let url = `${SUPABASE_URL}/rest/v1/${table}?select=*`;
  for (const [key, val] of Object.entries(filters)) {
    url += `&${key}=eq.${encodeURIComponent(val)}`;
  }
  const res = await fetch(url, { headers: baseHeaders });
  if (!res.ok) throw new Error(`SELECT ${table} failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function sbUpsert(table, rows) {
  const url = `${SUPABASE_URL}/rest/v1/${table}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { ...baseHeaders, 'Prefer': 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify(Array.isArray(rows) ? rows : [rows])
  });
  if (!res.ok) throw new Error(`UPSERT ${table} failed: ${res.status} ${await res.text()}`);
  return res.json();
}

// ─── LISTADO MAESTRO DE PERFILES ─────────────────────────────────────────────
// Fuente de verdad: operatorsData en index.html + perfiles_status.md
// Todos los perfiles conocidos de la agencia, agrupados por panel Datame.
//
// CRITERIO DE PANEL:
//   Los perfiles que aparecen en el PANEL-2 de la cuenta antigua están en panel_id=2
//   Los que están en el PANEL-3 (cuenta separada) están en panel_id=3
//   PANEL-4 corresponde a los perfiles del 4to panel de Datame
//
const ALL_PROFILES = [
  // ── PANEL 1 ──────────────────────────────────────────────────────────────
  { id_datame: '91360720',  modelo: 'SANDRA MARIA',       panel_id: 1, activo: true },

  // ── PANEL 2 ──────────────────────────────────────────────────────────────
  { id_datame: '95956014',  modelo: 'PABLO',              panel_id: 2, activo: true },
  { id_datame: '91733663',  modelo: 'DANIEL 68',          panel_id: 2, activo: true },
  { id_datame: '153039388', modelo: 'AGUSTIN FERNANDO',   panel_id: 2, activo: true },
  { id_datame: '95955130',  modelo: 'HECTOR',             panel_id: 2, activo: true },
  { id_datame: '103289167', modelo: 'LUIS',               panel_id: 2, activo: true },
  { id_datame: '98389135',  modelo: 'RAUL',               panel_id: 2, activo: true },
  { id_datame: '98540781',  modelo: 'LEANDRO',            panel_id: 2, activo: true },
  { id_datame: '157067734', modelo: 'VALDEMIR',           panel_id: 2, activo: true },
  { id_datame: '103291980', modelo: 'ARMANDO',            panel_id: 2, activo: true },
  { id_datame: '130431310', modelo: 'RAFAEL',             panel_id: 2, activo: true },
  { id_datame: '151070498', modelo: 'VALQUIMAR',          panel_id: 2, activo: true },
  { id_datame: '143014129', modelo: 'RENEE',              panel_id: 2, activo: true },
  { id_datame: '156716207', modelo: 'AGNALDO',            panel_id: 2, activo: true },
  { id_datame: '113579174', modelo: 'RONALDO',            panel_id: 2, activo: true },
  { id_datame: '93461947',  modelo: 'MARIANO',            panel_id: 2, activo: true },
  { id_datame: '164812184', modelo: 'MARCO',              panel_id: 2, activo: true },
  { id_datame: '158644203', modelo: 'SERGIO',             panel_id: 2, activo: true },
  { id_datame: '99611942',  modelo: 'PAOLA',              panel_id: 2, activo: true },
  { id_datame: '113752797', modelo: 'ROMARIO',            panel_id: 2, activo: true },
  { id_datame: '101245945', modelo: 'PABLO B',            panel_id: 2, activo: true },
  { id_datame: '114851358', modelo: 'JOHANNA',            panel_id: 2, activo: true },
  { id_datame: '151410237', modelo: 'EZEQUIEL',           panel_id: 2, activo: true },
  { id_datame: '145839775', modelo: 'BRUNO',              panel_id: 2, activo: true },
  { id_datame: '157112125', modelo: 'LUIZ',               panel_id: 2, activo: true },
  { id_datame: '160352260', modelo: 'JUVENAL',            panel_id: 2, activo: true },
  { id_datame: '118404407', modelo: 'MILENA',             panel_id: 2, activo: true },
  { id_datame: '132062039', modelo: 'BEATRIZ',            panel_id: 2, activo: true },
  { id_datame: '166575347', modelo: 'MAX',                panel_id: 2, activo: true },
  { id_datame: '170740935', modelo: 'ROBERTO',            panel_id: 2, activo: true },
  { id_datame: '171638277', modelo: 'RONALT',             panel_id: 2, activo: true },
  { id_datame: '167279664', modelo: 'JOSE ROBERTO',       panel_id: 2, activo: true },
  { id_datame: '167273716', modelo: 'ARIEL HERNAN',       panel_id: 2, activo: true },
  { id_datame: '153037229', modelo: 'HORACIO B',          panel_id: 2, activo: true },
  { id_datame: '168486464', modelo: 'GUSTAVO A',          panel_id: 2, activo: true },

  // ── PANEL 3 ──────────────────────────────────────────────────────────────
  { id_datame: '88243516',  modelo: 'RICARDO',            panel_id: 3, activo: true },
  { id_datame: '79679899',  modelo: 'NORBERTO',           panel_id: 3, activo: true },
  { id_datame: '118692242', modelo: 'FRANCISCO',          panel_id: 3, activo: true },
  { id_datame: '109551682', modelo: 'RENATO',             panel_id: 3, activo: true },
  { id_datame: '108018336', modelo: 'LUCAS',              panel_id: 3, activo: true },
  { id_datame: '118179794', modelo: 'HORACIO',            panel_id: 3, activo: true },
  { id_datame: '130338853', modelo: 'IVALDO',             panel_id: 3, activo: true },
  { id_datame: '137163229', modelo: 'SEBASTIAN',          panel_id: 3, activo: true },
  { id_datame: '120720195', modelo: 'MARCOS',             panel_id: 3, activo: true },
  { id_datame: '139247498', modelo: 'DAMIAN',             panel_id: 3, activo: true },
  { id_datame: '139245989', modelo: 'ALFREDO',            panel_id: 3, activo: true },
  { id_datame: '120275229', modelo: 'GERMAN',             panel_id: 3, activo: true },
  { id_datame: '156881990', modelo: 'RALPH',              panel_id: 3, activo: true },
  { id_datame: '130422416', modelo: 'RAONI',              panel_id: 3, activo: true },
  { id_datame: '143017065', modelo: 'MARIO',              panel_id: 3, activo: true },
  { id_datame: '145211163', modelo: 'FERMIN',             panel_id: 3, activo: true },
  { id_datame: '145834230', modelo: 'MURILO',             panel_id: 3, activo: true },
  { id_datame: '145844971', modelo: 'RODRIGO',            panel_id: 3, activo: true },
  { id_datame: '101652076', modelo: 'CARINA',             panel_id: 3, activo: true },
  { id_datame: '160951610', modelo: 'GUSTAVO',            panel_id: 3, activo: true },

  // ── PANEL 4 ──────────────────────────────────────────────────────────────
  { id_datame: '131130713', modelo: 'LUIS JOAO',          panel_id: 4, activo: true },
  { id_datame: '138130329', modelo: 'AGUSTIN',            panel_id: 4, activo: true },
  { id_datame: '133085188', modelo: 'MARCOS ANTONIO',     panel_id: 4, activo: true },
  { id_datame: '144863124', modelo: 'FERNANDO',           panel_id: 4, activo: true },
  { id_datame: '145211163', modelo: 'FERMIN B',           panel_id: 4, activo: true },
  { id_datame: '143014129', modelo: 'RENEE B',            panel_id: 4, activo: true },
  { id_datame: '143017065', modelo: 'MARIO B',            panel_id: 4, activo: true },
  { id_datame: '95955130',  modelo: 'HECTOR B',           panel_id: 4, activo: true },
];

// ─── EJECUCIÓN PRINCIPAL ──────────────────────────────────────────────────────
async function run() {
  console.log(`\n╔══════════════════════════════════════════╗`);
  console.log(`║  REGISTRO MAESTRO DE PERFILES — RR 2026  ║`);
  console.log(`╚══════════════════════════════════════════╝\n`);

  // ── Sincronizar Paneles de Tableau ──
  console.log(`\n📊 Sincronizando tabla tableau_panels...`);
  try {
    const panelsToRegister = [
      {
        id: 1,
        nombre: 'ROMERO OFICIAL',
        server: 'https://prod-uk-a.online.tableau.com',
        site: 'partnerdata',
        view_name: 'Revenuedetailed',
        token_name: 'Analytics',
        activo: true
      },
      {
        id: 2,
        nombre: 'ROMERO ICES',
        server: 'https://prod-uk-a.online.tableau.com',
        site: 'partnerdata',
        view_name: 'Chaticeswithoutphoto',
        token_name: 'Analytics',
        activo: true
      }
    ];
    await sbUpsert('tableau_panels', panelsToRegister);
    console.log(`✅ tableau_panels sincronizados con éxito (ROMERO OFICIAL & ROMERO ICES).`);
  } catch (panelErr) {
    console.error(`⚠️ Error registrando tableau_panels (revisar políticas):`, panelErr.message);
  }

  console.log(`📋 Total perfiles a sincronizar: ${ALL_PROFILES.length}`);

  // Cargar todos los perfiles existentes en DB para comparar
  console.log(`\n🔍 Leyendo tabla datame_perfiles...`);
  let existingInDB = [];
  try {
    existingInDB = await sbSelect('datame_perfiles', {});
  } catch (err) {
    console.error(`❌ No se pudo leer datame_perfiles:`, err.message);
    process.exit(1);
  }

  const existingIds = new Set(existingInDB.map(p => p.id_datame));
  console.log(`✅ ${existingInDB.length} perfiles encontrados en BD.\n`);

  const toInsert  = ALL_PROFILES.filter(p => !existingIds.has(p.id_datame));
  const toUpdate  = ALL_PROFILES.filter(p =>  existingIds.has(p.id_datame));

  console.log(`➕ Perfiles NUEVOS a insertar: ${toInsert.length}`);
  console.log(`🔄 Perfiles EXISTENTES a actualizar: ${toUpdate.length}`);

  let ok = 0, fail = 0;

  // ── INSERTAR NUEVOS ────────────────────────────────────────────
  if (toInsert.length > 0) {
    console.log(`\n── INSERTANDO NUEVOS ─────────────────────────────────`);
    for (const p of toInsert) {
      try {
        const result = await sbUpsert('datame_perfiles', p);
        console.log(`  ✅ INSERT OK: ${p.modelo} (${p.id_datame}) → PANEL-${p.panel_id}`);
        ok++;
      } catch (err) {
        console.error(`  ❌ INSERT FAIL: ${p.modelo} (${p.id_datame}): ${err.message}`);
        fail++;
      }
    }
  }

  // ── ACTUALIZAR EXISTENTES (panel_id + activo) ─────────────────
  if (toUpdate.length > 0) {
    console.log(`\n── ACTUALIZANDO EXISTENTES ────────────────────────────`);
    for (const p of toUpdate) {
      const existing = existingInDB.find(e => e.id_datame === p.id_datame);
      const needsUpdate = existing && (
        existing.panel_id !== p.panel_id ||
        existing.activo   !== p.activo   ||
        existing.modelo   !== p.modelo
      );
      if (!needsUpdate) {
        console.log(`  ↔️  SIN CAMBIOS: ${p.modelo} (${p.id_datame})`);
        continue;
      }
      try {
        const url = `${SUPABASE_URL}/rest/v1/datame_perfiles?id_datame=eq.${p.id_datame}`;
        const res = await fetch(url, {
          method: 'PATCH',
          headers: { ...baseHeaders, 'Prefer': 'return=representation' },
          body: JSON.stringify({ panel_id: p.panel_id, activo: p.activo, modelo: p.modelo })
        });
        if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
        console.log(`  🔄 UPDATE OK: ${p.modelo} (${p.id_datame}) → PANEL-${p.panel_id}`);
        ok++;
      } catch (err) {
        console.error(`  ❌ UPDATE FAIL: ${p.modelo}: ${err.message}`);
        fail++;
      }
    }
  }

  console.log(`\n╔══════════════════════════╗`);
  console.log(`║  RESUMEN FINAL           ║`);
  console.log(`║  ✅ Exitosos:  ${String(ok).padEnd(10)}║`);
  console.log(`║  ❌ Fallidos:  ${String(fail).padEnd(10)}║`);
  console.log(`╚══════════════════════════╝\n`);

  if (fail > 0) {
    console.error(`⚠️  Hubo ${fail} errores. Verifica que SUPABASE_SERVICE_KEY sea la clave "service_role" (no "anon").`);
    process.exit(1);
  }
}

run().catch(err => {
  console.error('💥 Error fatal:', err);
  process.exit(1);
});
