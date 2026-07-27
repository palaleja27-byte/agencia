const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://vpyzpjgctidqmhqjboxq.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZweXpwamdjdGlkcW1ocWpib3hxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI3NTk3MDcsImV4cCI6MjA4ODMzNTcwN30.84hij4AgUD_ughF-xocWVFisq4niL2YsSI9yPfbFPj0';

const sb = createClient(SUPABASE_URL, SUPABASE_ANON);

// Datos exactos extraídos de la tabla manual de las 4:00 AM
const corte4AM = [
  { id: 88243516,  nombre: 'RICARDO',          comienza: 1920.54, enCurso: 1931.58, neto: 11.04 },
  { id: 95956014,  nombre: 'PABLO',            comienza: 950.10,  enCurso: 951.78,  neto: 1.68 },
  { id: 91360720,  nombre: 'SANDRA MARIA',     comienza: 504.72,  enCurso: 508.44,  neto: 3.72 },
  { id: 91733663,  nombre: 'DANIEL 68',        comienza: 12852.36,enCurso: 12934.80,neto: 82.44 },
  { id: 79679899,  nombre: 'NORBERTO',         comienza: 922.08,  enCurso: 922.68,  neto: 0.60 },
  { id: 99766806,  nombre: 'EDUARDO',          comienza: 1629.84, enCurso: 1633.20, neto: 3.36 },
  { id: 168486464, nombre: 'GUSTAVO',          comienza: 1122.18, enCurso: 1125.06, neto: 2.88 },
  { id: 108018336, nombre: 'LUCAS',            comienza: 4514.58, enCurso: 4531.38, neto: 16.80 },
  { id: 103289167, nombre: 'LUIS DAROSA',      comienza: 3438.30, enCurso: 3454.14, neto: 15.84 },
  { id: 118179794, nombre: 'HORACIO',          comienza: 3012.66, enCurso: 3020.22, neto: 7.56 },
  { id: 157112125, nombre: 'LUIZ',             comienza: 2910.90, enCurso: 2912.34, neto: 1.44 },
  { id: 103291980, nombre: 'ARMANDO',          comienza: 360.12,  enCurso: 360.24,  neto: 0.12 },
  { id: 120720195, nombre: 'MARCOS',           comienza: 9919.14, enCurso: 9961.74, neto: 42.60 },
  { id: 139247498, nombre: 'DAMIAN',           comienza: 2120.70, enCurso: 2139.72, neto: 19.02 },
  { id: 120275229, nombre: 'GERMAN',           comienza: 508.26,  enCurso: 508.38,  neto: 0.12 },
  { id: 130338853, nombre: 'IVALDO',           comienza: 1737.84, enCurso: 1750.68, neto: 12.84 },
  { id: 130431310, nombre: 'RAFAEL',           comienza: 1398.00, enCurso: 1403.64, neto: 5.64 },
  { id: 98389135,  nombre: 'RAUL',             comienza: 2002.92, enCurso: 2006.34, neto: 3.42 },
  { id: 139245989, nombre: 'ALFREDO',          comienza: 2423.28, enCurso: 2438.34, neto: 15.06 },
  { id: 156881990, nombre: 'RALPH',            comienza: 390.18,  enCurso: 390.78,  neto: 0.60 },
  { id: 137163229, nombre: 'SEBASTIAN',        comienza: 217.08,  enCurso: 221.28,  neto: 4.20 },
  { id: 143017065, nombre: 'MARIO',            comienza: 366.24,  enCurso: 369.12,  neto: 2.88 },
  { id: 138130329, nombre: 'AGUSTIN',          comienza: 3461.16, enCurso: 3479.34, neto: 18.18 },
  { id: 143014129, nombre: 'RENEE',            comienza: 373.32,  enCurso: 414.60,  neto: 41.28 },
  { id: 95955130,  nombre: 'HECTOR',           comienza: 1185.48, enCurso: 1191.12, neto: 5.64 },
  { id: 145211163, nombre: 'FERMIN',           comienza: 389.34,  enCurso: 391.02,  neto: 1.68 },
  { id: 145844971, nombre: 'RODRIGO',          comienza: 2621.22, enCurso: 2648.82, neto: 27.60 },
  { id: 170740935, nombre: 'ROBERTO',          comienza: 5879.46, enCurso: 5904.90, neto: 25.44 },
  { id: 130422416, nombre: 'RAONI',            comienza: 3054.96, enCurso: 3057.60, neto: 2.64 },
  { id: 160352260, nombre: 'JUVENAL',          comienza: 503.16,  enCurso: 503.76,  neto: 0.60 },
  { id: 157067734, nombre: 'VALDEMIR',         comienza: 208.80,  enCurso: 209.88,  neto: 1.08 },
  { id: 153039388, nombre: 'AGUSTIN FERNANDO', comienza: 352.86,  enCurso: 353.22,  neto: 0.36 },
  { id: 109551682, nombre: 'RENATO',           comienza: 579.48,  enCurso: 582.36,  neto: 2.88 },
  { id: 98540781,  nombre: 'LEANDRO',          comienza: 1141.44, enCurso: 1143.72, neto: 2.28 }
];

async function calibrate() {
  const fechaDia = '2026-07-26'; // Noche shift 10pm-6am
  console.log(`🚀 Iniciando calibración de 34 perfiles para Noche (${fechaDia})...`);

  let updated = 0;
  let totalComienza = 0;
  let totalEnCurso = 0;
  let totalNeto = 0;

  for (const item of corte4AM) {
    totalComienza += item.comienza;
    totalEnCurso += item.enCurso;
    totalNeto += item.neto;

    const { data, error } = await sb
      .from('operaciones')
      .update({
        puntos_baseline: item.comienza,
        puntos_total: item.enCurso,
        puntos_neto: item.neto,
        puntos: item.enCurso
      })
      .eq('fecha_dia', fechaDia)
      .eq('id_perfil', item.id);

    if (error) {
      console.warn(`⚠️ Error al actualizar ID ${item.id} (${item.nombre}):`, error.message);
    } else {
      updated++;
    }
  }

  console.log(`\n✅ ${updated}/${corte4AM.length} perfiles actualizados en Supabase Cloud.`);
  console.log(`📊 TOTAL COMIENZA: ${totalComienza.toFixed(2)} pts`);
  console.log(`📊 TOTAL EN CURSO: ${totalEnCurso.toFixed(2)} pts (Esperado: 75356.22)`);
  console.log(`📊 TOTAL NETO TURNO: ${totalNeto.toFixed(2)} pts (Esperado: 383.52)`);
}

calibrate();
