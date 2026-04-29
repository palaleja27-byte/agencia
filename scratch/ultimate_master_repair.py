import os
import re

file_path = r'c:\Users\ADMIN\Documents\AgenciaRR\AgenciaRROriginal\agencia\index.html'

def final_master_repair():
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. REMOVE ALL DUPLICATE asiCardHTML AND BROKEN SCRIPTS
    # We'll use a regex to find all versions and delete them
    content = re.sub(r'function asiCardHTML\(.*?\)\s*\{.*?\}\s*\\n\s*</script>', '', content, flags=re.DOTALL)
    content = re.sub(r'function asiCardHTML\(.*?\)\s*\{.*?\}', '', content, flags=re.DOTALL)
    
    # 2. DEFINE THE MODERN ASISTENCIA CARD (GLOBAL VERSION)
    new_asi_card_js = """
    function asiCardHTML(name, role, groupTag) {
      const k = asiKey(name, role);
      const cur = asiEstados[k] || { estado: '', nota: '' };
      const est = cur.estado;
      const av = (typeof getAvatar === 'function') ? getAvatar(name) : null;
      const avatarHTML = av 
        ? `<div style="width:55px; height:55px; border-radius:16px; overflow:hidden; border:2px solid rgba(255,255,255,0.1); flex-shrink:0;"><img src="${av}" style="width:100%; height:100%; object-fit:cover;"></div>` 
        : `<div style="width:55px; height:55px; border-radius:16px; background:rgba(255,255,255,0.05); display:flex; align-items:center; justify-content:center; font-size:1.8rem; border:1px solid rgba(255,255,255,0.1); flex-shrink:0;">👤</div>`;
      
      const sn = name.replace(/\\\\/g, '\\\\\\\\').replace(/'/g, \"\\\\'\");
      const op = (typeof operatorsData !== 'undefined') ? operatorsData.find(o => _normName(o.name) === _normName(name)) : null;
      const hReg = asiGetHoras(name);
      const hAct = hReg?.horas || op?.turno_horas || 8;
      const tAct = op?.turno || 'Mañana';
      const tIcon = tAct === 'Mañana' ? '☀️' : tAct === 'Tarde' ? '🌆' : tAct === 'Noche' ? '🌙' : '🔄';
      const safeId = name.replace(/[^a-zA-Z0-9]/g, '_');

      const perfs = op?.profiles || [];
      const perfilesList = perfs.length ? perfs.map((p, pIdx) => {
          const esCob = p.tipo === 'cobertura';
          return `<div style="font-size:0.72rem; color:#e2e8f0; background:rgba(0,0,0,0.4); padding:8px 12px; border-radius:12px; display:flex; justify-content:space-between; align-items:center; margin-bottom:6px; border:1px solid rgba(255,255,255,0.05); box-shadow:0 2px 5px rgba(0,0,0,0.2);">
            <div style="display:flex; flex-direction:column;">
              <span style="font-weight:900; letter-spacing:0.5px;">${p.id}</span>
              <span style="font-size:0.55rem; color:#6366f1; font-weight:800; text-transform:uppercase;">${p.model || 'ID'} · ${esCob ? 'Cobertura' : 'Propio'}</span>
            </div>
            <span onclick="asiPerfilRemove('${sn}',${pIdx})" style="cursor:pointer; font-size:1.1rem; padding:0 5px; opacity:0.7; transition:0.2s;" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0.7">🗑️</span>
          </div>`;
      }).join('') : '<div style="font-size:0.62rem; color:#475569; padding:15px 0; font-style:italic; text-align:center;">Sin perfiles vinculados</div>';

      return `
      <div class="asi-card" style="display: flex; flex-direction: row; gap: 0; padding: 0; background: #0f172a; border: 1px solid rgba(255,255,255,0.08); border-radius: 24px; transition: 0.3s; position:relative; overflow:hidden; min-height:165px; box-shadow:0 10px 40px rgba(0,0,0,0.4);">
        
        <!-- COL 1: PERFIL -->
        <div style="width: 210px; padding: 20px; flex-shrink: 0; display: flex; flex-direction: column; gap: 12px; border-right: 1px solid rgba(255,255,255,0.06); background: rgba(255,255,255,0.01);">
           <div style="display: flex; align-items: center; gap: 15px;">
              ${avatarHTML}
              <div style="overflow: hidden;">
                 <div style="font-size: 1rem; font-weight: 900; color: white; line-height: 1.1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${name}">${name}</div>
                 <div style="font-size:0.65rem; color:#5eead4; font-weight:800; text-transform:uppercase; margin-top:5px; letter-spacing:1px; background:rgba(94,234,212,0.1); padding:2px 6px; border-radius:6px; display:inline-block;">${groupTag}</div>
              </div>
           </div>
           <div style="font-size: 0.65rem; font-weight: 700; color: ${cur.horaIngreso ? '#34d399' : '#64748b'}; display:flex; align-items:center; gap:6px; background:rgba(0,0,0,0.2); padding:6px 10px; border-radius:10px;">
              <span>${cur.horaIngreso ? '🟢 Ingresó: ' + cur.horaIngreso : '🔴 Fuera de Turno'}</span>
           </div>
           <div style="display: flex; gap: 6px; margin-top: auto;">
              <button onclick="asiSetEstado('${sn}','${role}','P')" style="flex:1; height: 36px; border-radius: 12px; border: none; cursor: pointer; background: ${est === 'P' ? '#10b981' : 'rgba(255,255,255,0.03)'}; color: ${est === 'P' ? '#fff' : '#10b981'}; font-weight:900; font-size:0.7rem; border:1px solid ${est === 'P' ? '#10b981' : 'rgba(255,255,255,0.05)'};">PRESENTE</button>
              <button onclick="asiSetEstado('${sn}','${role}','A')" style="flex:1; height: 36px; border-radius: 12px; border: none; cursor: pointer; background: ${est === 'A' ? '#ef4444' : 'rgba(255,255,255,0.03)'}; color: ${est === 'A' ? '#fff' : '#ef4444'}; font-weight:900; font-size:0.7rem; border:1px solid ${est === 'A' ? '#ef4444' : 'rgba(255,255,255,0.05)'};">AUSENTE</button>
           </div>
        </div>

        <!-- COL 2: HORARIO -->
        <div style="width: 150px; padding: 20px; flex-shrink: 0; border-right: 1px solid rgba(255,255,255,0.06); display: flex; flex-direction: column; gap: 10px; background:rgba(0,0,0,0.1);">
           <div style="font-size: 0.55rem; color: #475569; text-transform: uppercase; font-weight: 900; letter-spacing: 1px; margin-bottom:5px;">Jornada ${tIcon}</div>
           <div style="display:flex; flex-direction:column; gap:6px;">
              <button onclick=\"asiSetHoras('${sn}','8')\" style=\"padding:7px; font-size:.7rem; font-weight:800; background:${hAct==8?'rgba(52,211,153,0.1)':'rgba(255,255,255,0.02)'}; border:1px solid ${hAct==8?'#34d399':'rgba(255,255,255,0.05)'}; color:${hAct==8?'#34d399':'#64748b'}; border-radius:12px; cursor:pointer;\">8 HORAS</button>
              <button onclick=\"asiSetHoras('${sn}','12')\" style=\"padding:7px; font-size:.7rem; font-weight:800; background:${hAct==12?'rgba(96,165,250,0.1)':'rgba(255,255,255,0.02)'}; border:1px solid ${hAct==12?'#60a5fa':'rgba(255,255,255,0.05)'}; color:${hAct==12?'#60a5fa':'#64748b'}; border-radius:12px; cursor:pointer;\">12 HORAS</button>
              <button onclick=\"asiSetHoras('${sn}','cambio')\" style=\"padding:7px; font-size:.7rem; font-weight:800; background:rgba(251,191,36,0.05); color:#fbbf24; border:1px solid rgba(251,191,36,0.2); border-radius:12px; cursor:pointer;\">🔄 CAMBIO</button>
           </div>
        </div>

        <!-- COL 3: PERFILES MASTER -->
        <div style="flex: 1; padding: 20px; display: flex; flex-direction: column; gap: 12px;">
           <div style="display: flex; justify-content: space-between; align-items: center;">
              <div style="font-size: 0.62rem; color: #64748b; text-transform: uppercase; font-weight: 900; letter-spacing:1px;">📂 Perfiles (${perfs.length})</div>
              <button onclick=\"asiPerfilToggleForm('${sn}')\" style=\"background:linear-gradient(135deg, #6366f1, #4f46e5); color:white; border:none; padding:4px 14px; border-radius:10px; font-size:0.65rem; font-weight:900; cursor:pointer; box-shadow:0 4px 15px rgba(99,102,241,0.4); text-transform:uppercase;\">+ AGREGAR</button>
           </div>
           <div style=\"flex: 1; overflow-y: auto; max-height: 110px; padding-right: 8px;\" class=\"custom-scroll\">
              ${perfilesList}
           </div>
           <div id=\"asi-form-wrap-${safeId}\" style=\"margin-top:5px;\"></div>
        </div>

        <!-- SIDE ACTIONS -->
        <div style=\"width: 60px; background: rgba(0,0,0,0.3); display: flex; flex-direction: column; align-items: center; padding: 20px 0; gap: 20px; border-left:1px solid rgba(255,255,255,0.05);\">
           <button onclick=\"asiTerminarTurnoManual('${sn}','${role}')\" style=\"background:rgba(244,63,94,0.1); border:1px solid rgba(244,63,94,0.2); color:#f43f5e; padding:10px; border-radius:14px; cursor:pointer; font-size:1.2rem; transition:0.3s;\" title=\"Finalizar Jornada\" onmouseover=\"this.style.background='#f43f5e'; this.style.color='white'\" onmouseout=\"this.style.background='rgba(244,63,94,0.1)'; this.style.color='#f43f5e'\">🛑</button>
           ${role === 'monitor' ? `<button onclick=\"asiDeleteMonitor('${sn}')\" style=\"background:none; border:none; cursor:pointer; font-size:1.2rem; opacity:0.3; filter:grayscale(1);\" title=\"Eliminar Monitor\">🗑️</button>` : ''}
        </div>
      </div>`;
    }
    """

    # 3. OVERWRITE renderVistaOperador WITH THE ULTIMATE VERSION
    # We'll replace the entire function body
    op_view_start = content.find("function renderVistaOperador(name)")
    if op_view_start != -1:
        # Find next } (end of function)
        bracket_count = 0
        op_view_end = -1
        for i in range(op_view_start, len(content)):
            if content[i] == '{': bracket_count += 1
            if content[i] == '}':
                bracket_count -= 1
                if bracket_count == 0:
                    op_view_end = i
                    break
        
        if op_view_end != -1:
            ultimate_op_view = """function renderVistaOperador(name) {
      const op = operatorsData.find(o => o.name.toUpperCase() === name?.toUpperCase());
      if (!op) return;

      renderOpDashboard(name);
      renderOpStats(name);
      
      // Sincronizar Meta Real desde Admin (Prioridad: Metas por Grupo)
      let _metaOp = 3000;
      if (typeof METAS_GRUPALES !== 'undefined' && METAS_GRUPALES[op.group]) {
          _metaOp = METAS_GRUPALES[op.group];
      } else if (op.meta_dia) {
          _metaOp = op.meta_dia;
      }
      
      const _ptsDia = typeof _opRtTurnos !== 'undefined' ? Object.values(_opRtTurnos).reduce((s,v)=>s+v,0) : 0;
      const _grpPts = typeof _opRtTotalMes !== 'undefined' ? _opRtTotalMes : (op.puntos_mes || 0);
      const _lograda = _grpPts >= _metaOp;
      
      // Render Metrics (Horizontal)
      const metricsDiv = document.getElementById('op-dash-metrics');
      if (metricsDiv) {
          metricsDiv.innerHTML = `
            <div class="op-dash-metric" style="grid-column: span 4; background: rgba(94, 234, 212, 0.04); border: 1px solid rgba(94, 234, 212, 0.1); padding: 25px; border-radius: 24px; display:flex; align-items:center; gap:30px; flex-wrap:nowrap; box-shadow:0 10px 30px rgba(0,0,0,0.2);">
              <div style="flex: 0 0 auto; min-width: 160px; border-right: 1px solid rgba(94, 234, 212, 0.15); padding-right: 30px;">
                <div style="font-size: 0.65rem; letter-spacing: 2.5px; font-weight:900; color:#94a3b8; margin-bottom:6px; text-transform:uppercase;">🚀 Puntos Hoy</div>
                <div style="font-size: 4rem; color: #5eead4; line-height:1; font-weight:950; letter-spacing: -2px; text-shadow:0 0 20px rgba(94,234,212,0.3);">${_ptsDia.toFixed(1)}</div>
              </div>
              
              <div style="flex: 1;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
                   <div style="font-size:0.7rem; color:#e2e8f0; font-weight:900; text-transform:uppercase; letter-spacing:1.5px; background:rgba(255,255,255,0.05); padding:4px 12px; border-radius:10px;">
                     GRUPO ${op.group} | META: <span style="color:#5eead4;">${_metaOp}</span>
                   </div>
                   <div style="font-size:0.85rem; font-weight:950; color:${_lograda ? '#34d399' : '#fbbf24'}; text-shadow:0 0 10px ${_lograda ? 'rgba(52,211,153,0.3)' : 'rgba(251,191,36,0.2)'};">
                     ${((_grpPts / _metaOp) * 100).toFixed(1)}% CUMPLIDO
                   </div>
                </div>
                
                <div style="background:rgba(0,0,0,0.5); border-radius:20px; padding:20px; border:1px solid rgba(255,255,255,0.08); display:flex; align-items:center; gap:25px; backdrop-filter:blur(10px);">
                   <div style="flex:1;">
                     <div style="font-size: 0.6rem; color:#64748b; font-weight:800; text-transform:uppercase; margin-bottom:5px;">Puntos Reales Mes</div>
                     <div style="font-size: 2.5rem; font-weight:950; color:${_lograda ? '#34d399' : '#ffffff'}; line-height:1; letter-spacing:-1px;">${_grpPts.toLocaleString()}</div>
                     <div style="font-size: 0.65rem; color:#94a3b8; font-weight:800; margin-top:8px; display:flex; align-items:center; gap:6px;">
                        ${_lograda ? '🏆 <span style="color:#34d399;">BONO META ACTIVADO ($1.500)</span>' : `🔥 Faltan <b style="color:#e2e8f0;">${(_metaOp - _grpPts).toFixed(1)}</b> pts para el bono`}
                     </div>
                   </div>
                   <div style="flex:0 0 140px; display:flex; flex-direction:column; gap:8px; border-left:2px solid rgba(255,255,255,0.05); padding-left:20px;">
                     <div style="font-size:0.55rem; color:#64748b; font-weight:800; text-transform:uppercase;">Liquidación</div>
                     <div style="font-size:0.8rem; color:#cbd5e1; font-weight:700;">Base: <span style="color:#94a3b8;">$1.400</span></div>
                     <div style="font-size:0.8rem; color:#cbd5e1; font-weight:700;">Meta: <span style="color:${_lograda?'#34d399':'#64748b'};">$1.500</span></div>
                   </div>
                </div>
              </div>
            </div>`;
      }

      // Agente AI OpenClaw (Reemplazo de Historial)
      const agentSection = document.getElementById('op-openclaw-agent-section');
      if (agentSection) {
          agentSection.style.display = 'block';
          // El contenido se carga dinámicamente desde el motor de IA
      }
      
      // Robot Motivador Persuasivo (Auto-Trigger opcional)
      setTimeout(() => { 
        if (typeof renderNewsCarousel === 'function') renderNewsCarousel();
        console.log("[DASHBOARD] V8.6.32 Inicializado correctamente.");
      }, 500);
    }"""
            content = content[:op_view_start] + ultimate_op_view + content[op_view_end+1:]

    # 4. INSERT THE CLEAN asiCardHTML AT THE END OF THE SCRIPT
    script_end = content.rfind("</script>")
    if script_end != -1:
        content = content[:script_end] + "\n" + new_asi_card_js + "\n" + content[script_end:]

    # 5. REMOVE ANY \n LITERALS
    content = content.replace("\\n", "\n")

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("ULTIMATE MASTER REPAIR SUCCESSFUL. All systems synchronized and modernized.")

if __name__ == "__main__":
    final_master_repair()
