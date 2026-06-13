// content.js - AGENTE RYR V16.1 (AUTOPILOT SOCKETS & OVERWATCH FIX)
console.log("🦾 [AGENTE RYR] Iniciando V16.1 (Interceptor de Sockets Activo)...");

const REGLAS_ICE = {
    palabras_baneadas: ["whatsapp", "wa.me", "skype", "telegram", "instagram", "facebook", "crypto", "bitcoin", "money", "bank", "send me"],
    regex_telefono: /\b\d{6,}\b/
};

const FILTRO_BASURA = [
    "ryr v1", "operador alfa", "manage media", "gestionar medios", "new present request", 
    "support@talkytimes.com", "terms of use", "privacy policy", "cookie policy", 
    "anti-scam policy", "platform use policy", "legal documents", "icebreakers", "rompehielos",
    "newsfeed", "noticias", "you have no present requests", "will appear here", "términos legales",
    "información de", "acerca de", "información útil", "radar activo", "esperando objetivo", "my content", "mi contenido"
];

let escaneoActivo = false;
let pilotoAutomatico = false;
let tonoSeleccionado = "directo";
let ultimoIdSincronizado = "";
let ultimoMensajeRecibidoId = "";
let nombreOperadorGlobal = "Operador";
let estadoDB = { texto: "🔍 RADAR", color: "#aaa", bg: "#333" }; 
let memoriaConversacion = [];
let bufferMensaje = { es: "", en: "" };

// 📡 SENSOR DE RED (CAPTURADOR DE SOCKETS PARA AUTOPILOT)
const ryrHook = document.createElement('script');
ryrHook.textContent = `
    (function() {
        const originalFetch = window.fetch;
        window.fetch = async function(...args) {
            const response = await originalFetch(...args);
            if (typeof args[0] === 'string' && (args[0].includes('message') || args[0].includes('history'))) {
                const clone = response.clone();
                clone.json().then(rawData => {
                    let msjs = Array.isArray(rawData) ? rawData : (rawData.messages || rawData.data || rawData.items || []);
                    if (msjs.length > 0) window.postMessage({ type: 'RYR_STREAM_CAPTURED', data: msjs }, '*');
                }).catch(e => {});
            }
            return response;
        };
    })();
`;
(document.head || document.documentElement).appendChild(ryrHook);
ryrHook.remove();

window.addEventListener("message", (event) => {
    if (event.data && event.data.type === 'RYR_STREAM_CAPTURED') {
        const msjs = event.data.data;
        if (msjs.length > 0) {
            memoriaConversacion = msjs.slice(-15).map(m => {
                return { remitente: (m.is_out || m.out || m.from_me) ? "Operadora" : "Cliente", texto: m.text || m.body || m.message || "", id: m.id || null };
            }).filter(m => m.texto.trim() !== "");

            let path = window.location.pathname; let lastSegment = path.split('/').pop().split('?')[0];
            let targetID = lastSegment.includes('_') ? lastSegment.split('_')[1] : "00000";
            if(targetID !== "00000") {
                chrome.runtime.sendMessage({ accion: "sync_historial_completo", payload: { mensajes: memoriaConversacion, cliente_id: targetID } });
            }

            // 🔥 DISPARADOR INQUEBRANTABLE DEL AUTOPILOT
            const ultimoMsj = msjs[msjs.length - 1];
            if (!ultimoMsj.is_out && !ultimoMsj.from_me) {
                if (ultimoMsj.id !== ultimoMensajeRecibidoId) {
                    ultimoMensajeRecibidoId = ultimoMsj.id;
                    if (pilotoAutomatico) {
                        console.log("⚡ [AUTOPILOT] Nuevo socket detectado. Activando Pre-Cog...");
                        activarProtocoloPreCog(ultimoMsj.text || ultimoMsj.body || "");
                    }
                }
            }
        }
    }
});

function inicializarExtension() {
    chrome.storage.local.get(['operador_activo'], (result) => {
        if (!result.operador_activo) { inyectarLogin(); } 
        else { escaneoActivo = true; nombreOperadorGlobal = result.operador_activo.nombre; inyectarHUD(); ejecutarMineriaDual(); activarAgenteOverwatch(); }
    });
}

