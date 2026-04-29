import os

file_path = r'c:\Users\ADMIN\Documents\AgenciaRR\AgenciaRROriginal\agencia\index.html'

def final_modernization():
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Update News Carousel Implementation
    # We replace renderNewsAcordeon and add renderNewsCarousel
    news_start = content.find("function renderNewsAcordeon()")
    news_end = -1
    if news_start != -1:
        bracket_count = 0
        for i in range(news_start + len("function renderNewsAcordeon()"), len(content)):
            if content[i] == '{': bracket_count += 1
            if content[i] == '}':
                if bracket_count == 1: # End of function
                    news_end = i
                    break
                else:
                    bracket_count -= 1
    
    if news_start != -1 and news_end != -1:
        new_news_logic = """function renderNewsCarousel() {
      const container = document.getElementById('op-news-acordeon');
      if (!container) return;
      
      const newsData = [];
      Object.keys(_newsCache).forEach(k => {
        if (_newsCache[k]) {
          _newsCache[k].forEach(n => { newsData.push({ ...n, sourceKey: k }); });
        }
      });

      if (newsData.length === 0) {
        container.innerHTML = '<div style="padding:20px; text-align:center; color:#475569; font-size:0.75rem;">⏳ Cargando tendencias virales...</div>';
        return;
      }

      const carouselItems = newsData.sort(() => 0.5 - Math.random()).slice(0, 15).map(n => {
        const src = NEWS_SOURCES.find(s => s.key === n.sourceKey) || { flag: '🌐', label: n.source };
        return `
          <div style="flex: 0 0 280px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 16px; overflow: hidden; margin-right: 15px; display: flex; flex-direction: column; transition: 0.3s; cursor: pointer; scroll-snap-align: start;" 
               onmouseover="this.style.background='rgba(255,255,255,0.05)'; this.style.transform='translateY(-3px)'" 
               onmouseout="this.style.background='rgba(255,255,255,0.03)'; this.style.transform='translateY(0)'" 
               onclick="window.open('${n.link}', '_blank')">
            <div style="height: 120px; background: #020617; position: relative; overflow:hidden;">
               <img src="https://images.unsplash.com/photo-1504711434969-e33886168f5c?auto=format&fit=crop&q=80&w=400" style="width:100%; height:100%; object-fit:cover; opacity:0.3; filter:grayscale(100%);">
               <div style="position: absolute; top: 10px; left: 10px; background: rgba(99,102,241,0.2); backdrop-filter:blur(4px); padding:2px 8px; border-radius:6px; font-size: 0.55rem; color: #818cf8; font-weight: 800; border: 1px solid rgba(99,102,241,0.3);">${src.flag} ${src.label}</div>
            </div>
            <div style="padding: 12px; flex: 1; display: flex; flex-direction: column;">
               <div style="font-size: 0.8rem; font-weight: 700; color: #e2e8f0; line-height: 1.3; margin-bottom: 8px; height: 3.1em; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">${n.title}</div>
               <div style="font-size: 0.6rem; color: #475569; margin-top: auto; display: flex; align-items: center; justify-content:space-between;">
                  <span style="font-weight: 800; color:#6366f1; letter-spacing:1px;">VIRAL TREND</span>
                  <span>${n.time || 'Reciente'}</span>
               </div>
            </div>
          </div>
        `;
      }).join('');

      container.innerHTML = `
        <div style="display: flex; overflow-x: auto; padding: 5px 0 15px 0; scroll-snap-type: x mandatory; scrollbar-width: none; -ms-overflow-style: none;">
          ${carouselItems}
        </div>
        <style>#op-news-acordeon div::-webkit-scrollbar { display: none; }</style>
      `;
    }
    function renderNewsAcordeon() { renderNewsCarousel(); }"""
        content = content[:news_start] + new_news_logic + content[news_end+1:]

    # 2. Fix renderOpStats (Remove Prom/dia)
    stats_start = content.find("async function renderOpStats(name) {")
    stats_end = -1
    if stats_start != -1:
        bracket_count = 0
        for i in range(stats_start + len("async function renderOpStats(name) {"), len(content)):
            if content[i] == '{': bracket_count += 1
            if content[i] == '}':
                if bracket_count == 1:
                    stats_end = i
                    break
                else:
                    bracket_count -= 1
    
    if stats_start != -1 and stats_end != -1:
        # We'll replace the inner HTML generation part of renderOpStats
        # But for safety, I'll just replace the specific block that renders promDia
        old_footer = "'<span>$' + fmt(Math.round(promDia * VALOR_COP)) + ' COP/dia</span>' +"
        if old_footer in content:
            # We'll just remove the whole promDia row
            start_row = content.find('<div style="display:flex;justify-content:space-between;font-size:.68rem;color:#475569;padding:0 2px;margin-bottom:4px;">')
            end_row = content.find("'</div>';", start_row) + 8
            if start_row != -1 and end_row != -1:
                content = content[:start_row] + "''" + content[end_row:]

    # 3. Finalize renderVistaOperador (OpenClaw Agent + News Call)
    # We'll ensure renderNewsCarousel() is called and Agente AI logic is robust
    if "setTimeout(() => { renderNewsCarousel(); }, 300);" not in content:
        # Inject it at the end of renderVistaOperador
        idx = content.find("renderCompetitiveBar();")
        if idx != -1:
            # Find next }
            next_brace = content.find("}", idx)
            # Find the end of renderVistaOperador
            # We'll just append it before the function ends
            last_brace = content.find("}", content.find("function renderVistaOperador"))
            # This is complex, I'll use a safer marker
            if "function loginLogout()" in content:
                insert_pos = content.find("function loginLogout()") - 5
                content = content[:insert_pos] + "\\n      setTimeout(() => { renderNewsCarousel(); }, 500);\\n    }\\n\\n" + content[insert_pos:]

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("Modernization applied.")

if __name__ == "__main__":
    final_modernization()
