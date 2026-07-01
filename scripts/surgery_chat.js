const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '..', 'index.html');
let content = fs.readFileSync(file, 'utf8');

const quickRepliesHtml = `
    <!-- Quick Replies (Respuestas Rápidas) -->
    <div style="padding:6px 12px; background:rgba(0,0,0,0.4); border-top:1px solid rgba(255,255,255,0.02); display:flex; gap:6px; overflow-x:auto;" class="custom-scrollbar">
      <button onclick="document.getElementById('rr-chat-input').value='¡Excelente ritmo, sigue así! 🔥'; enviarMensajeChat()" style="background:rgba(16,185,129,0.15); border:1px solid rgba(16,185,129,0.3); color:#10b981; font-size:0.6rem; padding:4px 8px; border-radius:12px; cursor:pointer; white-space:nowrap; transition:0.2s;" onmouseover="this.style.background='rgba(16,185,129,0.25)'" onmouseout="this.style.background='rgba(16,185,129,0.15)'">🔥 Excelente ritmo</button>
      <button onclick="document.getElementById('rr-chat-input').value='¿Todo bien por ahí? 👀'; enviarMensajeChat()" style="background:rgba(99,102,241,0.15); border:1px solid rgba(99,102,241,0.3); color:#818cf8; font-size:0.6rem; padding:4px 8px; border-radius:12px; cursor:pointer; white-space:nowrap; transition:0.2s;" onmouseover="this.style.background='rgba(99,102,241,0.25)'" onmouseout="this.style.background='rgba(99,102,241,0.15)'">👀 ¿Todo bien?</button>
      <button onclick="document.getElementById('rr-chat-input').value='Acelera, estás perdiendo tiempo ⚠️'; enviarMensajeChat()" style="background:rgba(245,158,11,0.15); border:1px solid rgba(245,158,11,0.3); color:#f59e0b; font-size:0.6rem; padding:4px 8px; border-radius:12px; cursor:pointer; white-space:nowrap; transition:0.2s;" onmouseover="this.style.background='rgba(245,158,11,0.25)'" onmouseout="this.style.background='rgba(245,158,11,0.15)'">⚠️ Acelera</button>
      <button onclick="document.getElementById('rr-chat-input').value='Cuidado con las reglas 🚨'; enviarMensajeChat()" style="background:rgba(239,68,68,0.15); border:1px solid rgba(239,68,68,0.3); color:#ef4444; font-size:0.6rem; padding:4px 8px; border-radius:12px; cursor:pointer; white-space:nowrap; transition:0.2s;" onmouseover="this.style.background='rgba(239,68,68,0.25)'" onmouseout="this.style.background='rgba(239,68,68,0.15)'">🚨 Cuidado</button>
    </div>

    <!-- Input -->`;

content = content.replace('<!-- Input -->', quickRepliesHtml);

const scrollTopRegex = /box\.scrollTop\s*=\s*box\.scrollHeight;/g;
const scrollFixHtml = `setTimeout(() => { if (box) box.scrollTo({ top: box.scrollHeight, behavior: 'smooth' }); }, 50);`;

content = content.replace(scrollTopRegex, scrollFixHtml);

fs.writeFileSync(file, content, 'utf8');
console.log('Chat UI upgraded');
