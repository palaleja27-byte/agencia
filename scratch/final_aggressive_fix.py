import os

file_path = r'c:\Users\ADMIN\Documents\AgenciaRR\AgenciaRROriginal\agencia\index.html'

def final_aggressive_fix():
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Use !important in the inline styles to win over any CSS rules
    horizontal_card_html = """
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
          return `<div style="font-size:0.75rem; color:#e2e8f0; background:rgba(0,0,0,0.3); padding:8px 12px; border-radius:12px; display:flex; justify-content:space-between; align-items:center; margin-bottom:5px; border:1px solid rgba(255,255,255,0.05);">
            <div style="display:flex; flex-direction:column;">
              <span style="font-weight:900;">${p.id}</span>
              <span style="font-size:0.55rem; color:#6366f1; font-weight:800;">${p.model || 'ID'}</span>
            </div>
            <span onclick="asiPerfilRemove('${sn}',${pIdx})" style="cursor:pointer; font-size:1.2rem; padding:0 5px;">🗑️</span>
          </div>`;
      }).join('') : '<div style="font-size:0.65rem; color:#475569; padding:10px 0; font-style:italic; text-align:center;">Sin perfiles</div>';

      return `
      <div class="asi-card" style="display: flex !important; flex-direction: row !important; gap: 0 !important; padding: 0 !important; background: #0f172a !important; border: 1px solid rgba(255,255,255,0.1) !important; border-radius: 24px !important; transition: 0.3s !important; position:relative !important; overflow:hidden !important; min-height:160px !important; width:100% !important;">
        
        <!-- SECCION 1 -->
        <div style="width: 210px !important; padding: 20px !important; flex-shrink: 0 !important; display: flex !important; flex-direction: column !important; gap: 12px !important; border-right: 1px solid rgba(255,255,255,0.06) !important;">
           <div style="display: flex !important; align-items: center !important; gap: 12px !important;">
              ${avatarHTML}
              <div style="overflow: hidden !important;">
                 <div style="font-size: 0.95rem !important; font-weight: 800 !important; color: white !important; line-height: 1.1 !important; white-space: nowrap !important; overflow: hidden !important; text-overflow: ellipsis !important;">${name}</div>
                 <div style="font-size: 0.6rem !important; color: #5eead4 !important; font-weight: 700 !important; text-transform: uppercase !important;">${groupTag}</div>
              </div>
           </div>
           <div style="font-size: 0.65rem !important; color: ${cur.horaIngreso ? '#34d399' : '#475569'} !important; font-weight:700 !important;">
              ${cur.horaIngreso ? '🟢 ' + cur.horaIngreso : '🔴 Inactivo'}
           </div>
           <div style="display: flex !important; gap: 4px !important; margin-top: auto !important;">
              <button onclick="asiSetEstado('${sn}','${role}','P')" style="flex:1 !important; height: 34px !important; border-radius: 10px !important; border: none !important; cursor: pointer !important; background: ${est === 'P' ? '#10b981' : 'rgba(255,255,255,0.05)'} !important; color: ${est === 'P' ? '#fff' : '#10b981'} !important; font-weight:800 !important;">PRES</button>
              <button onclick="asiSetEstado('${sn}','${role}','A')" style="flex:1 !important; height: 34px !important; border-radius: 10px !important; border: none !important; cursor: pointer !important; background: ${est === 'A' ? '#ef4444' : 'rgba(255,255,255,0.05)'} !important; color: ${est === 'A' ? '#fff' : '#ef4444'} !important; font-weight:800 !important;">AUS</button>
           </div>
        </div>

        <!-- SECCION 2 -->
        <div style="width: 140px !important; padding: 20px !important; flex-shrink: 0 !important; border-right: 1px solid rgba(255,255,255,0.06) !important; display: flex !important; flex-direction: column !important; gap: 8px !important;">
           <div style="font-size: 0.55rem !important; color: #475569 !important; text-transform: uppercase !important; font-weight: 800 !important;">Turno ${tIcon}</div>
           <button onclick="asiSetHoras('${sn}','8')" style="padding:5px !important; font-size:.65rem !important; font-weight:700 !important; background:${hAct==8?'rgba(52,211,153,0.1)':'rgba(255,255,255,0.03)'} !important; border:1px solid ${hAct==8?'#34d399':'transparent'} !important; color:${hAct==8?'#34d399':'#64748b'} !important; border-radius:8px !important; cursor:pointer !important;">8H</button>
           <button onclick="asiSetHoras('${sn}','12')" style="padding:5px !important; font-size:.65rem !important; font-weight:700 !important; background:${hAct==12?'rgba(96,165,250,0.1)':'rgba(255,255,255,0.03)'} !important; border:1px solid ${hAct==12?'#60a5fa':'transparent'} !important; color:${hAct==12?'#60a5fa':'#64748b'} !important; border-radius:8px !important; cursor:pointer !important;">12H</button>
           <button onclick="asiSetHoras('${sn}','cambio')" style="padding:5px !important; font-size:.65rem !important; font-weight:700 !important; background:rgba(251,191,36,0.05) !important; color:#fbbf24 !important; border:1px solid rgba(251,191,36,0.2) !important; border-radius:8px !important; cursor:pointer !important;">🔄 CAMBIO</button>
        </div>

        <!-- SECCION 3 -->
        <div style="flex: 1 !important; padding: 20px !important; display: flex !important; flex-direction: column !important; gap: 10px !important;">
           <div style="display: flex !important; justify-content: space-between !important; align-items: center !important;">
              <div style="font-size: 0.65rem !important; color: #64748b !important; text-transform: uppercase !important; font-weight: 800 !important;">Perfiles (${perfs.length})</div>
              <button onclick="asiPerfilToggleForm('${sn}')" style="background:#6366f1 !important; color:white !important; border:none !important; padding:4px 10px !important; border-radius:8px !important; font-size:0.6rem !important; font-weight:800 !important; cursor:pointer !important;">+ AGREGAR</button>
           </div>
           <div style="flex: 1 !important; overflow-y: auto !important; max-height: 110px !important; padding-right: 5px !important;">
              ${perfilesList}
           </div>
        </div>

        <!-- SIDE -->
        <div style="width: 55px !important; background: rgba(0,0,0,0.2) !important; display: flex !important; flex-direction: column !important; align-items: center !important; padding: 20px 0 !important; gap: 20px !important;">
           <button onclick="asiTerminarTurnoManual('${sn}','${role}')" style="background:none !important; border:none !important; cursor:pointer !important; font-size:1.3rem !important;">🛑</button>
        </div>
      </div>`;
    }
    """

    import re
    # Replace ALL definitions of asiCardHTML with the horizontal version
    content = re.sub(r'function asiCardHTML\(.*?\)\s*\{.*?\}', horizontal_card_html, content, flags=re.DOTALL)

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("Aggressive horizontal fix applied to all instances.")

if __name__ == "__main__":
    final_aggressive_fix()
