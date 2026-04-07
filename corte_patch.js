(function() {
  const hoyRaw = new Date().toLocaleDateString('es-CO');
  const patchKey = 'patch_20260407_final_v5';
  if (localStorage.getItem(patchKey)) return;

  const realData = [
    ["RICARDO",59.04],["PABLO",3.36],["SANDRA MARIA",21.06],["NORBERTO",1.32],
    ["DANIEL 68",101.64],["AGUSTIN FERNANDO",2.88],["FRANCISCO",2.88],["RENATO",2.16],
    ["LUIS JOAO",12.24],["HECTOR",1.32],["LUCAS",58.20],["LUIS DAROSA",24.72],
    ["HORACIO",32.16],["IVALDO",20.34],["SEBASTIAN",5.76],["RAUL",4.68],
    ["MARCOS",37.20],["DAMIAN",63.96],["KETY",0.0],["LEANDRO",10.56],
    ["VALDEMIR",86.4],["ARMANDO",4.2],["RAFAEL",10.56],["CARINA",0.96],
    ["ALFREDO",17.76],["GERMAN",2.04],["RALPH",2.88],["VALQUIMAR",3.96],
    ["RAONI",55.44],["AGUSTIN",4.92],["MARCOS ANTONIO",6.24],["BEATRIZ",0.0],
    ["RENEE",3.36],["MARIO",3.72],["FERMIN",0.12],["FERNANDO",8.64],
    ["MURILO",2.88],["RODRIGO",28.08],["AGNALDO",0.36],["LUIZ",0.12]
  ];

  console.log("🛸 Inyectando Realidad Agencia Analytics...");
  const all = JSON.parse(localStorage.getItem('rr_prime_cortes') || '{}');
  
  realData.forEach(([n, p]) => {
    if (!all[n]) all[n] = [];
    // Limpiamos cualquier rastro de puntos inflados de hoy (>1000)
    all[n] = all[n].filter(c => c.fecha !== hoyRaw || c.puntos < 1000);
    // Insertamos la produccion real neta
    all[n].push({
      fecha: hoyRaw,
      jornada: 'Mañana',
      hora: '12:00',
      puntos: p,
      ts: Date.now()
    });
  });

  localStorage.setItem('rr_prime_cortes', JSON.stringify(all));
  localStorage.setItem(patchKey, 'applied');
  console.log("👽 Sincronizacion Maestra Completada. Cargando 708.12 pts.");
  setTimeout(() => location.reload(), 300);
})();
