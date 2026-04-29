import os

file_path = r'c:\Users\ADMIN\Documents\AgenciaRR\AgenciaRROriginal\agencia\index.html'

def final_html_cleanup():
    with open(file_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    # Locate the start of the operator dashboard
    start_idx = -1
    for i, line in enumerate(lines):
        if '<div id="op-dashboard">' in line:
            start_idx = i
            break
    
    if start_idx == -1:
        print("Could not find op-dashboard")
        return

    # Replace from start_idx until the end of the sections we want to modernize
    # We'll go up to the end of the news section (approx 100 lines)
    end_idx = start_idx + 150 # Safety margin
    for i in range(start_idx, len(lines)):
        if '<div class="op-section" id="op-ice-section"' in lines[i]:
            end_idx = i
            break

    new_html = [
        '  <div id="op-dashboard">\n',
        '    <div class="op-dash-hero">\n',
        '      <div id="op-dash-avatar-wrap" style="width:100%;"></div>\n',
        '      <div id="op-dash-last-update" style="position:absolute; bottom:5px; right:12px; font-size:.52rem; color:#334155; letter-spacing:.3px;"></div>\n',
        '    </div>\n',
        '    <div id="op-dash-metrics" class="op-dash-metrics" style="margin-top:10px;"></div>\n',
        '\n',
        '    <!-- MÓDULO: AGENTE AI OPENCLAW (PREMIUM) -->\n',
        '    <div class="op-section" id="op-openclaw-agent-section" style="border: 2px solid #6366f1; background: rgba(99,102,241,0.05); box-shadow: 0 0 25px rgba(99,102,241,0.15); border-radius: 20px; position:relative; overflow:hidden;">\n',
        '      <div style="position:absolute; top:-10px; right:15px; background:#6366f1; color:white; font-size:0.55rem; font-weight:900; padding:2px 10px; border-radius:10px; text-transform:uppercase; letter-spacing:1px; box-shadow: 0 0 15px rgba(99,102,241,0.5);">LIVE AI AGENT</div>\n',
        '      <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:15px; padding: 15px 20px 0;">\n',
        '        <div class="op-section-title" style="margin-bottom:0; color:#818cf8; font-size:1.1rem;">🤖 Agente AI OpenClaw <small style="font-size:0.6rem; opacity:0.6;">v8.6.32</small></div>\n',
        '        <div style="font-size:0.55rem; color:#6366f1; font-weight:800; text-transform:uppercase; letter-spacing:1.5px; background:rgba(99,102,241,0.15); padding:3px 10px; border-radius:12px; animation: pulseGlow 2s infinite; border:1px solid rgba(99,102,241,0.3);">Sincronizando...</div>\n',
        '      </div>\n',
        '      <div id="op-openclaw-alerts" style="max-height: 350px; overflow-y: auto; padding: 0 20px 20px;">\n',
        '         <div style="color:#64748b; font-size:0.85rem; padding:40px; text-align:center; display:flex; flex-direction:column; align-items:center; gap:12px; background:rgba(0,0,0,0.2); border-radius:16px; border:1px dashed rgba(255,255,255,0.05);">\n',
        '           <span style="font-size:2rem; animation: float 3s infinite ease-in-out;">🛰️</span>\n',
        '           <span>Escaneando flujos de chat y perfiles asignados...<br><small style="opacity:0.6;">Los insights estratégicos aparecerán aquí automáticamente.</small></span>\n',
        '         </div>\n',
        '      </div>\n',
        '    </div>\n',
        '\n',
        '    <!-- PLAN DE TRABAJO -->\n',
        '    <div class="op-section" id="op-tasks-section">\n',
        '      <div class="op-section-title">📝 Tu Plan de Trabajo</div>\n',
        '      <div id="op-tasks-content"></div>\n',
        '    </div>\n',
        '\n',
        '    <!-- RENDIMIENTO COMPLETO (Sin Promedio Diario) -->\n',
        '    <div class="op-section" id="op-stats-section">\n',
        '      <div class="op-section-title">📊 Tu rendimiento completo</div>\n',
        '      <div id="op-stats-content"></div>\n',
        '    </div>\n',
        '\n',
        '    <!-- RANKING Y POSICIÓN -->\n',
        '    <div class="op-section">\n',
        '      <div class="op-section-title">🏆 Tu posición en el ranking</div>\n',
        '      <div class="op-ranking-pos" id="op-rank-pos">#—</div>\n',
        '      <div class="op-ranking-sub" id="op-rank-sub">Cargando ranking...</div>\n',
        '    </div>\n',
        '\n',
        '    <!-- BARRA COMPETITIVA -->\n',
        '    <div class="op-section">\n',
        '      <div class="op-section-title">🔥 Rendimiento en turno activo</div>\n',
        '      <div id="op-competitive-bar" style="padding:4px 0;"></div>\n',
        '    </div>\n',
        '\n',
        '    <!-- PORTAL DE NOTICIAS (CAROUSEL) -->\n',
        '    <div class="op-section" id="op-noticias-section">\n',
        '      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">\n',
        '        <div class="op-section-title" style="margin-bottom:0;">🌎 Noticias del mundo</div>\n',
        '        <button onclick="cargarTodasNoticias()" id="news-refresh-btn" \n',
        '          style="background:rgba(94,234,212,.1);border:1px solid rgba(94,234,212,.25);color:#5eead4;font-size:.68rem;font-weight:700;cursor:pointer;padding:5px 11px;border-radius:8px;">🔄 Actualizar todo</button>\n',
        '      </div>\n',
        '      <div id="op-news-acordeon" style="min-height:200px;"></div>\n',
        '    </div>\n',
        '\n',
        '    <div class="op-section">\n',
        '      <div class="op-section-title">📁 Tus perfiles asignados</div>\n',
        '      <div id="op-profiles-list"></div>\n',
        '    </div>\n',
        '\n',
        '    <div class="op-section">\n',
        '      <div class="op-section-title">💡 Consejos del monitor para ti</div>\n',
        '      <div id="op-consejos-list"></div>\n',
        '    </div>\n'
    ]

    lines[start_idx:end_idx] = new_html

    with open(file_path, 'w', encoding='utf-8') as f:
        f.writelines(lines)
    print("Final HTML modernization successful.")

if __name__ == "__main__":
    final_html_cleanup()
