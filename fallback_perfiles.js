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

// ── CORTE MANUAL 12:00 AM (Fuente Oficial) ──
const CORTE_MANUAL_BASELINES = {
  // Tabla 1
  '98540781':  { baseline: 157.69, total: 157.69, neto: 0.00,  modelo: 'LEANDRO' },
  '95956014':  { baseline: 354.51, total: 358.25, neto: 3.74,  modelo: 'PABLO' },
  '91360720':  { baseline: 175.50, total: 184.41, neto: 8.91,  modelo: 'SANDRA MARIA' },
  '91733663':  { baseline: 3311.03, total: 3318.41, neto: 7.38, modelo: 'DANIEL 68' },
  '79679899':  { baseline: 339.80, total: 340.45, neto: 0.65,  modelo: 'NORBERTO' },
  '99766806':  { baseline: 621.31, total: 641.55, neto: 20.24, modelo: 'EDUARDO' },
  '168486464': { baseline: 819.79, total: 835.30, neto: 15.51, modelo: 'GUSTAVO' },
  '108018336': { baseline: 945.63, total: 956.51, neto: 10.88, modelo: 'LUCAS' },
  '103289167': { baseline: 1062.36, total: 1079.85, neto: 17.49, modelo: 'LUIS DAROSA' },
  '118179794': { baseline: 694.65, total: 694.65, neto: 0.00,  modelo: 'HORACIO' },
  '98389135':  { baseline: 100.45, total: 100.45, neto: 0.00,  modelo: 'RAUL' },
  '120720195': { baseline: 1720.03, total: 1726.46, neto: 6.43, modelo: 'MARCOS' },
  '139247498': { baseline: 850.70, total: 855.75, neto: 5.05,  modelo: 'DAMIAN' },
  '157112125': { baseline: 108.23, total: 108.23, neto: 0.00,  modelo: 'LUIZ' },
  '130338853': { baseline: 359.85, total: 362.38, neto: 2.53,  modelo: 'IVALDO' },
  '130431310': { baseline: 309.35, total: 314.63, neto: 5.28,  modelo: 'RAFAEL' },
  '139245989': { baseline: 627.18, total: 633.56, neto: 6.38,  modelo: 'ALFREDO' },
  '188143166': { baseline: 0.00,   total: 0.00,   neto: 0.00,  modelo: 'ALEX' },
  '156881990': { baseline: 148.15, total: 148.92, neto: 0.77,  modelo: 'RALPH' },
  '143017065': { baseline: 387.22, total: 387.22, neto: 0.00,  modelo: 'MARIO' },
  '138130329': { baseline: 733.93, total: 740.87, neto: 6.94,  modelo: 'AGUSTIN' },
  '120275229': { baseline: 52.14,  total: 52.14,  neto: 0.00,  modelo: 'GERMAN' },
  '143014129': { baseline: 366.13, total: 371.95, neto: 5.82,  modelo: 'RENEE' },
  '95955130':  { baseline: 406.50, total: 411.79, neto: 5.29,  modelo: 'HECTOR' },
  '145844971': { baseline: 1626.53, total: 1627.19, neto: 0.66, modelo: 'RODRIGO' },
  '170740935': { baseline: 1344.43, total: 1360.71, neto: 16.28, modelo: 'ROBERTO' },
  '187684981': { baseline: 11.33,  total: 11.44,  neto: 0.11,  modelo: 'CARLOS' },
  '130422416': { baseline: 1223.83, total: 1235.82, neto: 11.99, modelo: 'RAONI' },
  '160352260': { baseline: 9.97,   total: 9.97,   neto: 0.00,  modelo: 'JUVENAL' },
  '103291980': { baseline: 85.36,  total: 84.11,  neto: 0.00,  modelo: 'ARMANDO' },
  '187538072': { baseline: 3.52,   total: 3.52,   neto: 0.00,  modelo: 'VALERIA' },
  '187536756': { baseline: 0.00,   total: 0.00,   neto: 0.00,  modelo: 'MAY' },
  '187536112': { baseline: 0.00,   total: 0.00,   neto: 0.00,  modelo: 'MARIELYS' },

  // Tabla 2
  '158644203': { baseline: 70.13,  total: 70.13,  neto: 0.00,  modelo: 'SERGIO' },
  '128062998': { baseline: 1124.35, total: 1127.43, neto: 3.08, modelo: 'MARCO' },
  '174069335': { baseline: 330.10, total: 330.10, neto: 0.00,  modelo: 'FEDERICO' },
  '101245945': { baseline: 839.39, total: 839.95, neto: 0.56,  modelo: 'PABLO' },
  '167493871': { baseline: 153.18, total: 153.62, neto: 0.44,  modelo: 'HUMBERTO' },
  '113579174': { baseline: 17.11,  total: 17.11,  neto: 0.00,  modelo: 'RONALDO' },
  '145839775': { baseline: 501.00, total: 508.26, neto: 7.26,  modelo: 'BRUNO' },
  '113752797': { baseline: 84.86,  total: 85.52,  neto: 0.66,  modelo: 'ROMARIO' },
  '153037229': { baseline: 217.56, total: 225.16, neto: 7.60,  modelo: 'HORACIO' },
  '93461947':  { baseline: 110.26, total: 110.26, neto: 0.00,  modelo: 'MARIANO' }
};

module.exports = {
  getFallbackPanels,
  FALLBACK_PERFILES,
  CORTE_MANUAL_BASELINES
};
