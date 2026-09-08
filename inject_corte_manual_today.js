// inject_corte_manual_today.js
// Inyecta el corte manual de hoy (2026-09-08 12:00 PM) para estabilizar baselines del turno Mañana

const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://bhewmidnkldjpdnvassj.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJoZXdtaWRua2xkanBkbnZhc3NqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU0NjMyNzAsImV4cCI6MjEwMTAzOTI3MH0.4DXjV8jH9Yj0jwNPg2DvRCqTgObiKULGCxFRf0lwIpI';

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const CORTE_MANUAL_HOY = [
  // Tabla 1 (12:00 PM)
  { id: '98540781', modelo: 'LEANDRO', comienza: 136.46, en_curso: 143.60, total: 7.14, panel: 'PANEL-2' },
  { id: '95956014', modelo: 'PABLO', comienza: 295.88, en_curso: 303.36, total: 7.48, panel: 'PANEL-2' },
  { id: '91360720', modelo: 'SANDRA MARIA', comienza: 129.31, en_curso: 129.75, total: 0.44, panel: 'PANEL-1' },
  { id: '91733663', modelo: 'DANIEL 68', comienza: 2864.99, en_curso: 2908.66, total: 43.67, panel: 'PANEL-2' },
  { id: '79679899', modelo: 'NORBERTO', comienza: 293.81, en_curso: 302.62, total: 8.81, panel: 'PANEL-3' },
  { id: '99766806', modelo: 'EDUARDO', comienza: 545.02, en_curso: 548.88, total: 3.86, panel: 'PANEL-2' },
  { id: '168486464', modelo: 'GUSTAVO A', comienza: 644.46, en_curso: 669.42, total: 24.96, panel: 'PANEL-2' },
  { id: '108018336', modelo: 'LUCAS', comienza: 762.64, en_curso: 795.03, total: 32.39, panel: 'PANEL-3' },
  { id: '103289167', modelo: 'LUIS', comienza: 919.52, en_curso: 940.75, total: 21.23, panel: 'PANEL-2' },
  { id: '118179794', modelo: 'HORACIO', comienza: 656.65, en_curso: 664.13, total: 7.48, panel: 'PANEL-3' },
  { id: '157112125', modelo: 'LUIZ', comienza: 86.95, en_curso: 88.82, total: 1.87, panel: 'PANEL-2' },
  { id: '120720195', modelo: 'MARCOS', comienza: 1420.66, en_curso: 1458.62, total: 37.96, panel: 'PANEL-3' },
  { id: '139247498', modelo: 'DAMIAN', comienza: 770.17, en_curso: 793.99, total: 23.82, panel: 'PANEL-3' },
  { id: '120275229', modelo: 'GERMAN', comienza: 43.23, en_curso: 43.78, total: 0.55, panel: 'PANEL-3' },
  { id: '130338853', modelo: 'IVALDO', comienza: 273.55, en_curso: 285.32, total: 11.77, panel: 'PANEL-3' },
  { id: '130431310', modelo: 'RAFAEL', comienza: 198.03, en_curso: 219.92, total: 21.89, panel: 'PANEL-2' },
  { id: '98389135', modelo: 'RAUL', comienza: 89.78, en_curso: 93.85, total: 4.07, panel: 'PANEL-2' },
  { id: '139245989', modelo: 'ALFREDO', comienza: 503.60, en_curso: 541.43, total: 37.83, panel: 'PANEL-3' },
  { id: '156881990', modelo: 'RALPH', comienza: 128.35, en_curso: 130.88, total: 2.53, panel: 'PANEL-3' },
  { id: '143017065', modelo: 'MARIO', comienza: 314.62, en_curso: 315.28, total: 0.66, panel: 'PANEL-3' },
  { id: '138130329', modelo: 'AGUSTIN', comienza: 421.81, en_curso: 447.33, total: 25.52, panel: 'PANEL-4' },
  { id: '143014129', modelo: 'RENEE', comienza: 278.89, en_curso: 283.07, total: 4.18, panel: 'PANEL-4' },
  { id: '95955130', modelo: 'HECTOR', comienza: 389.95, en_curso: 390.17, total: 0.22, panel: 'PANEL-2' },
  { id: '145844971', modelo: 'RODRIGO', comienza: 1359.07, en_curso: 1385.58, total: 26.51, panel: 'PANEL-3' },
  { id: '170740935', modelo: 'ROBERTO', comienza: 1109.26, en_curso: 1137.25, total: 27.99, panel: 'PANEL-2' },
  { id: '130422416', modelo: 'RAONI', comienza: 1012.85, en_curso: 1085.89, total: 73.04, panel: 'PANEL-3' },
  { id: '160352260', modelo: 'JUVENAL', comienza: 9.10, en_curso: 9.43, total: 0.33, panel: 'PANEL-2' },
  { id: '103291980', modelo: 'ARMANDO', comienza: 78.72, en_curso: 79.16, total: 0.44, panel: 'PANEL-2' },
  { id: '187684981', modelo: 'CARLOS', comienza: 11.33, en_curso: 11.33, total: 0.00, panel: 'PANEL-2' },
  { id: '187538072', modelo: 'VALERIA', comienza: 3.52, en_curso: 3.52, total: 0.00, panel: 'PANEL-2' },
  { id: '187536756', modelo: 'MAY', comienza: 0.00, en_curso: 0.00, total: 0.00, panel: 'PANEL-2' },
  { id: '187536112', modelo: 'MARIELYS', comienza: 0.00, en_curso: 0.00, total: 0.00, panel: 'PANEL-2' },

  // Tabla 2 (12:00 PM)
  { id: '158644203', modelo: 'SERGIO', comienza: 62.20, en_curso: 64.52, total: 2.32, panel: 'PANEL-2' },
  { id: '128062998', modelo: 'MARCO', comienza: 1098.01, en_curso: 1101.31, total: 3.30, panel: 'PANEL-2' },
  { id: '174069335', modelo: 'FEDERICO', comienza: 240.88, en_curso: 242.09, total: 1.21, panel: 'PANEL-2' },
  { id: '101245945', modelo: 'PABLO B', comienza: 810.52, en_curso: 817.39, total: 6.87, panel: 'PANEL-2' },
  { id: '167493871', modelo: 'HUMBERTO', comienza: 56.16, en_curso: 58.69, total: 2.53, panel: 'PANEL-2' },
  { id: '113579174', modelo: 'RONALDO', comienza: 15.89, en_curso: 16.34, total: 0.45, panel: 'PANEL-2' },
  { id: '145839775', modelo: 'BRUNO', comienza: 415.75, en_curso: 427.52, total: 11.77, panel: 'PANEL-2' },
  { id: '113752797', modelo: 'ROMARIO', comienza: 77.16, en_curso: 77.27, total: 0.11, panel: 'PANEL-2' },
  { id: '153037229', modelo: 'HORACIO B', comienza: 158.82, en_curso: 163.83, total: 5.01, panel: 'PANEL-2' },
  { id: '93461947', modelo: 'MARIANO', comienza: 100.47, en_curso: 103.66, total: 3.19, panel: 'PANEL-2' }
];