function inyectarLogin() {
    if (document.getElementById('ryr-login-container') || document.getElementById('ryr-hud-container')) return;
    const hud = document.createElement('div'); hud.id = 'ryr-login-container';
    hud.innerHTML = `<div style="background:#0d0d12; border:1px solid #00ffcc; padding:15px; text-align:center; border-radius: 5px;"><div style="color:#00ffcc; font-weight:bold; margin-bottom:10px;">⚡ AGENTE RYR V16.1</div><input id="ryr-user" type="text" placeholder="ID Usuario" style="width:100%; margin-bottom:10px; background:#111; color:#fff; border:1px solid #333; padding:6px;"><input id="ryr-pass" type="password" placeholder="Contraseña" style="width:100%; margin-bottom:15px; background:#111; color:#fff; border:1px solid #333; padding:6px;"><button id="ryr-btn-login" style="width:100%; background:#00ffcc; color:#000; font-weight:bold; border:none; padding:8px; cursor:pointer;">INICIAR TURNO</button></div>`;
    hud.style.position = 'fixed'; hud.style.bottom = '20px'; hud.style.right = '20px'; hud.style.width = '260px'; hud.style.zIndex = '999999'; document.body.appendChild(hud);
    document.getElementById('ryr-btn-login').onclick = () => {
        chrome.runtime.sendMessage({ accion: "login_operador", payload: { username: document.getElementById('ryr-user').value, password: document.getElementById('ryr-pass').value } }, (res) => {
            if (res && res.success) { chrome.storage.local.set({ operador_activo: res.operador }); document.getElementById('ryr-login-container').remove(); inicializarExtension(); }
        });
    };
}

function inyectarHUD() {
    if (document.getElementById('ryr-hud-container')) return;
    const hud = document.createElement('div'); hud.id = 'ryr-hud-container';
    hud.innerHTML = `
        <div id="ryr-hud-header" style="background:#0d0d12; border-bottom:1px solid #00ffcc; padding:6px; font-weight:bold; display:flex; justify-content:space-between; align-items:center; font-family:sans-serif;">
            <span style="color:#00ffcc; font-size:11px;">⚡ RYR V16.1 | Op: ${nombreOperadorGlobal}</span>
            <div style="display:flex; gap:5px; align-items:center;"><span id="hud-db-status" style="background:${estadoDB.bg}; color:${estadoDB.color}; padding:2px 6px; border-radius:3px; font-size:9px;">🔍 RADAR</span><button id="ryr-btn-autopilot" style="background:#333; color:#aaa; border:1px solid #555; font-size:9px; padding:2px 5px; cursor:pointer; font-weight:bold;">🤖 OFF</button></div>
        </div>
        <div id="ryr-hud-body" style="background:#0d0d12; padding:10px; border:1px solid #00ffcc; border-top:none; max-height: 85vh; overflow-y: auto; font-family:sans-serif;">
            <div class="ryr-stats-box" style="font-size:11px; margin-bottom:8px; color:#fff; line-height: 1.4; background:#111; padding:6px; border-radius:4px; border:1px solid #333;">
                🎯 <span id="hud-obj-name" style="color:#00ffcc">Esperando objetivo...</span><br>
                📖 <span id="hud-obj-bio" style="color:#00ffcc">...</span><br>
                🧠 <span id="hud-obj-gustos" style="color:#aaa">...</span>
            </div>
            <div id="ryr-overwatch-alert" style="display:none; background:rgba(255,0,60,0.2); color:#ff003c; border:1px solid #ff003c; font-size:10px; padding:6px; font-weight:bold; text-align:center; margin-bottom:5px;"></div>
            <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
                <button class="ryr-btn-tono" data-tono="directo" style="flex:1; margin:1px; font-size:9px; cursor:pointer; background:#00ffcc; color:#000; font-weight:bold; border:none; padding:5px;">🎯 DIR</button>
                <button class="ryr-btn-tono" data-tono="picante" style="flex:1; margin:1px; font-size:9px; cursor:pointer; background:#222; color:#aaa; border:1px solid #444; padding:5px;">😈 PIC</button>
                <button class="ryr-btn-tono" data-tono="misterioso" style="flex:1; margin:1px; font-size:9px; cursor:pointer; background:#222; color:#aaa; border:1px solid #444; padding:5px;">🕵️ MIST</button>
                <button class="ryr-btn-tono" data-tono="burlon" style="flex:1; margin:1px; font-size:9px; cursor:pointer; background:#222; color:#aaa; border:1px solid #444; padding:5px;">😜 BURL</button>
            </div>
            <div id="ryr-log-terminal" style="height:45px; font-size:9px; background:#000; color:#aaa; padding:5px; border-radius:3px; margin-bottom:6px; overflow-y:auto; font-family:monospace; border:1px solid #33ff33;"></div>
            <textarea id="ryr-input-es" style="width:100%; height:35px; background:#000; color:#fff; border:1px solid #444; padding:5px; box-sizing:border-box; font-family:monospace; margin-bottom:5px;" placeholder="Comando para la IA..."></textarea>
            <button id="ryr-btn-traducir" style="width:100%; background:#444; color:#00ffcc; border:1px solid #00ffcc; padding:6px; cursor:pointer; font-weight:bold; font-size:11px;">ADAPTAR CON IA</button>
            <div id="ryr-hud-output" style="margin-top:6px; font-size:11px; color:#fff; min-height:15px; word-wrap: break-word;"></div>
            <button id="ryr-btn-inyectar" style="display:none; width:100%; background:#ff00ff; color:#000; border:none; padding:6px; cursor:pointer; font-weight:bold; margin-top:5px; font-size:11px;">👉 APROBAR E INYECTAR</button>
        </div>
    `;
    hud.style.position = 'fixed'; hud.style.bottom = '20px'; hud.style.right = '20px'; hud.style.width = '330px'; hud.style.zIndex = '999999'; document.body.appendChild(hud); setupAcciones();
}

