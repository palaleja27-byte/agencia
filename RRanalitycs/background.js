// background.js - AGENTE RYR V15.1
const SERVER_URL = "http://10.21.41.168:18791";

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    const ruteo = {
        "login_operador": "/api/auth/login",
        "sincronizar_avatar_automatico": "/api/sincronizar_avatar_automatico",
        "solicitar_traduccion": "/api/traducir",
        "sincronizar_perfil_masivo": "/api/sincronizar_perfil",
        "guardar_en_boveda": "/api/guardar_mensaje",
        "sync_historial_completo": "/api/sync_historial"
    };

    if (ruteo[request.accion]) {
        fetch(`${SERVER_URL}${ruteo[request.accion]}`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(request.payload || request)
        }).then(r => r.json()).then(data => sendResponse(data)).catch(err => sendResponse({ success: false }));
        return true;
    }

    if (request.accion === "verificar_estado") {
        fetch(`${SERVER_URL}/api/estado_perfil/${request.cliente_id}`)
        .then(r => r.json()).then(data => sendResponse(data)).catch(err => sendResponse({ actualizado: false }));
        return true;
    }
});