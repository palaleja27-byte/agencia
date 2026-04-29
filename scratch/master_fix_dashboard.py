import os

file_path = r'c:\Users\ADMIN\Documents\AgenciaRR\AgenciaRROriginal\agencia\index.html'

def fix_all():
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Fix HTML Grid
    old_grid = '<div id="asi-ops-grid" style="display:block;"></div>'
    new_grid = '<div id="asi-ops-grid" style="display:grid; grid-template-columns: repeat(auto-fill, minmax(380px, 1fr)); gap:20px;"></div>'
    content = content.replace(old_grid, new_grid)

    # 2. Fix Script Logic (asiKey, asiCardHTML, etc.)
    # We'll locate the block starting from // MODULO ASISTENCIA
    start_marker = "// —————————— MÓDULO ASISTENCIA ——————————"
    if start_marker not in content:
        start_marker = "// —————————— MÓDULO ASISTENCIA ——————————" # fallback search
    
    # Actually, I'll just find where asiKey starts and replace until the end of the cards logic
    # Looking at the provided snippet, it starts around 13832
    
    # We'll use a safer approach: replace the mangled functions
    
    # Fix abrirRobotMotivador
    robot_start = "window.abrirRobotMotivador = function() {"
    # Find the end of this function
    r_start_idx = content.find(robot_start)
    if r_start_idx != -1:
        # Find end (crude closing brace matching)
        bracket_count = 0
        r_end_idx = -1
        for i in range(r_start_idx + len(robot_start), len(content)):
            if content[i] == '{': bracket_count += 1
            if content[i] == '}':
                if bracket_count == 0:
                    r_end_idx = i
                    break
                else:
                    bracket_count -= 1
        
        if r_end_idx != -1:
            new_robot_code = """window.abrirRobotMotivador = function() {
      const opName = currentOpName;
      if (!opName) return;
      
      const op = operatorsData.find(o => _normName(o.name) === _normName(opName));
      if (!op) return;
      
      const pts = getPuntosHoy(opName);
      const meta = (typeof getMetaValue === 'function') ? getMetaValue('grupo', op.group, 'dia') : 100;
      const key = localStorage.getItem('rr_ai_api_key');

      const playlistTrends = [
        "Techno Industrial & Cyberpunk 2077 Beats",
        "Afrobeat & Global Dance Trends 2026",
        "Reggaetón New Era (Bad Bunny x Feid Vibes)",
        "Hardstyle para Enfoque Extremo",
        "Phonk Industrial (High Tempo Focus)"
      ];
      const randomTrack = playlistTrends[Math.floor(Math.random() * playlistTrends.length)];

      let title = "SISTEMA OPERATIVO: ACTIVO";
      let msg = "";

      // Si hay API Key, generamos un mensaje "inteligente" (simulado o real si tuviéramos el wrapper)
      if (key) {
         title = "ANALIZADOR AI: PREMIUM ACTIVO";
         if (pts === 0) {
            msg = `Analizando métricas de <b>${opName}</b>... Sector inactivo detectado. Estrategia: "Rompe el hielo". El algoritmo sugiere <b>${randomTrack}</b> para entrar en flujo. ¡Los primeros 5 puntos son clave para el algoritmo de hoy!`;
         } else if (pts < meta) {
            msg = `Progreso detectado: <b>${pts.toFixed(1)} pts</b>. Estás al ${(pts/meta*100).toFixed(0)}% de la meta grupal. Recomendación: Incrementa el ritmo un 15%. La IA detecta potencial de Bonus mÁximo ($1500). ¡Dale volumen a esa música y conquista el sector!`;
         } else {
            msg = `¡ESTADO LEGENDARIO DETECTADO! <b>${pts.toFixed(1)} pts</b> superados. Nivel de eficiencia: 120%. Estás en modo "God View". El sistema recomienda 3 min de descanso con <b>Lo-Fi Cyber</b> y luego seguir recolectando bonus infinitos.`;
         }
      } else {
         // Fallback estático mejorado
         if (pts === 0) {
           msg = `Detecto inactividad, <b>${opName}</b>. ⚡ El éxito llega por ejecución. Ponle play a <b>${randomTrack}</b> y arranca con tu primer punto. ¡El algoritmo está listo para ti!`;
           title = "ORDEN DE ARRANQUE";
         } else if (pts < meta) {
           msg = `Buen inicio. Llevamos <b>${pts.toFixed(1)} pts</b>. ¡Tu grupo ${op.group} cuenta con tu potencia! Escucha <b>${randomTrack}</b> para no perder el ritmo.`;
         } else {
           msg = `¡ESTADO LEGENDARIO! Has superado la meta. Ya estás en modo cosecha máxima. ¡Eres imparable!`;
           title = "META SUPERADA";
         }
      }

      const modalHTML = `
        <div id="modal-robot-ai" style="position:fixed; inset:0; background:rgba(2,6,23,0.95); z-index:10000; display:flex; align-items:center; justify-content:center; backdrop-filter:blur(20px);">
          <div style="background:linear-gradient(135deg, #0f172a, #1e293b); border:1px solid rgba(94,234,212,0.5); border-radius:32px; padding:40px; width:90%; max-width:450px; text-align:center; box-shadow:0 0 80px rgba(94,234,212,0.3); position:relative; overflow:hidden; animation: fadeInModal .4s cubic-bezier(0.16, 1, 0.3, 1);">
            <div style="position:absolute; top:0; left:0; width:100%; height:4px; background:linear-gradient(90deg,transparent,#5eead4,transparent);"></div>
            <div style="font-size:5rem; margin-bottom:20px; animation: glitchRobot 2s infinite;">🤖</div>
            <div style="font-size:0.75rem; font-weight:900; color:#5eead4; text-transform:uppercase; letter-spacing:5px; margin-bottom:10px; opacity:0.9;">${title}</div>
            <div style="font-size:1.3rem; font-weight:900; color:white; margin-bottom:25px; font-family:'Montserrat',sans-serif; letter-spacing:1px; text-transform:uppercase;">Analizador Agencia RR v8.6</div>
            <div style="font-size:1rem; color:#cbd5e1; line-height:1.7; margin-bottom:32px; font-weight:500;">${msg}</div>
            <div style="background:rgba(94,234,212,0.08); padding:16px; border-radius:16px; border:1px dashed rgba(94,234,212,0.3); margin-bottom:30px;">
              <div style="font-size:0.65rem; color:#5eead4; font-weight:900; text-transform:uppercase; margin-bottom:6px; letter-spacing:1px;">🚀 Hack de Productividad</div>
              <div style="font-size:0.8rem; color:#e2e8f0;">${pts < meta ? "Limpia tu bandeja cada 15 min y mantén el scroll activo para visibilizar perfiles." : "¡Objetivo cumplido! Disfruta del multiplicador de puntos activo."}</div>
            </div>
            <button onclick="document.getElementById('modal-robot-ai').remove()" class="btn-neumorphic" style="width:100%; padding:20px; color:#5eead4; border-color:rgba(94,234,212,0.3); font-size:0.9rem; font-weight:800; border-radius:16px;">VOLVER AL FLUJO DE TRABAJO</button>
          </div>
        </div>`;
      document.body.insertAdjacentHTML('beforeend', modalHTML);
    };"""
            content = content[:r_start_idx] + new_robot_code + content[r_end_idx+1:]

    # 3. Fix Assistance Logic (Admin View)
    # Search for function asiKey(name, role) { ... }
    # In the current mangled file, asiKey has the body of asiCardHTML.
    
    asi_logic_start = content.find("function asiKey(name, role) {")
    # We need to find the end of this whole mess (asiKey + mangled template)
    # It ends before function asiSetEstado or similar
    asi_logic_end = content.find("function asiSetEstado(name, role, estado) {")
    
    if asi_logic_start != -1 and asi_logic_end != -1:
        new_asi_logic = """function asiKey(name, role) {
      return 'asi_' + role + '_' + name.replace(/\\s+/g, '_').toLowerCase();
    }

    function asiCardHTML(name, role, groupTag) {
      const k = asiKey(name, role);
      const cur = asiEstados[k] || { estado: '', nota: '' };
      const est = cur.estado;
      const av = (typeof getAvatar === 'function') ? getAvatar(name) : null;
      const avatarHTML = av 
        ? `<div style="width:50px; height:50px; border-radius:15px; overflow:hidden; border:2px solid rgba(255,255,255,0.1); flex-shrink:0;"><img src="${av}" style="width:100%; height:100%; object-fit:cover;"></div>` 
        : `<div style="width:50px; height:50px; border-radius:15px; background:rgba(255,255,255,0.05); display:flex; align-items:center; justify-content:center; font-size:1.6rem; border:1px solid rgba(255,255,255,0.1); flex-shrink:0;">👤</div>`;
      
      const sn = name.replace(/\\\\/g, '\\\\\\\\').replace(/'/g, \"\\\\'\");
      const op = (typeof operatorsData !== 'undefined') ? operatorsData.find(o => _normName(o.name) === _normName(name)) : null;
      const hReg = asiGetHoras(name);
      const hAct = hReg?.horas || op?.turno_horas || 8;
      const tAct = op?.turno || 'Mañana';
      const tIcon = tAct === 'Mañana' ? '☀️' : tAct === 'Tarde' ? '🌆' : tAct === 'Noche' ? '🌙' : '🔄';

      // --- ESTRUCTURA HORIZONTAL PREMIUM ---
      return `
      <div class="asi-card" style="display: flex; flex-direction: row; align-items: center; gap: 20px; padding: 15px 25px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); border-radius: 20px; transition: 0.3s; position:relative; overflow:hidden;">
        <!-- Lado Izquierdo: Info Personal -->
        <div style="display: flex; align-items: center; gap: 15px; min-width: 180px;">
           ${avatarHTML}
           <div style="flex: 1;">
              <div style="font-size: 0.95rem; font-weight: 800; color: white; line-height: 1.1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 120px;">${name}</div>
              <div style="font-size: 0.6rem; color: #64748b; font-weight: 700; text-transform: uppercase; margin-top:3px;">Grupo ${op?.group || '—'} · ${role.toUpperCase()}</div>
              <div style="font-size: 0.7rem; color: ${cur.horaIngreso ? '#34d399' : '#475569'}; font-weight:700; margin-top:2px;">${cur.horaIngreso ? '🟢 ' + cur.horaIngreso : '🔴 Inactivo'}</div>
           </div>
        </div>

        <!-- Centro: Selectores de Estado -->
        <div style="display: flex; gap: 8px; border-left: 1px solid rgba(255,255,255,0.05); border-right: 1px solid rgba(255,255,255,0.05); padding: 0 20px;">
           <button onclick="asiSetEstado('${sn}','${role}','P')" style="width: 38px; height: 38px; border-radius: 12px; border: none; cursor: pointer; background: ${est === 'P' ? '#10b981' : 'rgba(16,185,129,0.05)'}; color: ${est === 'P' ? '#fff' : '#10b981'}; transition: 0.2s; font-size: 0.9rem;" title="Presente">✅</button>
           <button onclick="asiSetEstado('${sn}','${role}','A')" style="width: 38px; height: 38px; border-radius: 12px; border: none; cursor: pointer; background: ${est === 'A' ? '#ef4444' : 'rgba(239,68,68,0.05)'}; color: ${est === 'A' ? '#fff' : '#ef4444'}; transition: 0.2s; font-size: 0.9rem;" title="Ausente">❌</button>
           <button onclick="asiSetEstado('${sn}','${role}','T')" style="width: 38px; height: 38px; border-radius: 12px; border: none; cursor: pointer; background: ${est === 'T' ? '#f59e0b' : 'rgba(245,158,11,0.05)'}; color: ${est === 'T' ? '#fff' : '#f59e0b'}; transition: 0.2s; font-size: 0.9rem;" title="Tarde">⏰</button>
        </div>

        <!-- Lado Derecho: Configuración y Nota -->
        <div style="flex: 1; display: flex; align-items: center; gap: 15px;">
           <div style="background: rgba(0,0,0,0.2); padding: 5px 10px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.03); display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 0.6rem; color: #475569; font-weight: 800;">HORAS:</span>
              <div style="display:flex; gap:3px;">
                 <button onclick=\"asiSetHoras('${sn}','8')\" style=\"padding:3px 8px; font-size:.65rem; font-weight:700; background:${hAct==8?'rgba(52,211,153,0.15)':'rgba(255,255,255,0.03)'}; border:1px solid ${hAct==8?'#34d399':'transparent'}; color:${hAct==8?'#34d399':'#64748b'}; border-radius:6px; cursor:pointer;\">8H</button>
                 <button onclick=\"asiSetHoras('${sn}','12')\" style=\"padding:3px 8px; font-size:.65rem; font-weight:700; background:${hAct==12?'rgba(96,165,250,0.15)':'rgba(255,255,255,0.03)'}; border:1px solid ${hAct==12?'#60a5fa':'transparent'}; color:${hAct==12?'#60a5fa':'#64748b'}; border-radius:6px; cursor:pointer;\">12H</button>
              </div>
           </div>
           
           <div style=\"flex: 1;\">
              ${(est === 'A' || est === 'T') 
                ? `<input type=\"text\" placeholder=\"Nota/Motivo...\" value=\"${cur.nota || ''}\"
                    onchange=\"asiSetNota('${sn}','${role}',this.value)\"
                    style=\"width: 100%; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; padding: 8px 12px; color: white; font-size: 0.75rem; outline: none; box-sizing: border-box;\">`
                : `<div style=\"font-size:0.6rem; color:#475569; font-style:italic;\">Perfil: ${op?.profiles?.length || 0} asignados</div>`
              }
           </div>
           
           <button onclick=\"asiTerminarTurnoManual('${sn}','${role}')\" style=\"background:none; border:none; cursor:pointer; font-size:1.1rem; padding:5px; opacity:0.5; transition:0.3s;\" onmouseover=\"this.style.opacity=1\" onmouseout=\"this.style.opacity=0.5\" title=\"Cerrar Jornada\">⏹️</button>
        </div>
      </div>`;
    }

    """
        content = content[:asi_logic_start] + new_asi_logic + content[asi_logic_end:]

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("Master fix applied.")

if __name__ == "__main__":
    fix_all()
