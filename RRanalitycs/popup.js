document.addEventListener('DOMContentLoaded', () => {
    const SERVER_IP = "10.21.41.168"; // Servidor ZeroTier
    
    chrome.storage.local.get(['operador_activo'], (result) => {
        if (result.operador_activo) mostrarPanelActivo(result.operador_activo.nombre);
    });

    document.getElementById('btn-login').addEventListener('click', async () => {
        const user = document.getElementById('username').value.trim();
        const pass = document.getElementById('password').value.trim();
        const status = document.getElementById('status-msg');

        if (!user || !pass) {
            status.style.color = "#ff4d4d";
            status.innerText = "🛑 Faltan credenciales.";
            return;
        }

        status.style.color = "#00ffcc";
        status.innerText = "Autenticando en la Matriz...";

        try {
            const response = await fetch(`http://${SERVER_IP}:18791/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: user, password: pass })
            });
            const data = await response.json();

            if (data.success) {
                chrome.storage.local.set({ operador_activo: { id: data.operador.id, nombre: data.operador.nombre } }, () => {
                    mostrarPanelActivo(data.operador.nombre);
                    status.innerText = "";
                });
            } else {
                status.style.color = "#ff4d4d";
                status.innerText = `🛑 Error: ${data.message}`;
            }
        } catch (error) {
            status.style.color = "#ff4d4d";
            status.innerText = "🛑 Error de red. ¿Servidor apagado?";
        }
    });

    document.getElementById('btn-logout').addEventListener('click', () => {
        chrome.storage.local.remove(['operador_activo'], () => {
            document.getElementById('login-form').style.display = "block";
            document.getElementById('panel-activo').style.display = "none";
            document.getElementById('username').value = "";
            document.getElementById('password').value = "";
            document.getElementById('status-msg').innerText = "Turno cerrado.";
            document.getElementById('status-msg').style.color = "#aaa";
        });
    });

    function mostrarPanelActivo(nombre) {
        document.getElementById('login-form').style.display = "none";
        document.getElementById('panel-activo').style.display = "block";
        document.getElementById('op-name').innerText = nombre;
    }
});