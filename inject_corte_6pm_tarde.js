// inject_corte_6pm_tarde.js — Corte manual 6:00 PM — 2026-09-08
// "Comienza" = baseline inicio turno TARDE; "en_curso" = total actual Datame
const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = 'https://bhewmidnkldjpdnvassj.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJoZXdtaWRua2xkanBkbnZhc3NqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU0NjMyNzAsImV4cCI6MjEwMTAzOTI3MH0.4DXjV8jH9Yj0jwNPg2DvRCqTgObiKULGCxFRf0lwIpI';
const sb = createClient(SUPABASE_URL, SUPABASE_KEY);
const FECHA='2026-09-08', JORNADA='Tarde';
const CORTE=[
  {id:'98540781',  m:'LEANDRO',     c:150.21, e:150.87},
  {id:'95956014',  m:'PABLO',       c:305.23, e:307.21},
  {id:'91360720',  m:'SANDRA MARIA',c:129.75, e:129.75},
  {id:'91733663',  m:'DANIEL 68',   c:2920.32,e:2951.06},
  {id:'79679899',  m:'NORBERTO',    c:303.38, e:304.15},
  {id:'99766806',  m:'EDUARDO',     c:550.20, e:559.00},
  {id:'168486464', m:'GUSTAVO',     c:674.82, e:698.63},
  {id:'108018336', m:'LUCAS',       c:804.11, e:841.29},
  {id:'103289167', m:'LUIS DAROSA', c:946.59, e:960.83},
  {id:'118179794', m:'HORACIO',     c:664.68, e:668.31},
  {id:'157112125', m:'LUIZ',        c:90.14,  e:93.44 },
  {id:'120720195', m:'MARCOS',      c:1464.01,e:1512.52},
  {id:'139247498', m:'DAMIAN',      c:797.40, e:805.21},
  {id:'120275229', m:'GERMAN',      c:44.55,  e:48.84 },
  {id:'130338853', m:'IVALDO',      c:285.98, e:287.08},
  {id:'130431310', m:'RAFAEL',      c:219.92, e:227.07},
  {id:'98389135',  m:'RAUL',        c:93.85,  e:93.85 },
  {id:'139245989', m:'ALFREDO',     c:552.11, e:552.11},
  {id:'156881990', m:'RALPH',       c:131.10, e:132.31},
  {id:'143017065', m:'MARIO',       c:319.79, e:331.94},
  {id:'138130329', m:'AGUSTIN',     c:449.53, e:513.66},
  {id:'143014129', m:'RENEE',       c:286.26, e:299.02},
  {id:'95955130',  m:'HECTOR',      c:390.17, e:390.17},
  {id:'145844971', m:'RODRIGO',     c:1397.23,e:1487.90},
  {id:'170740935', m:'ROBERTO',     c:1138.02,e:1170.58},
  {id:'130422416', m:'RAONI',       c:1088.86,e:1099.86},
  {id:'160352260', m:'JUVENAL',     c:9.43,   e:9.97  },
  {id:'103291980', m:'ARMANDO',     c:79.16,  e:79.16 },
  {id:'187684981', m:'CARLOS',      c:11.33,  e:11.33 },
  {id:'187538072', m:'VALERIA',     c:3.52,   e:3.52  },
  {id:'187536756', m:'MAY',         c:0.00,   e:0.00  },
  {id:'187536112', m:'MARIELYS',    c:0.00,   e:0.00  },
  {id:'158644203', m:'SERGIO',      c:64.52,  e:65.72 },
  {id:'128062998', m:'MARCO',       c:1102.08,e:1102.08},
  {id:'174069335', m:'FEDERICO',    c:242.09, e:242.87},
  {id:'103245945', m:'PABLO B',     c:819.82, e:824.43},
  {id:'167493871', m:'HUMBERTO',    c:61.66,  e:66.94 },
  {id:'113579174', m:'RONALDO',     c:16.34,  e:16.45 },
  {id:'145833775', m:'BRUNO',       c:430.82, e:440.06},
  {id:'113752797', m:'ROMARIO',     c:77.77,  e:78.25 },
  {id:'153037223', m:'IGNACIO',     c:180.93, e:181.71},
  {id:'33461947',  m:'MARIANO',     c:104.54, e:105.31},
];
async function main(){
  let ok=0,err=0;
  for(const p of CORTE){
    if(p.e<=0){console.log('  SKIP '+p.m);continue;}
    const neto=+(Math.max(0,p.e-p.c).toFixed(2));
    const {error}=await sb.from('operaciones').upsert({
      id_perfil:p.id,fecha_dia:FECHA,jornada:JORNADA,
      puntos_baseline:+p.c.toFixed(2),puntos_total:+p.e.toFixed(2),puntos_neto:neto,
      agencia:'CORTE-MANUAL-6PM',fecha_corte:'2026-09-08T18:00:00-05:00'
    },{onConflict:'id_perfil,fecha_dia,jornada',ignoreDuplicates:false});
    if(error){console.error('ERR '+p.m+': '+error.message);err++;}
    else{console.log('OK  '+p.m.padEnd(16)+' base='+p.c.toFixed(2)+' total='+p.e.toFixed(2)+' neto='+neto.toFixed(2));ok++;}
  }
  console.log('\nOK:'+ok+' ERR:'+err);
}
main().catch(console.error);