// Generar archivo SQL
function generateSQL() {
  let sql = '-- CORTE MANUAL 2026-09-08 12:00 PM (Turno Mañana)\n';
  sql += '-- Ejecutar en Supabase Dashboard > SQL Editor para fijar baselines exactos de hoy\n\n';

  CORTE_MANUAL_HOY.forEach(c => {
    sql += `INSERT INTO operaciones (id_perfil, puntos_baseline, puntos_total, puntos_neto, fecha_dia, jornada, agencia, fecha_corte)\n`;
    sql += `VALUES ('${c.id}', ${c.comienza}, ${c.en_curso}, ${c.total}, '2026-09-08', 'Mañana', '${c.panel}', NOW())\n`;
    sql += `ON CONFLICT (id_perfil, fecha_dia, jornada) DO UPDATE SET\n`;
    sql += `  puntos_baseline = EXCLUDED.puntos_baseline,\n`;
    sql += `  puntos_total = EXCLUDED.puntos_total,\n`;
    sql += `  puntos_neto = EXCLUDED.puntos_neto,\n`;
    sql += `  fecha_corte = NOW();\n\n`;
  });

  fs.writeFileSync('sql/corte_manual_2026-09-08_12pm.sql', sql, 'utf8');
  console.log('✅ Archivo SQL generado: sql/corte_manual_2026-09-08_12pm.sql (' + CORTE_MANUAL_HOY.length + ' registros)');
}

async function injectSupabase() {
  console.log(`📡 Intentando inyectar ${CORTE_MANUAL_HOY.length} registros a Supabase...`);
  const payloads = CORTE_MANUAL_HOY.map(c => ({
    id_perfil: c.id,
    puntos_baseline: c.comienza,
    puntos_total: c.en_curso,
    puntos_neto: c.total,
    fecha_dia: '2026-09-08',
    jornada: 'Mañana',
    agencia: c.panel,
    fecha_corte: new Date().toISOString()
  }));

  try {
    const { data, error } = await Promise.race([
      sb.from('operaciones').upsert(payloads, { onConflict: 'id_perfil,fecha_dia,jornada' }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Supabase Timeout (10s)')), 10000))
    ]);
    if (error) {
      console.error('❌ Error al insertar en Supabase:', error.message);
    } else {
      console.log('✅ Registros inyectados exitosamente en Supabase');
    }
  } catch (err) {
    console.warn('⚠️ Supabase no respondió (' + err.message + '). El archivo SQL quedó disponible para ejecutar manualmente.');
  }
}

generateSQL();
injectSupabase();
