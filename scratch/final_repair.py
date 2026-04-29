import os

file_path = r'c:\Users\ADMIN\Documents\AgenciaRR\AgenciaRROriginal\agencia\index.html'

def final_repair():
    with open(file_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    # Find the start of the assistance logic
    start_asi = -1
    for i, line in enumerate(lines):
        if 'function asiRender()' in line:
            start_asi = i
            break
    
    if start_asi == -1:
        print("Could not find asiRender")
        return

    # Everything from start_asi to the end of the script block or until a known stable point
    # We'll search for where asiCardHTML logic ends
    end_asi = -1
    for i in range(start_asi, len(lines)):
        if 'function asiPerfilToggleForm' in lines[i]:
            end_asi = i
            break
    
    if end_asi == -1:
        end_asi = len(lines)

    new_asi_block = [
        "    function asiRender() {\n",
        "      const turno = localStorage.getItem(ASI_SHIFT_KEY) || 'Todos';\n",
        "      const grid = document.getElementById('asi-ops-grid');\n",
        "      if (!grid) return;\n",
        "      grid.innerHTML = '';\n",
        "      \n",
        "      const filtered = operatorsData.filter(op => {\n",
        "        if (turno === 'Todos') return true;\n",
        "        return (op.turno || 'Mañana').toLowerCase() === turno.toLowerCase();\n",
        "      });\n",
        "\n",
        "      filtered.forEach(op => {\n",
        "        grid.innerHTML += asiCardHTML(op.name, 'operador', op.group);\n",
        "      });\n",
        "\n",
        "      // Update buttons style\n",
        "      ['Todos', 'Mañana', 'Tarde', 'Noche'].forEach(t => {\n",
        "        const btn = document.getElementById('asi-turno-' + t);\n",
        "        if (btn) {\n",
        "           const active = t === turno;\n",
        "           btn.style.color = active ? '#5eead4' : '#64748b';\n",
        "           btn.style.background = active ? 'rgba(94,234,212,.1)' : 'rgba(255,255,255,.03)';\n",
        "           btn.style.borderColor = active ? 'rgba(94,234,212,.4)' : 'rgba(255,255,255,.1)';\n",
        "        }\n",
        "      });\n",
        "    }\n",
        "\n",
        "    function asiKey(name, role) {\n",
        "      return 'asi_' + role + '_' + name.replace(/\\s+/g, '_').toLowerCase();\n",
        "    }\n",
        "\n",
        "    function asiCardHTML(name, role, groupTag) {\n",
        "      const k = asiKey(name, role);\n",
        "      const cur = asiEstados[k] || { estado: '', nota: '' };\n",
        "      const est = cur.estado;\n",
        "      const av = (typeof getAvatar === 'function') ? getAvatar(name) : null;\n",
        "      const avatarHTML = av \n",
        "        ? `<div style=\"width:45px; height:45px; border-radius:14px; overflow:hidden; border:2px solid rgba(255,255,255,0.1);\"><img src=\"${av}\" style=\"width:100%; height:100%; object-fit:cover;\"></div>` \n",
        "        : `<div style=\"width:45px; height:45px; border-radius:14px; background:rgba(255,255,255,0.05); display:flex; align-items:center; justify-content:center; font-size:1.5rem; border:1px solid rgba(255,255,255,0.1);\">👤</div>`;\n",
        "      \n",
        "      const sn = name.replace(/\\\\/g, '\\\\\\\\').replace(/'/g, \"\\\\'\");\n",
        "      const op = (typeof operatorsData !== 'undefined') ? operatorsData.find(o => _normName(o.name) === _normName(name)) : null;\n",
        "      const hReg = asiGetHoras(name);\n",
        "      const hAct = hReg?.horas || op?.turno_horas || 8;\n",
        "      const tAct = op?.turno || 'Mañana';\n",
        "      const tIcon = tAct === 'Mañana' ? '☀️' : tAct === 'Tarde' ? '🌆' : tAct === 'Noche' ? '🌙' : '🔄';\n",
        "\n",
        "      return `\n",
        "      <div class=\"asi-card\" style=\"display: flex; flex-direction: column; gap: 15px; padding: 20px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); border-radius: 24px; transition: 0.3s; position:relative; overflow:hidden;\">\n",
        "        <div style=\"display: flex; align-items: center; gap: 15px;\">\n",
        "           ${avatarHTML}\n",
        "           <div style=\"flex: 1;\">\n",
        "              <div style=\"font-size: 1rem; font-weight: 800; color: white; line-height: 1.1;\">${name}</div>\n",
        "              <div style=\"font-size: 0.65rem; color: #64748b; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;\">Grupo ${op?.group || '—'} · ${role.toUpperCase()}</div>\n",
        "           </div>\n",
        "           <div style=\"display: flex; gap: 6px;\">\n",
        "              <button onclick=\"asiSetEstado('${sn}','${role}','P')\" style=\"width: 34px; height: 34px; border-radius: 12px; border: none; cursor: pointer; background: ${est === 'P' ? '#10b981' : 'rgba(16,185,129,0.1)'}; color: ${est === 'P' ? '#fff' : '#10b981'}; transition: 0.2s; font-size: 0.9rem;\">${est === 'P' ? '✅' : 'P'}</button>\n",
        "              <button onclick=\"asiSetEstado('${sn}','${role}','A')\" style=\"width: 34px; height: 34px; border-radius: 12px; border: none; cursor: pointer; background: ${est === 'A' ? '#ef4444' : 'rgba(239,68,68,0.1)'}; color: ${est === 'A' ? '#fff' : '#ef4444'}; transition: 0.2s; font-size: 0.9rem;\">${est === 'A' ? '❌' : 'A'}</button>\n",
        "              <button onclick=\"asiSetEstado('${sn}','${role}','T')\" style=\"width: 34px; height: 34px; border-radius: 12px; border: none; cursor: pointer; background: ${est === 'T' ? '#f59e0b' : 'rgba(245,158,11,0.1)'}; color: ${est === 'T' ? '#fff' : '#f59e0b'}; transition: 0.2s; font-size: 0.9rem;\">${est === 'T' ? '⏰' : 'T'}</button>\n",
        "           </div>\n",
        "        </div>\n",
        "\n",
        "        <div style=\"display: grid; grid-template-columns: 1.2fr 1fr; gap: 12px; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 15px;\">\n",
        "           <div style=\"background: rgba(0,0,0,0.2); padding: 10px; border-radius: 14px; border: 1px solid rgba(255,255,255,0.04);\">\n",
        "              <div style=\"font-size: 0.55rem; color: #475569; text-transform: uppercase; font-weight: 800; margin-bottom: 6px;\">Config. Horas (${tIcon})</div>\n",
        "              <div style=\"display:flex; gap:4px;\">\n",
        "                 <button onclick=\"asiSetHoras('${sn}','8')\" style=\"flex:1; padding:4px; font-size:.65rem; font-weight:700; background:${hAct==8?'rgba(52,211,153,0.2)':'rgba(255,255,255,0.05)'}; border:1px solid ${hAct==8?'#34d399':'transparent'}; color:${hAct==8?'#34d399':'#64748b'}; border-radius:7px; cursor:pointer;\">8H</button>\n",
        "                 <button onclick=\"asiSetHoras('${sn}','12')\" style=\"flex:1; padding:4px; font-size:.65rem; font-weight:700; background:${hAct==12?'rgba(96,165,250,0.2)':'rgba(255,255,255,0.05)'}; border:1px solid ${hAct==12?'#60a5fa':'transparent'}; color:${hAct==12?'#60a5fa':'#64748b'}; border-radius:7px; cursor:pointer;\">12H</button>\n",
        "                 <button onclick=\"asiSetHoras('${sn}','cambio')\" style=\"padding:4px 8px; font-size:.65rem; background:rgba(251,191,36,0.1); border:1px solid rgba(251,191,36,0.3); color:#fbbf24; border-radius:7px; cursor:pointer;\">🔄</button>\n",
        "              </div>\n",
        "           </div>\n",
        "           <div style=\"background: rgba(0,0,0,0.2); padding: 10px; border-radius: 14px; border: 1px solid rgba(255,255,255,0.04);\">\n",
        "              <div style=\"font-size: 0.55rem; color: #475569; text-transform: uppercase; font-weight: 800; margin-bottom: 6px;\">Estatus Chat</div>\n",
        "              <div style=\"font-size: 0.8rem; font-weight: 700; color: ${cur.horaIngreso ? '#34d399' : '#475569'}\">${cur.horaIngreso ? '🟢 ' + cur.horaIngreso : '🔴 Inactivo'}</div>\n",
        "           </div>\n",
        "        </div>\n",
        "\n",
        "        <div style=\"display: ${est === 'A' || est === 'T' ? 'block' : 'none'}\">\n",
        "           <input type=\"text\" placeholder=\"Añadir nota/motivo...\" value=\"${cur.nota || ''}\"\n",
        "             onchange=\"asiSetNota('${sn}','${role}',this.value)\"\n",
        "             style=\"width: 100%; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 10px 14px; color: white; font-size: 0.8rem; outline: none; box-sizing: border-box;\">\n",
        "        </div>\n",
        "\n",
        "        <div style=\"display:flex; justify-content:space-between; align-items:center; border-top:1px dashed rgba(255,255,255,0.05); padding-top:12px; margin-top:5px;\">\n",
        "           <span style=\"font-size:0.6rem; color:#475569; font-weight:800; text-transform:uppercase;\">Perfiles (${op?.profiles?.length || 0})</span>\n",
        "           <button onclick=\"asiTerminarTurnoManual('${sn}','${role}')\" style=\"font-size:0.6rem; color:#f87171; background:none; border:none; cursor:pointer; font-weight:700;\">⏹️ Terminar Jornada</button>\n",
        "        </div>\n",
        "      </div>`;\n",
        "    }\n",
        "\n"
    ]

    lines[start_asi:end_asi] = new_asi_block

    with open(file_path, 'w', encoding='utf-8') as f:
        f.writelines(lines)
    print("Final repair successful.")

if __name__ == \"__main__\":
    final_repair()