function printLog(mensaje) { const terminal = document.getElementById('ryr-log-terminal'); if (!terminal) return; const l = document.createElement('div'); l.innerHTML = `<span style="color:#555">[>_]</span> ${mensaje}`; terminal.appendChild(l); terminal.scrollTop = terminal.scrollHeight; }
function actualizarStatusHUD(texto, color, bg) { estadoDB = { texto, color, bg }; const badge = document.getElementById('hud-db-status'); if (badge) { badge.innerText = texto; badge.style.color = color; badge.style.backgroundColor = bg; } }

function activarAgenteOverwatch() {
    setInterval(() => {
        // Enfoque agresivo: Atrapa cualquier textarea o caja editable
        let campo = document.querySelector('textarea, div[contenteditable="true"]');
        if (campo && campo.getAttribute('placeholder') && campo.getAttribute('placeholder').toLowerCase().includes('search')) return; // Ignora barras de búsqueda

        let botonEnviar = null;
        document.querySelectorAll('button').forEach(b => {
            let txt = b.innerText.toLowerCase();
            if (txt.includes('send') || txt.includes('enviar') || b.querySelector('.fa-paper-plane') || b.querySelector('svg')) botonEnviar = b;
        });

        const alertaHUD = document.getElementById('ryr-overwatch-alert');
        
        if (campo && botonEnviar) {
            let textoLower = (campo.value || campo.innerText).toLowerCase();
            let detectado = false; let triggerInfraccion = "";
            
            for (let w of REGLAS_ICE.palabras_baneadas) { 
                if (textoLower.includes(w)) { detectado = true; triggerInfraccion = w; break; } 
            }
            if (!detectado && REGLAS_ICE.regex_telefono.test(textoLower)) { detectado = true; triggerInfraccion = "Patrón numérico"; }

            let elBoton = botonEnviar.closest('button') || botonEnviar;
            if (detectado) {
                elBoton.disabled = true; elBoton.style.pointerEvents = "none"; elBoton.style.opacity = "0.2";
                campo.style.border = "2px solid #ff003c"; campo.style.backgroundColor = "rgba(255,0,60,0.05)";
                if (alertaHUD) { alertaHUD.style.display = "block"; alertaHUD.innerHTML = `⚠️ OVERWATCH ICE: Bloqueo activo. Borra la palabra prohibida.`; }
            } else {
                elBoton.disabled = false; elBoton.style.pointerEvents = "auto"; elBoton.style.opacity = "1";
                campo.style.border = "none"; campo.style.backgroundColor = "transparent";
                if (alertaHUD) alertaHUD.style.display = "none";
            }
        }
    }, 300);
}

