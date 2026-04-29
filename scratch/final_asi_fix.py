import os

file_path = r'c:\Users\ADMIN\Documents\AgenciaRR\AgenciaRROriginal\agencia\index.html'

def final_asi_fix():
    with open(file_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    # Find the REAL asiCardHTML function
    # We'll look for the one that has "profiles-section" in it
    target_idx = -1
    for i, line in enumerate(lines):
        if 'function asiCardHTML(name, role, groupTag)' in line and i > 13000:
            # Check if this one has perfiles logic
            found_perfiles = False
            for j in range(i, i + 50):
                if j < len(lines) and 'perfilesHTML =' in lines[j]:
                    found_perfiles = True
                    break
            if found_perfiles:
                target_idx = i
                break
    
    if target_idx == -1:
        print("Could not find the target asiCardHTML function")
        return

    # Find end of function
    end_idx = -1
    bracket_count = 0
    for i in range(target_idx, len(lines)):
        if '{' in lines[i]: bracket_count += lines[i].count('{')
        if '}' in lines[i]: bracket_count -= lines[i].count('}')
        if bracket_count == 0 and i > target_idx:
            end_idx = i
            break
    
    if end_idx == -1:
        print("Could not find end of asiCardHTML")
        return

    new_asi_card_js = """    function asiCardHTML(name, role, groupTag) {
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
      const safeId = name.replace(/[^a-zA-Z0-9]/g, '_');

      // --- Perfiles Logic ---
      const perfs = op?.profiles || [];
      const perfilesList = perfs.length ? perfs.map((p, pIdx) => {
          const esCob = p.tipo === 'cobertura';
          return `<div style="font-size:0.7rem; color:#e2e8f0; background:rgba(255,255,255,0.03); padding:4px 8px; border-radius:8px; display:flex; justify-content:space-between; align-items:center; margin-bottom:4px; border:1px solid rgba(255,255,255,0.03);">
            <span>${p.id} <small style="color:#64748b;">(${p.model || 'ID'})</small></span>
            <span onclick="asiPerfilRemove('${sn}',${pIdx})" style="cursor:pointer; color:#f87171; font-size:0.8rem; margin-left:8px;">×</span>
          </div>`;
      }).join('') : '<div style="font-size:0.6rem; color:#475569; font-style:italic;">Sin perfiles</div>';

      return `
      <div class="asi-card" style="display: flex; flex-direction: row; gap: 20px; padding: 20px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); border-radius: 24px; transition: 0.3s; position:relative; overflow:hidden; align-items: stretch;">
        
        <!-- SECCIÓN 1: IDENTIDAD (150px) -->
        <div style="width: 150px; flex-shrink: 0; display: flex; flex-direction: column; gap: 10px;">
           <div style="display: flex; align-items: center; gap: 12px;">
              ${avatarHTML}
              <div style="overflow: hidden;">
                 <div style="font-size: 0.95rem; font-weight: 800; color: white; line-height: 1.1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${name}">${name}</div>
                 <div style="font-size: 0.6rem; color: #64748b; font-weight: 700; text-transform: uppercase; margin-top:3px;">${groupTag}</div>
              </div>
           </div>
           <div style="font-size: 0.65rem; color: ${cur.horaIngreso ? '#34d399' : '#475569'}; font-weight:700;">
              ${cur.horaIngreso ? '🟢 ' + cur.horaIngreso : '🔴 Inactivo'}
           </div>
           <div style="display: flex; gap: 4px; margin-top: auto;">
              <button onclick="asiSetEstado('${sn}','${role}','P')" style="flex:1; height: 32px; border-radius: 10px; border: none; cursor: pointer; background: ${est === 'P' ? '#10b981' : 'rgba(16,185,129,0.05)'}; color: ${est === 'P' ? '#fff' : '#10b981'}; transition: 0.2s; font-size: 0.8rem;">✅</button>
              <button onclick="asiSetEstado('${sn}','${role}','A')" style="flex:1; height: 32px; border-radius: 10px; border: none; cursor: pointer; background: ${est === 'A' ? '#ef4444' : 'rgba(239,68,68,0.05)'}; color: ${est === 'A' ? '#fff' : '#ef4444'}; transition: 0.2s; font-size: 0.8rem;">❌</button>
              <button onclick="asiSetEstado('${sn}','${role}','T')" style="flex:1; height: 32px; border-radius: 10px; border: none; cursor: pointer; background: ${est === 'T' ? '#f59e0b' : 'rgba(245,158,11,0.05)'}; color: ${est === 'T' ? '#fff' : '#f59e0b'}; transition: 0.2s; font-size: 0.8rem;">⏰</button>
           </div>
        </div>

        <!-- SECCIÓN 2: CONFIGURACIÓN (120px) -->
        <div style="width: 120px; flex-shrink: 0; border-left: 1px solid rgba(255,255,255,0.05); padding-left: 20px; display: flex; flex-direction: column; gap: 8px;">
           <div style="font-size: 0.55rem; color: #475569; text-transform: uppercase; font-weight: 800; letter-spacing: 0.5px;">Turno ${tIcon}</div>
           <div style="display:flex; flex-direction:column; gap:4px;">
              <button onclick=\"asiSetHoras('${sn}','8')\" style=\"padding:5px; font-size:.65rem; font-weight:700; background:${hAct==8?'rgba(52,211,153,0.15)':'rgba(255,255,255,0.03)'}; border:1px solid ${hAct==8?'#34d399':'transparent'}; color:${hAct==8?'#34d399':'#64748b'}; border-radius:8px; cursor:pointer;\">8 HORAS</button>
              <button onclick=\"asiSetHoras('${sn}','12')\" style=\"padding:5px; font-size:.65rem; font-weight:700; background:${hAct==12?'rgba(96,165,250,0.15)':'rgba(255,255,255,0.03)'}; border:1px solid ${hAct==12?'#60a5fa':'transparent'}; color:${hAct==12?'#60a5fa':'#64748b'}; border-radius:8px; cursor:pointer;\">12 HORAS</button>
              <button onclick=\"asiSetHoras('${sn}','cambio')\" style=\"padding:5px; font-size:.65rem; font-weight:700; background:rgba(251,191,36,0.05); color:#fbbf24; border:1px solid rgba(251,191,36,0.2); border-radius:8px; cursor:pointer;\">🔄 CAMBIO</button>
           </div>
        </div>

        <!-- SECCIÓN 3: PERFILES (Flexible) -->
        <div style="flex: 1; border-left: 1px solid rgba(255,255,255,0.05); padding-left: 20px; display: flex; flex-direction: column; gap: 8px;">
           <div style="display: flex; justify-content: space-between; align-items: center;">
              <div style="font-size: 0.6rem; color: #64748b; text-transform: uppercase; font-weight: 800;">Perfiles (${perfs.length})</div>
              <button onclick="asiPerfilToggleForm('${sn}')" style="background:rgba(99,102,241,0.2); color:#818cf8; border:none; padding:2px 8px; border-radius:6px; font-size:0.6rem; font-weight:800; cursor:pointer;">+ AGREGAR</button>
           </div>
           <div style="flex: 1; overflow-y: auto; max-height: 85px; padding-right: 5px;">
              ${perfilesList}
           </div>
           ${renderAsiProfileForm ? renderAsiProfileForm(safeId, sn) : ''}
        </div>

        <!-- BOTONES ACCIÓN RÁPIDA -->
        <div style="display: flex; flex-direction: column; justify-content: center; gap: 8px;">
           <button onclick="asiTerminarTurnoManual('${sn}','${role}')" style="background:none; border:none; cursor:pointer; font-size:1.2rem;" title="Finalizar Jornada">⏹️</button>
           ${role === 'monitor' ? `<button onclick="asiDeleteMonitor('${sn}')" style="background:none; border:none; cursor:pointer; font-size:1rem; opacity:0.3;">🗑️</button>` : ''}
        </div>
      </div>`;
    }\n"""
    
    lines[target_idx:end_idx+1] = [new_asi_card_js]

    with open(file_path, 'w', encoding='utf-8') as f:
        f.writelines(lines)
    print("Horizontal Attendance Cards fix applied.")

if __name__ == "__main__":
    final_asi_fix()
