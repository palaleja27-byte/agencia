// RYR TITAN APEX - SERVICE WORKER

// Escuchar cuando la extensión se instala o actualiza
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    console.log("🚀 RYR TITAN APEX instalado con éxito.");
    // Inicializar valores por defecto
    chrome.storage.local.set({
      monitoringActive: false,
      activeSlaTimers: {},
      syncedChatsList: []
    });
  }
});

// Mantener el worker despierto para procesos críticos
chrome.runtime.onConnect.addListener((port) => {
  console.log("🔌 Canal de comunicación activo.");
});

// Listener para mensajes y difusión transversal entre pestañas y scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "checkStatus") {
    sendResponse({ status: "alive" });
    return true;
  }

  // Enrutar alertas globales y configuraciones a todas las pestañas abiertas de Talkytimes
  if (request && (request.type === 'GLOBAL_TASK_ALERT' || request.type === 'GLOBAL_VOICE_ALERT' || request.type === 'TASK_ALERTS_CONFIG')) {
    chrome.tabs.query({ url: "*://*.talkytimes.com/*" }, (tabs) => {
      if (tabs && tabs.length) {
        tabs.forEach(tab => {
          chrome.tabs.sendMessage(tab.id, request).catch(() => {});
        });
      }
    });
    sendResponse({ success: true, deliveredToTabs: true });
    return true;
  }

  return true;
});