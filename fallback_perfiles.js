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
  // PANEL 1
  { id_datame: '91360720', modelo: 'SANDRA MARIA', panel_id: 1, activo: true },

  // PANEL 2
  { id_datame: '101245945', modelo: 'PABLO B', panel_id: 2, activo: true },
  { id_datame: '103289167', modelo: 'LUIS', panel_id: 2, activo: true },
  { id_datame: '103291980', modelo: 'ARMANDO', panel_id: 2, activo: true },
  { id_datame: '113579174', modelo: 'RONALDO', panel_id: 2, activo: true },
  { id_datame: '113752797', modelo: 'ROMARIO', panel_id: 2, activo: true },
  { id_datame: '114851358', modelo: 'JOHANNA', panel_id: 2, activo: true },
  { id_datame: '130431310', modelo: 'RAFAEL', panel_id: 2, activo: true },
  { id_datame: '132062039', modelo: 'BEATRIZ', panel_id: 2, activo: true },
  { id_datame: '145839775', modelo: 'BRUNO', panel_id: 2, activo: true },
  { id_datame: '151070498', modelo: 'VALQUIMAR', panel_id: 2, activo: true },
  { id_datame: '151410237', modelo: 'EZEQUIEL', panel_id: 2, activo: true },
  { id_datame: '153037229', modelo: 'HORACIO B', panel_id: 2, activo: true },
  { id_datame: '153039388', modelo: 'AGUSTIN FERNANDO', panel_id: 2, activo: true },
  { id_datame: '156716207', modelo: 'AGNALDO', panel_id: 2, activo: true },
  { id_datame: '157067734', modelo: 'VALDEMIR', panel_id: 2, activo: true },
  { id_datame: '157112125', modelo: 'LUIZ', panel_id: 2, activo: true },
  { id_datame: '158644203', modelo: 'SERGIO', panel_id: 2, activo: true },
  { id_datame: '160352260', modelo: 'JUVENAL', panel_id: 2, activo: true },
  { id_datame: '164812184', modelo: 'MARCO', panel_id: 2, activo: true },
  { id_datame: '166575347', modelo: 'MAX', panel_id: 2, activo: true },
  { id_datame: '167273716', modelo: 'ARIEL HERNAN', panel_id: 2, activo: true },
  { id_datame: '167279664', modelo: 'JOSE ROBERTO', panel_id: 2, activo: true },
  { id_datame: '168486464', modelo: 'GUSTAVO A', panel_id: 2, activo: true },
  { id_datame: '170740935', modelo: 'ROBERTO', panel_id: 2, activo: true },
  { id_datame: '171638277', modelo: 'RONALT', panel_id: 2, activo: true },
  { id_datame: '91733663',  modelo: 'DANIEL 68', panel_id: 2, activo: true },
  { id_datame: '93461947',  modelo: 'MARIANO', panel_id: 2, activo: true },
  { id_datame: '95955130',  modelo: 'HECTOR', panel_id: 2, activo: true },
  { id_datame: '95956014',  modelo: 'PABLO', panel_id: 2, activo: true },
  { id_datame: '98389135',  modelo: 'RAUL', panel_id: 2, activo: true },
  { id_datame: '98540781',  modelo: 'LEANDRO', panel_id: 2, activo: true },
  { id_datame: '99611942',  modelo: 'PAOLA', panel_id: 2, activo: true },
  { id_datame: '99766806',  modelo: 'EDUARDO', panel_id: 2, activo: true },

  // PANEL 3
  { id_datame: '101652076', modelo: 'CARINA', panel_id: 3, activo: true },
  { id_datame: '108018336', modelo: 'LUCAS', panel_id: 3, activo: true },
  { id_datame: '109551682', modelo: 'RENATO', panel_id: 3, activo: true },
  { id_datame: '118179794', modelo: 'HORACIO', panel_id: 3, activo: true },
  { id_datame: '118692242', modelo: 'FRANCISCO', panel_id: 3, activo: true },
  { id_datame: '120275229', modelo: 'GERMAN', panel_id: 3, activo: true },
  { id_datame: '120720195', modelo: 'MARCOS', panel_id: 3, activo: true },
  { id_datame: '130338853', modelo: 'IVALDO', panel_id: 3, activo: true },
  { id_datame: '130422416', modelo: 'RAONI', panel_id: 3, activo: true },
  { id_datame: '137163229', modelo: 'SEBASTIAN', panel_id: 3, activo: true },
  { id_datame: '139245989', modelo: 'ALFREDO', panel_id: 3, activo: true },
  { id_datame: '139247498', modelo: 'DAMIAN', panel_id: 3, activo: true },
  { id_datame: '145834230', modelo: 'MURILO', panel_id: 3, activo: true },
  { id_datame: '145844971', modelo: 'RODRIGO', panel_id: 3, activo: true },
  { id_datame: '156881990', modelo: 'RALPH', panel_id: 3, activo: true },
  { id_datame: '160951610', modelo: 'GUSTAVO', panel_id: 3, activo: true },
  { id_datame: '79679899',  modelo: 'NORBERTO', panel_id: 3, activo: true },
  { id_datame: '88243516',  modelo: 'RICARDO', panel_id: 3, activo: true },

  // PANEL 4
  { id_datame: '131130713', modelo: 'LUIS JOAO', panel_id: 4, activo: true },
  { id_datame: '133085188', modelo: 'MARCOS ANTONIO', panel_id: 4, activo: true },
  { id_datame: '138130329', modelo: 'AGUSTIN', panel_id: 4, activo: true },
  { id_datame: '143014129', modelo: 'RENEE B', panel_id: 4, activo: true },
  { id_datame: '143017065', modelo: 'MARIO B', panel_id: 4, activo: true },
  { id_datame: '144863124', modelo: 'FERNANDO', panel_id: 4, activo: true },
  { id_datame: '145211163', modelo: 'FERMIN B', panel_id: 4, activo: true },
  { id_datame: '95955130',  modelo: 'HECTOR B', panel_id: 4, activo: true },
];

