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

module.exports = {
  getFallbackPanels,
  FALLBACK_PERFILES
};
