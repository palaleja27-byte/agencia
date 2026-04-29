import os

file_path = r'c:\Users\ADMIN\Documents\AgenciaRR\AgenciaRROriginal\agencia\index.html'

def super_cleaner():
    with open(file_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    # 1. Identify all asiCardHTML blocks
    indices = []
    for i, line in enumerate(lines):
        if 'function asiCardHTML' in line:
            indices.append(i)
    
    if not indices:
        print("No asiCardHTML found")
        return

    # We'll replace the LAST one and comment out/delete the others
    # Actually, we'll just remove all of them and put a NEW ONE at the last position
    
    # Sort indices in reverse to delete from bottom up
    indices.sort(reverse=True)
    
    new_asi_card_js = """    function asiCardHTML(name, role, groupTag) {
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

      // Perfiles
      const perfs = op?.profiles || [];
      const perfilesList = perfs.length ? perfs.map((p, pIdx) => {
          const esCob = p.tipo === 'cobertura';
          return `<div style="font-size:0.75rem; color:#e2e8f0; background:rgba(0,0,0,0.3); padding:6px 10px; border-radius:10px; display:flex; justify-content:space-between; align-items:center; margin-bottom:5px; border:1px solid rgba(255,255,255,0.04);">
            <div style="display:flex; flex-direction:column;">
              <span style="font-weight:800;">${p.id}</span>
              <span style="font-size:0.6rem; color:#64748b;">${p.model || 'MODELO'} ${esCob ? '· Cobertura' : '· Propio'}</span>
            </div>
            <span onclick="asiPerfilRemove('${sn}',${pIdx})" style="cursor:pointer; color:#f87171; font-size:1rem; padding:0 5px;">🗑️</span>
          </div>`;
      }).join('') : '<div style="font-size:0.65rem; color:#475569; padding:10px 0; font-style:italic;">Sin perfiles asignados</div>';

      return `
      <div class="asi-card" style="display: flex; flex-direction: row; gap: 0; padding: 0; background: rgba(15,23,42,0.4); border: 1px solid rgba(255,255,255,0.08); border-radius: 24px; transition: 0.3s; position:relative; overflow:hidden; min-height:160px; box-shadow:0 10px 30px rgba(0,0,0,0.2);">
        
        <!-- SECCIÓN 1: IDENTIDAD -->
        <div style="width: 200px; padding: 20px; flex-shrink: 0; display: flex; flex-direction: column; gap: 12px; border-right: 1px solid rgba(255,255,255,0.06); background: rgba(255,255,255,0.01);">
           <div style="display: flex; align-items: center; gap: 15px;">
              ${avatarHTML}
              <div style="overflow: hidden;">
                 <div style="font-size: 1.05rem; font-weight: 900; color: white; line-height: 1.1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${name}">${name}</div>
                 <div style="font-size: 0.65rem; color: #5eead4; font-weight: 800; text-transform: uppercase; margin-top:4px; letter-spacing:1px;">${groupTag}</div>
              </div>
           </div>
           <div style="font-size: 0.7rem; font-weight: 700; color: ${cur.horaIngreso ? '#34d399' : '#64748b'}; display:flex; align-items:center; gap:6px;">
              <span>${cur.horaIngreso ? '🟢 Activo: ' + cur.horaIngreso : '🔴 Inactivo'}</span>
           </div>
           <div style="display: flex; gap: 6px; margin-top: auto;">
              <button onclick="asiSetEstado('${sn}','${role}','P')" style="flex:1; height: 38px; border-radius: 12px; border: none; cursor: pointer; background: ${est === 'P' ? '#10b981' : 'rgba(255,255,255,0.05)'}; color: ${est === 'P' ? '#fff' : '#10b981'}; font-weight:800;">PRES</button>
              <button onclick="asiSetEstado('${sn}','${role}','A')" style="flex:1; height: 38px; border-radius: 12px; border: none; cursor: pointer; background: ${est === 'A' ? '#ef4444' : 'rgba(255,255,255,0.05)'}; color: ${est === 'A' ? '#fff' : '#ef4444'}; font-weight:800;">AUS</button>
              <button onclick="asiSetEstado('${sn}','${role}','T')" style="flex:1; height: 38px; border-radius: 12px; border: none; cursor: pointer; background: ${est === 'T' ? '#f59e0b' : 'rgba(255,255,255,0.05)'}; color: ${est === 'T' ? '#fff' : '#f59e0b'}; font-weight:800;">TAR</button>
           </div>
        </div>

        <!-- SECCIÓN 2: CONFIG -->
        <div style="width: 140px; padding: 20px; flex-shrink: 0; border-right: 1px solid rgba(255,255,255,0.06); display: flex; flex-direction: column; gap: 10px;">
           <div style="font-size: 0.6rem; color: #475569; text-transform: uppercase; font-weight: 900; letter-spacing: 1px;">Turno: ${tIcon} ${tAct}</div>
           <div style="display:flex; flex-direction:column; gap:5px;">
              <button onclick=\"asiSetHoras('${sn}','8')\" style=\"padding:6px; font-size:.7rem; font-weight:800; background:${hAct==8?'rgba(52,211,153,0.1)':'rgba(255,255,255,0.02)'}; border:1px solid ${hAct==8?'#34d399':'rgba(255,255,255,0.05)'}; color:${hAct==8?'#34d399':'#64748b'}; border-radius:10px; cursor:pointer;\">8 HORAS</button>
              <button onclick=\"asiSetHoras('${sn}','12')\" style=\"padding:6px; font-size:.7rem; font-weight:800; background:${hAct==12?'rgba(96,165,250,0.1)':'rgba(255,255,255,0.02)'}; border:1px solid ${hAct==12?'#60a5fa':'rgba(255,255,255,0.05)'}; color:${hAct==12?'#60a5fa':'#64748b'}; border-radius:10px; cursor:pointer;\">12 HORAS</button>
              <button onclick=\"asiSetHoras('${sn}','cambio')\" style=\"padding:6px; font-size:.7rem; font-weight:800; background:rgba(251,191,36,0.05); color:#fbbf24; border:1px solid rgba(251,191,36,0.2); border-radius:10px; cursor:pointer;\">🔄 CAMBIO</button>
           </div>
        </div>

        <!-- SECCIÓN 3: PERFILES -->
        <div style="flex: 1; padding: 20px; display: flex; flex-direction: column; gap: 10px; min-width: 250px;">
           <div style="display: flex; justify-content: space-between; align-items: center;">
              <div style="font-size: 0.65rem; color: #64748b; text-transform: uppercase; font-weight: 900;">📂 Perfiles Master (${perfs.length})</div>
              <button onclick="asiPerfilToggleForm('${sn}')" style="background:#6366f1; color:white; border:none; padding:4px 12px; border-radius:8px; font-size:0.65rem; font-weight:800; cursor:pointer; box-shadow:0 4px 10px rgba(99,102,241,0.3);">+ AGREGAR</button>
           </div>
           <div style="flex: 1; overflow-y: auto; max-height: 120px; padding-right: 5px;">
              ${perfilesList}
           </div>
           <div id="asi-form-wrap-${safeId}" style="margin-top:5px;"></div>
        </div>

        <!-- BOTONES EXTRA -->
        <div style="width: 50px; background: rgba(0,0,0,0.2); display: flex; flex-direction: column; align-items: center; padding: 15px 0; gap: 15px;">
           <button onclick="asiTerminarTurnoManual('${sn}','${role}')" style="background:none; border:none; cursor:pointer; font-size:1.4rem;" title="Cerrar Jornada">🛑</button>
           ${role === 'monitor' ? `<button onclick="asiDeleteMonitor('${sn}')" style="background:none; border:none; cursor:pointer; font-size:1.1rem; opacity:0.3;">🗑️</button>` : ''}
        </div>
      </div>`;
    }
"""

    for idx in indices:
        # Find the end of this function block
        end_idx = -1
        bracket_count = 0
        for i in range(idx, len(lines)):
            if '{' in lines[i]: bracket_count += lines[i].count('{')
            if '}' in lines[i]: bracket_count -= lines[i].count('}')
            if bracket_count == 0 and i > idx:
                end_idx = i
                break
        
        if end_idx != -1:
            # Delete the block
            del lines[idx : end_idx + 1]
    
    # 2. Find the marker for the end of the script to insert the clean version
    # Actually, we'll insert it where the LAST one was (which is now deleted)
    # But for safety, let's just append it before the last </script>
    
    script_end = -1
    for i in range(len(lines)-1, 0, -1):
        if '</script>' in lines[i]:
            script_end = i
            break
    
    if script_end != -1:
        lines.insert(script_end, new_asi_card_js + "\\n")
    
    with open(file_path, 'w', encoding='utf-8') as f:
        f.writelines(lines)
    print("Super Clean applied. All asiCardHTML duplicates removed and replaced by a single modern version.")

if __name__ == "__main__":
    super_cleaner()