// ── CORTE MANUAL 2026-09-08 12:00 PM (Fuente Oficial) ──
const CORTE_MANUAL_BASELINES = {
  // Tabla 1
  '98540781':  { baseline: 136.46, total: 143.60, neto: 7.14,  modelo: 'LEANDRO' },
  '95956014':  { baseline: 295.88, total: 303.36, neto: 7.48,  modelo: 'PABLO' },
  '91360720':  { baseline: 129.31, total: 129.75, neto: 0.44,  modelo: 'SANDRA MARIA' },
  '91733663':  { baseline: 2864.99, total: 2908.66, neto: 43.67, modelo: 'DANIEL 68' },
  '79679899':  { baseline: 293.81, total: 302.62, neto: 8.81,  modelo: 'NORBERTO' },
  '99766806':  { baseline: 545.02, total: 548.88, neto: 3.86,  modelo: 'EDUARDO' },
  '168486464': { baseline: 644.46, total: 669.42, neto: 24.96, modelo: 'GUSTAVO A' },
  '108018336': { baseline: 762.64, total: 795.03, neto: 32.39, modelo: 'LUCAS' },
  '103289167': { baseline: 919.52, total: 940.75, neto: 21.23, modelo: 'LUIS' },
  '118179794': { baseline: 656.65, total: 664.13, neto: 7.48,  modelo: 'HORACIO' },
  '157112125': { baseline: 86.95,  total: 88.82,  neto: 1.87,  modelo: 'LUIZ' },
  '120720195': { baseline: 1420.66, total: 1458.62, neto: 37.96, modelo: 'MARCOS' },
  '139247498': { baseline: 770.17, total: 793.99, neto: 23.82, modelo: 'DAMIAN' },
  '120275229': { baseline: 43.23,  total: 43.78,  neto: 0.55,  modelo: 'GERMAN' },
  '130338853': { baseline: 273.55, total: 285.32, neto: 11.77, modelo: 'IVALDO' },
  '130431310': { baseline: 198.03, total: 219.92, neto: 21.89, modelo: 'RAFAEL' },
  '98389135':  { baseline: 89.78,  total: 93.85,  neto: 4.07,  modelo: 'RAUL' },
  '139245989': { baseline: 503.60, total: 541.43, neto: 37.83, modelo: 'ALFREDO' },
  '156881990': { baseline: 128.35, total: 130.88, neto: 2.53,  modelo: 'RALPH' },
  '143017065': { baseline: 314.62, total: 315.28, neto: 0.66,  modelo: 'MARIO' },
  '138130329': { baseline: 421.81, total: 447.33, neto: 25.52, modelo: 'AGUSTIN' },
  '143014129': { baseline: 278.89, total: 283.07, neto: 4.18,  modelo: 'RENEE' },
  '95955130':  { baseline: 389.95, total: 390.17, neto: 0.22,  modelo: 'HECTOR' },
  '145844971': { baseline: 1359.07, total: 1385.58, neto: 26.51, modelo: 'RODRIGO' },
  '170740935': { baseline: 1109.26, total: 1137.25, neto: 27.99, modelo: 'ROBERTO' },
  '130422416': { baseline: 1012.85, total: 1085.89, neto: 73.04, modelo: 'RAONI' },
  '160352260': { baseline: 9.10,    total: 9.43,    neto: 0.33,  modelo: 'JUVENAL' },
  '103291980': { baseline: 78.72,  total: 79.16,  neto: 0.44,  modelo: 'ARMANDO' },
  '187684981': { baseline: 11.33,  total: 11.33,  neto: 0.00,  modelo: 'CARLOS' },
  '187538072': { baseline: 3.52,   total: 3.52,   neto: 0.00,  modelo: 'VALERIA' },
  '187536756': { baseline: 0.00,   total: 0.00,   neto: 0.00,  modelo: 'MAY' },
  '187536112': { baseline: 0.00,   total: 0.00,   neto: 0.00,  modelo: 'MARIELYS' },

  // Tabla 2
  '158644203': { baseline: 62.20,  total: 64.52,  neto: 2.32,  modelo: 'SERGIO' },
  '128062998': { baseline: 1098.01, total: 1101.31, neto: 3.30, modelo: 'MARCO' },
  '174069335': { baseline: 240.88, total: 242.09, neto: 1.21,  modelo: 'FEDERICO' },
  '101245945': { baseline: 810.52, total: 817.39, neto: 6.87,  modelo: 'PABLO B' },
  '167493871': { baseline: 56.16,  total: 58.69,  neto: 2.53,  modelo: 'HUMBERTO' },
  '113579174': { baseline: 15.89,  total: 16.34,  neto: 0.45,  modelo: 'RONALDO' },
  '145839775': { baseline: 415.75, total: 427.52, neto: 11.77, modelo: 'BRUNO' },
  '113752797': { baseline: 77.16,  total: 77.27,  neto: 0.11,  modelo: 'ROMARIO' },
  '153037229': { baseline: 158.82, total: 163.83, neto: 5.01,  modelo: 'HORACIO B' },
  '93461947':  { baseline: 100.47, total: 103.66, neto: 3.19,  modelo: 'MARIANO' }
};

module.exports = {
  getFallbackPanels,
  FALLBACK_PERFILES,
  CORTE_MANUAL_BASELINES
};
