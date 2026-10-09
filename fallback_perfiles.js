// fallback_perfiles.js
// Catálogo de respaldo para Watcher y Scraper cuando Supabase no responde (Error 522 / Timeout)

const FALLBACK_PANELS_BASE = [
  { id: 1, nombre: 'PANEL-1', activo: true, envUserKey: 'PANEL1_USER', envPassKey: 'PANEL1_PASS' },
  { id: 2, nombre: 'PANEL-2', activo: true, envUserKey: 'PANEL2_USER', envPassKey: 'PANEL2_PASS' },
  { id: 3, nombre: 'PANEL-3', activo: true, envUserKey: 'PANEL3_USER', envPassKey: 'PANEL3_PASS' },
  { id: 4, nombre: 'PANEL-4', activo: true, envUserKey: 'PANEL4_USER', envPassKey: 'PANEL4_PASS' },
];

function getFallbackPanels() {
  return FALLBACK_PANELS_BASE.map(p => {
    const email = (process.env[p.envUserKey] || '').trim();
    const password = (process.env[p.envPassKey] || '').trim();
    return {
      id: p.id,
      nombre: p.nombre,
      activo: true,
      email,
      password
    };
  }).filter(p => p.email && p.password);
}

const FALLBACK_PERFILES = [
  // ═════════════════════════════════════════════════════════════════
  // 🌟 LISTADO OFICIAL 28 PERFILES AGENCIA RR (SEPTIEMBRE 2026)
  // ═════════════════════════════════════════════════════════════════
  { id_datame: '91360720',  modelo: 'SANDRA MARIA', panel_id: 1, activo: true },
  { id_datame: '91733663',  modelo: 'DANIEL 68',    panel_id: 2, activo: true },
  { id_datame: '79679899',  modelo: 'NORBERTO',     panel_id: 2, activo: true },
  { id_datame: '99766806',  modelo: 'EDUARDO',      panel_id: 2, activo: true },
  { id_datame: '168486464', modelo: 'GUSTAVO',      panel_id: 2, activo: true },
  { id_datame: '108018336', modelo: 'LUCAS',        panel_id: 2, activo: true },
  { id_datame: '103289167', modelo: 'LUIS DAROSA',  panel_id: 2, activo: true },
  { id_datame: '118179794', modelo: 'HORACIO',      panel_id: 2, activo: true },
  { id_datame: '98389135',  modelo: 'RAUL',         panel_id: 2, activo: true },
  { id_datame: '120720195', modelo: 'MARCOS',       panel_id: 2, activo: true },
  { id_datame: '139247498', modelo: 'DAMIAN',       panel_id: 2, activo: true },
  { id_datame: '157112125', modelo: 'LUIZ',         panel_id: 2, activo: true },
  { id_datame: '130338853', modelo: 'IVALDO',       panel_id: 2, activo: true },
  { id_datame: '130431310', modelo: 'RAFAEL',       panel_id: 2, activo: true },
  { id_datame: '139245989', modelo: 'ALFREDO',      panel_id: 2, activo: true },
  { id_datame: '188143166', modelo: 'ALEX',         panel_id: 2, activo: true },
  { id_datame: '156881990', modelo: 'RALPH',        panel_id: 2, activo: true },
  { id_datame: '143017065', modelo: 'MARIO',        panel_id: 2, activo: true },
  { id_datame: '138130329', modelo: 'AGUSTIN',      panel_id: 2, activo: true },
  { id_datame: '95956014',  modelo: 'PABLO',        panel_id: 2, activo: true },
  { id_datame: '98540781',  modelo: 'LEANDRO',      panel_id: 2, activo: true },
  { id_datame: '143014129', modelo: 'RENEE',        panel_id: 2, activo: true },
  { id_datame: '95955130',  modelo: 'HECTOR',       panel_id: 2, activo: true },
  { id_datame: '145844971', modelo: 'RODRIGO',      panel_id: 2, activo: true },
  { id_datame: '170740935', modelo: 'ROBERTO',      panel_id: 2, activo: true },
  { id_datame: '187684981', modelo: 'CARLOS',       panel_id: 2, activo: true },
  { id_datame: '130422416', modelo: 'RAONI',        panel_id: 2, activo: true },
  { id_datame: '120275229', modelo: 'GERMAN',       panel_id: 2, activo: true }
];

