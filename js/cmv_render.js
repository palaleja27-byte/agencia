// ══ CMV PREMIUM v2 — patch para inyectar en index.html ══
// Copiar el contenido de _cmvRender dentro de renderCrecimientoAnalisis

async function _cmvRender() {
  const panel = document.getElementById('crec-tooltip-panel');
  if (!panel) return;

  // ── Fetch Supabase data ──────────────────────────────
  const hoyD = new Date();
  const diaHoy = hoyD.getDate();
  const diasMes = new Date(hoyD.getFullYear(), hoyD.getMonth()+1, 0).getDate();
  const mesStr  = hoyD.toLocaleDateString('en-CA',{timeZone:'America/Bogota'}).slice(0,7);
  const desde   = mesStr + '-01';
  const hasta   = hoyD.toLocaleDateString('en-CA',{timeZone:'America/Bogota'});

  let rows = [], todayRows = [];
  try {
    const r1 = await _sb.from('operaciones')
      .select('fecha_dia,puntos_neto,id_perfil,agencia,jornada')
      .gte('fecha_dia', desde).lte('fecha_dia', hasta).gt('puntos_neto', 0)
      .neq('jornada','Auto');
    rows = r1.data || [];
    todayRows = rows.filter(r => r.fecha_dia === hasta);
  } catch(e) { console.warn('[CMV]', e); }

  // ── Historial ────────────────────────────────────────
  const h = window._rkHistorial || { m0Total:0, m1Total:0, m2Total:0, m0Name:'Hace 2m', m1Name:'Mes ant.', m2Name:'Actual', crec:0 };
  const promDia   = diaHoy > 0 ? h.m2Total / diaHoy : 0;
  const proyecc   = Math.round(promDia * diasMes);
  const crec      = h.crec;
  const crecColor = crec >= 0 ? '#10b981' : '#f87171';
  const crecSign  = crec > 0 ? '+' : '';
  const fmtPct = p => { if(!p) return '<span style="color:#64748b">—</span>'; const c=p>0?'#34d399':'#f87171'; return `<span style="color:${c};font-weight:700">${p>0?'+':''}${p.toFixed(1)}%</span>`; };
  const crecM1 = h.m0Total>0 ? ((h.m1Total-h.m0Total)/h.m0Total*100) : 0;
  const crecM2 = h.m1Total>0 ? ((h.m2Total-h.m1Total)/h.m1Total*100) : 0;

  // ── KPIs del día ─────────────────────────────────────
  const ptsHoy  = todayRows.reduce((s,r)=>s+(r.puntos_neto||0),0);
  const copHoy  = Math.round(ptsHoy * 1400);
  const copMes  = Math.round(h.m2Total * 1400);
  const copProy = Math.round(proyecc * 1400);
  const metaDia = promDia > 0 ? (ptsHoy / promDia * 100) : 0;
  const metaColor = metaDia >= 100 ? '#10b981' : metaDia >= 70 ? '#fbbf24' : '#f87171';

  // ── Heatmap por día ──────────────────────────────────
  const pd = {};
  rows.forEach(r => {
    if (!pd[r.fecha_dia]) pd[r.fecha_dia] = { t:0, n:0, ops: new Set() };
    pd[r.fecha_dia].t += Number(r.puntos_neto)||0;
    pd[r.fecha_dia].n++;
    pd[r.fecha_dia].ops.add(r.agencia||r.id_perfil);
  });
  const dias = Object.keys(pd).sort();
  const vals = dias.map(d=>pd[d].t);
  const maxV = Math.max(...vals, 1);
  const promG = vals.length ? vals.reduce((a,b)=>a+b,0)/vals.length : 0;

  // ── Alertas inteligentes ─────────────────────────────
  const alertas = [];
  if (metaDia < 60 && ptsHoy > 0)
    alertas.push({ t:'danger', i:'🚨', msg:`<b>Producción baja hoy:</b> ${ptsHoy.toFixed(1)} pts = ${metaDia.toFixed(0)}% de la meta diaria.` });
  if (crec < -20)
    alertas.push({ t:'danger', i:'📉', msg:`<b>Caída mensual severa:</b> ${crecSign}${crec.toFixed(1)}% vs ${h.m1Name}. Revisar asistencia y perfiles.` });
  if (crec < 0 && crec >= -20)
    alertas.push({ t:'warn', i:'⚠️', msg:`<b>Mes en negativo:</b> ${crecSign}${crec.toFixed(1)}% vs ${h.m1Name}. Aumentar ritmo.` });
  if (metaDia >= 120)
    alertas.push({ t:'success', i:'🔥', msg:`<b>¡Día excepcional!</b> ${ptsHoy.toFixed(1)} pts = ${metaDia.toFixed(0)}% del promedio.` });
  if (crec >= 10)
    alertas.push({ t:'success', i:'📈', msg:`<b>Mes en crecimiento:</b> +${crec.toFixed(1)}% vs ${h.m1Name}. ¡Buen ritmo!` });
  const diasRestantes = diasMes - diaHoy;
  const ptsNecesarios = h.m1Total - h.m2Total;
  if (ptsNecesarios > 0 && diasRestantes > 0)
    alertas.push({ t:'info', i:'🎯', msg:`<b>Para superar ${h.m1Name}:</b> faltan ${ptsNecesarios.toFixed(0)} pts en ${diasRestantes} días (${(ptsNecesarios/diasRestantes).toFixed(0)} pts/día).` });

  // ── Top operadores del mes ───────────────────────────
  const opMap = {};
  rows.forEach(r => {
    const op = operatorsData.find(o => o.profiles && o.profiles.some(p => String(p.id)===String(r.id_perfil)));
    const key = op ? op.name.split(' ').slice(0,2).join(' ') : (r.agencia||r.id_perfil);
    opMap[key] = (opMap[key]||0) + (r.puntos_neto||0);
  });
  const top5 = Object.entries(opMap).sort((a,b)=>b[1]-a[1]).slice(0,5);
  const medals = ['🥇','🥈','🥉','4️⃣','5️⃣'];

  // ── Sparkline (últimos 14 días) ──────────────────────
  const spark = dias.slice(-14).map(d => pd[d].t);
  const sparkMax = Math.max(...spark, 1);
  const sparkHTML = spark.map(v => {
    const h2 = Math.max(3, Math.round(v/sparkMax*22));
    const c = v>=promG*1.2?'#10b981':v>=promG*0.7?'#34d399':v>=promG*0.4?'#fbbf24':'#f87171';
    return `<div class="cmv-spark-bar" style="height:${h2}px;background:${c};opacity:.85"></div>`;
  }).join('');

  // ── Heatmap HTML ─────────────────────────────────────
  let hmHtml = '<div style="display:flex;flex-wrap:wrap;gap:3px;">';
  dias.forEach(d => {
    const v=pd[d].t, pct=v/maxV, dn=parseInt(d.slice(8));
    const bg=pct>=0.8?'#10b981':pct>=0.5?'#34d399':pct>=0.25?'#fbbf24':'#f87171';
    const lbl=pct>=0.8?'🔥':pct>=0.5?'✅':pct>=0.25?'⚡':'📉';
    hmHtml += `<div title="Día ${dn}: ${v.toFixed(1)} pts | ${pd[d].ops.size} perfiles"
      style="width:26px;height:26px;border-radius:5px;background:${bg};opacity:${(0.35+pct*0.65).toFixed(2)};
             display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:default;">
      <span style="font-size:.48rem;font-weight:900;color:#000">${dn}</span>
      <span style="font-size:.4rem">${lbl}</span></div>`;
  });
  hmHtml += `</div><div style="display:flex;gap:8px;margin-top:5px;font-size:.52rem;color:#64748b">
    <span>📉 Bajo</span><span>⚡ Medio</span><span>✅ Alto</span><span>🔥 Pico</span>
    <span style="margin-left:auto">Prom: ${promG.toFixed(0)} pts/día</span></div>`;

  // ── Tendencia ─────────────────────────────────────────
  const tend = vals.length>=4 && vals[vals.length-1] > vals[Math.floor(vals.length/2)] ? 'ASCENDENTE 📈' : 'DESCENDENTE 📉';
  const tendColor = tend.includes('ASC') ? '#10b981' : '#f87171';
  const mejor = dias[vals.indexOf(Math.max(...vals))];
  const peor  = dias[vals.indexOf(Math.min(...vals))];
  const bajos = dias.filter(d=>pd[d].t<promG*0.5);
  const altos = dias.filter(d=>pd[d].t>=promG*1.5);

  // ── RENDER ───────────────────────────────────────────
  const ts = new Date().toLocaleTimeString('es-CO',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
  panel.innerHTML = `
<div style="padding:18px;color:#f1f5f9;font-family:inherit">
  <!-- Header -->
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
    <div>
      <div style="color:#2dd4bf;font-weight:900;font-size:.88rem;letter-spacing:.4px">📊 ¿CÓMO VAMOS ESTE MES?</div>
      <div style="font-size:.55rem;color:#334155;margin-top:2px"><span class="cmv-rt-dot"></span>RT · ${ts}</div>
    </div>
    <button onclick="window.toggleCrecTooltip(event)" style="background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);color:#94a3b8;cursor:pointer;font-size:1rem;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center">&times;</button>
  </div>

  <!-- Big % -->
  <div style="text-align:center;margin-bottom:16px;padding:14px;background:rgba(255,255,255,.02);border-radius:14px;border:1px solid rgba(255,255,255,.05)">
    <div style="font-size:3rem;font-weight:900;color:${crecColor};line-height:1">${crecSign}${crec.toFixed(1)}%</div>
    <div style="color:#475569;font-size:.75rem;margin-top:6px;font-weight:700">vs ${h.m1Name} · Proyectado fin de mes</div>
    <div style="margin-top:10px"><div class="cmv-sparkline" style="height:22px;justify-content:center">${sparkHTML}</div></div>
  </div>

  <!-- 4 KPI Cards -->
  <div class="cmv-kpi-grid">
    <div class="cmv-kpi-card" style="border-color:rgba(45,212,191,.15)">
      <div class="cmv-kpi-label">📅 Hoy — Puntos</div>
      <div class="cmv-kpi-value" style="color:#2dd4bf">${ptsHoy.toFixed(1)}<small style="font-size:.55rem;opacity:.6"> pts</small></div>
      <div class="cmv-kpi-sub">$${copHoy.toLocaleString('es-CO')} COP</div>
      <span class="cmv-kpi-badge" style="background:${metaColor}22;color:${metaColor}">${metaDia.toFixed(0)}% de meta</span>
    </div>
    <div class="cmv-kpi-card" style="border-color:rgba(167,139,250,.15)">
      <div class="cmv-kpi-label">📆 Mes — Total</div>
      <div class="cmv-kpi-value" style="color:#a78bfa">${h.m2Total.toLocaleString('es-CO',{minimumFractionDigits:1})}<small style="font-size:.55rem;opacity:.6"> pts</small></div>
      <div class="cmv-kpi-sub">$${copMes.toLocaleString('es-CO')} COP</div>
      <span class="cmv-kpi-badge" style="background:rgba(167,139,250,.1);color:#a78bfa">${h.m2Name}</span>
    </div>
    <div class="cmv-kpi-card" style="border-color:rgba(251,191,36,.15)">
      <div class="cmv-kpi-label">✨ Promedio / día</div>
      <div class="cmv-kpi-value" style="color:#fbbf24">${Math.round(promDia).toLocaleString()}<small style="font-size:.55rem;opacity:.6"> pts</small></div>
      <div class="cmv-kpi-sub">$${Math.round(promDia*1400).toLocaleString('es-CO')} COP/día</div>
      <span class="cmv-kpi-badge" style="background:rgba(251,191,36,.1);color:#fbbf24">Día ${diaHoy} de ${diasMes}</span>
    </div>
    <div class="cmv-kpi-card" style="border-color:rgba(16,185,129,.15)">
      <div class="cmv-kpi-label">🚀 Proyección fin mes</div>
      <div class="cmv-kpi-value" style="color:#10b981">${proyecc.toLocaleString()}<small style="font-size:.55rem;opacity:.6"> pts</small></div>
      <div class="cmv-kpi-sub">$${copProy.toLocaleString('es-CO')} COP</div>
      <div class="cmv-proj-bar-wrap"><div class="cmv-proj-bar" style="width:${Math.min(100,(proyecc/(h.m1Total||1)*100)).toFixed(1)}%;background:${crec>=0?'#10b981':'#f87171'}"></div></div>
    </div>
  </div>

  <!-- Alertas -->
  ${alertas.length ? `<div class="cmv-section-title">🔔 ALERTAS INTELIGENTES</div>${alertas.map(a=>`<div class="cmv-alert ${a.t}"><span class="cmv-alert-icon">${a.i}</span><div>${a.msg}</div></div>`).join('')}` : ''}

  <!-- Historial -->
  <div class="cmv-section-title">📅 HISTORIAL ${hoyD.getFullYear()}</div>
  <div style="background:rgba(255,255,255,.02);border-radius:10px;border:1px solid rgba(255,255,255,.05);overflow:hidden">
    <table style="width:100%;font-size:.75rem;border-collapse:collapse">
      <tr style="border-bottom:1px solid rgba(255,255,255,.05)"><td style="padding:6px 10px;font-size:.58rem;color:#334155">MES</td><td style="text-align:right;padding:6px 10px;font-size:.58rem;color:#334155">PUNTOS</td><td style="text-align:right;padding:6px;font-size:.58rem;color:#334155">VS ANT.</td><td style="text-align:right;padding:6px 10px;font-size:.58rem;color:#334155">COP</td></tr>
      <tr style="border-bottom:1px solid rgba(255,255,255,.03)"><td style="padding:7px 10px;color:#94a3b8">${h.m0Name}</td><td style="text-align:right;padding:7px 10px;font-weight:700;color:#a78bfa">${h.m0Total.toLocaleString()} pts</td><td style="text-align:right;padding:7px 6px">—</td><td style="text-align:right;padding:7px 10px;color:#64748b;font-size:.65rem">$${Math.round(h.m0Total*1400).toLocaleString('es-CO')}</td></tr>
      <tr style="border-bottom:1px solid rgba(255,255,255,.03)"><td style="padding:7px 10px;color:#94a3b8">${h.m1Name}</td><td style="text-align:right;padding:7px 10px;font-weight:700;color:#a78bfa">${h.m1Total.toLocaleString()} pts</td><td style="text-align:right;padding:7px 6px">${fmtPct(crecM1)}</td><td style="text-align:right;padding:7px 10px;color:#64748b;font-size:.65rem">$${Math.round(h.m1Total*1400).toLocaleString('es-CO')}</td></tr>
      <tr style="background:rgba(52,211,153,.04)"><td style="padding:7px 10px;color:#34d399;font-weight:800">${h.m2Name} ✦</td><td style="text-align:right;padding:7px 10px;font-weight:900;color:#34d399">${h.m2Total.toLocaleString()} pts</td><td style="text-align:right;padding:7px 6px">${fmtPct(crecM2)}</td><td style="text-align:right;padding:7px 10px;color:#34d399;font-size:.65rem;font-weight:700">$${copMes.toLocaleString('es-CO')}</td></tr>
    </table>
  </div>

  <!-- Heatmap -->
  <div class="cmv-section-title">🔥 MAPA DE CALOR — DÍA A DÍA</div>
  ${hmHtml}
  <div style="margin-top:10px;font-size:.63rem;line-height:1.7;color:#64748b">
    <span style="color:#10b981">🔥 Mejor: día ${mejor?mejor.slice(8):'—'}</span>${mejor?` — ${pd[mejor].t.toFixed(1)} pts | ${pd[mejor].ops.size} perfiles`:''}
    <br><span style="color:#f87171">📉 Peor: día ${peor?peor.slice(8):'—'}</span>${peor?` — ${pd[peor].t.toFixed(1)} pts | ${pd[peor].ops.size} perfil(es)`:''}
    ${bajos.length?`<br><span style="color:#fbbf24">⚠️ ${bajos.length} día(s) bajo 50% del promedio</span>`:''}
    ${altos.length?`<br><span style="color:#34d399">✅ ${altos.length} día(s) con rendimiento >150%</span>`:''}
    <br><b style="color:${tendColor}">Tendencia 2ª mitad: ${tend}</b>
  </div>

  <!-- Top operadores -->
  <div class="cmv-section-title">🏆 TOP OPERADORES DEL MES</div>
  ${top5.map(([n,p],i)=>`
    <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid rgba(255,255,255,.04)">
      <span style="font-size:.78rem">${medals[i]} ${n}</span>
      <div style="text-align:right">
        <div style="font-weight:900;color:#2dd4bf;font-size:.82rem">${p.toFixed(1)} pts</div>
        <div style="font-size:.58rem;color:#475569">$${Math.round(p*1400).toLocaleString('es-CO')} COP</div>
      </div>
    </div>`).join('')}

  <!-- Footer RT -->
  <div style="text-align:center;margin-top:14px;font-size:.55rem;color:#1e293b">
    <span class="cmv-rt-dot"></span> Datos en tiempo real · Supabase · Auto-refresh 60s
    <br><button onclick="renderCrecimientoAnalisis()" style="margin-top:6px;background:rgba(45,212,191,.08);border:1px solid rgba(45,212,191,.2);color:#2dd4bf;padding:4px 14px;border-radius:99px;font-size:.6rem;cursor:pointer;font-weight:700">↻ Actualizar ahora</button>
  </div>
</div>`;
}