function ejecutarMineriaDual() {
    setInterval(() => {
        if (!escaneoActivo) return;
        let currentUrlPath = window.location.pathname;
        let pageTextRaw = document.body.innerText;
        
        // ✂️ DESTRUCTOR DE BASURA
        let arrText = pageTextRaw.split('\n').map(t => t.trim()).filter(t => {
            if(t.length === 0) return false;
            let tLow = t.toLowerCase();
            return !FILTRO_BASURA.some(basura => tLow.includes(basura) || tLow === `about ${document.querySelector('h1, .profile-name')?.innerText.split(',')[0].toLowerCase().trim()}`);
        });

        if (currentUrlPath.includes("/my/profile")) {
            try {
                let avIdMatch = pageTextRaw.match(/Profile ID:\s*(\d+)/i);
                if (avIdMatch) {
                    let avId = avIdMatch[1]; 
                    let avNombre = "Avatar"; let avEdad = "46";
                    let headingMatch = pageTextRaw.match(/([A-Za-z\s]+),\s*(\d{2})/);
                    if (headingMatch) { avNombre = headingMatch[1].trim(); avEdad = headingMatch[2].trim(); }
                    
                    let avCivil = "No especificado"; let civilMatch = pageTextRaw.match(/(Widowed|Divorced|Single|Married|Viudo)/i); if (civilMatch) avCivil = civilMatch[0];
                    let avCiudad = "No detectada"; let matchC = pageTextRaw.match(/(City|Ciudad)\s*\n*([^\n]+)/i); if(matchC) avCiudad = matchC[2].trim();
                    let avTraits = "No detectados"; let matchT = pageTextRaw.match(/(Traits|Rasgos)\s*\n*([^\n]+)/i); if(matchT) avTraits = matchT[2].trim();
                    
                    let avStory = ""; let idxStory = arrText.findIndex(t => t.toLowerCase() === 'story' || t.toLowerCase() === 'historia');
                    if (idxStory !== -1) {
                        let bloqueStory = arrText.slice(idxStory + 1, idxStory + 10); let lineaMasLarga = "";
                        for (let p of bloqueStory) { if (p.length > lineaMasLarga.length) lineaMasLarga = p; }
                        if (lineaMasLarga.length > 15) avStory = lineaMasLarga;
                        if (avStory) avTraits = avTraits + " | Historia: " + avStory.substring(0, 300); 
                    }
                    if(document.getElementById('hud-obj-name')) document.getElementById('hud-obj-name').innerHTML = `👤 <strong style="color:#ffcc00">MI PERFIL:</strong> ${avNombre}`;
                    if(document.getElementById('hud-obj-bio')) document.getElementById('hud-obj-bio').innerText = `Civil: ${avCivil}`;
                    if(document.getElementById('hud-obj-gustos')) document.getElementById('hud-obj-gustos').innerText = `Rasgos: ${avTraits.substring(0,60)}...`;

                    if (ultimoIdSincronizado !== "AVATAR_" + avId) {
                        ultimoIdSincronizado = "AVATAR_" + avId; actualizarStatusHUD("🧬 MUTANDO...", "#000", "#ffcc00");
                        chrome.runtime.sendMessage({ accion: "sincronizar_avatar_automatico", payload: { avatar_id: avId, nombre: avNombre, edad: avEdad, ciudad: avCiudad, estado_civil: avCivil, rasgos: avTraits } }, () => {
                            setTimeout(() => actualizarStatusHUD("✅ LORE ON", "#00ffcc", "#003333"), 1000);
                        });
                    }
                }
            } catch (e) { } return; 
        }

        let lastSegment = currentUrlPath.split('/').pop().split('?')[0]; let targetID = "00000";
        if (lastSegment.includes('_')) { targetID = lastSegment.split('_')[1]; } 
        else if (currentUrlPath.includes("/user/") || currentUrlPath.includes("/chat/")) { targetID = lastSegment; }
        
        if (targetID === "00000" || targetID.length < 5) {
             if (ultimoIdSincronizado !== "ESPERA") {
                 ultimoIdSincronizado = "ESPERA";
                 if(document.getElementById('hud-obj-name')) document.getElementById('hud-obj-name').innerHTML = `<span style="color:#00ffcc">Esperando chat...</span>`;
                 if(document.getElementById('hud-obj-bio')) document.getElementById('hud-obj-bio').innerText = `...`;
                 if(document.getElementById('hud-obj-gustos')) document.getElementById('hud-obj-gustos').innerText = `...`;
                 actualizarStatusHUD("🔍 RADAR", "#aaa", "#333");
             } return;
        }

        let nombreLimpio = "Anon", biografia = "Sin biografía", gustosLimpio = "No detectados";
        const elNombre = document.querySelector('main .name, .chat-header .name, h1, .profile-name');
        if (elNombre) { nombreLimpio = elNombre.innerText.split(',')[0].split('\n')[0].trim(); } 

        let idxAbout = arrText.findIndex(t => t.toLowerCase() === 'about me' || t.toLowerCase() === 'about');
        if (idxAbout !== -1) {
            let bloqueBio = arrText.slice(idxAbout + 1, idxAbout + 10); let lineaMasLarga = "";
            for (let p of bloqueBio) { if (p.length > lineaMasLarga.length) { lineaMasLarga = p; } }
            if (lineaMasLarga.length > 10) biografia = lineaMasLarga;
        }

        let idxInt = arrText.findIndex(t => t.toLowerCase() === 'interests' || t.toLowerCase() === 'intereses');
        if (idxInt !== -1) {
            let acumuladorInt = [];
            for (let i = idxInt + 1; i < idxInt + 8; i++) {
                if (!arrText[i]) break; let lineaMin = arrText[i].toLowerCase();
                if (lineaMin === 'looking for' || lineaMin.includes('acerca de')) break;
                if (arrText[i].length > 2 && arrText[i].length < 25) { acumuladorInt.push(arrText[i]); }
            }
            if (acumuladorInt.length > 0) gustosLimpio = acumuladorInt.join(', ');
        }

        if(document.getElementById('hud-obj-name')) document.getElementById('hud-obj-name').innerText = `🎯 TARGET: ${nombreLimpio}`;
        if(document.getElementById('hud-obj-bio') && biografia !== "Sin biografía") document.getElementById('hud-obj-bio').innerText = biografia.substring(0, 50) + "...";
        if(document.getElementById('hud-obj-gustos') && gustosLimpio !== "No detectados") document.getElementById('hud-obj-gustos').innerText = gustosLimpio.substring(0, 50) + "...";

        const payloadPerfil = { cliente_id: targetID, nombre: nombreLimpio, biografia: biografia.substring(0,400), intereses: gustosLimpio };

        if (ultimoIdSincronizado !== "TARGET_" + targetID) {
            ultimoIdSincronizado = "TARGET_" + targetID; actualizarStatusHUD("⏳ SYNC...", "#fff", "#aa6600");
            chrome.runtime.sendMessage({ accion: "verificar_estado", cliente_id: targetID }, (res) => {
                if (res && res.actualizado) { actualizarStatusHUD("✅ CONOCIDO", "#33ff33", "#004d00"); } 
                else { chrome.runtime.sendMessage({ accion: "sincronizar_perfil_masivo", payload: payloadPerfil }, (syncRes) => { if (syncRes && syncRes.success) actualizarStatusHUD("✅ GUARDADO", "#00ffcc", "#003333"); }); }
            });
        }
    }, 1500);
}

