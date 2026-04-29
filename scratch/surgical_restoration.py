import os

file_path = r'c:\Users\ADMIN\Documents\AgenciaRR\AgenciaRROriginal\agencia\index.html'

def restore_and_modernize():
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # If asiKey is at the end, we need to close the script and add the modern card
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
          return `<div style="font-size:0.75rem; color:#e2e8f0; background:rgba(0,0,0,0.3); padding:8px 12px; border-radius:12px; display:flex; justify-content:space-between; align-items:center; margin-bottom:5px; border:1px solid rgba(255,255,255,0.05);">
            <div style="display:flex; flex-direction:column;">
              <span style="font-weight:900;">${p.id}</span>
              <span style="font-size:0.55rem; color:#6366f1; font-weight:800;">${p.model || 'ID'}</span>
            </div>
            <span onclick="asiPerfilRemove('${sn}',${pIdx})" style="cursor:pointer; font-size:1.2rem; padding:0 5px;">🗑️</span>
          </div>`;
      }).join('') : '<div style="font-size:0.65rem; color:#475569; padding:10px 0; font-style:italic;">Sin perfiles</div>';

      return `
      <div class="asi-card" style="display: flex; flex-direction: row; gap: 0; padding: 0; background: #0f172a; border: 1px solid rgba(255,255,255,0.08); border-radius: 24px; transition: 0.3s; position:relative; overflow:hidden; min-height:160px;">
        <div style="width: 200px; padding: 20px; flex-shrink: 0; display: flex; flex-direction: column; gap: 12px; border-right: 1px solid rgba(255,255,255,0.06);">
           <div style="display: flex; align-items: center; gap: 12px;">
              ${avatarHTML}
              <div style="overflow: hidden;">
                 <div style="font-size: 0.95rem; font-weight: 800; color: white; line-height: 1.1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${name}</div>
                 <div style="font-size: 0.6rem; color: #5eead4; font-weight: 700; text-transform: uppercase;">${groupTag}</div>
              </div>
           </div>
           <div style="font-size: 0.65rem; color: ${cur.horaIngreso ? '#34d399' : '#475569'}; font-weight:700;">
              ${cur.horaIngreso ? '🟢 ' + cur.horaIngreso : '🔴 Inactivo'}
           </div>
           <div style="display: flex; gap: 4px; margin-top: auto;">
              <button onclick="asiSetEstado('${sn}','${role}','P')" style="flex:1; height: 34px; border-radius: 10px; border: none; cursor: pointer; background: ${est === 'P' ? '#10b981' : 'rgba(255,255,255,0.05)'}; color: ${est === 'P' ? '#fff' : '#10b981'}; font-weight:800;">PRES</button>
              <button onclick="asiSetEstado('${sn}','${role}','A')" style="flex:1; height: 34px; border-radius: 10px; border: none; cursor: pointer; background: ${est === 'A' ? '#ef4444' : 'rgba(255,255,255,0.05)'}; color: ${est === 'A' ? '#fff' : '#ef4444'}; font-weight:800;">AUS</button>
           </div>
        </div>
        <div style="width: 130px; padding: 20px; flex-shrink: 0; border-right: 1px solid rgba(255,255,255,0.06); display: flex; flex-direction: column; gap: 8px;">
           <div style="font-size: 0.55rem; color: #475569; text-transform: uppercase; font-weight: 800;">Turno ${tIcon}</div>
           <button onclick=\"asiSetHoras('${sn}','8')\" style=\"padding:5px; font-size:.65rem; font-weight:700; background:${hAct==8?'rgba(52,211,153,0.1)':'rgba(255,255,255,0.03)'}; border:1px solid ${hAct==8?'#34d399':'transparent'}; color:${hAct==8?'#34d399':'#64748b'}; border-radius:8px; cursor:pointer;\">8H</button>
           <button onclick=\"asiSetHoras('${sn}','12')\" style=\"padding:5px; font-size:.65rem; font-weight:700; background:${hAct==12?'rgba(96,165,250,0.1)':'rgba(255,255,255,0.03)'}; border:1px solid ${hAct==12?'#60a5fa':'transparent'}; color:${hAct==12?'#60a5fa':'#64748b'}; border-radius:8px; cursor:pointer;\">12H</button>
           <button onclick=\"asiSetHoras('${sn}','cambio')\" style=\"padding:5px; font-size:.65rem; font-weight:700; background:rgba(251,191,36,0.05); color:#fbbf24; border:1px solid rgba(251,191,36,0.2); border-radius:8px; cursor:pointer;\">🔄 CAMBIO</button>
        </div>
        <div style="flex: 1; padding: 20px; display: flex; flex-direction: column; gap: 10px;">
           <div style="display: flex; justify-content: space-between; align-items: center;">
              <div style="font-size: 0.65rem; color: #64748b; text-transform: uppercase; font-weight: 800;">Perfiles (${perfs.length})</div>
              <button onclick="asiPerfilToggleForm('${sn}')" style="background:#6366f1; color:white; border:none; padding:3px 10px; border-radius:8px; font-size:0.6rem; font-weight:800; cursor:pointer;">+ AGREGAR</button>
           </div>
           <div style="flex: 1; overflow-y: auto; max-height: 100px; padding-right: 5px;">
              ${perfilesList}
           </div>
        </div>
        <div style="width: 50px; background: rgba(0,0,0,0.2); display: flex; flex-direction: column; align-items: center; padding: 20px 0; gap: 20px;">
           <button onclick="asiTerminarTurnoManual('${sn}','${role}')" style="background:none; border:none; cursor:pointer; font-size:1.3rem;">🛑</button>
        </div>
      </div>`;
    }
    """

    # Check if closing tags are missing
    if "</html>" not in content[-100:]:
        print("Restoring closing tags...")
        content += "\n" + new_asi_card_js + "\n"
        content += "\n    </script>\n  </body>\n</html>"

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("Surgical restoration successful.")

if __name__ == "__main__":
    restore_and_modernize()