// ── CORTE MANUAL 12:00 PM (Fuente Oficial) ──
const CORTE_MANUAL_BASELINES = {
  // Tabla 1 (Agencia / Panel 1 y 2)
  '91733663':  { baseline: 2295.59, total: 2331.34, neto: 35.75, modelo: 'DANIEL 68' },
  '79679899':  { baseline: 370.59,  total: 377.63,  neto: 7.04,  modelo: 'NORBERTO' },
  '99766806':  { baseline: 366.80,  total: 373.50,  neto: 6.70,  modelo: 'EDUARDO' },
  '168486464': { baseline: 56.16,   total: 58.69,   neto: 2.53,  modelo: 'GUSTAVO' },
  '108018336': { baseline: 1016.67, total: 1040.65, neto: 23.98, modelo: 'LUCAS' },
  '103289167': { baseline: 763.62,  total: 798.43,  neto: 34.81, modelo: 'LUIS DAROSA' },
  '118179794': { baseline: 462.11,  total: 554.51,  neto: 92.40, modelo: 'HORACIO' },
  '98389135':  { baseline: 293.26,  total: 295.46,  neto: 2.20,  modelo: 'RAUL' },
  '91360720':  { baseline: 470.58,  total: 482.57,  neto: 11.99, modelo: 'SANDRA MARIA' },
  '120720195': { baseline: 4286.26, total: 4344.56, neto: 58.30, modelo: 'MARCOS' },
  '139247498': { baseline: 1066.17, total: 1123.05, neto: 56.88, modelo: 'DAMIAN' },
  '157112125': { baseline: 55.72,   total: 55.94,   neto: 0.22,  modelo: 'LUIZ' },
  '130338853': { baseline: 357.72,  total: 369.16,  neto: 11.44, modelo: 'IVALDO' },
  '130431310': { baseline: 572.88,  total: 635.58,  neto: 62.70, modelo: 'RAFAEL' },
  '139245989': { baseline: 328.46,  total: 329.23,  neto: 0.77,  modelo: 'ALFREDO' },
  '188143166': { baseline: 9.24,    total: 9.24,    neto: 0.00,  modelo: 'ALEX' },
  '156881990': { baseline: 62.76,   total: 62.87,   neto: 0.11,  modelo: 'RALPH' },
  '143017065': { baseline: 217.53,  total: 227.21,  neto: 9.68,  modelo: 'MARIO' },
  '138130329': { baseline: 1028.66, total: 1114.90, neto: 86.24, modelo: 'AGUSTIN' },
  '95956014':  { baseline: 252.28,  total: 258.56,  neto: 6.28,  modelo: 'PABLO' },
  '98540781':  { baseline: 83.00,   total: 86.41,   neto: 3.41,  modelo: 'LEANDRO' },
  '143014129': { baseline: 36.52,   total: 39.49,   neto: 2.97,  modelo: 'RENEE' },
  '95955130':  { baseline: 188.38,  total: 198.06,  neto: 9.68,  modelo: 'HECTOR' },
  '145844971': { baseline: 1433.08, total: 1479.72, neto: 46.64, modelo: 'RODRIGO' },
  '170740935': { baseline: 1316.03, total: 1357.62, neto: 41.59, modelo: 'ROBERTO' },
  '187684981': { baseline: 133.21,  total: 133.98,  neto: 0.77,  modelo: 'CARLOS' },
  '130422416': { baseline: 1108.53, total: 1123.82, neto: 15.29, modelo: 'RAONI' },
  '120275229': { baseline: 397.38,  total: 398.81,  neto: 1.43,  modelo: 'GERMAN' },
  '88243516':  { baseline: 85.53,   total: 87.53,   neto: 2.00,  modelo: 'RICARDO' },

  // Tabla 2 (Directos / Panel 4)
  '158644203': { baseline: 138.05,  total: 138.49,  neto: 0.44,  modelo: 'SERGIO' },
  '128062998': { baseline: 161.48,  total: 174.57,  neto: 13.09, modelo: 'MARCO' },
  '190725336': { baseline: 136.01,  total: 136.46,  neto: 0.45,  modelo: 'GABRIEL' },
  '190731277': { baseline: 1.76,    total: 1.87,    neto: 0.11,  modelo: 'LUCAS' },
  '174069335': { baseline: 131.28,  total: 132.50,  neto: 1.22,  modelo: 'FEDERICO' },
  '145839775': { baseline: 489.44,  total: 496.54,  neto: 7.10,  modelo: 'BRUNO' },
  '167493871': { baseline: 45.59,   total: 46.03,   neto: 0.44,  modelo: 'HUMBERTO' },
  '153037229': { baseline: 622.82,  total: 649.88,  neto: 27.06, modelo: 'HORACIO' }
};

module.exports = {
  getFallbackPanels,
  FALLBACK_PERFILES,
  CORTE_MANUAL_BASELINES
};