function activarProtocoloPreCog(textoCliente) {
    let path = window.location.pathname; let lastSegment = path.split('/').pop().split('?')[0]; let myAvatarID = lastSegment.includes('_') ? lastSegment.split('_')[0] : "108018336";
    document.getElementById('ryr-hud-output').innerText = "⚡ Interceptado. Generando respuesta...";

    const txtBioHTML = document.getElementById('hud-obj-bio') ? document.getElementById('hud-obj-bio').innerText : "";
    const txtGustosHTML = document.getElementById('hud-obj-gustos') ? document.getElementById('hud-obj-gustos').innerText : "";
    const objNombre = document.getElementById('hud-obj-name') ? document.getElementById('hud-obj-name').innerText.replace('🎯 TARGET: ', '') : "Client";

    chrome.runtime.sendMessage({
        accion: "solicitar_traduccion", texto_espanol: textoCliente, 
        objetivo: { nombre: objNombre, biografia: txtBioHTML, gustos: txtGustosHTML }, auto_chat: true, historial_reciente: memoriaConversacion, avatar_id: myAvatarID
    }, (res) => {
        if (res && res.success && res.ingles) { 
            if (pilotoAutomatico) {
                setTimeout(() => { inyectarYEnviarAutomatico(res.ingles); }, 2000); 
            } else {
                document.getElementById('ryr-hud-output').innerHTML = `<div style="background:#111; padding:4px; border-left:2px solid #ff00ff; margin-bottom:4px;"><strong style="color:#ff00ff">EN:</strong> ${res.ingles}</div><div style="background:#111; padding:4px; border-left:2px solid #ffcc00;"><strong style="color:#ffcc00">ES:</strong> ${res.espanol}</div>`;
                bufferMensaje = { en: res.ingles }; document.getElementById('ryr-btn-inyectar').style.display = "block";
            }
        } else { document.getElementById('ryr-hud-output').innerText = "⚠️ Retraso de IA. Reintenta."; }
    });
}

