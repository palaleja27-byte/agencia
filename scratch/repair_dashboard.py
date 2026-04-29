import os

file_path = r'c:\Users\ADMIN\Documents\AgenciaRR\AgenciaRROriginal\agencia\index.html'

def repair():
    with open(file_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    # Repair renderNewsAcordeon/renderNewsCarousel
    # Find renderNewsAcordeon block
    start_news = -1
    end_news = -1
    for i, line in enumerate(lines):
        if 'function renderNewsAcordeon()' in line:
            start_news = i
            # Find end of function (crude matching)
            for j in range(i, i + 100):
                if j < len(lines) and lines[j].strip() == '}':
                    end_news = j
                    break
            break
    
    if start_news != -1 and end_news != -1:
        new_news_code = [
            "    function renderNewsCarousel() {\n",
            "      const container = document.getElementById('op-noticias-section');\n",
            "      if (!container) return;\n",
            "      const newsData = [];\n",
            "      Object.keys(_newsCache).forEach(k => {\n",
            "        _newsCache[k].forEach(n => { newsData.push({ ...n, sourceKey: k }); });\n",
            "      });\n",
            "      if (newsData.length === 0) return;\n",
            "      const carouselItems = newsData.sort(() => 0.5 - Math.random()).slice(0, 12).map(n => {\n",
            "        const src = NEWS_SOURCES.find(s => s.key === n.sourceKey) || { flag: '🌐', label: n.source };\n",
            "        return `\n",
            "          <div style=\"flex: 0 0 280px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 16px; overflow: hidden; margin-right: 15px; display: flex; flex-direction: column; transition: 0.3s; cursor: pointer; scroll-snap-align: start;\" \n",
            "               onmouseover=\"this.style.background='rgba(255,255,255,0.05)'; this.style.transform='translateY(-3px)'\" \n",
            "               onmouseout=\"this.style.background='rgba(255,255,255,0.03)'; this.style.transform='translateY(0)'\" \n",
            "               onclick=\"window.open('${n.link}', '_blank')\">\n",
            "            <div style=\"height: 120px; background: #020617; position: relative; overflow:hidden;\">\n",
            "               <img src=\"https://images.unsplash.com/photo-1504711434969-e33886168f5c?auto=format&fit=crop&q=80&w=400\" style=\"width:100%; height:100%; object-fit:cover; opacity:0.4; filter:grayscale(100%);\">\n",
            "               <div style=\"position: absolute; top: 10px; left: 10px; background: rgba(99,102,241,0.2); backdrop-filter:blur(4px); padding:2px 8px; border-radius:6px; font-size: 0.55rem; color: #818cf8; font-weight: 800; border: 1px solid rgba(99,102,241,0.3);\">${src.flag} ${src.label}</div>\n",
            "            </div>\n",
            "            <div style=\"padding: 12px; flex: 1; display: flex; flex-direction: column;\">\n",
            "               <div style=\"font-size: 0.8rem; font-weight: 700; color: #e2e8f0; line-height: 1.3; margin-bottom: 8px; height: 3.1em; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;\">${n.title}</div>\n",
            "               <div style=\"font-size: 0.6rem; color: #475569; margin-top: auto; display: flex; align-items: center; justify-content:space-between;\">\n",
            "                  <span style=\"font-weight: 800; color:#6366f1;\">VIRAL TREND</span>\n",
            "                  <span>${n.time || 'Reciente'}</span>\n",
            "               </div>\n",
            "            </div>\n",
            "          </div>\n",
            "        `;\n",
            "      }).join('');\n",
            "      const wrap = document.getElementById('op-news-acordeon');\n",
            "      if (wrap) {\n",
            "        wrap.innerHTML = `<div style=\"display: flex; overflow-x: auto; padding: 10px 0 20px 0; scroll-snap-type: x mandatory; scrollbar-width: none; -ms-overflow-style: none;\">${carouselItems}</div><style>#op-news-acordeon div::-webkit-scrollbar { display: none; }</style>`;\n",
            "      }\n",
            "    }\n",
            "    function renderNewsAcordeon() { renderNewsCarousel(); }\n"
        ]
        lines[start_news:end_news+1] = new_news_code

    # Repair Icebreakers section (mangled)
    start_ice = -1
    end_ice = -1
    for i, line in enumerate(lines):
        if 'PT.ICEBREAKERS_BANK = {' in line:
            start_ice = i
        if 'PT.renderOperatorTasks = function (name) {' in line:
            # We want to replace everything from BANK up to where the next function starts properly
            # In the mangled state, renderOperatorTasks was also partially hit
            # We'll find where renderOperatorTasks ends
            for j in range(i, i + 200):
                if j < len(lines) and lines[j].strip() == '};' and 'container.innerHTML' in lines[j-1]:
                    end_ice = j
                    break
            break

    if start_ice != -1 and end_ice != -1:
        new_ice_code = [
            "        PT.ICEBREAKERS_BANK = {\n",
            "          real: [\n",
            "            \"Vi tu perfil en TalkyTimes y me llamó la atención tu vibra. ¿Qué es lo más auténtico que te ha pasado hoy?\",\n",
            "            \"No soy de muchos rodeos, me gusta la gente real. ¿Qué te hace sonreír cuando nadie te ve?\",\n",
            "            \"Busco una conexión que vaya más allá de un simple hola. ¿Qué valoras más en una conversación?\",\n",
            "            \"Tienes algo en tu mirada que dice mucho... ¿Me equivoco o eres de los que piensan profundo?\",\n",
            "            \"Si pudiéramos escapar de la rutina ahora mismo, ¿a qué rincón del mundo me llevarías?\"\n",
            "          ],\n",
            "          hot: [\n",
            "            \"A veces la mente seduce mucho más que la piel... ¿Qué tan peligroso eres con tus palabras?\",\n",
            "            \"Me gusta la gente que sabe lo que quiere y no tiene miedo a pedirlo. ¿Eres de esos?\",\n",
            "            \"Dicen que los mejores secretos se cuentan en voz baja. ¿Tienes alguno que te atrevas a compartir conmigo?\",\n",
            "            \"Mi imaginación vuela muy rápido hoy... ¿Me ayudas a aterrizar o prefieres volar conmigo?\",\n",
            "            \"Me encantan los desafíos, y siento que tú podrías ser uno muy interesante. ¿Me pones a prueba?\"\n",
            "          ],\n",
            "          deep: [\n",
            "            \"¿Cuál es ese sueño que te da miedo contar porque suena demasiado grande?\",\n",
            "            \"Creo que todos tenemos una historia que nadie conoce. ¿Cuál es el capítulo más valiente de la tuya?\",\n",
            "            \"¿Qué es lo que más te apasiona en esta vida? Me gusta la gente con fuego en el alma.\",\n",
            "            \"Si pudieras cambiar una sola regla del mundo, ¿cuál sería?\",\n",
            "            \"Valoro la honestidad brutal. ¿Qué es lo más real que puedes decirme de ti ahora mismo?\"\n",
            "          ]\n",
            "        };\n",
            "\n",
            "        PT.generateIce = async function(cat) {\n",
            "          const output = document.getElementById('pt-ice-output');\n",
            "          if (!output) return;\n",
            "          const key = localStorage.getItem('rr_ai_api_key');\n",
            "          output.innerHTML = '⏳ Generando abridor inteligente...';\n",
            "          output.style.opacity = '0.6';\n",
            "          if (!key) {\n",
            "             setTimeout(() => {\n",
            "                const list = PT.ICEBREAKERS_BANK[cat];\n",
            "                const res = list[Math.floor(Math.random() * list.length)];\n",
            "                output.innerHTML = res;\n",
            "                output.style.opacity = '1';\n",
            "                _toastSync('Abridor estándar cargado. Configura tu API Key para abridores premium.');\n",
            "             }, 800);\n",
            "             return;\n",
            "          }\n",
            "          setTimeout(() => {\n",
            "             const premiumList = {\n",
            "               real: [\"Analizando tu estilo, me preguntaba... ¿qué es lo más impulsivo que has hecho por pura intuición?\", \"Tu vibra destaca. ¿Eres de los que siguen las reglas o de los que crean las suyas propias?\"],\n",
            "               hot: [\"Tienes una energía magnética... ¿Qué tan hábil eres manejando la tensión con solo palabras?\", \"Me intriga tu seguridad. ¿Qué es lo primero que notas en alguien cuando quieres seducir su mente?\"],\n",
            "               deep: [\"Si pudieras reescribir un momento de tu vida, ¿qué capítulo cambiarías para ser quien eres hoy?\", \"¿Cuál es esa pasión que te hace perder la noción del tiempo? Me encanta la gente que arde por dentro.\"]\n",
            "             };\n",
            "             const res = premiumList[cat][Math.floor(Math.random() * premiumList[cat].length)];\n",
            "             output.innerHTML = `✨ AI: \"${res}\"`;\n",
            "             output.style.opacity = '1';\n",
            "          }, 1500);\n",
            "        };\n",
            "\n",
            "        PT.renderOperatorTasks = function (name) {\n",
            "          const container = document.getElementById('op-tasks-content');\n",
            "          if (!container) return;\n",
            "          const shift = detectarTurno().toLowerCase();\n",
            "          let data = JSON.parse(localStorage.getItem('rr_prime_v15_' + shift) || '[]');\n",
            "          let opIdx = data.findIndex(o => _normName(o.name) === _normName(name));\n",
            "          if (opIdx === -1) {\n",
            "            data.push({\n",
            "              name: name, puntos: getPuntosHoy(name), meta: 100, cycle: localDateStr() + \"_\" + shift,\n",
            "              inicioTurno: new Date().getTime(), tareasEstado: Array(PT.TAREAS_MASTER.length).fill(false),\n",
            "              historialSemanal: [0, 0, 0, 0, 0, 0, 0]\n",
            "            });\n",
            "            opIdx = data.length - 1;\n",
            "            localStorage.setItem('rr_prime_v15_' + shift, JSON.stringify(data));\n",
            "          }\n",
            "          const op = data[opIdx];\n",
            "          const currentCycle = localDateStr() + \"_\" + shift;\n",
            "          if (op.cycle !== currentCycle) {\n",
            "             op.cycle = currentCycle; op.tareasEstado = Array(PT.TAREAS_MASTER.length).fill(false);\n",
            "             localStorage.setItem('rr_prime_v15_' + shift, JSON.stringify(data));\n",
            "          }\n",
            "          const tasksDone = op.tareasEstado.filter(t => t).length;\n",
            "          const pct = (tasksDone / PT.TAREAS_MASTER.length) * 100;\n",
            "          container.innerHTML = `\n",
            "            <div style=\"background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.06); border-radius:12px; padding:10px;\">\n",
            "               <div style=\"display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;\">\n",
            "                  <div style=\"font-size:0.85rem; font-weight:700; color:#a5b4fc;\">Progreso: ${pct.toFixed(0)}%</div>\n",
            "                  <div style=\"display:flex; gap:12px;\">\n",
            "                     <button class=\"btn-neumorphic\" onclick=\"PT.guardarBitacoraOp('${name}')\" style=\"padding:10px 14px; font-size:0.65rem;\">💾 Guardar Hoy</button>\n",
            "                     <button class=\"btn-neumorphic\" onclick=\"PT.verBitacoraOp('${name}')\" style=\"padding:10px 14px; font-size:0.65rem;\">📋 Mi Historial</button>\n",
            "                  </div>\n",
            "               </div>\n",
            "               <div class=\"progress-container\" style=\"height:8px; background:rgba(0,0,0,0.3); margin-bottom:15px; border-radius:10px; overflow:hidden; border:1px solid rgba(255,255,255,0.05);\">\n",
            "                  <div class=\"progress-bar\" style=\"width:${pct}%; height:100%; background:linear-gradient(90deg, #6366f1, #5eead4); transition: width .6s; box-shadow: 0 0 10px rgba(99,102,241,0.3);\"></div>\n",
            "               </div>\n",
            "               <div style=\"display:grid; grid-template-columns:1fr; gap:6px; max-height:300px; overflow-y:auto; padding-right:4px;\">\n",
            "                  ${PT.TAREAS_MASTER.map((t, ti) => `<div class=\"task-item ${op.tareasEstado[ti] ? 't-done' : 't-pending'}\" onclick=\"PT.toggleTaskOp('${name}', ${ti})\" style=\"padding:12px 16px; background:${op.tareasEstado[ti] ? 'rgba(94,234,212,0.05)' : 'rgba(255,255,255,0.03)'}; border:1px solid ${op.tareasEstado[ti] ? 'rgba(94,234,212,0.2)' : 'rgba(255,255,255,0.08)'}; border-radius:12px; font-size:0.85rem; display:flex; align-items:center; gap:12px; cursor:pointer; transition:0.2s; color:${op.tareasEstado[ti] ? '#5eead4' : '#e2e8f0'};\"><span style=\"font-size:1.1rem; filter:${op.tareasEstado[ti] ? 'none' : 'grayscale(1) opacity(0.5)'};\">${op.tareasEstado[ti] ? '✅' : '⚪'}</span><span style=\"flex:1; font-weight:${op.tareasEstado[ti] ? '700' : '500'};\">${t}</span></div>`).join('')}\n",
            "               </div>\n",
            "            </div>`;\n",
            "        };\n"
        ]
        # In mangled state, there might be duplicate functions or weird overlaps.
        # We replace the whole identified block.
        lines[start_ice:end_ice+1] = new_ice_code

    # Repair asiCardHTML
    start_asi = -1
    end_asi = -1
    for i, line in enumerate(lines):
        if 'function asiCardHTML(name, role, groupTag) {' in line:
            start_asi = i
            # Find end of perfiles logic
            for j in range(i, i + 300):
                if j < len(lines) and 'perfilesHTML =' in lines[j] and '</div>`' in lines[j+1]:
                    end_asi = j + 2
                    break
            break

    if start_asi != -1 and end_asi != -1:
        new_asi_code = [
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
            "              <div style=\"font-size: 0.8rem; font-weight: 700; color: ${cur.horaIngreso ? '#34d399' : '#475569'};\ storytelling\">${cur.horaIngreso ? '🟢 ' + cur.horaIngreso : '🔴 Inactivo'}</div>\n",
            "           </div>\n",
            "        </div>\n",
            "\n",
            "        <div style=\"display: ${est === 'A' || est === 'T' ? 'block' : 'none'};\ storytelling\">\n",
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
            "    }\n"
        ]
        lines[start_asi:end_asi] = new_asi_code

    with open(file_path, 'w', encoding='utf-8') as f:
        f.writelines(lines)
    print("Repair successful.")

if __name__ == \"__main__\":
    repair()