function inyectarYEnviarAutomatico(textoFinal) {
    const campo = document.querySelector('textarea, div[contenteditable="true"]');
    if (campo) {
        campo.focus(); document.execCommand('insertText', false, textoFinal); campo.value = textoFinal; 
        campo.dispatchEvent(new Event('input', { bubbles: true }));
        
        setTimeout(() => { 
            let btn = null;
            document.querySelectorAll('button').forEach(b => { 
                let txt = b.innerText.toLowerCase(); 
                if (txt.includes('send') || txt.includes('enviar') || b.querySelector('svg')) btn = b; 
            });
            if (btn && !btn.disabled) { btn.click(); printLog(`✅ Autopilot disparó JSON nativo.`); } 
        }, 800);
    }
}

function setupAcciones() {
    document.getElementById('ryr-btn-autopilot').onclick = (e) => { pilotoAutomatico = !pilotoAutomatico; e.target.style.background = pilotoAutomatico ? "#ffcc00" : "#333"; e.target.style.color = pilotoAutomatico ? "#000" : "#aaa"; e.target.innerText = pilotoAutomatico ? "🤖 ON" : "🤖 OFF"; printLog(pilotoAutomatico ? "⚠️ AUTOPILOT ACTIVADO." : "🛑 MANUAL."); };
    document.querySelectorAll('.ryr-btn-tono').forEach(btn => { btn.onclick = (e) => { document.querySelectorAll('.ryr-btn-tono').forEach(b => { b.style.background = "#222"; b.style.color = "#aaa"; b.style.border = "1px solid #444"; }); e.target.style.background = "#00ffcc"; e.target.style.color = "#000"; e.target.style.border = "none"; tonoSeleccionado = e.target.getAttribute('data-tono'); }; });

    const inputEs = document.getElementById('ryr-input-es'); const btnTraducir = document.getElementById('ryr-btn-traducir'); const btnInyectar = document.getElementById('ryr-btn-inyectar');

    btnTraducir.onclick = () => {
        if (!inputEs.value.trim()) return;
        document.getElementById('ryr-hud-output').innerText = "🧠 Compilando Comando + Contexto...";
        let path = window.location.pathname; let lastSegment = path.split('/').pop().split('?')[0]; let myAvatarID = lastSegment.includes('_') ? lastSegment.split('_')[0] : "108018336"; 

        chrome.runtime.sendMessage({
            accion: "solicitar_traduccion", texto_espanol: inputEs.value.trim(),
            objetivo: { nombre: document.getElementById('hud-obj-name').innerText, biografia: document.getElementById('hud-obj-bio').innerText, gustos: document.getElementById('hud-obj-gustos').innerText },
            tono: tonoSeleccionado, auto_chat: false, avatar_id: myAvatarID, historial_reciente: memoriaConversacion
        }, (res) => {
            if (res && res.success && res.ingles) {
                bufferMensaje = { en: res.ingles };
                document.getElementById('ryr-hud-output').innerHTML = `<div style="background:#111; padding:4px; border-left:2px solid #00ffcc; margin-bottom:4px;"><strong style="color:#00ffcc">EN:</strong> ${res.ingles}</div><div style="background:#111; padding:4px; border-left:2px solid #ffcc00;"><strong style="color:#ffcc00">ES:</strong> ${res.espanol}</div>`;
                btnInyectar.style.display = "block";
            }
        });
    };

    btnInyectar.onclick = () => {
        inyectarYEnviarAutomatico(bufferMensaje.en);
        btnInyectar.style.display = "none"; inputEs.value = "";
    };
}

inicializarExtension();
const observer = new MutationObserver(() => { if (escaneoActivo && !document.getElementById('ryr-hud-container')) inyectarHUD(); });
observer.observe(document.body, { childList: true, subtree: true });