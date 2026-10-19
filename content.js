(() => {
  if (window.self !== window.top) return;

  function isContextValid() {
    return typeof chrome !== 'undefined' && chrome.runtime && !!chrome.runtime.id;
  }

  const API_URL = 'https://ryr-titan-backend.onrender.com';

  // 0. ESCUDO CSS INMEDIATO (0ms): OCULTA LÁPICES, DRAFTS Y BOTONES DE RAYITO EN LA LISTA LATERAL
  const draftBlockerStyle = document.createElement('style');
  draftBlockerStyle.id = 'ryr-draft-eradicator-css';
  draftBlockerStyle.innerHTML = `
    div[data-test-id*="dialog-item"] span:has(svg[class*="pencil" i]),
    div[class*="dialog-item"] span:has(svg[class*="pencil" i]),
    div[class*="item-wrap"] span:has(svg[class*="pencil" i]),
    [class*="draft" i], [class*="Draft"],
    .ryr-row-extract-btn, .ryr-extract-menu {
      display: none !important;
      visibility: hidden !important;
      opacity: 0 !important;
    }
  `;
  if (document.head) document.head.appendChild(draftBlockerStyle);

  let isStorageLoaded = false;

  let sessionData = {
    operator: null,
    shift: null,
    profileName: null,
    profileId: null,
    monitoringActive: false
  };

  // 1. MÉTRICAS Y TELEMETRÍA DE RENDIMIENTO (ZERO-LAG ENGINE)
  const PerformanceSentinel = {
    lastLoopDurationMs: 0,
    measureExecution: function(fn) {
      const t0 = performance.now();
      try {
        fn();
      } catch (err) {
        console.error('[RYR-HUD] Execution error:', err);
      }
      this.lastLoopDurationMs = Math.round((performance.now() - t0) * 100) / 100;
    },
    runIdle: function(task) {
      if ('requestIdleCallback' in window) {
        window.requestIdleCallback(task, { timeout: 1000 });
      } else {
        setTimeout(task, 16);
      }
    }
  };

  let totalGlobalReadLetters = 0;
  let isCrawlerRunning = false;
  let lastCrawlerRunTime = 0;

  let lastUserInteraction = Date.now();
  const AFK_THRESHOLD_SECONDS = 300;

  let configuredSlaDurationSeconds = 120; // Tiempo de respuesta por defecto (2 minutos)
  let activeSlaTimers = {};
  let finedTimerKeys = new Set();
  let syncedChatsMemory = new Set();
  let seenSupervisorMessageIds = new Set();
  let supervisorMessagesHistory = [];
  let isSupervisorChatOpen = false;
  let zeroCreditsClientsSet = new Set();

  // REGISTRO DE ALERTAS E INFRACCIONES DETALLADAS DEL FIREWALL
  let firewallInfractionsCount = 0;
  let liveInfractionsLog = [];

  const PROSPECTING_MIN_QUOTA = 10;
  const PROSPECTING_CYCLE_DURATION = 1800; // 30 min
  let prospectingCycleStartTime = Date.now();
  let prospectingCount = 0;
  let cycleInteractedUsersSet = new Set();

  // DICCIONARIO BASE DE RAÍCES PROHIBIDAS Y PATRONES TRAVEL MISLEADING (TM)
  let bannedRoots = [
    'promet', 'promes', 'whatsapp', 'skype', 'email', 'correo', 
    'telefon', 'teléfon', 'numer', 'númer', 'banc', 'tarjet', 
    'instagram', 'telegram', 'diner', 'transferenc', 'pay', 'cash', 'paypal',
    'when we meet', 'when i visit you', 'book a flight', 'hotel', 'meet up',
    'airport', 'tickets', 'my flight', 'in person', 'flight to', 'flying to',
    'visit you', 'come see you', 'ticket to', 'where are you from', 'where do you live',
    'where r u from', 'where you from', 'de donde eres', 'donde vives', 'what city',
    'which city', 'what country', 'marry me', 'casarnos', 'matrimonio'
  ];

  // 2. REGISTRO DE ACTIVIDAD HUMANA
  ['keydown', 'mousedown', 'mousemove', 'wheel', 'touchstart', 'input'].forEach(evt => {
    window.addEventListener(evt, () => {
      lastUserInteraction = Date.now();
    }, { passive: true });
  });

  function getIdleSeconds() {
    return Math.floor((Date.now() - lastUserInteraction) / 1000);
  }

  function isOperatorAfk() {
    return getIdleSeconds() >= AFK_THRESHOLD_SECONDS;
  }

  // 3. PURGADOR DE TEXTAREA AL CAMBIAR DE CHAT
  ['pointerdown', 'mousedown', 'touchstart'].forEach(evtType => {
    document.addEventListener(evtType, (e) => {
      const sidebarItem = e.target.closest('div[data-test-id*="dialog-item"], div[class*="dialog-item"], div[class*="item-wrap"], .tab-content-item');
      if (sidebarItem) {
        const textareas = document.querySelectorAll('textarea');
        textareas.forEach(ta => {
          if (!ta.id?.includes('intel') && !ta.id?.includes('search') && !ta.id?.includes('sup-reply')) {
            try {
              const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
              if (nativeSetter) nativeSetter.call(ta, '');
              else ta.value = '';
              ta.dispatchEvent(new Event('input', { bubbles: true }));
              ta.dispatchEvent(new Event('change', { bubbles: true }));
            } catch (err) {
              ta.value = '';
            }
          }
        });
      }
    }, true);
  });

  // 4. DETECTOR DE CLICS PARA PROSPECCIÓN
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('button, a, div[role="button"]');
    if (!btn) return;

    const rawText = (btn.innerText || '').trim().toLowerCase();
    if (rawText.includes('liked') || rawText.includes('winked') || rawText.includes('unfollow') || rawText.includes('following')) {
      return;
    }

    const isFreshLike = rawText === 'like';
    const isFreshWink = rawText === 'wink';
    const isFreshFollow = rawText === 'follow';
    const isCardHeart = btn.querySelector('svg[class*="heart"]') && !btn.className.includes('liked') && !btn.className.includes('active');

    if (isFreshLike || isFreshWink || isFreshFollow || isCardHeart) {
      const userLink = btn.closest('div, a')?.querySelector('a[href*="/user/"]') || btn.closest('a[href*="/user/"]');
      let targetUserId = '';
      if (userLink) {
        const m = userLink.getAttribute('href').match(/user\/(\d+)/);
        if (m) targetUserId = m[1];
      }
      if (!targetUserId && window.location.href.includes('/user/')) {
        const m = window.location.href.match(/user\/(\d+)/);
        if (m) targetUserId = m[1];
      }
      if (!targetUserId) targetUserId = `user_${Date.now()}`;

      if (!cycleInteractedUsersSet.has(targetUserId)) {
        cycleInteractedUsersSet.add(targetUserId);
        prospectingCount = cycleInteractedUsersSet.size;

        persistProspectingState();
        renderFloatingBar();
        sendTelemetry(true);
      }
    }
  }, true);

  function persistProspectingState() {
    if (!isContextValid()) return;
    try {
      chrome.storage.local.set({
        prospectingCycleStartTime,
        prospectingCount,
        cycleInteractedUsersList: Array.from(cycleInteractedUsersSet)
      });
    } catch (e) {}
  }

  // 5. CARGA BLINDADA DE STORAGE (INMUNE A F5)
  if (isContextValid()) {
    try {
      chrome.storage.local.get(null, (data) => {
        if (!isContextValid() || !data) return;
        
        if (data.configuredSlaDurationSeconds) {
          configuredSlaDurationSeconds = Number(data.configuredSlaDurationSeconds) || 120;
        }

        if (data.activeSlaTimers && typeof data.activeSlaTimers === 'object') {
          activeSlaTimers = { ...data.activeSlaTimers };
        }
        
        if (Array.isArray(data.syncedChatsList)) {
          data.syncedChatsList.forEach(item => syncedChatsMemory.add(String(item).trim().toLowerCase()));
        }

        if (Array.isArray(data.seenSupervisorMessageIdsList)) {
          data.seenSupervisorMessageIdsList.forEach(id => seenSupervisorMessageIds.add(id));
        }

        if (Array.isArray(data.zeroCreditsClientsList)) {
          data.zeroCreditsClientsList.forEach(id => zeroCreditsClientsSet.add(String(id).trim().toLowerCase()));
        }

        if (data.prospectingCycleStartTime) prospectingCycleStartTime = data.prospectingCycleStartTime;
        if (data.prospectingCount) prospectingCount = data.prospectingCount;
        if (Array.isArray(data.cycleInteractedUsersList)) {
          data.cycleInteractedUsersList.forEach(id => cycleInteractedUsersSet.add(id));
        }

        if (data.firewallInfractionsCount) firewallInfractionsCount = data.firewallInfractionsCount;
        if (Array.isArray(data.liveInfractionsLog)) {
          liveInfractionsLog = [...data.liveInfractionsLog];
        }

        sessionData = {
          operator: data.operator || 'walther',
          shift: data.shift || 'Mañana',
          profileName: data.profileName || 'HORACIO',
          profileId: data.profileId || '118179794',
          monitoringActive: !!data.monitoringActive
        };

        if (sessionData.monitoringActive) {
          renderFloatingBar();
          injectIntelPanel();
          syncServerKnownChats();
        }

        isStorageLoaded = true;
      });
    } catch (e) {
      isStorageLoaded = true;
    }
  } else {
    isStorageLoaded = true;
  }

  function persistTimersToStorage() {
    if (!isContextValid() || !isStorageLoaded) return;
    try {
      chrome.storage.local.set({ activeSlaTimers });
    } catch (e) {}
  }

  function persistSyncedChatsToStorage() {
    if (!isContextValid()) return;
    try {
      chrome.storage.local.set({ syncedChatsList: Array.from(syncedChatsMemory) });
    } catch (e) {}
  }

  function persistSeenSupervisorMessages() {
    if (!isContextValid()) return;
    try {
      chrome.storage.local.set({ seenSupervisorMessageIdsList: Array.from(seenSupervisorMessageIds) });
    } catch (e) {}
  }

  function persistZeroCreditsClients() {
    if (!isContextValid()) return;
    try {
      chrome.storage.local.set({ zeroCreditsClientsList: Array.from(zeroCreditsClientsSet) });
    } catch (e) {}
  }

  function persistFirewallInfractions() {
    if (!isContextValid()) return;
    try {
      chrome.storage.local.set({
        firewallInfractionsCount,
        liveInfractionsLog: liveInfractionsLog.slice(0, 50)
      });
    } catch (e) {}
  }

  if (isContextValid()) {
    try {
      chrome.storage.onChanged.addListener((changes, area) => {
        if (!isContextValid()) return;
        if (area === 'local') {
          if (changes.monitoringActive) sessionData.monitoringActive = changes.monitoringActive.newValue;
          if (changes.operator) sessionData.operator = changes.operator.newValue;
          if (changes.shift) sessionData.shift = changes.shift.newValue;
          if (changes.profileName) sessionData.profileName = changes.profileName.newValue;
          if (changes.profileId) sessionData.profileId = changes.profileId.newValue;

          if (sessionData.monitoringActive) {
            renderFloatingBar();
            injectIntelPanel();
            syncServerKnownChats();
          } else {
            removeFloatingBar();
          }
        }
      });
    } catch (e) {}
  }

  // 6. CHAT BIDIRECCIONAL SUPERVISOR-OPERADOR (BANNER & MODAL HUD)
  let supervisorChatPollTimer = null;

  async function checkSupervisorDirectMessages() {
    const rawOp = (sessionData.operator || 'walther').trim();
    if (!rawOp) return;
    try {
      const res = await fetch(`${API_URL}/api/supervisor/messages/${encodeURIComponent(rawOp)}?role=${isSupervisorChatOpen ? 'OPERATOR' : ''}`);
      const data = await res.json();
      if (data && Array.isArray(data.messages)) {
        const serverMessages = [...data.messages];
        const seenIds = new Set(serverMessages.map(m => String(m.id)));
        
        // Mantener mensajes locales optimistas temporales que aún no están en el servidor
        supervisorMessagesHistory.forEach(localM => {
          if (String(localM.id).startsWith('op_tmp_') && !seenIds.has(String(localM.id))) {
            serverMessages.push(localM);
            seenIds.add(String(localM.id));
          }
        });

        serverMessages.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
        supervisorMessagesHistory = serverMessages;
        renderSupervisorChatMessages();

        const unreadSupMessages = supervisorMessagesHistory.filter(m => m.sender === 'SUPERVISOR' && !m.read && !seenSupervisorMessageIds.has(m.id));
        const supChatBtn = document.getElementById('ryr-btn-open-sup-chat');
        if (supChatBtn) {
          if (unreadSupMessages.length > 0 && !isSupervisorChatOpen) {
            supChatBtn.classList.add('unread');
            supChatBtn.style.setProperty('background', 'linear-gradient(135deg, #dc2626, #b91c1c)', 'important');
            supChatBtn.style.setProperty('border-color', '#f87171', 'important');
            supChatBtn.style.setProperty('box-shadow', '0 0 10px rgba(239,68,68,0.7)', 'important');
            supChatBtn.innerText = `💬 Chat Sup (${unreadSupMessages.length} NUEVO${unreadSupMessages.length > 1 ? 'S' : ''})`;
          } else {
            supChatBtn.classList.remove('unread');
            supChatBtn.style.removeProperty('background');
            supChatBtn.style.removeProperty('border-color');
            supChatBtn.style.removeProperty('box-shadow');
            supChatBtn.innerText = `💬 Chat Sup`;
          }
        }

        if (unreadSupMessages.length > 0 && !isSupervisorChatOpen) {
          const latest = unreadSupMessages[unreadSupMessages.length - 1];
          const existingBanner = document.getElementById('ryr-supervisor-banner');
          if (!existingBanner || existingBanner.getAttribute('data-msg-id') !== String(latest.id)) {
            showSupervisorDirectBanner(latest.text, latest.id);
          }
        }
      }
    } catch (e) {}
  }

  function showSupervisorDirectBanner(text, messageId) {
    const existing = document.getElementById('ryr-supervisor-banner');
    if (existing) existing.remove();

    const banner = document.createElement('div');
    banner.id = 'ryr-supervisor-banner';
    banner.setAttribute('data-msg-id', String(messageId));
    banner.style.cssText = `
      position: fixed;
      top: 45px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(15, 23, 42, 0.98);
      backdrop-filter: blur(16px);
      border: 2px solid #818cf8;
      color: #ffffff;
      padding: 12px 16px;
      border-radius: 10px;
      font-family: system-ui, sans-serif;
      font-size: 12px;
      z-index: 2147483647;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.8), 0 0 15px rgba(99, 102, 241, 0.5);
      display: flex;
      flex-direction: column;
      gap: 8px;
      width: 420px;
      max-width: 92%;
      animation: ryrToastSlide 0.25s ease-out;
    `;

    banner.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <span style="font-weight:900; color:#c7d2fe; letter-spacing:0.5px;">📢 MENSAJE DIRECTO DEL SUPERVISOR:</span>
        <span id="btn-close-sup-banner" style="cursor:pointer; font-size:16px; color:#94a3b8; line-height:1;">✕</span>
      </div>
      <div style="font-size:12px; line-height:1.4; color:#fde68a; font-weight:500; background:rgba(30,27,75,0.6); padding:8px 10px; border-radius:6px; border-left:3px solid #818cf8;">
        ${text}
      </div>
      <div style="display:flex; gap:6px;">
        <input type="text" id="input-reply-sup" placeholder="Responder al supervisor..." style="flex:1; padding:7px 10px; background:rgba(6,9,19,0.9); border:1px solid #4f46e5; color:#fff; border-radius:5px; font-size:11px; outline:none;">
        <button id="btn-reply-sup" style="background:#6366f1; color:#fff; border:none; padding:7px 14px; border-radius:5px; font-weight:bold; cursor:pointer; font-size:11px;">Enviar</button>
      </div>
    `;

    document.body.appendChild(banner);

    const replyInput = document.getElementById('input-reply-sup');
    const sendReplyBtn = document.getElementById('btn-reply-sup');

    ['keydown', 'keyup', 'input'].forEach(evtType => {
      replyInput.addEventListener(evtType, (e) => {
        e.stopPropagation();
        if (e.key === 'Enter') {
          e.preventDefault();
          sendReplyBtn.click();
        }
      }, true);
    });

    document.getElementById('btn-close-sup-banner').onclick = () => {
      seenSupervisorMessageIds.add(messageId);
      persistSeenSupervisorMessages();
      banner.remove();
    };

    sendReplyBtn.onclick = async () => {
      const replyText = replyInput.value.trim();
      if (!replyText) return;

      seenSupervisorMessageIds.add(messageId);
      persistSeenSupervisorMessages();

      try {
        await fetch(`${API_URL}/api/operator/reply-message`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            operatorName: sessionData.operator || 'walther',
            text: replyText
          })
        });
        banner.remove();
        checkSupervisorDirectMessages();
      } catch (e) {
        banner.remove();
      }
    };
  }

  function toggleSupervisorChatModal() {
    let modal = document.getElementById('ryr-supervisor-chat-modal');
    if (modal) {
      modal.remove();
      isSupervisorChatOpen = false;
      if (supervisorChatPollTimer) {
        clearInterval(supervisorChatPollTimer);
        supervisorChatPollTimer = null;
      }
      return;
    }

    isSupervisorChatOpen = true;
    const currentOp = (sessionData.operator || 'walther').trim();
    modal = document.createElement('div');
    modal.id = 'ryr-supervisor-chat-modal';
    modal.innerHTML = `
      <div class="ryr-sup-chat-header">
        <span>💬 CANAL SUPERVISIÓN & MONITOREO (${currentOp.toUpperCase()})</span>
        <span id="ryr-close-sup-chat" style="cursor:pointer; font-size:16px;">✕</span>
      </div>
      <div id="ryr-sup-chat-stream" class="ryr-sup-chat-body">
        <div style="color:#94a3b8; font-size:11px; text-align:center; padding:10px;">Cargando mensajes del turno...</div>
      </div>
      <div class="ryr-sup-chat-footer">
        <input type="text" id="input-sup-chat-live" placeholder="Escribe al supervisor...">
        <button id="btn-send-sup-chat-live">Enviar</button>
      </div>
    `;

    document.body.appendChild(modal);

    document.getElementById('ryr-close-sup-chat').onclick = () => {
      modal.remove();
      isSupervisorChatOpen = false;
      if (supervisorChatPollTimer) {
        clearInterval(supervisorChatPollTimer);
        supervisorChatPollTimer = null;
      }
    };

    const input = document.getElementById('input-sup-chat-live');
    const sendBtn = document.getElementById('btn-send-sup-chat-live');

    const sendAction = async () => {
      const txt = input.value.trim();
      if (!txt) return;
      input.value = '';

      const tempId = `op_tmp_${Date.now()}`;
      supervisorMessagesHistory.push({
        id: tempId,
        sender: 'OPERATOR',
        text: txt,
        timestamp: Date.now(),
        read: false,
        isEdited: false
      });
      renderSupervisorChatMessages();

      try {
        const res = await fetch(`${API_URL}/api/operator/reply-message`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            operatorName: sessionData.operator || 'walther',
            text: txt
          })
        });
        const resData = await res.json();
        if (resData && resData.id) {
          const item = supervisorMessagesHistory.find(m => m.id === tempId);
          if (item) item.id = resData.id;
        }
        checkSupervisorDirectMessages();
      } catch (e) {}
    };

    sendBtn.onclick = sendAction;
    input.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') {
        e.preventDefault();
        sendAction();
      }
    });

    // Marcar como leídos al abrir el chat
    fetch(`${API_URL}/api/supervisor/mark-read`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        operatorName: sessionData.operator || 'walther',
        role: 'OPERATOR'
      })
    }).catch(() => {});

    checkSupervisorDirectMessages();

    // Iniciar sondeo en vivo cada 1.5s mientras esté abierto el modal
    if (supervisorChatPollTimer) clearInterval(supervisorChatPollTimer);
    supervisorChatPollTimer = setInterval(() => {
      if (isSupervisorChatOpen) {
        checkSupervisorDirectMessages();
      } else {
        clearInterval(supervisorChatPollTimer);
        supervisorChatPollTimer = null;
      }
    }, 1500);
  }

  window.editSupervisorMsgFromHud = async (msgId, currentText) => {
    const newText = prompt('✏️ Editar mensaje:', currentText);
    if (newText === null) return;
    const cleanNewText = newText.trim();
    if (!cleanNewText || cleanNewText === currentText) return;

    // Actualizar localmente de inmediato (optimistic update)
    const localMsg = supervisorMessagesHistory.find(m => String(m.id) === String(msgId));
    if (localMsg) {
      localMsg.text = cleanNewText;
      localMsg.isEdited = true;
      renderSupervisorChatMessages();
    }

    try {
      await fetch(`${API_URL}/api/supervisor/edit-message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: msgId,
          text: cleanNewText,
          operatorName: sessionData.operator || 'walther'
        })
      });
      checkSupervisorDirectMessages();
      showFirewallToast('✅ Mensaje editado con éxito.', 'success');
    } catch (e) {
      showFirewallToast('⚠️ Error al editar mensaje.');
    }
  };

  function renderSupervisorChatMessages() {
    const stream = document.getElementById('ryr-sup-chat-stream');
    if (!stream) return;

    if (!supervisorMessagesHistory || supervisorMessagesHistory.length === 0) {
      stream.innerHTML = '<div style="color:#64748b; font-size:11px; text-align:center; padding:20px;">No hay mensajes recientes del supervisor en este turno. Escribe abajo para iniciar.</div>';
      return;
    }

    stream.innerHTML = supervisorMessagesHistory.map(m => {
      const isSup = m.sender === 'SUPERVISOR';
      const cssClass = isSup ? 'ryr-sup-msg-supervisor' : 'ryr-sup-msg-operator';
      const timeStr = m.timestamp ? new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
      const label = isSup ? `👮 Supervisor` : `💼 Tú (${sessionData.operator || 'Op'})`;
      const editedTag = m.isEdited ? '<span style="font-size:9.5px; color:#fbbf24; font-style:italic;"> (editado)</span>' : '';
      const escapedText = (m.text || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');

      // Chulitos tipo WhatsApp: ✓ (Gris - Enviado/No leído) | ✓✓ (Verde - Leído)
      let checkmarkHtml = '';
      if (!isSup) {
        if (m.read) {
          checkmarkHtml = '<span style="color:#22c55e; font-weight:900; font-size:11.5px; margin-left:3px;" title="Leído por el supervisor">✓✓</span>';
        } else {
          checkmarkHtml = '<span style="color:#94a3b8; font-weight:900; font-size:11.5px; margin-left:3px;" title="Enviado al supervisor">✓</span>';
        }
      } else {
        if (m.read) {
          checkmarkHtml = '<span style="color:#22c55e; font-weight:900; font-size:11.5px; margin-left:3px;" title="Leído">✓✓</span>';
        } else {
          checkmarkHtml = '<span style="color:#94a3b8; font-weight:900; font-size:11.5px; margin-left:3px;" title="Entregado">✓</span>';
        }
      }

      return `
        <div class="ryr-sup-msg-item ${cssClass}" id="ryr-sup-msg-${m.id}">
          <div style="display:flex; justify-content:space-between; align-items:center; gap:6px; font-size:9.5px; opacity:0.85; margin-bottom:3px; font-weight:bold;">
            <span>${label} • ${timeStr}${editedTag}</span>
            <div style="display:flex; align-items:center; gap:3px;">
              <button type="button" onclick="window.editSupervisorMsgFromHud('${m.id}', '${escapedText}')" style="background:transparent; border:none; color:#cbd5e1; cursor:pointer; font-size:10px; padding:0 2px;" title="Editar mensaje">✏️</button>
              ${checkmarkHtml}
            </div>
          </div>
          <div style="word-break:break-word; font-size:11.5px; line-height:1.4;">${m.text}</div>
        </div>
      `;
    }).join('');

    stream.scrollTop = stream.scrollHeight;
  }

  // 7. EVALUADOR DEL CICLO DE PROSPECCIÓN (30 MIN)
  function evaluateProspectingCycle() {
    const elapsed = Math.floor((Date.now() - prospectingCycleStartTime) / 1000);
    const remaining = Math.max(0, PROSPECTING_CYCLE_DURATION - elapsed);

    if (elapsed >= PROSPECTING_CYCLE_DURATION) {
      prospectingCycleStartTime = Date.now();
      prospectingCount = 0;
      cycleInteractedUsersSet.clear();
      persistProspectingState();
    }

    const min = Math.floor(remaining / 60);
    const sec = remaining % 60;
    return {
      formattedTime: `${min < 10 ? '0' : ''}${min}:${sec < 10 ? '0' : ''}${sec}`,
      count: prospectingCount,
      quota: PROSPECTING_MIN_QUOTA,
      isCompleted: prospectingCount >= PROSPECTING_MIN_QUOTA,
      remainingSeconds: remaining
    };
  }

  // 8. SINCRONIZACIÓN CON SERVIDOR
  async function syncServerKnownChats() {
    if (!sessionData.profileName) return;
    try {
      const res = await fetch(`${API_URL}/api/chats/synced-ids?profile=${sessionData.profileName}`);
      const data = await res.json();
      if (data && Array.isArray(data.syncedIds)) {
        data.syncedIds.forEach(id => syncedChatsMemory.add(String(id).trim().toLowerCase()));
        persistSyncedChatsToStorage();
      }
    } catch (e) {}
  }

  async function syncBannedWords() {
    try {
      const res = await fetch(`${API_URL}/api/banned-words`);
      const data = await res.json();
      if (data && Array.isArray(data.words)) {
        bannedRoots = Array.from(new Set([...bannedRoots, ...data.words.map(w => w.toLowerCase())]));
      }
    } catch (e) {}
  }
  syncBannedWords();
  setInterval(syncBannedWords, 15000);

  // 9. FIREWALL MULTILINGÜE DE 3 CAPAS & PREVENCIÓN DE TRAVEL MISLEADING (TM)
  
  // Detección inteligente de si el cliente preguntó explícitamente por países, origen, partidos, juegos o equipos
  function didClientExplicitlyAskCountryOrContext() {
    const cleanClientId = getExactNumericClientId() || 'user';
    const history = persistentClientChatHistoryMap.get(cleanClientId);
    if (history && history.size > 0) {
      const list = Array.from(history.values()).slice(-10);
      for (let i = list.length - 1; i >= 0; i--) {
        const msg = list[i];
        if (!msg.isOperator) {
          const txt = (msg.text || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
          
          // 1. Pregunta explícita de origen o ubicación
          if (
            /\b(where\s+(are|r)\s+(you|u)\s+from|where\s+do\s+(you|u)\s+live|where\s+are\s+you\s+located|what\s+country\s+are\s+you\s+from|what\s+country|which\s+country)\b/i.test(txt) ||
            /\b(de\s+donde\s+eres|de\s+donde\s+vienes|donde\s+vives|de\s+que\s+pais\s+eres|de\s+que\s+ciudad\s+eres|en\s+que\s+pais\s+estas|que\s+pais)\b/i.test(txt) ||
            /\b(de\s+onde\s+(voce|vc)\s+(e|mora|vive)|qual\s+o\s+seu\s+pais|qual\s+a\s+sua\s+cidade|qual\s+pais)\b/i.test(txt) ||
            /\b(d\s*ou\s*tu\s*es|d\s*ou\s*viens\s*tu|ou\s+tu\s+habites|quel\s+pays|di\s+dove\s+sei|dove\s+vivi|quale\s+paese|woher\s+kommst\s+du|wo\s+wohnst\s+du|welches\s+land)\b/i.test(txt) ||
            /\b(откуда\s+ты|где\s+ты\s+живешь|какая\s+страна)\b/i.test(txt)
          ) {
            return true;
          }

          // 2. Pregunta sobre quién juega, partidos, equipos, copa o deportes
          if (
            /\b(quien\s+juega|quienes\s+juegan|que\s+paises\s+juegan|que\s+equipos|cuales\s+equipos|que\s+partido|quien\s+va\s+a\s+jugar|con\s+quien\s+juega|quien\s+juega\s+hoy)\b/i.test(txt) ||
            /\b(who\s+is\s+playing|who\s+plays|which\s+teams|which\s+countries|what\s+match|who\s+is\s+in\s+the\s+game|who\s+vs\s+who|who\s+plays\s+today)\b/i.test(txt) ||
            /\b(quem\s+joga|quais\s+paises\s+jogam|quais\s+times|qual\s+jogo|quem\s+joga\s+hoje)\b/i.test(txt) ||
            /\b(qui\s+joue|quelles\s+equipes|chi\s+gioca|quali\s+squadre|wer\s+spielt|welche\s+mannschaften|кто\s+играет)\b/i.test(txt)
          ) {
            return true;
          }
        }
      }
    }

    // Búsqueda de respaldo en las burbujas del DOM
    const bubbles = document.querySelectorAll('div[class*="dialog-content"] div, div[class*="chat-scroll"] div, div[class*="message"]');
    for (let el of bubbles) {
      if (el.innerText && el.innerText.length < 140) {
        const txt = el.innerText.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        if (
          /\b(where\s+(are|r)\s+(you|u)\s+from|where\s+do\s+(you|u)\s+live|what\s+country|who\s+is\s+playing|who\s+plays|which\s+teams)\b/i.test(txt) ||
          /\b(de\s+donde\s+eres|de\s+que\s+pais|quien\s+juega|quienes\s+juegan|que\s+partido|que\s+equipos)\b/i.test(txt) ||
          /\b(de\s+onde\s+voce\s+e|qual\s+pais|quem\s+joga|quais\s+times)\b/i.test(txt)
        ) {
          const isOp = el.querySelector('svg[class*="check"]') || el.innerText.includes('You:') || el.className.includes('right');
          if (!isOp) return true;
        }
      }
    }
    return false;
  }

  function checkViolationInText(text) {
    if (!text || text.length < 2) return null;
    
    // Normalización universal (remueve tildes, acentos y diacríticos)
    const rawLower = text.toLowerCase().trim();
    const normalized = text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[\r\n\t]+/g, " ")
      .trim();

    // 1. PROHIBICIÓN ESTRICTA: PREGUNTAR AL USUARIO SOBRE PAÍS, CIUDAD O UBICACIÓN (SIEMPRE BLOQUEADO)
    const countryQuestionPatterns = [
      /\b(de\s+que\s+pais|de\s+que\s+ciudad|de\s+que\s+estado|de\s+que\s+lugar|de\s+donde\s+eres|de\s+donde\s+vienes|donde\s+vives|en\s+que\s+pais|en\s+que\s+ciudad|en\s+que\s+lugar\s+vives|cual\s+es\s+tu\s+pais|cual\s+es\s+tu\s+ciudad|en\s+que\s+parte\s+vives)\b/i,
      /\b(what\s+country|what\s+city|which\s+country|which\s+city|where\s+are\s+you\s+from|where\s+do\s+you\s+live|where\s+r\s+u\s+from|what\s+state\s+are\s+you\s+in|what\s+place\s+are\s+you\s+from)\b/i,
      /\b(de\s+qual\s+pais|de\s+qual\s+cidade|de\s+onde\s+voce\s+e|onde\s+voce\s+mora|onde\s+voce\s+vive|qual\s+o\s+seu\s+pais|qual\s+a\s+sua\s+cidade|qual\s+o\s+seu\s+estado)\b/i,
      /\b(de\s+quel\s+pays|de\s+quelle\s+ville|d\s*ou\s*tu\s*viens|tu\s+es\s+de\s+quel\s+pays|tu\s+habites\s+dans\s+quel\s+pays)\b/i,
      /\b(di\s+che\s+paese|di\s+quale\s+citta|di\s+dove\s+sei|dove\s+vivi|in\s+quale\s+paese\s+vivi)\b/i,
      /\b(aus\s+welchem\s+land|aus\s+welcher\s+stadt|woher\s+kommst\s+du|wo\s+wohnst\s+du)\b/i,
      /\b(из\s+какой\s+ты\s+страны|в\s+какой\s+стране|откуда\s+ты|где\s+ты\s+живешь)\b/i
    ];

    for (const pat of countryQuestionPatterns) {
      if (pat.test(normalized) || pat.test(rawLower)) {
        const matchStr = normalized.match(pat)?.[0] || rawLower.match(pat)?.[0] || 'Pregunta de País';
        return {
          type: 'COUNTRY_QUESTION_PROHIBITED',
          title: '✈️ Pregunta de País / Ubicación no Permitida',
          sample: matchStr,
          reason: 'Está prohibido preguntar al usuario de qué país o ciudad es. Las preguntas sobre ubicación son consideradas inducción a Travel Misleading por la plataforma.',
          solution: 'Pregúntale sobre sus gustos, pasatiempos, trabajo o comida favorita sin mencionar países ni ubicaciones geográficas.',
          safeHooks: [
            'Cuéntame, ¿qué es lo que más te apasiona hacer en tus tiempos libres?',
            '¿Cómo ha estado tu día hoy? ¿Hiciste algo divertido o relajante?',
            'Tengo curiosidad por saber, ¿cuál es tu comida favorita de todos los tiempos?'
          ]
        };
      }
    }

    // 2. PROHIBICIÓN ESTRICTA: DECIR QUE HIJOS O FAMILIARES VIVEN EN OTROS PAÍSES O CIUDADES
    const familyAbroadPatterns = [
      /\b(mis\s+hijos?\s+(viven|estan|residen|se\s+fueron)|mi\s+hijo\s+(vive|esta|reside)|mi\s+hija\s+(vive|esta|reside)|mis\s+padres\s+(viven|estan)|mi\s+familia\s+(vive|esta)|tengo\s+familia\s+en|tengo\s+hijos\s+en|mis\s+hijos\s+en\s+otro\s+pais)\b/i,
      /\b(my\s+kids?\s+(live|are|stay)|my\s+children\s+(live|are)|my\s+son\s+(lives|is)|my\s+daughter\s+(lives|is)|my\s+parents\s+live|my\s+family\s+lives|kids\s+in\s+another\s+country)\b/i,
      /\b(meus\s+filhos?\s+(moram|vivem|estao)|minha\s+filha\s+(mora|vive|esta)|meu\s+filho\s+(mora|vive|esta)|minha\s+familia\s+mora)\b/i,
      /\b(mes\s+enfants\s+(vivent|habitent)|mon\s+fils\s+vit|ma\s+fille\s+vit|i\s+miei\s+figli\s+vivono|meine\s+kinder\s+leben)\b/i
    ];

    for (const pat of familyAbroadPatterns) {
      if (pat.test(normalized) || pat.test(rawLower)) {
        const matchStr = normalized.match(pat)?.[0] || rawLower.match(pat)?.[0] || 'Familia en otro país';
        return {
          type: 'FAMILY_ABROAD_PROHIBITED',
          title: '👨‍👩‍👧 Prohibido Mencionar Familia/Hijos en Otros Países',
          sample: matchStr,
          reason: 'No se permite mencionar que tus hijos o familiares viven en otros países. Talkytimes sanciona estos relatos como manipulación de contexto geográfico.',
          solution: 'Comparte momentos agradables en casa (cocinar, escuchar música, pasear mascotas) sin nombrar países ni distancias geográficas.',
          safeHooks: [
            'Hoy estuve cocinando algo delicioso en casa. ¿A ti te gusta cocinar o prefieres salir?',
            'Me encanta pasar tiempo relajándome con buena música. ¿Qué tipo de música te gusta escuchar?'
          ]
        };
      }
    }

    // 3. MENCIÓN DE PAÍSES O REVELAR ORIGEN ESPONTÁNEAMENTE (SÓLO SE PERMITE SI EL CLIENTE LO PREGUNTÓ)
    const clientAskedCountryOrContext = didClientExplicitlyAskCountryOrContext();
    if (!clientAskedCountryOrContext) {
      const countryListPatterns = [
        /\b(colombia|venezuela|mexico|estados\s+unidos|ee\.?\s*uu|usa|spain|espana|argentina|chile|peru|ecuador|brasil|brazil|canada|alemania|germany|francia|france|italia|italy|reino\s+unido|uk|inglaterra|england|portugal|rusia|russia|ucrania|ukraine|cuba|republica\s+dominicana|panama|costa\s+rica|guatemala|honduras|bolivia|uruguay|paraguay)\b/i,
        /\b(soy\s+de|vivo\s+en|radico\s+en|vengo\s+de|naci\s+en|mi\s+pais\s+es|mi\s+ciudad\s+es)\b/i,
        /\b(i\s+am\s+from|i\s+live\s+in|i\s+come\s+from|born\s+in|my\s+country\s+is|my\s+city\s+is)\b/i,
        /\b(sou\s+de|moro\s+em|vivo\s+em|nasci\s+em|meu\s+pais\s+e|minha\s+cidade\s+e)\b/i,
        /\b(je\s+suis\s+de|je\s+vis\s+a|sono\s+di|ich\s+komme\s+aus|ich\s+lebe\s+in)\b/i
      ];

      for (const pat of countryListPatterns) {
        if (pat.test(normalized) || pat.test(rawLower)) {
          const matchStr = normalized.match(pat)?.[0] || rawLower.match(pat)?.[0] || 'Mención de país';
          return {
            type: 'UNSOLICITED_ORIGIN_MENTION',
            title: '🗺️ Mención de País no Solicitada',
            sample: matchStr,
            reason: 'El usuario NO ha preguntado por países, partidos ni origen. Solo se pueden nombrar países si el usuario lo pide expresamente (por ejemplo si pregunta "¿quién juega?" o "¿de dónde eres?").',
            solution: 'Háblale del evento o partido en general sin nombrar países (ej: "Hoy hay un gran juego de la copa"). Si él pregunta "¿quién juega?", en ese momento sí podrás nombrarlos.',
            safeHooks: [
              'Hoy hay un partidazo increíble en la copa deportiva. ¿A ti te gusta el fútbol o prefieres otros deportes?',
              'Hoy tuve un día súper activo y me encanta desconectarme charlando contigo. ¿Cómo va tu día?'
            ]
          };
        }
      }
    }

    // 4. PROMESAS DE MATRIMONIO Y COMPROMISOS CONYUGALES (SIEMPRE BLOQUEADO)
    const marriagePatterns = [
      /\b(casar(se|nos|me|te)?|casemonos|matrimonio|boda|bodas|compromet(erse|ernos|idos?|erme)|prometid[oa]|espos[oa]s?|marido|marido\s+y\s+mujer|esposo\s+y\s+esposa|pedir\s+(tu|la)\s+mano|anillo\s+de\s+compromiso)\b/i,
      /\b(marry|marry\s*me|getting\s*married|get\s*married|marriage|wedding|fiancee?|engagement|husband|wife|be\s*my\s*(husband|wife)|propose\s*to\s*me|marry\s*you)\b/i,
      /\b(casar\s+comigo|quando\s+a\s+gente\s+casar|casamento|noivado|noiv[oa]|meu\s+marido|minha\s+esposa)\b/i,
      /\b(se\s+marier|mariage|fiancailles|mon\s+mari|ma\s+femme)\b/i,
      /\b(sposar(si|ci)?|matrimonio|fidanzamento|mio\s+marito|mia\s+moglie)\b/i,
      /\b(heiraten|ehe|verlobung|mein\s+ehemann|meine\s+ehefrau)\b/i,
      /\b(жениться|выйти\s+замуж|свадьба|помолвка|муж|жена)\b/i
    ];

    for (const pat of marriagePatterns) {
      if (pat.test(normalized) || pat.test(rawLower)) {
        const matchStr = normalized.match(pat)?.[0] || rawLower.match(pat)?.[0] || 'Matrimonio';
        return {
          type: 'MARRIAGE_PROMISE',
          title: '💍 Promesa de Matrimonio Prohibida',
          sample: matchStr,
          reason: 'Está prohibido hablar de matrimonio, bodas o referirse al usuario como esposo/marido. Genera expectativas sancionables por la plataforma.',
          solution: 'Enfócate en construir química sincera y una amistad bonita sin promesas de compromiso conyugal ni bodas.',
          safeHooks: [
            'Me encanta lo bien que nos entendemos charlando. ¿Qué es lo que más valoras en una bonita amistad?',
            'Cada charla contigo es muy especial. Cuéntame algo que te haya hecho sonreír hoy.'
          ]
        };
      }
    }

    // 5. ENCUENTROS EN PERSONA, VUELOS, HOTELES, AEROPUERTOS Y VIAJES (TRAVEL MISLEADING - SIEMPRE BLOQUEADO)
    const tmMeetingPatterns = [
      /\b(vernos\s+en\s+persona|conocernos\s+en\s+persona|estar\s+en\s+persona|cuando\s+nos\s+vemos|cuando\s+vienes|ir\s+a\s+verte|venir\s+a\s+verme|visitarte|visitarme|puedes\s+venir)\b/i,
      /\b(comprar\s+(el\s+)?vuelo|comprar\s+boletos?|comprar\s+pasajes?|boletos?\s+(de\s+)?avion|pasajes?\s+aereos?|mi\s+vuelo|tu\s+vuelo)\b/i,
      /\b(aeropuerto|hotel|airbnb|motel|resort|viajar\s+juntos|hacer\s+un\s+viaje|nuestro\s+viaje|viajar\s+a\s+verte)\b/i,
      /\b(meet\s*up|in\s*person|come\s*see\s*(me|you)|come\s*visit\s*(me|you)|when\s*(will|can)\s*you\s*visit|book\s*(a\s*)?flight|flight\s*ticket|airport|hotel|vacation\s*together|travel\s*together)\b/i,
      /\b(conhecer\s+pessoalmente|se\s+ver\s+pessoalmente|quando\s+voce\s+vem|comprar\s+passagem|passagem\s+aerea|aeroporto|hotel|viajar\s+juntos)\b/i,
      /\b(se\s+voir\s+en\s+vrai|rencontrer\s+en\s+personne|billet\s+d\s*avion|vol\s+pour|aeroport|hotel)\b/i,
      /\b(incontrarci\s+di\s+persona|vederci\s+di\s+persona|biglietto\s+aereo|volo\s+per|aeroporto|hotel)\b/i,
      /\b(personlich\s+treffen|in\s+person\s+treffen|flugticket|flug\s+nach|flughafen|hotel)\b/i,
      /\b(когда\s+увидимся|когда\s+встретимся|приедешь\s+ко\s+мне|прилетишь\s+ко\s+мне|встретиться\s+вживую|увидеться\s+вживую|билет\s+на\s+самолет|самолет|аэропорт|отель)\b/i
    ];

    for (const pat of tmMeetingPatterns) {
      if (pat.test(normalized) || pat.test(rawLower)) {
        const matchStr = normalized.match(pat)?.[0] || rawLower.match(pat)?.[0] || 'Encuentro / Vuelo';
        return {
          type: 'TRAVEL_MISLEADING_MEETING',
          title: '✈️ Encuentro / Vuelos en Persona (Travel Misleading)',
          sample: matchStr,
          reason: 'Prohibido proponer encuentros físicos, visitas, compra de vuelos o estadías en hoteles. Infracción grave de Travel Misleading ($10.000 COP de multa y riesgo de baneo).',
          solution: 'Mantén el vínculo enfocado en el presente virtual. Comparte anécdotas, fotos y pregúntale por sus momentos favoritos del día.',
          safeHooks: [
            'Me fascina pasar este rato contigo compartiendo nuestras historias. ¿Qué planes tienes para esta noche?',
            'Siempre me alegras el día con tus mensajes. ¿Qué tal estuvo tu jornada hoy?'
          ]
        };
      }
    }

    // 6. FUGA DE CONTACTO / DATOS PRIVADOS MULTILINGÜE
    const contactPatterns = [
      /\bwhatsapp\b/i, /\btelegram\b/i, /\binstagram\b/i, /\bskype\b/i, /\bfacebook\b/i, /\btiktok\b/i,
      /\bemail\b/i, /\bcorreo\b/i, /\bgmail\b/i, /\bhotmail\b/i, /\byahoo\b/i, /\boutlook\b/i,
      /\b(phone\s*number|numero\s*de\s*telefono|numero\s*de\s*celular|meu\s*numero|mi\s*numero|my\s*number|mon\s*numero|meu\s*zap|meu\s*whats)\b/i,
      /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/,
      /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/
    ];

    for (const pat of contactPatterns) {
      if (pat.test(normalized) || pat.test(rawLower)) {
        const matchStr = normalized.match(pat)?.[0] || rawLower.match(pat)?.[0] || 'Contacto externo';
        return {
          type: 'CONTACT_LEAK',
          title: '📱 Fuga de Contacto Externo',
          sample: matchStr,
          reason: 'Está prohibido compartir números telefónicos, redes sociales o correos electrónicos fuera de la plataforma.',
          solution: 'Invítalo a seguir disfrutando y compartiendo anécdotas exclusivas de forma segura dentro de este chat.',
          safeHooks: [
            'Me encanta charlar contigo por aquí de forma segura. Cuéntame más sobre lo que hiciste hoy.'
          ]
        };
      }
    }

    // 7. MANIPULACIÓN DE REGALOS / TOKENS / DINERO MULTILINGÜE
    const giftPatterns = [
      /\b(send|buy)\s*me\s*(a\s*)?(gift|present|token|money|credit)\b/i,
      /\bgift\s*me\b/i,
      /\b(regalame|comprame|mandame)\s*(un\s*)?(regalo|detalle|token|moneda|dinero)\b/i,
      /\b(me\s+da\s+um\s+presente|me\s+manda\s+um\s+presente|compra\s+um\s+presente|me\s+manda\s+dinheiro|me\s+manda\s+tokens)\b/i,
      /\bpaypal\b/i, /\bcash\s*app\b/i, /\bwestern\s*union\b/i, /\btransferenc\b/i, /\bcrypto\b/i, /\bpix\b/i
    ];

    for (const pat of giftPatterns) {
      if (pat.test(normalized) || pat.test(rawLower)) {
        const matchStr = normalized.match(pat)?.[0] || rawLower.match(pat)?.[0] || 'Solicitud de regalo';
        return {
          type: 'GIFT_MANIPULATION',
          title: '🎁 Manipulación de Regalos / Tokens Prohibida',
          sample: matchStr,
          reason: 'Está prohibido pedir o manipular al usuario para que envíe regalos, tokens o dinero.',
          solution: 'Construye valor con fotos y cartas emotivas para que el usuario gaste tokens de forma voluntaria.',
          safeHooks: [
            'Me encanta compartir momentos contigo. Cuéntame, ¿qué es lo que más te gusta de nuestras charlas?'
          ]
        };
      }
    }

    // 8. Raíces dinámicas adicionales desde backend
    for (const root of bannedRoots) {
      if (root && root.length > 2 && (normalized.includes(root.toLowerCase()) || rawLower.includes(root.toLowerCase()))) {
        return {
          type: 'CUSTOM_BANNED_ROOT',
          title: `🛡️ Término Restringido ("${root}")`,
          sample: root,
          reason: `El término "${root}" está restringido por la administración de la agencia.`,
          solution: 'Reemplaza la frase por una pregunta sobre intereses generales o experiencias cotidianas.',
          safeHooks: [
            'Cuéntame algo curioso o divertido que te haya pasado esta semana.'
          ]
        };
      }
    }

    return null;
  }

  // RENDERIZADOR DE LA NUBE DE INFORMACIÓN FLOTANTE (NO INVASIVA / TIPO CLOUD POPOVER)
  function renderFirewallSolutionCard(violation, targetInput) {
    let cloud = document.getElementById('ryr-firewall-cloud-popover');
    
    if (!violation) {
      if (cloud) cloud.remove();
      return;
    }

    if (!cloud) {
      cloud = document.createElement('div');
      cloud.id = 'ryr-firewall-cloud-popover';
      cloud.style.cssText = `
        position: fixed;
        bottom: 85px;
        right: 24px;
        width: 390px;
        max-width: 90vw;
        background: linear-gradient(135deg, rgba(8, 12, 26, 0.98), rgba(24, 7, 24, 0.98));
        border: 2px solid #ef4444;
        border-radius: 14px;
        box-shadow: 0 15px 50px rgba(0, 0, 0, 0.95), 0 0 30px rgba(239, 68, 68, 0.4);
        backdrop-filter: blur(25px);
        color: #fff;
        font-family: 'Space Grotesk', system-ui, sans-serif;
        font-size: 12px;
        z-index: 2147483640;
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 14px 16px;
        animation: ryrCloudPop 0.25s cubic-bezier(0.16, 1, 0.3, 1);
      `;
      document.body.appendChild(cloud);
    }

    const safeHooks = Array.isArray(violation.safeHooks) ? violation.safeHooks : [];

    cloud.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(239,68,68,0.3); padding-bottom:8px;">
        <div style="display:flex; align-items:center; gap:8px;">
          <span style="font-size:1.3rem;">☁️</span>
          <div>
            <div style="font-weight:900; color:#fca5a5; font-size:12px; letter-spacing:0.5px;">
              ${violation.title}
            </div>
            <div style="font-size:10px; color:#94a3b8;">Nube de Consejo Táctico Anti-TM</div>
          </div>
        </div>
        <div style="display:flex; align-items:center; gap:6px;">
          <span style="background:#ef4444; color:#fff; font-size:9.5px; font-weight:bold; padding:2px 7px; border-radius:4px;">
            🚫 ENVÍO BLOQUEADO
          </span>
          <button type="button" id="ryr-cloud-close-btn" style="background:transparent; border:none; color:#94a3b8; font-size:16px; cursor:pointer; font-weight:bold; padding:0 4px;" title="Cerrar nube">✕</button>
        </div>
      </div>

      <div style="background:rgba(0,0,0,0.55); border-left:3px solid #ef4444; padding:6px 10px; border-radius:4px; font-size:11.5px; color:#fecaca;">
        <b>Texto detectado:</b> <code style="background:rgba(239,68,68,0.25); color:#fff; padding:2px 6px; border-radius:3px; font-weight:bold;">"${violation.sample}"</code>
      </div>

      <div style="font-size:11px; color:#cbd5e1; line-height:1.4;">
        ⚠️ <b>¿Por qué no se puede enviar?:</b> ${violation.reason}
      </div>

      <div style="background:rgba(16,185,129,0.15); border:1px dashed #10b981; padding:8px 12px; border-radius:6px; font-size:11.5px; color:#6ee7b7; line-height:1.4;">
        💡 <b>Cómo cambiar la conversación:</b> ${violation.solution}
      </div>

      <!-- BOTONES DE GANCHOS SEGUROS PARA INSERTAR EN 1 CLIC -->
      <div style="display:flex; flex-direction:column; gap:5px; margin-top:2px;">
        <span style="font-size:10px; color:#94a3b8; font-weight:bold;">⚡ Sugerencias seguras (Clic para insertar y desbloquear):</span>
        <div style="display:flex; flex-direction:column; gap:4px;">
          ${safeHooks.map(hook => `
            <button type="button" class="ryr-firewall-safe-hook-btn" data-hook="${encodeURIComponent(hook)}" style="background:#090d1f; color:#38bdf8; border:1px solid #0284c7; padding:6px 10px; border-radius:6px; font-size:11px; cursor:pointer; font-weight:bold; transition:all 0.2s; text-align:left; line-height:1.3;">
              💬 "${hook}"
            </button>
          `).join('')}
        </div>
        <button type="button" id="ryr-firewall-clear-btn" style="background:rgba(239,68,68,0.2); color:#fca5a5; border:1px solid #ef4444; padding:5px 10px; border-radius:6px; font-size:11px; cursor:pointer; font-weight:bold; margin-top:3px;">
          🧹 Borrar texto y desbloquear
        </button>
      </div>
    `;

    // Botón cerrar nube
    const closeBtn = cloud.querySelector('#ryr-cloud-close-btn');
    if (closeBtn) {
      closeBtn.onclick = () => {
        cloud.remove();
      };
    }

    // Vincular clics de ganchos seguros
    cloud.querySelectorAll('.ryr-firewall-safe-hook-btn').forEach(b => {
      b.onclick = (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        const hookText = decodeURIComponent(b.getAttribute('data-hook') || '');
        if (targetInput && hookText) {
          setInputValueSafely(targetInput, hookText);
          cloud.remove();
          showFirewallToast('✨ Sugerencia segura aplicada. ¡Botón de envío desbloqueado!', 'success');
        }
      };
    });

    const clearBtn = cloud.querySelector('#ryr-firewall-clear-btn');
    if (clearBtn) {
      clearBtn.onclick = (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        if (targetInput) {
          setInputValueSafely(targetInput, '');
          cloud.remove();
          showFirewallToast('🧹 Texto borrado. Bloqueo levantado.', 'success');
        }
      };
    }
  }

  let lastReportedInfractionText = '';
  let lastReportedInfractionTime = 0;

  function enforceFirewall(e) {
    const inputs = document.querySelectorAll('textarea, input[type="text"], [contenteditable="true"]');
    let anyViolation = false;
    let currentViolationInfo = null;
    let activeViolatingInput = null;

    inputs.forEach(input => {
      if (input.id?.includes('intel') || input.id?.includes('search') || input.id?.includes('reply') || input.id?.includes('sup')) return;
      
      const text = (input.value || input.innerText || '').trim();
      const violation = checkViolationInText(text);

      if (violation) {
        anyViolation = true;
        currentViolationInfo = violation;
        activeViolatingInput = input;
        input.style.setProperty('border', '2px solid #ef4444', 'important');
        input.style.setProperty('box-shadow', '0 0 12px rgba(239, 68, 68, 0.6)', 'important');

        // Registrar infracción en memoria y backend de inmediato (con debounce inteligente)
        const now = Date.now();
        if (text !== lastReportedInfractionText || (now - lastReportedInfractionTime > 4000)) {
          lastReportedInfractionText = text;
          lastReportedInfractionTime = now;

          const { clientName } = getExactClientProfileData();
          const infractionRecord = {
            id: `inf_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            timestamp: Date.now(),
            timeFormatted: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            rule: violation.type,
            ruleTitle: violation.title,
            snippet: text.length > 160 ? text.substring(0, 160) + '...' : text,
            blockedPhrase: violation.sample,
            reason: violation.reason,
            solution: violation.solution,
            clientName: clientName || 'Chat en Vivo',
            operator: sessionData.operator || 'walther',
            profile: sessionData.profileName || 'HORACIO'
          };
          liveInfractionsLog.unshift(infractionRecord);
          if (liveInfractionsLog.length > 50) liveInfractionsLog.pop();

          firewallInfractionsCount++;
          persistFirewallInfractions();
          sendTelemetry(true);

          // Enviar inmediatamente a endpoint backend
          try {
            fetch(`${API_URL}/api/fines/report-infraction`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ infraction: infractionRecord, profile: sessionData.profileName, operator: sessionData.operator })
            }).catch(() => {});
          } catch (ePost) {}
        }

        if (e && e.type === 'keydown' && e.key === 'Enter' && e.target === input) {
          e.preventDefault();
          e.stopPropagation();
          showFirewallToast(`🚨 Infracción Bloqueada: ${violation.title}.`);
          playAlertChime();
        }
      } else {
        if (input.style.borderColor === 'rgb(239, 68, 68)' || input.style.border.includes('239, 68, 68')) {
          input.style.removeProperty('border');
          input.style.removeProperty('box-shadow');
        }
      }
    });

    // Renderizar o remover el banner de solución interactiva
    renderFirewallSolutionCard(currentViolationInfo, activeViolatingInput);

    // Localizar y bloquear TODOS los botones de envío en el chat y cartas
    const sendButtons = document.querySelectorAll('button, [role="button"], div[class*="send" i], a[class*="send" i]');
    sendButtons.forEach(btn => {
      const btnText = (btn.innerText || btn.textContent || '').toLowerCase().trim();
      const isSendBtn = (btnText === 'send' || btnText.startsWith('send') || btnText === 'enviar' || btn.querySelector('svg') || (btn.className && btn.className.toLowerCase().includes('send'))) &&
                        !btn.classList.contains('ryr-row-extract-btn') && 
                        !btn.classList.contains('ryr-btn-logout') &&
                        !btn.classList.contains('ryr-btn-intel') &&
                        !btn.classList.contains('ryr-btn-handover') &&
                        !btn.classList.contains('ryr-chat-hooks-btn') &&
                        !btn.classList.contains('ryr-letter-drafter-btn') &&
                        !btn.classList.contains('ryr-firewall-safe-hook-btn') &&
                        !btn.classList.contains('ryr-btn-sup-chat');

      if (isSendBtn) {
        if (anyViolation) {
          btn.classList.add('ryr-btn-blocked-force');
          btn.disabled = true;
          btn.style.setProperty('pointer-events', 'none', 'important');
          btn.style.setProperty('filter', 'grayscale(90%)', 'important');
          btn.style.setProperty('opacity', '0.35', 'important');
          btn.style.setProperty('background', '#ef4444', 'important');
          btn.style.setProperty('cursor', 'not-allowed', 'important');
          btn.setAttribute('title', `🚨 ENVÍO BLOQUEADO: ${currentViolationInfo?.title || 'Travel Misleading detectado'}`);
        } else {
          btn.classList.remove('ryr-btn-blocked-force');
          btn.disabled = false;
          btn.style.removeProperty('pointer-events');
          btn.style.removeProperty('filter');
          btn.style.removeProperty('opacity');
          btn.style.removeProperty('background');
          btn.style.removeProperty('cursor');
          btn.removeAttribute('title');
        }
      }
    });
  }

  let ryrSharedAudioCtx = null;
  function initRyrAudioGesture() {
    try {
      if (!ryrSharedAudioCtx) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (AudioContextClass) {
          ryrSharedAudioCtx = new AudioContextClass();
        }
      }
      if (ryrSharedAudioCtx && ryrSharedAudioCtx.state === 'suspended') {
        ryrSharedAudioCtx.resume().catch(() => {});
      }
    } catch (e) {}
  }
  window.addEventListener('pointerdown', initRyrAudioGesture, { capture: true, passive: true });
  window.addEventListener('keydown', initRyrAudioGesture, { capture: true, passive: true });
  window.addEventListener('click', initRyrAudioGesture, { capture: true, passive: true });

  function playAlertChime() {
    try {
      if (!ryrSharedAudioCtx) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (AudioContextClass) {
          ryrSharedAudioCtx = new AudioContextClass();
        }
      }
      if (!ryrSharedAudioCtx) return;
      if (ryrSharedAudioCtx.state === 'suspended') {
        ryrSharedAudioCtx.resume().then(() => {
          _soundOscillator(ryrSharedAudioCtx);
        }).catch(() => {});
        return;
      }
      if (ryrSharedAudioCtx.state === 'running') {
        _soundOscillator(ryrSharedAudioCtx);
      }
    } catch (e) {}
  }

  function _soundOscillator(ctx) {
    try {
      if (!ctx || ctx.state !== 'running') return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.2); // A5
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
    } catch (e) {}
  }

  function showFirewallToast(msg, type = 'danger') {
    const toastId = 'ryr-firewall-toast';
    const old = document.getElementById(toastId);
    if (old) old.remove();

    const isRecharge = type === 'recharge' || msg.includes('RECARGA') || msg.includes('FIDELIZADO');
    const isSuccess = type === 'success' || msg.includes('✅') || msg.includes('✨');

    let bg = 'rgba(69, 10, 10, 0.95)';
    let border = '2px solid #ef4444';
    let color = '#fca5a5';
    let shadow = '0 8px 30px rgba(239, 68, 68, 0.6)';

    if (isRecharge) {
      bg = 'linear-gradient(135deg, rgba(6, 78, 59, 0.98) 0%, rgba(15, 23, 42, 0.98) 100%)';
      border = '2px solid #10b981';
      color = '#6ee7b7';
      shadow = '0 8px 30px rgba(16, 185, 129, 0.8), 0 0 15px rgba(52, 211, 153, 0.5)';
      playAlertChime();
    } else if (isSuccess) {
      bg = 'rgba(15, 23, 42, 0.95)';
      border = '1px solid #38bdf8';
      color = '#bae6fd';
      shadow = '0 8px 25px rgba(6, 182, 212, 0.4)';
    }

    const toast = document.createElement('div');
    toast.id = toastId;
    toast.style.cssText = `
      position: fixed;
      bottom: 24px;
      left: 24px;
      background: ${bg};
      border: ${border};
      color: ${color};
      padding: 12px 18px;
      border-radius: 8px;
      font-family: system-ui, sans-serif;
      font-size: 12.5px;
      font-weight: 800;
      z-index: 2147483647;
      box-shadow: ${shadow};
      animation: ryrToastSlide 0.2s ease-out;
      display: flex;
      align-items: center;
      gap: 8px;
    `;
    toast.innerText = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 4500);
  }

  ['input', 'keyup', 'keydown', 'paste', 'change'].forEach(evtType => {
    document.addEventListener(evtType, enforceFirewall, true);
  });

  // 10. EXTRACTOR QUIRÚRGICO DE DATOS DE CLIENTE & INYECCIÓN DE AGENCIA
  function sanitizeClientName(raw) {
    if (!raw) return 'Cliente';
    const firstLine = raw.split('\n')[0].trim();
    let clean = firstLine
      .replace(/(\d+\s*(minute|hour|day|week|month)s?\s*ago|\ban hour ago\b|\d+\s*[✉💬]|\bonline\b|\btyping\b|\bSearch\b|\bMessages\b)/gi, '')
      .replace(/\s+/g, ' ')
      .replace(/^,\s*/, '')
      .trim();

    // Descartar si es timestamp, fecha o etiqueta de previsualización
    if (/^\d{1,2}:\d{2}\s*(?:am|pm|a\.?\s*m\.?|p\.?\s*m\.?)?$/i.test(clean) ||
        /^(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s*\d{0,2}$/i.test(clean) ||
        /^(?:today|yesterday|hoy|ayer)$/i.test(clean) ||
        /^(?:you:|tú:|tu:|você:|photo|sticker|audio|video|gift|seen|media|unread|sent)$/i.test(clean)) {
      return 'Cliente';
    }

    const noisyWords = ['yes', 'no', 'open', 'search', 'messages', 'mail', 'gifts', 'account', 'titan apex', 'mute', 'listened', 'public photos', 'my content'];
    if (noisyWords.includes(clean.toLowerCase()) || clean.length < 2) {
      return 'Cliente';
    }
    return clean;
  }

  function getExactClientProfileData() {
    let clientName = '';
    const chatTitleContainer = document.querySelector('div[data-test-id="dialog-header-title"], div[class*="dialog-header"], div[class*="chat-header"]');
    if (chatTitleContainer) {
      const candidates = chatTitleContainer.querySelectorAll('h1, h2, h3, span, div');
      for (let c of candidates) {
        const txt = c.innerText.trim();
        const cleaned = sanitizeClientName(txt);
        if (cleaned !== 'Cliente' && txt.length > 1 && !txt.includes('ago') && !txt.includes('Online')) {
          clientName = cleaned;
          break;
        }
      }
    }

    if (!clientName) {
      const activeTabItem = document.querySelector('div[class*="dialog-item"][class*="active"], div[class*="item-wrap"][class*="active"], div[data-selected="true"]');
      if (activeTabItem) {
        const firstLine = activeTabItem.innerText.split('\n')[0].trim();
        const cleaned = sanitizeClientName(firstLine);
        if (cleaned !== 'Cliente') clientName = cleaned;
      }
    }

    if (!clientName || clientName === 'Cliente') {
      const mailSendTo = (document.body?.innerText || '').match(/Send your letter to\s+([A-Za-z0-9_ -]+)/i) ||
                         (document.body?.innerText || '').match(/Enviar carta a\s+([A-Za-z0-9_ -]+)/i);
      if (mailSendTo && mailSendTo[1]) {
        const parsed = sanitizeClientName(mailSendTo[1].trim());
        if (parsed && parsed !== 'Cliente') clientName = parsed;
      }
    }

    let country = '';
    let birthDate = '';
    let maritalStatus = '';

    const allPills = document.querySelectorAll('span, div, button, p');
    allPills.forEach(el => {
      if (el.children.length > 1) return;
      const t = el.innerText.trim();

      if (!country && /^(Canada|United States|Brazil|Australia|Poland|Hong Kong|Colombia|Mexico|Spain|Argentina|United Kingdom|Germany|Uruguay|Italy|Albania)/i.test(t)) {
        country = t;
      }
      if (!birthDate && /([A-Za-z]{3,9}\s+\d{1,2},\s+\d{4})/i.test(t)) {
        const m = t.match(/([A-Za-z]{3,9}\s+\d{1,2},\s+\d{4})/i);
        if (m) birthDate = m[1];
      }
      if (!maritalStatus && /^(Widowed|Divorced|Single|Not Married|Married|Viudo|Viuda|Divorciado|Soltero|Soltera)$/i.test(t)) {
        maritalStatus = t;
      }
    });

    let ageText = '';
    if (birthDate) {
      const yearMatch = birthDate.match(/\d{4}/);
      if (yearMatch) {
        const age = new Date().getFullYear() - parseInt(yearMatch[0], 10);
        ageText = `${age} años`;
      }
    }

    return {
      clientName: clientName || 'Cliente',
      bioData: {
        country: country || 'United States',
        birthDate: birthDate ? `${birthDate} (${ageText || '53 años'})` : 'En perfil',
        maritalStatus: maritalStatus || 'Not married / Soltera'
      }
    };
  }

  function getExactNumericClientId(targetUrl = window.location.href) {
    const chatMatch = targetUrl.match(/chat\/\d+_(\d+)/);
    if (chatMatch) return String(chatMatch[1]).trim();
    const mailMatch = targetUrl.match(/mails\/(?:view|thread)\/\d+_(\d+)/);
    if (mailMatch) return String(mailMatch[1]).trim();
    const userMatch = targetUrl.match(/user\/(\d+)/);
    if (userMatch) return String(userMatch[1]).trim();
    return '119678157';
  }

  // 10.1 MOTOR DE DETECCIÓN DE IDIOMA Y TRADUCCIÓN INSTANTÁNEA MULTI-LENGUAJE
  function detectLanguage(text) {
    if (!text || typeof text !== 'string') return { code: 'en', name: 'English 🇺🇸', flag: '🇺🇸' };
    const t = ` ${text.toLowerCase().replace(/[^a-zñáéíóúàâçèêëîïôûùäöüß]/g, ' ')} `;

    // Ruso (Cirílico)
    if (/[\u0400-\u04FF]/.test(text)) {
      return { code: 'ru', name: 'Ruso 🇷🇺', flag: '🇷🇺' };
    }

    // Inglés (Palabras clave exclusivas de alto peso)
    const enWords = [' the ', ' and ', ' you ', ' are ', ' for ', ' with ', ' about ', ' sleep ', ' have ', ' having ', ' headache ', ' bus ', ' feel ', ' hold ', ' tight ', ' home ', ' please ', ' pls ', ' love ', ' good ', ' what ', ' this ', ' from ', ' your ', ' will ', ' that ', ' took ', ' soaked ', ' waiting ', ' leaving ', ' morning ', ' afternoon ', ' night ', ' coffee ', ' smiling ', ' doing '];
    let enScore = enWords.reduce((acc, w) => acc + (t.includes(w) ? 1.5 : 0), 0);

    // Español
    const esWords = [' que ', ' para ', ' con ', ' hola ', ' como ', ' bien ', ' amor ', ' gracias ', ' cielo ', ' quiero ', ' tengo ', ' cuando ', ' donde ', ' mensaje ', ' carta ', ' fotos ', ' beso ', ' besos ', ' pero ', ' estoy ', ' tarde '];
    let esScore = esWords.reduce((acc, w) => acc + (t.includes(w) ? 1 : 0), 0);
    if (/[áéíóúñ¿¡]/.test(text)) esScore += 3;

    // Francés
    const frWords = [' bonjour ', ' salut ', ' merci ', ' avec ', ' pour ', ' vous ', ' dans ', ' cette ', ' suis ', ' très ', ' chéri ', ' bisous ', ' lettre ', ' comment ', ' oui '];
    let frScore = frWords.reduce((acc, w) => acc + (t.includes(w) ? 1 : 0), 0);
    if (/[àâçèêëîïôûù]/.test(text)) frScore += 2;

    // Portugués
    const ptWords = [' olá ', ' obrigado ', ' obrigada ', ' você ', ' voce ', ' muito ', ' lindo ', ' linda ', ' beijo ', ' beijos ', ' tudo ', ' bem ', ' não ', ' nao '];
    let ptScore = ptWords.reduce((acc, w) => acc + (t.includes(w) ? 1 : 0), 0);
    if (/[ãõ]/.test(text)) ptScore += 2;

    if (enScore > 0 && enScore >= esScore && enScore >= frScore && enScore >= ptScore && !/[áéíóúñ¿¡]/.test(text)) {
      return { code: 'en', name: 'English 🇺🇸', flag: '🇺🇸' };
    }
    if (esScore >= 2 && esScore >= frScore && esScore >= ptScore) {
      return { code: 'es', name: 'Español 🇪🇸', flag: '🇪🇸' };
    }
    if (frScore >= 2) {
      return { code: 'fr', name: 'Français 🇫🇷', flag: '🇫🇷' };
    }
    if (ptScore >= 2) {
      return { code: 'pt', name: 'Português 🇧🇷', flag: '🇧🇷' };
    }

    // Por defecto Inglés
    return { code: 'en', name: 'English 🇺🇸', flag: '🇺🇸' };
  }

  async function translateText(text, targetLang = 'en') {
    if (!text || text.trim().length === 0) return '';
    try {
      const googleUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${encodeURIComponent(targetLang)}&dt=t&q=${encodeURIComponent(text)}`;
      const res = await fetch(googleUrl);
      const data = await res.json();
      if (Array.isArray(data) && Array.isArray(data[0])) {
        return data[0].map(item => item[0]).join('');
      }
    } catch (e) {
      try {
        const res = await fetch(`${API_URL}/api/translate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, targetLang })
        });
        const data = await res.json();
        if (data && data.translatedText) return data.translatedText;
      } catch (err) {}
    }
    return text;
  }

  function setInputValueSafely(element, value) {
    if (!element) return;
    if (element.tagName === 'TEXTAREA' || element.tagName === 'INPUT') {
      const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set ||
                           Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
      if (nativeSetter) nativeSetter.call(element, value);
      else element.value = value;
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
    } else {
      element.innerText = value;
      element.dispatchEvent(new Event('input', { bubbles: true }));
    }
    element.focus();
    enforceFirewall(null);
  }

  let fidelizedClientsMap = new Map();

  function findChatInput() {
    return document.querySelector('textarea[placeholder*="message" i], textarea[class*="compose" i], textarea[class*="chat" i], div[contenteditable="true"], textarea');
  }

  function findChatSendButton() {
    const chatInput = findChatInput();
    const allButtons = Array.from(document.querySelectorAll('button, div[role="button"]'));
    
    let inputRect = null;
    if (chatInput) {
      inputRect = chatInput.getBoundingClientRect();
    }

    const candidates = allButtons.filter(b => {
      if (b.closest('#ryr-titan-bar') || 
          b.closest('#ryr-intel-panel') || 
          b.closest('.ryr-chat-tools-wrapper') || 
          b.closest('#ryr-letter-drafter-box') || 
          b.closest('#ryr-supervisor-chat-modal') ||
          b.closest('header') ||
          b.closest('div[data-test-id*="dialog-item"]') ||
          b.closest('div[class*="dialog-item"]') ||
          b.closest('div[class*="item-wrap"]') ||
          b.closest('div[class*="sidebar"]') ||
          b.closest('.toolbar-top') ||
          b.closest('[class*="toolbar"]')) {
        return false;
      }

      // Si tenemos la caja de chat, ignorar cualquier botón ubicado arriba del textarea (barra de stickers/regalos)
      if (inputRect && inputRect.top > 0) {
        const bRect = b.getBoundingClientRect();
        if (bRect.top < inputRect.top - 10) {
          return false;
        }
      }

      const txt = (b.innerText || b.textContent || '').trim().toLowerCase();
      const testId = (b.getAttribute('data-test-id') || '').toLowerCase();
      const className = (b.className || '').toString().toLowerCase();
      const ariaLabel = (b.getAttribute('aria-label') || '').toLowerCase();
      
      const isSendText = txt === 'send' || txt === 'enviar' || txt.startsWith('send ') || txt.startsWith('send\n') || txt.startsWith('enviar ');
      const isSendTestId = testId.includes('send') || testId.includes('submit');
      const isSendClass = (className.includes('send') || className.includes('submit')) && !className.includes('header') && !className.includes('nav');
      const isSendAria = ariaLabel.includes('send') || ariaLabel.includes('enviar');
      const hasSendSvg = b.querySelector('svg[class*="send" i], path[d*="M2.01 21L23 12 2.01 3"]') !== null;

      return isSendText || isSendTestId || isSendClass || isSendAria || hasSendSvg;
    });

    if (candidates.length > 0) {
      if (inputRect && candidates.length > 1) {
        candidates.sort((a, b) => {
          const rectA = a.getBoundingClientRect();
          const rectB = b.getBoundingClientRect();
          const distA = Math.hypot(rectA.left - inputRect.right, rectA.top - inputRect.bottom);
          const distB = Math.hypot(rectB.left - inputRect.right, rectB.top - inputRect.bottom);
          return distA - distB;
        });
      }
      return candidates[0];
    }

    return document.querySelector('button[class*="send" i], div[class*="send" i] button');
  }

  let knownClientCreditsMap = new Map();
  let shiftInitialClientPostStatus = new Map();

  // 11. INYECCIÓN DE SALDO / PUNTOS REALES, GASTO HISTÓRICO, GANCHOS DUALES Y TRADUCTOR
  async function injectAgenciaChatEnhancements() {
    if (!window.location.href.includes('/chat/')) return;

    const clientId = getExactNumericClientId();
    if (!clientId || clientId === 'N/A') return;

    // Detectar si el cliente tiene activado / desbloqueado el servicio de Posts o Chat
    const hasPostsUnlocked = Boolean(
      document.querySelector('a[href*="/posts"], button[title*="Posts" i], button[title*="Post" i], [data-test-id*="post"], svg[class*="bolt"], svg[class*="flash"]') ||
      window.location.href.includes('/posts') ||
      (document.querySelector('div[class*="header"]') && document.querySelector('div[class*="header"]').innerHTML.includes('posts')) ||
      document.body.innerText.includes('Go to Posts')
    );

    // Leer saldo en vivo desde el DOM de Talkytimes o API
    let liveCredits = null;
    
    // 1. Selector específico de Talkytimes para contadores de restricción y balance
    const restrictionEl = document.querySelector('[data-test-id*="restriction-limits"], [data-type="Chat"].counter, .chat-limits-counter');
    if (restrictionEl) {
      const activeSpan = restrictionEl.querySelector('span:not(.counter-inactive)');
      if (activeSpan) {
        const val = parseInt((activeSpan.textContent || activeSpan.innerText || '').trim(), 10);
        if (!isNaN(val)) liveCredits = val;
      }
    }

    // 2. Selector en encabezado o barra de perfil
    if (liveCredits === null) {
      const headerEl = document.querySelector('div[data-test-id="dialog-header-title"], div[class*="dialog-header"], div[class*="chat-header"]') || document.querySelector('div[class*="header"]');
      if (headerEl) {
        const crMatch = headerEl.parentElement?.innerText?.match(/(\d+)\s*(?:cr|credits|pts)\b/i) || headerEl.innerText.match(/(\d+)\s*(?:cr|credits|pts)\b/i);
        if (crMatch) liveCredits = parseInt(crMatch[1], 10);
      }
    }

    // 3. Selector en chips de saldo o perfiles laterales
    if (liveCredits === null) {
      const balanceChips = document.querySelectorAll('span[class*="balance"], div[class*="balance"], span[class*="credit"], div[class*="credit"]');
      for (const chip of balanceChips) {
        const chipText = (chip.innerText || '').trim();
        const m = chipText.match(/(\d+)\s*(?:cr|credits|pts)?\b/i);
        if (m && parseInt(m[1], 10) > 0) {
          liveCredits = parseInt(m[1], 10);
          break;
        }
      }
    }

    if (liveCredits === null && isChatHeaderZeroMessages()) {
      liveCredits = 0;
    }

    const { clientName, bioData } = getExactClientProfileData();

    // REGISTRO DE ESTADO INICIAL DEL CLIENTE EN EL TURNO (PARA EVALUAR FIDELIZACIÓN REAL Y ACTIVIDAD DE TURNO)
    const recentChat = parseCurrentChatMessagesBidirectional(clientName);
    const messagesCountNow = recentChat.length;

    if (!shiftInitialClientPostStatus.has(clientId)) {
      const isColdAtStart = messagesCountNow === 0;
      shiftInitialClientPostStatus.set(clientId, {
        wasColdAtStart: isColdAtStart,
        wasZeroCredits: isChatHeaderZeroMessages(),
        initialUnlocked: hasPostsUnlocked,
        messagesCountAtStart: messagesCountNow,
        rechargeAlertFired: false,
        firstSeen: Date.now()
      });
    }

    const initialStatus = shiftInitialClientPostStatus.get(clientId);
    const shiftMsgsCount = initialStatus ? Math.max(0, messagesCountNow - initialStatus.messagesCountAtStart) : 0;
    const shiftPts = shiftMsgsCount * 1;
    const shiftUSD = (shiftPts * 0.28).toFixed(2);

    const unlockedDuringShift = initialStatus && initialStatus.wasColdAtStart && !initialStatus.initialUnlocked && hasPostsUnlocked;
    const enoughInteraction = initialStatus && initialStatus.wasColdAtStart && shiftMsgsCount >= 3;

    // DETECCIÓN DETERMINÍSTICA DE RECARGA EN VIVO (Cuando un cliente inactivo/sin saldo reanuda con mensajes pagados)
    if (initialStatus && (initialStatus.wasColdAtStart || initialStatus.wasZeroCredits) && shiftMsgsCount > 0 && !initialStatus.rechargeAlertFired) {
      initialStatus.rechargeAlertFired = true;
      try {
        playAlertChime();
        showFirewallToast(`⚡ ¡RECARGA EN VIVO CONFIRMADA! ${clientName} inyectó saldo y reanudó el chat.`);
      } catch(e){}
    }

    if ((unlockedDuringShift || initialStatus.rechargeAlertFired) && enoughInteraction) {
      if (!fidelizedClientsMap.has(String(clientId))) {
        fidelizedClientsMap.set(String(clientId), {
          clientId: String(clientId),
          name: clientName,
          credits: 150,
          profile: sessionData.profileName || 'HORACIO',
          operator: sessionData.operator || 'walther',
          shift: sessionData.shift || 'Mañana'
        });
        showFirewallToast(`🎉 ¡CLIENTE FIDELIZADO EN TU TURNO! ${clientName} inició sin historial y desbloqueó el servicio.`);
      }
    }

    // A. Badge de Saldo / Estado en Vivo, Gasto Histórico y Botón de Información en Cabecera
    const headerTitle = document.querySelector('div[data-test-id="dialog-header-title"], div[class*="dialog-header"], div[class*="chat-header"]');
    if (headerTitle) {
      try {
        let badge = headerTitle.querySelector('.ryr-client-credit-badge');
        if (!badge) {
          badge = document.createElement('span');
          badge.className = 'ryr-client-credit-badge';
          headerTitle.appendChild(badge);
        }

        // 1. Extraer contadores directos de la cabecera de Talkytimes (ej: 💬 6  ✉ 2)
        let headerLetters = null;
        let headerMessages = null;
        let headerLastSeen = '';

        const headerContainer = headerTitle.parentElement || headerTitle;
        const headerContainerText = (headerContainer ? headerContainer.innerText : '') || '';

        // Búsqueda de lastSeen ("6 minutes ago", "online", etc.)
        const seenMatch = headerContainerText.match(/(\d+\s*(?:minutes?|hours?|days?|mins?|hrs?|segundos?|minutos?|horas?)\s*ago|online|en línea|conectad[oa])/i);
        if (seenMatch) headerLastSeen = seenMatch[0];

        // Match de caracteres Unicode o palabras
        const letterMatch = headerContainerText.match(/(?:✉|mails?|letters?)\s*(\d+)/i) || headerContainerText.match(/(\d+)\s*(?:mails?|letters?)/i);
        if (letterMatch) headerLetters = parseInt(letterMatch[1], 10);

        const msgMatch = headerContainerText.match(/(?:💬|chats?|msgs?)\s*(\d+)/i) || headerContainerText.match(/(\d+)\s*(?:chats?|msgs?)/i);
        if (msgMatch) headerMessages = parseInt(msgMatch[1], 10);

        // Si falló por texto plano, buscar directamente en los elementos hijos del header
        if (headerMessages === null || headerLetters === null) {
          const candidateBadges = headerContainer.querySelectorAll('span, div, a');
          candidateBadges.forEach(el => {
            const rawVal = (el.innerText || '').trim();
            if (/^\d+$/.test(rawVal)) {
              const num = parseInt(rawVal, 10);
              const pEl = el.parentElement || el;
              const innerHtml = (pEl.innerHTML || '').toLowerCase();
              const prevHtml = (el.previousElementSibling ? el.previousElementSibling.outerHTML : '').toLowerCase();
              if (innerHtml.includes('chat') || innerHtml.includes('message') || innerHtml.includes('comment') || prevHtml.includes('chat') || prevHtml.includes('comment')) {
                if (headerMessages === null) headerMessages = num;
              } else if (innerHtml.includes('mail') || innerHtml.includes('letter') || innerHtml.includes('envelope') || prevHtml.includes('mail') || prevHtml.includes('letter')) {
                if (headerLetters === null) headerLetters = num;
              }
            }
          });
        }

        // 2. Si aún no hay contadores, buscar en la lista lateral
        let letterCount = headerLetters !== null ? headerLetters : 0;
        if (headerLetters === null) {
          const allSidebarRows = document.querySelectorAll('div[data-test-id*="dialog-item"], div[class*="dialog-item"], div[class*="item-wrap"]');
          for (let r of allSidebarRows) {
            const userLink = r.querySelector('a[href*="/chat/"], a[href*="/user/"], a[href*="/mails/"]');
            const rowId = userLink ? getExactNumericClientId(userLink.getAttribute('href')) : null;
            const rText = r.innerText || '';
            if (rowId === clientId || (clientName && rText.toLowerCase().includes(clientName.toLowerCase()))) {
              const m = rText.match(/(\d+)\s+letter total/i);
              if (m) letterCount = parseInt(m[1], 10);
              break;
            }
          }
        }

        const totalMessages = headerMessages !== null ? headerMessages : messagesCountNow;
        const totalChatCredits = totalMessages * 1;
        const totalChatUSD = (totalChatCredits * 0.28).toFixed(2);
        const totalLetterCredits = letterCount * 10;
        const totalLetterUSD = (totalLetterCredits * 0.28).toFixed(2);

        const realSpentCredits = totalChatCredits + totalLetterCredits;
        const realSpentUSD = (realSpentCredits * 0.28).toFixed(2);

        const isZeroCredits = isChatHeaderZeroMessages();
        let dispStatusBadgeText = isZeroCredits ? '🔴 Sin Saldo' : '🟢 Saldo Activo';
        let dispStatusColor = isZeroCredits ? '#ef4444' : '#34d399';

        const isFidelized = fidelizedClientsMap.has(String(clientId)) || fidelizedClientsMap.has(clientName.toLowerCase());
        const isVipTier = realSpentCredits > 300 || letterCount > 25;

        const fidelTag = isFidelized 
          ? `<span style="color:#f472b6; font-weight:900;">💎 FIDELIZADO</span> | ` 
          : (isVipTier ? `<span style="color:#f59e0b; font-weight:900;">💎 VIP</span> | ` : '');

        // Calcular duración y tiempo chateando
        let firstMsgInfo = 'Hoy en turno';
        let chatDurationStr = 'En curso';
        if (recentChat && recentChat.length > 0) {
          const firstMsg = recentChat[0];
          firstMsgInfo = `${firstMsg.date || 'Hoy'} a las ${firstMsg.time || 'inicio'}`;
          const lastMsg = recentChat[recentChat.length - 1];
          chatDurationStr = `${recentChat.length} mensajes en hilo activo (Último: ${lastMsg.time || 'Reciente'})`;
        }

        const badgeSig = `${fidelTag}_${dispStatusBadgeText}_${realSpentUSD}_${realSpentCredits}`;
        if (badge.dataset.sig !== badgeSig) {
          badge.dataset.sig = badgeSig;
          badge.innerHTML = `
            <div style="display:flex; align-items:center; justify-content:space-between; gap:4px;">
              <div style="display:flex; align-items:center; gap:3px;">
                ${fidelTag}🪙 <b style="color:${dispStatusColor};">${dispStatusBadgeText}</b>
              </div>
              <button class="ryr-credit-info-btn" id="ryr-btn-credit-info" title="Ver auditoría comercial, desglose de gasto y tiempo chateando" type="button">ℹ️</button>
            </div>
            <div style="display:flex; align-items:center; gap:3px; color:#cbd5e1; font-size:9.5px;">
              💎 <b>Gasto Total: $${realSpentUSD}</b> <span style="color:#94a3b8;">(${realSpentCredits} Pts)</span>
            </div>
          `;
        }

        // Acción del Botón de Info: Desplegar Popover Persistente con desglose detallado
        const infoBtn = badge.querySelector('#ryr-btn-credit-info');
        if (infoBtn && !infoBtn.dataset.bound) {
          infoBtn.dataset.bound = 'true';
          infoBtn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            const existingPop = document.getElementById('ryr-client-intel-popover');
            if (existingPop) {
              existingPop.remove();
              return;
            }
            const pop = document.createElement('div');
            pop.id = 'ryr-client-intel-popover';
            pop.className = 'ryr-client-intel-popover';
            pop.innerHTML = `
              <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(56,189,248,0.3); padding-bottom:6px; margin-bottom:8px;">
                <span style="font-weight:900; color:#38bdf8; font-size:11px; letter-spacing:0.5px;">📊 AUDITORÍA COMERCIAL: ${clientName.toUpperCase()}</span>
                <span style="cursor:pointer; color:#94a3b8; font-size:15px; font-weight:bold; line-height:1; padding:2px 6px;" id="ryr-close-intel-popover" title="Cerrar ventana">✕</span>
              </div>
              
              <div style="margin-bottom:8px; background:rgba(56,189,248,0.08); padding:6px 8px; border-radius:6px; border:1px solid rgba(56,189,248,0.2);">
                <div style="font-weight:bold; color:#7dd3fc; margin-bottom:2px; font-size:10px;">🔍 ¿CÓMO SE CALCULAN ESTOS DATOS?</div>
                <div style="color:#cbd5e1; font-size:9.5px; line-height:1.35;">
                  Talkytimes registra en su cabecera el historial acumulado de interacción (💬 <b>${totalMessages} chats</b> y ✉ <b>${letterCount} cartas</b>) con este perfil. Aplicamos la tasa oficial de la plataforma: <b>1 crédito ($0.28 USD) por chat</b> y <b>10 créditos ($2.80 USD) por carta</b>.
                </div>
              </div>

              <!-- SECCIÓN 1: GASTO HISTÓRICO TOTAL CON ESTE PERFIL -->
              <div style="margin-bottom:8px; background:rgba(15,23,42,0.6); border:1px solid rgba(255,255,255,0.08); border-radius:6px; padding:6px 8px;">
                <div style="font-weight:bold; color:#facc15; margin-bottom:3px; font-size:10px;">💎 GASTO HISTÓRICO TOTAL CON ${sessionData.profileName || 'ESTE PERFIL'}:</div>
                <div style="display:flex; justify-content:space-between; color:#e2e8f0; font-size:10px; margin-bottom:2px;">
                  <span>• Mensajes de Chat (${totalMessages} total):</span>
                  <span style="font-weight:bold; color:#34d399;">${totalChatCredits} pts ($${totalChatUSD} USD)</span>
                </div>
                <div style="display:flex; justify-content:space-between; color:#e2e8f0; font-size:10px; margin-bottom:2px;">
                  <span>• Cartas Enviadas (${letterCount} total):</span>
                  <span style="font-weight:bold; color:#34d399;">${totalLetterCredits} pts ($${totalLetterUSD} USD)</span>
                </div>
                <div style="display:flex; justify-content:space-between; color:#fff; font-size:10.5px; font-weight:900; border-top:1px solid rgba(255,255,255,0.12); padding-top:4px; margin-top:3px;">
                  <span>💎 TOTAL COMPLETO INVERTIDO:</span>
                  <span style="color:#f59e0b; font-size:11px;">${realSpentCredits} Pts ($${realSpentUSD} USD)</span>
                </div>
              </div>

              <!-- SECCIÓN 2: ACTIVIDAD EN EL TURNO ACTUAL -->
              <div style="margin-bottom:8px; background:rgba(15,23,42,0.4); border:1px solid rgba(167,139,250,0.25); border-radius:6px; padding:6px 8px;">
                <div style="font-weight:bold; color:#a78bfa; margin-bottom:3px; font-size:10px;">⚡ ACTIVIDAD EN EL TURNO ACTUAL (HOY):</div>
                <div style="display:flex; justify-content:space-between; color:#e2e8f0; font-size:9.5px; margin-bottom:2px;">
                  <span>• Mensajes en tu turno:</span>
                  <span style="font-weight:bold; color:#38bdf8;">${shiftMsgsCount} chats (${shiftPts} pts / $${shiftUSD} USD)</span>
                </div>
                <div style="color:#cbd5e1; font-size:9.5px; margin-bottom:2px;">• <b>Primer contacto:</b> ${firstMsgInfo}</div>
                <div style="color:#cbd5e1; font-size:9.5px;">• <b>Última actividad:</b> ${headerLastSeen || 'Activo ahora en chat'}</div>
              </div>

              <!-- SECCIÓN 3: ESTADO DE SALDO & RECARGAS -->
              <div style="background:rgba(16,185,129,0.06); border:1px solid rgba(16,185,129,0.25); border-radius:6px; padding:6px 8px;">
                <div style="font-weight:bold; color:#34d399; margin-bottom:2px; font-size:10px;">🔋 ESTADO DE SALDO & RECARGAS:</div>
                <div style="color:#cbd5e1; font-size:9.5px; line-height:1.35;">
                  Estado: <b style="color:${dispStatusColor};">${isZeroCredits ? '🔴 Sin Saldo / Chat Pausado' : '🟢 Saldo Activo (Interactuando con fluidez)'}</b>.<br>
                  <span style="font-size:9px; color:#94a3b8;">Monitoreo en vivo: Si el cliente agota sus créditos y vuelve a recargar, el Agente emitirá un aviso auditivo y visual en pantalla.</span>
                </div>
              </div>
            `;

            // Posicionamiento fijo seguro y estable en pantalla
            const rect = infoBtn.getBoundingClientRect();
            const topPos = Math.min(window.innerHeight - 440, Math.max(10, rect.bottom + 8));
            const leftPos = Math.max(10, Math.min(window.innerWidth - 345, rect.right - 325));
            pop.style.top = `${topPos}px`;
            pop.style.left = `${leftPos}px`;

            // Insertar en document.body para desacoplarlo de cualquier re-render del chat o badge
            document.body.appendChild(pop);

            const closePop = pop.querySelector('#ryr-close-intel-popover');
            if (closePop) {
              closePop.onclick = (ev) => {
                ev.preventDefault();
                ev.stopPropagation();
                pop.remove();
              };
            }

            // Click fuera para cerrar voluntariamente sin apresurar la lectura
            const handleOutsideClick = (ev) => {
              if (pop && !pop.contains(ev.target) && ev.target !== infoBtn && !infoBtn.contains(ev.target)) {
                pop.remove();
                document.removeEventListener('click', handleOutsideClick);
              }
            };
            setTimeout(() => {
              document.addEventListener('click', handleOutsideClick);
            }, 50);
          };
        }

        if (isFidelized) {
          badge.className = 'ryr-client-credit-badge ryr-credit-fidelizar';
        } else if (isVipTier) {
          badge.className = 'ryr-client-credit-badge ryr-credit-vip';
        } else {
          badge.className = 'ryr-client-credit-badge';
        }
      } catch (errBadge) {
        console.warn('[AgenteRYR] Error creando credit badge:', errBadge);
      }
    }

    // B. Detectar Idioma y Contexto de Conversación
    const clientMessages = recentChat.filter(m => !m.isOperator);
    const combinedClientText = clientMessages.map(m => m.text).join(' ');
    let detectedLang = detectLanguage(combinedClientText || bioData?.country || '');
    
    // Si el perfil o bio es USA/UK o no hay certeza, asegurar que el idioma de destino sea EN
    if (detectedLang.code === 'es' && !/[áéíóúñ¿¡]/.test(combinedClientText)) {
      detectedLang = { code: 'en', name: 'English 🇺🇸', flag: '🇺🇸' };
    }

    const hasConversationHistory = clientMessages.length > 0;
    const lastClientMsg = clientMessages.length > 0 ? clientMessages[clientMessages.length - 1].text : '';

    // C. Limpiar cualquier inyección previa fuera de lugar o huérfana
    const sendBtn = findChatSendButton();
    
    document.querySelectorAll('.ryr-chat-tools-wrapper').forEach(el => {
      if (!sendBtn || el.parentElement !== sendBtn.parentElement) {
        el.remove();
      }
    });

    if (!sendBtn || !sendBtn.parentElement) return;

    // Asegurar posicionamiento y layout flex sin saltos de línea al cambiar pantalla
    sendBtn.parentElement.style.setProperty('display', 'flex', 'important');
    sendBtn.parentElement.style.setProperty('align-items', 'center', 'important');
    sendBtn.parentElement.style.setProperty('flex-wrap', 'nowrap', 'important');
    sendBtn.parentElement.style.setProperty('position', 'relative', 'important');

    // Inyección de Botones justo al lado DERECHO del botón Send (dentro del mismo nivel)
    let toolsWrapper = sendBtn.parentElement.querySelector('.ryr-chat-tools-wrapper');
    if (!toolsWrapper) {
      toolsWrapper = document.createElement('div');
      toolsWrapper.className = 'ryr-chat-tools-wrapper';
      sendBtn.after(toolsWrapper);
    } else if (toolsWrapper.previousElementSibling !== sendBtn) {
      sendBtn.after(toolsWrapper);
    }

    toolsWrapper.style.setProperty('display', 'inline-flex', 'important');
    toolsWrapper.style.setProperty('flex-direction', 'column', 'important');
    toolsWrapper.style.setProperty('align-items', 'stretch', 'important');
    toolsWrapper.style.setProperty('justify-content', 'center', 'important');
    toolsWrapper.style.setProperty('gap', '3px', 'important');
    toolsWrapper.style.setProperty('flex-shrink', '0', 'important');
    toolsWrapper.style.setProperty('white-space', 'nowrap', 'important');
    toolsWrapper.style.setProperty('margin-left', '6px', 'important');

    // Limpiar badge residual de idioma si existía
    const oldLangBadge = toolsWrapper.querySelector('.ryr-lang-badge');
    if (oldLangBadge) oldLangBadge.remove();

    // 1. Botón de Responder Chat (ARRIBA)
    let hookBtn = toolsWrapper.querySelector('.ryr-chat-hooks-btn');
    if (!hookBtn) {
      hookBtn = document.createElement('button');
      hookBtn.type = 'button';
      hookBtn.className = 'ryr-chat-hooks-btn';
      toolsWrapper.appendChild(hookBtn);
    }
    hookBtn.innerHTML = '✨ Responder Chat';
    hookBtn.title = 'Generar 3 respuestas inteligentes y humanizadas con contexto de la conversación';

    // 2. Botón de Traducir Mensaje (ABAJO)
    const targetLabel = detectedLang.code.toUpperCase();
    let transBtn = toolsWrapper.querySelector('.ryr-translate-btn');
    if (!transBtn) {
      transBtn = document.createElement('button');
      transBtn.type = 'button';
      transBtn.className = 'ryr-translate-btn';
      toolsWrapper.appendChild(transBtn);
    }
    transBtn.innerHTML = `🌐 Traducir a ${targetLabel}`;
    transBtn.title = `Traducir texto al idioma del cliente (${detectedLang.name})`;

    // Asegurar estricto orden vertical: Responder Chat ARRIBA, Traducir ABAJO
    if (hookBtn.nextElementSibling !== transBtn) {
      hookBtn.after(transBtn);
    }

    // Acción de Traducir Auto-Detectada
    transBtn.onclick = async (e) => {
      e.preventDefault();
      e.stopPropagation();

      const ta = findChatInput();
      if (!ta) return;
      const currentText = (ta.value || ta.innerText || '').trim();

      if (!currentText) {
        showFirewallToast(`✍️ Escribe tu mensaje en la caja primero para traducirlo.`);
        ta.focus();
        return;
      }

      transBtn.disabled = true;
      transBtn.innerHTML = `⏳ Traduciendo...`;

      // Si el texto escrito está en español, traducir a la lengua del cliente (ej. EN). Si no, a ES.
      const isInputSpanish = /[áéíóúñ¿¡]|\b(hola|que|cómo|como|estas|estás|bien|amor|gracias|quiero|tengo|donde|cuando|para|con)\b/i.test(currentText);
      const destinationLang = isInputSpanish ? (detectedLang.code === 'es' ? 'en' : detectedLang.code) : 'es';

      try {
        const translated = await translateText(currentText, destinationLang);
        setInputValueSafely(ta, translated);
        showFirewallToast(`✅ Traducido a ${destinationLang.toUpperCase()} y listo para enviar.`);
      } catch (err) {
        showFirewallToast(`⚠️ Error al traducir.`);
      } finally {
        transBtn.disabled = false;
        transBtn.innerHTML = `🌐 Traducir a ${targetLabel}`;
      }
    };

    // Acción de Responder Chat (Modo Contextual Ultra-Humanizado con Razonamiento IA en Tiempo Real)
    hookBtn.onclick = async (e) => {
      e.preventDefault();
      e.stopPropagation();

      const existingDropdown = toolsWrapper.querySelector('.ryr-chat-hooks-dropdown');
      if (existingDropdown) {
        existingDropdown.remove();
        return;
      }

      // 1. Obtener datos EXACTOS y FRESCOS del cliente en pantalla al momento del clic
      const { clientName: liveClientName, bioData: liveBioData } = getExactClientProfileData();
      const liveClientId = getExactNumericClientId();
      const liveMessages = parseCurrentChatMessagesBidirectional(liveClientName);
      const liveClientMessages = liveMessages.filter(m => !m.isOperator);
      const liveLetters = extractMailThreadContext();

      // Extraer el último mensaje del cliente y del operador con máxima precisión
      let lastClientMsg = '';
      let lastOperatorMsg = '';
      for (let i = liveMessages.length - 1; i >= 0; i--) {
        const m = liveMessages[i];
        if (!m.isOperator && m.text && !lastClientMsg) {
          lastClientMsg = m.text.trim();
        }
        if (m.isOperator && m.text && !lastOperatorMsg) {
          lastOperatorMsg = m.text.trim();
        }
        if (lastClientMsg && lastOperatorMsg) break;
      }
      if (!lastClientMsg && liveClientMessages.length > 0) {
        lastClientMsg = liveClientMessages[liveClientMessages.length - 1].text.trim();
      }
      if (!lastClientMsg && liveMessages.length > 0) {
        lastClientMsg = liveMessages[liveMessages.length - 1].text.trim();
      }

      const combinedLiveClientText = [
        lastClientMsg,
        ...liveClientMessages.map(m => m.text),
        ...liveLetters.map(l => l.body || l.preview || '')
      ].join(' ');

      let liveDetectedLang = detectLanguage(combinedLiveClientText || liveBioData?.country || '');
      // Refinamiento de idioma según país de perfil o léxico
      const countryStr = (liveBioData?.country || '').toLowerCase();
      if (/brazil|brasil|portugal|angola|mozambique/i.test(countryStr)) {
        liveDetectedLang = { code: 'pt', name: 'Português 🇧🇷', flag: '🇧🇷' };
      } else if (/spain|españa|mexico|méxico|colombia|argentina|peru|perú|chile|venezuela|ecuador|guatemala|bolivia|cuba|dominican|honduras|paraguay|el salvador|nicaragua|costa rica|panama|panamá|uruguay/i.test(countryStr)) {
        liveDetectedLang = { code: 'es', name: 'Español 🇪🇸', flag: '🇪🇸' };
      }

      const isSyncedInDb = syncedChatsMemory.has(String(liveClientId).toLowerCase()) || (liveClientName && syncedChatsMemory.has(liveClientName.toLowerCase()));
      const showMissingHistoryWarning = !isSyncedInDb && liveClientMessages.length <= 2 && (!liveLetters || liveLetters.length === 0);

      const dropdown = document.createElement('div');
      dropdown.className = 'ryr-chat-hooks-dropdown';
      toolsWrapper.appendChild(dropdown);

      const headerTitleText = `🔄 RESPONDER CHAT A ${liveClientName.toUpperCase()} (${liveDetectedLang.name}):`;

      let warningHtml = '';
      if (showMissingHistoryWarning) {
        warningHtml = `
          <div class="ryr-no-info-warning">
            <span style="font-size:10px; line-height:1.2;">⚠️ <b>Sin historial previo en BD:</b> Sube las conversaciones para contexto 360°.</span>
            <button class="ryr-no-info-btn" id="ryr-quick-sync-btn">⚡ Subir Ahora</button>
          </div>
        `;
      }

      dropdown.innerHTML = `
        <div style="font-weight:bold; color:#a5b4fc; font-size:11px; margin-bottom:6px; display:flex; justify-content:space-between; align-items:center;">
          <span>${headerTitleText}</span>
          <span style="cursor:pointer; color:#94a3b8; font-size:14px;" id="ryr-close-hooks-dropdown">✕</span>
        </div>
        ${warningHtml}
        <div id="ryr-hooks-loading" style="text-align:center; padding:18px 10px; color:#38bdf8; font-size:11px; font-weight:bold;">
          🧠 Razonando contexto y analizando conversación con IA...
        </div>
        <div id="ryr-hooks-options-container" style="display:none; flex-direction:column; gap:6px;"></div>
      `;

      const closeBtn = dropdown.querySelector('#ryr-close-hooks-dropdown');
      if (closeBtn) closeBtn.onclick = () => dropdown.remove();

      const syncNowBtn = dropdown.querySelector('#ryr-quick-sync-btn');
      if (syncNowBtn) {
        syncNowBtn.onclick = async (ev) => {
          ev.stopPropagation();
          syncNowBtn.innerText = '⏳ Subiendo...';
          syncNowBtn.disabled = true;
          await syncCurrentChatToDatabase();
          syncNowBtn.innerText = '✅ Subido';
        };
      }

      const container = dropdown.querySelector('#ryr-hooks-options-container');
      const loadingEl = dropdown.querySelector('#ryr-hooks-loading');

      const renderOptionsList = (hooksList) => {
        if (loadingEl) loadingEl.style.display = 'none';
        if (!container) return;
        container.style.display = 'flex';
        container.innerHTML = '';

        hooksList.forEach((item, idx) => {
          const targetText = typeof item === 'object' ? item.target : item;
          const esText = typeof item === 'object' ? item.es : 'Respuesta contextual razonada.';
          const optTitle = typeof item === 'object' && item.title ? item.title : `Opción ${idx + 1}`;

          const option = document.createElement('div');
          option.className = 'ryr-hook-option';
          option.style.cssText = 'box-sizing:border-box !important; width:100% !important; white-space:normal !important; word-break:break-word !important; overflow-wrap:anywhere !important; overflow:hidden !important;';
          option.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:3px; width:100%;">
              <span style="font-weight:bold; color:#a5b4fc; font-size:10px;">${optTitle.toUpperCase()}</span>
              <span style="font-size:9.5px; color:#38bdf8; font-weight:bold; white-space:nowrap;">⚡ Clic para Enviar</span>
            </div>
            <div class="ryr-hook-target-text" style="white-space:normal !important; word-break:break-word !important; overflow-wrap:anywhere !important; width:100% !important; box-sizing:border-box !important; line-height:1.4 !important;">"${targetText}"</div>
            <div class="ryr-hook-es-text" style="white-space:normal !important; word-break:break-word !important; overflow-wrap:anywhere !important; width:100% !important; box-sizing:border-box !important; line-height:1.35 !important;">💡 <b>Explicación en Español:</b> <i>${esText}</i></div>
          `;

          // Clic directo: Inserción inmediata 1-Click
          option.onclick = () => {
            const ta = findChatInput();
            if (ta) {
              setInputValueSafely(ta, targetText);
              showFirewallToast(`✨ Mensaje en ${liveDetectedLang.name} insertado en el chat. ¡Listo para enviar!`, 'success');
              ta.focus();
            }
            dropdown.remove();
          };

          container.appendChild(option);
        });
      };

      // 2. Motor Neuronal Contextual de Respuestas Humanizadas Ultra-Naturales
      const synthesizeDynamicChatOptions = (clientText, langCode, clientNameStr, msgsHistory = [], lettersHistory = [], prevOpText = '') => {
        // --- 1. HELPERS & VARIETY SYSTEM ---
        const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
        
        // Formato seguro del nombre del cliente
        const rawName = (clientNameStr || '').trim();
        const clientShort = rawName ? rawName.split(' ')[0].replace(/[^a-zA-ZáéíóúñÁÉÍÓÚÑàèìòùãõçÀÈÌÒÙÃÕÇ]/g, '') : (langCode === 'pt' ? 'amigo' : (langCode === 'es' ? 'amigo' : 'friend'));
        const lang = (langCode || 'en').toLowerCase().trim();

        // --- 2. LISTAS DE STOPWORDS EN, ES, PT ---
        const STOPWORDS_EN = new Set([
          'a','about','above','after','again','against','all','am','an','and','any','are','aren\'t','as','at','be','because',
          'been','before','being','below','between','both','but','by','can','can\'t','cannot','could','couldn\'t','did','didn\'t',
          'do','does','doesn\'t','doing','don\'t','down','during','each','few','for','from','further','had','hadn\'t','has','hasn\'t',
          'have','haven\'t','having','he','he\'d','he\'ll','he\'s','her','here','here\'s','hers','herself','him','himself','his',
          'how','how\'s','i','i\'d','i\'ll','i\'m','i\'ve','if','in','into','is','isn\'t','it','it\'s','its','itself','let\'s','me',
          'more','most','mustn\'t','my','myself','no','nor','not','of','off','on','once','only','or','other','ought','our','ours',
          'ourselves','out','over','own','same','shan\'t','she','she\'d','she\'ll','she\'s','should','shouldn\'t','so','some','such',
          'than','that','that\'s','the','their','theirs','them','themselves','then','there','there\'s','these','they','they\'d',
          'they\'ll','they\'re','they\'ve','this','those','through','to','too','under','until','up','very','was','wasn\'t','we',
          'we\'d','we\'ll','we\'re','we\'ve','were','weren\'t','what','what\'s','when','when\'s','where','where\'s','which','while',
          'who','who\'s','whom','why','why\'s','with','won\'t','would','wouldn\'t','you','you\'d','you\'ll','you\'re','you\'ve',
          'your','yours','yourself','yourselves','just','really','also','like','get','got','yeah','yes','ok','okay','oh','ah','hey',
          'hello','hi','well','gonna','wanna','kinda','actually','basically','already','though','still','much','lot','lots','way'
        ]);

        const STOPWORDS_ES = new Set([
          'a','al','algo','algunas','algunos','ante','antes','aquel','aquella','aquellas','aquellos','aqui','aquí','arriba','asi','así',
          'atras','atrás','aun','aún','aunque','bajo','bastante','bien','cabe','cada','casi','como','cómo','con','conmigo','consigo',
          'contigo','contra','cual','cuál','cuales','cuáles','cuando','cuándo','cuanta','cuánta','cuantas','cuántas','cuanto','cuánto',
          'cuantos','cuántos','de','del','demás','demas','desde','donde','dónde','dos','durante','e','el','ella','ellas','ello','ellos',
          'en','encima','entonces','entre','era','eras','éramos','eran','es','esa','esas','ese','eso','esos','esta','estás','está',
          'estamos','están','estar','estas','este','esto','estos','estoy','fue','fuera','fueron','fui','fuimos','ha','habia','había',
          'habian','habían','han','has','hasta','hay','haya','he','hemos','hube','hubo','la','las','le','les','lo','los','mas','más',
          'me','menos','mi','mí','mia','mía','mias','mías','mientras','mio','mío','mios','míos','mis','mucha','muchas','mucho','muchos',
          'muy','nada','ni','no','nos','nosotras','nosotros','nuestra','nuestras','nuestro','nuestros','nunca','o','otra','otras','otro',
          'otros','para','pero','poca','pocas','poco','pocos','por','porque','por qué','pronto','pues','que','qué','quien','quién',
          'quienes','quiénes','quiza','quizás','se','según','segun','ser','si','sí','siempre','siendo','sin','sino','so','sobre',
          'solo','sólo','somos','son','soy','su','sus','suya','suyas','suyo','suyos','tal','tales','tambien','también','tampoco','tan',
          'tanta','tantas','tanto','tantos','te','tenemos','tener','tengo','ti','tiene','tienen','toda','todas','todavia','todavía',
          'todo','todos','tras','tu','tú','tus','tuya','tuyas','tuyo','tuyos','un','una','unas','uno','unos','usted','ustedes','va',
          'vamos','van','vaya','verdad','voy','y','ya','yo','hola','oye','bueno','vale','jaja','jajaja'
        ]);

        const STOPWORDS_PT = new Set([
          'a','à','às','agora','ainda','além','algo','algum','alguma','algumas','alguns','ante','antes','ao','aos','após','aquela',
          'aquelas','aquele','aqueles','aquilo','as','até','através','bem','boa','boas','bom','bons','cá','cada','quase','com','como',
          'contra','contudo','da','das','de','dela','delas','dele','deles','demais','depois','desde','dessa','dessas','desse','desses',
          'desta','destas','deste','destes','deve','devem','dever','deveria','diz','dizem','do','dos','e','é','ela','elas','ele','eles',
          'em','enquanto','entre','era','eram','éramos','essa','essas','esse','esses','esta','estás','está','estamos','estão','estar',
          'estas','estava','estavam','este','estes','estou','eu','fazendo','fazer','foi','fomos','for','foram','fosse','fossem','grande',
          'grandes','há','isso','isto','já','la','lá','lhe','lhes','lo','logo','mais','mas','me','mesmo','mesma','mesmas','mesmos','meu',
          'meus','minha','minhas','muita','muitas','muito','muitos','na','não','nas','nem','no','nos','nós','nossa','nossas','nosso',
          'nossos','num','numa','numas','nuns','o','os','ou','outra','outras','outro','outros','para','pela','pelas','pelo','pelos',
          'perto','pode','podem','poder','poderia','pois','por','porém','porque','por que','portanto','posso','pouca','poucas','pouco',
          'poucos','quais','qual','qualquer','quando','quanto','quantos','quase','que','quem','são','se','seja','sejam','sem','sempre',
          'sendo','ser','será','serão','seria','seu','seus','si','sido','só','sob','sobre','sua','suas','talvez','também','tampoco',
          'tanta','tantas','tanto','tantos','te','tem','temos','tendo','tenha','tenham','tenho','ter','terá','terão','teria','teu','teus',
          'teve','ti','tinha','tinham','tive','tiveram','toda','todas','todavia','todo','todos','tu','tua','tuas','tudo','um','uma',
          'umas','uns','vendo','ver','vez','você','vocês','olá','oi','opa','kkk','kkkk'
        ]);

        // Inversor gramatical de persona (1ra persona del cliente -> 2da persona para el operador)
        const invertPronouns = (phrase, targetLang) => {
          if (!phrase) return '';
          const mapEn = {
            'my': 'your', 'My': 'your', 'me': 'you', 'Me': 'you',
            'mine': 'yours', 'Mine': 'yours', 'myself': 'yourself', 'Myself': 'yourself',
            'i': 'you', 'I': 'you', "i'm": "you're", "I'm": "you're",
            'am': 'are', 'was': 'were', 'we': 'you', 'our': 'your', 'ours': 'yours'
          };
          const mapEs = {
            'mi': 'tu', 'Mi': 'tu', 'mis': 'tus', 'Mis': 'tus',
            'conmigo': 'contigo', 'Conmigo': 'contigo', 'me': 'te', 'Me': 'te',
            'mio': 'tuyo', 'mío': 'tuyo', 'mia': 'tuya', 'mía': 'tuya',
            'yo': 'tú', 'Yo': 'tú', 'estoy': 'estás', 'estaba': 'estabas',
            'fui': 'fuiste', 'tuve': 'tuviste'
          };
          const mapPt = {
            'meu': 'seu', 'Meu': 'seu', 'meus': 'seus', 'Meus': 'seus',
            'minha': 'sua', 'Minha': 'sua', 'minhas': 'suas', 'Minhas': 'suas',
            'comigo': 'com você', 'Comigo': 'com você', 'me': 'te', 'Me': 'te',
            'eu': 'você', 'Eu': 'você', 'estou': 'está', 'estava': 'estava', 'tive': 'teve'
          };
          const selMap = targetLang === 'pt' ? mapPt : (targetLang === 'es' ? mapEs : mapEn);
          return phrase.split(/(\s+|[.,!?;:])/).map(tok => {
            const lower = tok.toLowerCase();
            if (selMap[tok]) return selMap[tok];
            if (selMap[lower]) return selMap[lower];
            return tok;
          }).join('');
        };

        // --- 3. CONVERSATION CONTEXT BUILDER ---
        const rawInput = (clientText || '').trim();
        const clientHistory = (msgsHistory || []).filter(m => !m.isOperator && m.text).map(m => m.text.trim());
        const letterCount = (lettersHistory || []).length;

        let effectiveText = rawInput;
        const wordCount = rawInput ? rawInput.split(/\s+/).length : 0;
        if (wordCount < 3 && clientHistory.length > 0) {
          const fallbackMsg = [...clientHistory].reverse().find(t => t.split(/\s+/).length >= 3) || clientHistory[clientHistory.length - 1];
          if (fallbackMsg) {
            effectiveText = fallbackMsg;
          }
        }

        const isColdStart = !effectiveText && clientHistory.length === 0 && letterCount === 0;
        const textLower = (effectiveText || '').toLowerCase().trim();

        // --- 4. KEYWORD & INTENT EXTRACTION ENGINE ---
        // Preguntas del cliente
        const isQuestion = /\?|^(what|how|where|when|why|who|are you|do you|can you|did you|have you|c[oó]mo|qu[eé]|d[oó]nde|cu[aá]ndo|por qu[eé]|vc|voc[eê]|tá|est[aá]s|onde|quem|qual)\b/i.test(effectiveText);
        let questionType = null;
        if (isQuestion) {
          if (/\b(what are you doing|what('re| are) you up to|what you up to|qu[eé] haces|qu[eé] est[aá]s haciendo|que est[aá]s haciendo|o que est[aá] fazendo|o que voc[eê] est[aá] fazendo|t[aá] fazendo o que|fazendo o q)\b/i.test(textLower)) {
            questionType = 'doing_now';
          } else if (/\b(how are you|how('s| is) your day|how was your day|how you doing|c[oó]mo est[aá]s|c[oó]mo te va|c[oó]mo va tu d[ií]a|como foi seu dia|como voc[eê] est[aá]|tudo bem|tudo bom)\b/i.test(textLower)) {
            questionType = 'how_are_you';
          } else if (/\b(where are you from|where do you live|where are you located|de d[oó]nde eres|d[oó]nde vives|de d[oó]nde sos|de onde voc[eê] [eé]|onde voc[eê] mora|de qual cidade)\b/i.test(textLower)) {
            questionType = 'where_from';
          } else if (/\b(do you like|are you|have you ever|what do you think|te gusta|eres|has estado|qu[eé] opinas|voc[eê] gosta|voc[eê] [eé]|j[aá] foi|o que voc[eê] acha)\b/i.test(textLower)) {
            questionType = 'about_me';
          } else {
            questionType = 'general_question';
          }
        }

        // Intenciones temáticas
        const isBedtime = /\b(bed|bedtime|goodnight|good night|nighty|sleep|sleeping|sleepy|going to bed|head to bed|turn in|cama|dormir|sue[ñn]o|descanso|a la cama|buenas noches|descansar|dormindo|deitar|boas noites|boa noite)\b/i.test(textLower);
        const isExhausted = /\b(tired|exhausted|burnout|burned out|overwhelmed|drained|hectic|long day|rough day|heavy day|hard day|cansad[oa]|agotad[oa]|estresad[oa]|drenad[oa]|pesad[oa]|agobiad[oa]|reventad[oa]|exaust[oa]|esgotad[oa]|morto de sono|puxad[oa])\b/i.test(textLower);
        const isWork = /\b(work|working|job|office|boss|shift|meeting|deadline|coworker|colleague|client|project|interview|trabaj[oa]|chamba|oficina|jefe|jefa|turno|reuni[oó]n|proyecto|trabalh[oa]|trampo|escrit[oó]rio|chefe|plant[aã]o)\b/i.test(textLower);
        const isFood = /\b(cook|cooking|dinner|lunch|breakfast|coffee|tea|wine|beer|pizza|pasta|food|eat|eating|meal|kitchen|recipe|cena|cenar|almuerzo|almorzar|desayuno|cocina|cocinar|comida|vino|cerveza|jantar|almoço|café|chá|cerveja|churrasco)\b/i.test(textLower);
        const isPets = /\b(dog|puppy|puppies|cat|kitten|pet|pets|perr[oa]|perrit[oa]|gat[oa]|gatit[oa]|mascota|mascotas|cachorr[oa]|cachorrinh[oa]|c[aã]o|bichinho)\b/i.test(textLower);
        const isFamily = /\b(kid|kids|child|children|son|daughter|baby|babies|mom|dad|family|hijo|hija|hijos|niñ[oa]|niñ[oa]s|beb[eé]|familia|filho|filha|filhos|criança|crianças|família|mãe|pai)\b/i.test(textLower);
        const isSick = /\b(sick|ill|headache|migraine|fever|flu|pain|medicine|pill|hospital|doctor|dolor|cabeza|migraña|fiebre|gripe|enferm[oa]|remedio|medicina|m[eé]dico|doente|dor|febre|rem[eé]dio)\b/i.test(textLower);

        // Extracción de frases clave de estrés o actividad
        let specificStress = '';
        let specificActivity = '';
        let topicNoun = '';

        if (isExhausted || isWork) {
          const bossMatch = effectiveText.match(/(?:my\s+|mi\s+|meu\s+)?(?:boss|jefe|jefa|chefe)\s+(?:was|is|estuvo|está|pegou|foi)\s+([^,.!?]+)/i);
          if (bossMatch && bossMatch[1]) {
            specificStress = invertPronouns(bossMatch[0].trim(), lang);
          } else {
            const tiredFromMatch = effectiveText.match(/(?:tired|exhausted|drained|cansad[oa]|agotad[oa]|exaust[oa])\s+(?:from|after|of|de|por|com)\s+([^,.!?]+)/i);
            if (tiredFromMatch && tiredFromMatch[1]) {
              specificStress = invertPronouns(tiredFromMatch[1].trim(), lang);
            }
          }
        }

        const actionMatch = effectiveText.match(/(?:finished|just\s+finished|am|was|been|acabo\s+de|terminé\s+de|estuve|estoy|acabei\s+de|terminei\s+de|estive|passei\s+o\s+dia|passei\s+a\s+tarde)\s+([^,.!?]{4,40})/i);
        if (actionMatch && actionMatch[1]) {
          specificActivity = invertPronouns(actionMatch[1].trim(), lang);
        }

        // Extracción de sustantivos salientes
        const activeStopwords = lang === 'pt' ? STOPWORDS_PT : (lang === 'es' ? STOPWORDS_ES : STOPWORDS_EN);
        const rawWords = (effectiveText || '').toLowerCase().replace(/[^a-zA-ZáéíóúñÁÉÍÓÚÑàèìòùãõçÀÈÌÒÙÃÕÇ\s]/g, ' ').split(/\s+/).filter(w => w.length >= 3 && !activeStopwords.has(w));
        if (rawWords.length > 0) {
          topicNoun = rawWords[rawWords.length - 1];
        }

        let dynamicTopicRef = '';
        if (specificStress) {
          dynamicTopicRef = specificStress;
        } else if (specificActivity) {
          dynamicTopicRef = specificActivity;
        } else if (topicNoun) {
          dynamicTopicRef = lang === 'en' ? `your ${topicNoun}` : `${topicNoun}`;
        } else {
          dynamicTopicRef = lang === 'pt' ? 'o seu dia' : (lang === 'es' ? 'tu día' : 'your day');
        }

        // --- 5. DYNAMIC RESPONSE COMPOSITOR ---
        // CASO A: COLD START
        if (isColdStart) {
          if (lang === 'pt') {
            return [
              {
                title: '💬 Contextual & Empatia',
                target: `Olá ${clientShort}! Estava vendo seu perfil e quis passar para te dar um oi com muito carinho ✨ Como está sendo a sua semana até agora?`,
                es: `Abertura calorosa mencionando seu nome e convidando a contar como está a semana.`
              },
              {
                title: '✨ Descontraído & Curioso',
                target: `Oi ${clientShort}! Espero que seu dia esteja sendo bem leve 😉 Me deu curiosidade: o que você mais gosta de fazer quando tem um tempinho livre só seu?`,
                es: `Tom leve e descontraído que desperta interesse sobre seus hobbies favoritos.`
              },
              {
                title: '❤️ Conexão & Proximidade',
                target: `Olá ${clientShort}... Muito bom poder trocar uma ideia com você por aqui ❤️ Me conta, qual foi a coisa mais legal ou divertida que te aconteceu hoje?`,
                es: `Abordagem mais doce e conectiva focada em pensamentos positivos do dia.`
              }
            ];
          } else if (lang === 'es') {
            return [
              {
                title: '💬 Contextual & Empatía',
                target: `¡Hola ${clientShort}! Estuve viendo tu perfil y no quise dejar pasar el día sin pasar a darte un saludo sincero ✨ ¿Cómo te ha estado tratando la semana?`,
                es: `Apertura cálida y humana que nombra al cliente y le pregunta por su semana.`
              },
              {
                title: '✨ Chispa & Curiosidad',
                target: `¡Hola ${clientShort}! Espero que tu día venga con buena vibra 😉 Me dio curiosidad saber de ti: ¿qué es lo que más disfrutas hacer cuando tienes un ratito libre?`,
                es: `Pregunta fresca de estilo de vida sin sonar a plantilla ni presionar.`
              },
              {
                title: '❤️ Conexión & Cercanía',
                target: `Hola ${clientShort}... Qué lindo coincidir contigo por aquí ❤️ Cuéntame, ¿qué fue lo mejor o más entretenido que te pasó en el día de hoy?`,
                es: `Aproximación dulce y personal que invita a compartir momentos alegres.`
              }
            ];
          } else {
            return [
              {
                title: '💬 Contextual & Empathetic',
                target: `Hello ${clientShort}! I came across your profile and thought I'd stop by to say a genuine hello ✨ How has your week been treating you so far?`,
                es: `Apertura cálida y natural mencionando su nombre y preguntando por su semana.`
              },
              {
                title: '✨ Playful & Curious',
                target: `Hey ${clientShort}! Hope your day is going great 😉 Tell me, what's your absolute favorite way to unwind when you have some time just for yourself?`,
                es: `Tono fresco y espontáneo sobre sus pasatiempos favoritos sin sonar a bot.`
              },
              {
                title: '❤️ Personal & Intimate',
                target: `Hi ${clientShort}... It's really lovely to cross paths with you on here ❤️ Tell me, what was one fun highlight from your day today?`,
                es: `Mensaje dulce y personal invitando a compartir momentos agradables del día.`
              }
            ];
          }
        }

        // CASO B: BEDTIME / GOODNIGHT
        if (isBedtime) {
          if (lang === 'pt') {
            return [
              {
                title: '💬 Contextual & Empatia',
                target: `Durma muito bem, ${clientShort}! Você teve um dia cheio com ${dynamicTopicRef}, então merece um descanso daqueles bem restauradores ❤️ Me dá um bom dia amanhã quando acordar?`,
                es: `Valida seu dia cansativo, deseja bom descanso e deixa gancho para amanhã.`
              },
              {
                title: '✨ Descontraído & Curioso',
                target: `Indo para a cama já, ${clientShort}? 😉 Tratando de desligar a cabeça e recarregar a bateria! Promete que vai sonhar com coisas boas hoje?`,
                es: `Tom brincalhão sobre a hora de dormir com gancho leve e carinhoso.`
              },
              {
                title: '❤️ Conexão & Proximidade',
                target: `Boa noite, ${clientShort}... Espero que você tenha uma noite deliciosa e acorde com as energias renovadas ✨ Vou ficar pensando em você. Descanse muito bem!`,
                es: `Mensagem doce e íntima de despedida noturna para fortalecer o vínculo.`
              }
            ];
          } else if (lang === 'es') {
            return [
              {
                title: '💬 Contextual & Empatía',
                target: `¡Que descanses delicioso, ${clientShort}! Tuviste un día largo con ${dynamicTopicRef}, así que te mereces el sueño más reparador de todos ❤️ ¿Me avisas mañana cuando despiertes?`,
                es: `Reconoce su cansancio, le desea un descanso reparador y pide saludo matutino.`
              },
              {
                title: '✨ Chispa & Curiosidad',
                target: `¿A dormir tan temprano, ${clientShort}? 😉 Es broma, ¡a recargar pilas al 100%! Prométeme que vas a soñar algo lindo esta noche ✨`,
                es: `Broma simpática sobre ir a la cama con deseo positivo y chispa.`
              },
              {
                title: '❤️ Conexión & Cercanía',
                target: `Buenas noches, ${clientShort}... Deseo de corazón que duermas tranquilo y descanses como te lo mereces ❤️ Me voy a quedar pensando en ti. ¡Dulces sueños!`,
                es: `Despedida íntima y afectuosa para ir a dormir dejando una huella emocional.`
              }
            ];
          } else {
            return [
              {
                title: '💬 Contextual & Empathetic',
                target: `Rest up so well, ${clientShort}! After everything with ${dynamicTopicRef}, you definitely earned the deepest sleep tonight ❤️ Let me know how you slept when you wake up tomorrow!`,
                es: `Valida su día y cansancio, deseando sueño reparador y saludo mañana.`
              },
              {
                title: '✨ Playful & Curious',
                target: `Heading off to dreamland already, ${clientShort}? 😉 Go recharge those batteries! Promise you'll say hi tomorrow when you're back on your feet?`,
                es: `Broma ligera sobre recargar baterías y gancho para retomar mañana.`
              },
              {
                title: '❤️ Personal & Intimate',
                target: `Sweet dreams, ${clientShort}... I hope you drift off comfortably and wake up feeling wonderful ✨ I'll be thinking about you tonight. Sleep gently!`,
                es: `Cierre íntimo y dulce para dejar una sensación de abrigo y ternura.`
              }
            ];
          }
        }

        // CASO C: CLIENTE PREGUNTA
        if (isQuestion && questionType) {
          if (questionType === 'doing_now') {
            if (lang === 'pt') {
              return [
                {
                  title: '💬 Contextual & Empatia',
                  target: `Eu estava aqui tirando um tempinho calmo para relaxar e adorei ver sua mensagem, ${clientShort} ❤️ Meu dia foi tranquilo. E você, finalmente conseguindo descansar agora?`,
                  es: `Responde que estaba relajándose y le pregunta si él ya puede descansar.`
                },
                {
                  title: '✨ Descontraído & Curioso',
                  target: `Me pegou no flagra! Eu estava justamente pensando no que você estaria aprontando agora, ${clientShort} 😉 Minha noite ficou bem mais animada agora. O que você está fazendo de bom por aí?`,
                  es: `Tono juguetón diciendo que pensaba en él y pregunta qué hace él.`
                },
                {
                  title: '❤️ Conexão & Proximidade',
                  target: `Estou aqui deitadinha, curtindo o silêncio e agora com um sorriso bobo conversando com você, ${clientShort} ✨ Como está o seu cantinho e o seu clima por aí agora?`,
                  es: `Respuesta íntima y acogedora describiendo su momento y preguntando por su ambiente.`
                }
              ];
            } else if (lang === 'es') {
              return [
                {
                  title: '💬 Contextual & Empatía',
                  target: `Estaba tomándome un momento tranquilo para relajarme y me dio mucha alegría ver tu mensaje, ${clientShort} ❤️ Mi día estuvo tranquilo. ¿Y tú, ya lograste poner los pies en alto para descansar?`,
                  es: `Responde con calidez sobre su momento de descanso y le pregunta si ya descansa.`
                },
                {
                  title: '✨ Chispa & Curiosidad',
                  target: `¡Me atrapaste justo pensando en qué estarías haciendo tú, ${clientShort}! 😉 Estaba aquí con mi teléfono, pero ahora se puso mucho mejor la noche. ¿Qué travesuras andas haciendo tú?`,
                  es: `Respuesta traviesa y espontánea devolviendo la pregunta con picardía.`
                },
                {
                  title: '❤️ Conexión & Cercanía',
                  target: `Aquí descansando en casa, poniéndome cómoda y sintiéndome mucho más acompañada ahora que me escribes, ${clientShort} ✨ ¿Cómo se siente tu noche en este momento?`,
                  es: `Respuesta íntima que genera complicidad y calidez en el chat.`
                }
              ];
            } else {
              return [
                {
                  title: '💬 Contextual & Empathetic',
                  target: `I was just taking a quiet moment to unwind, and seeing your message pop up brought a big smile, ${clientShort} ❤️ My day has been calm. Are you finally getting some downtime for yourself too?`,
                  es: `Responde con naturalidad que estaba descansando y pregunta por su noche.`
                },
                {
                  title: '✨ Playful & Curious',
                  target: `Busted! Right now I was actually wondering what you were getting up to, ${clientShort} 😉 Just lounging here, but chatting with you makes everything way more fun! What are you doing at this exact moment?`,
                  es: `Respuesta traviesa y juguetona diciendo que pensaba en él.`
                },
                {
                  title: '❤️ Personal & Intimate',
                  target: `Just getting cozy at home and enjoying having you here with me right now, ${clientShort} ✨ There's something so peaceful about our chats. What does your evening look like right now?`,
                  es: `Respuesta cercana e íntima compartiendo un momento acogedor.`
                }
              ];
            }
          } else if (questionType === 'how_are_you') {
            if (lang === 'pt') {
              return [
                {
                  title: '💬 Contextual & Empatia',
                  target: `Estou super bem, muito obrigada pelo carinho de perguntar, ${clientShort}! ❤️ Meu dia foi tranquilo, mas falar com você sempre deixa as coisas mais leves. E para você, como foi o resto do seu dia?`,
                  es: `Agradece a pergunta com carinho e devolve o interesse sobre o dia dele.`
                },
                {
                  title: '✨ Descontraído & Curioso',
                  target: `Agora estou muito melhor com a sua mensagem, ${clientShort}! 😉 Meu dia teve de tudo um pouco, mas agora estou 100% relaxada. O que de mais interessante aconteceu no seu dia?`,
                  es: `Elogio divertido dizendo que ficou melhor com a mensagem dele.`
                },
                {
                  title: '❤️ Conexão & Proximidade',
                  target: `Estou ótima, e é tão bom sentir essa sua atenção comigo, ${clientShort} ✨ Estava aqui refletindo sobre as coisas boas da vida e você apareceu. Me conta, como está o seu coração hoje?`,
                  es: `Tom profundo e afetuoso valorizando o cuidado mútuo.`
                }
              ];
            } else if (lang === 'es') {
              return [
                {
                  title: '💬 Contextual & Empatía',
                  target: `¡Muy bien, muchas gracias por preguntar tan lindo, ${clientShort}! ❤️ Mi día estuvo tranquilo, pero tenerte por aquí siempre me alegra la tarde. ¿Cómo terminó de irte a ti hoy?`,
                  es: `Agradece con afecto su pregunta y se interesa por cómo terminó su día.`
                },
                {
                  title: '✨ Chispa & Curiosidad',
                  target: `¡Pues ahora que me escribiste estoy muchísimo mejor, ${clientShort}! 😉 Mi día estuvo entretenido, pero platicar contigo es la mejor parte. ¿Qué fue lo más loco o divertido que te pasó hoy?`,
                  es: `Respuesta coqueta y alegre que dinamiza la charla.`
                },
                {
                  title: '❤️ Conexión & Cercanía',
                  target: `Estoy con el corazón contento y muy en paz, ${clientShort} ✨ Me encanta que siempre tengas ese detalle de estar pendiente de mí. Cuéntame, ¿cómo te sientes por dentro hoy?`,
                  es: `Apertura emocional profunda y agradecida sobre el estado interior.`
                }
              ];
            } else {
              return [
                {
                  title: '💬 Contextual & Empathetic',
                  target: `I'm doing really well, thank you so much for asking, ${clientShort}! ❤️ My day was pretty smooth, but hearing from you always brightens it up. How has everything been treating you today?`,
                  es: `Agradece con afecto y pregunta por cómo le ha ido a él hoy.`
                },
                {
                  title: '✨ Playful & Curious',
                  target: `Honestly, way better now that I see you popping into my notifications, ${clientShort}! 😉 My day was good, but this is the fun part. What was the wildest or best moment of your day?`,
                  es: `Halago alegre diciendo que hablar con él es la mejor parte de su día.`
                },
                {
                  title: '❤️ Personal & Intimate',
                  target: `I'm feeling very peaceful tonight, ${clientShort} ✨ There's such a gentle warmth whenever we connect like this. Tell me, how are you really feeling deep down today?`,
                  es: `Conexión íntima y sincera preguntando por cómo se siente en el fondo.`
                }
              ];
            }
          }
        }

        // CASO D: CANSANCIO / AGOBIO / TRABAJO / JEFE (Mental test scenario)
        if (isExhausted || (isWork && (textLower.includes('hard') || textLower.includes('tired') || textLower.includes('stress') || textLower.includes('pesad') || textLower.includes('cansad') || textLower.includes('puxad')))) {
          if (lang === 'pt') {
            const workRef = specificStress || 'o trabalho e essa correria toda';
            return [
              {
                title: '💬 Contextual & Empatia',
                target: `Nossa, isso parece ter sido tão desgastante, ${clientShort}... Encarar ${workRef} quando a gente já está no limite suga qualquer energia ❤️ Você realmente merece colocar os pés para cima agora. O que te ajudaria a relaxar a cabeça neste momento?`,
                es: `Valida seu cansaço com o trabalho/chefe com muita empatia e pergunta como relaxar.`
              },
              {
                title: '✨ Descontraído & Curioso',
                target: `Assunto de trabalho e estresse está oficialmente censurado por hoje, ${clientShort}! 😉 Sobreviver a ${workRef} já te dá direito a uma medalha de honra. Se você pudesse sumir para qualquer lugar relaxante agora, para onde a gente iria?`,
                es: `Broma divertida sobre proibir o estresse e pergunta imaginativa sobre fugir da rotina.`
              },
              {
                title: '❤️ Conexão & Proximidade',
                target: `Não gosto nada de saber que ${workRef} te deixou tão acabado hoje, ${clientShort}... Se eu estivesse aí do seu lado, cuidaria de você para não ter que se preocupar com nada ✨ Me conta, qual é o seu refúgio favorito quando precisa de paz?`,
                es: `Afeto profundo querendo cuidar dele e pergunta íntima sobre o que traz paz.`
              }
            ];
          } else if (lang === 'es') {
            const workRef = specificStress || 'el trabajo y toda esa presión';
            return [
              {
                title: '💬 Contextual & Empatía',
                target: `Uff, eso suena súper desgastante, ${clientShort}... Lidiar con ${workRef} cuando ya vienes agotado de verdad cansa el cuerpo y la mente ❤️ Te mereces soltar todo y darte un gran respiro. ¿Qué es lo que más te ayudaría a desconectar en este momento?`,
                es: `Valida con empatía profunda su día difícil en el trabajo y pregunta cómo desconectar.`
              },
              {
                title: '✨ Chispa & Curiosidad',
                target: `¡Queda oficialmente prohibido hablar de trabajo y estrés por el resto de la noche, ${clientShort}! 😉 Sobrevivir a ${workRef} hoy te hace merecedor de un premio. Si tuvieras un botón mágico para teletransportarte lejos de todo, ¿a dónde nos iríamos?`,
                es: `Tono juguetón bromeando sobre sobrevivir al día pesado para despejar su mente.`
              },
              {
                title: '❤️ Conexión & Cercanía',
                target: `Me da mucha tristeza saber que ${workRef} te drenó tanto la energía hoy, ${clientShort}... Si estuviera ahí contigo, te prepararía algo caliente y no dejaría que muevas un solo dedo ✨ Dime, ¿qué es lo que más tranquilidad te da cuando el día estuvo tan pesado?`,
                es: `Muestra calidez y deseo de consentirlo, preguntando qué le da paz.`
              }
            ];
          } else {
            const workRef = specificStress || 'work and all that pressure';
            return [
              {
                title: '💬 Contextual & Empathetic',
                target: `Ugh, that sounds so rough, ${clientShort}... Dealing with ${workRef} when you're already exhausted really takes a heavy toll ❤️ You honestly deserve to put everything on pause and just breathe. What would help you relax the most right now?`,
                es: `Valida su cansancio por la presión laboral con empatía sincera y pregunta cómo relajarse.`
              },
              {
                title: '✨ Playful & Curious',
                target: `Work drama is officially cancelled for the rest of the night, ${clientShort}! 😉 Surviving ${workRef} today definitely qualifies you for an award. If you could hit a giant snooze button on reality right now, where would we disappear to?`,
                es: `Broma fresca sobre cancelar el estrés laboral y pregunta lúdica para cambiar el ánimo.`
              },
              {
                title: '❤️ Personal & Intimate',
                target: `I hate hearing that ${workRef} drained you so much today, ${clientShort}... If I were there with you, I'd make you a cozy drink and make sure nobody bothered you ✨ Tell me, what's your go-to comfort when you've had a tough day?`,
                es: `Conexión íntima y protectora deseando cuidarlo tras un día pesado.`
              }
            ];
          }
        }

        // CASO E: COMIDA / COCINAR / CENAR
        if (isFood) {
          const foodRef = specificActivity || dynamicTopicRef || (lang === 'pt' ? 'a comida' : (lang === 'es' ? 'la comida' : 'dinner'));
          if (lang === 'pt') {
            return [
              {
                title: '💬 Contextual & Empatia',
                target: `Que delícia, ${clientShort}! Tirar um tempo para curtir ${foodRef} é uma das melhores coisas para fechar bem o dia ❤️ Como ficou tudo? O que você preparou de especial?`,
                es: `Valida o prazer da comida/jantar e pergunta detalhes do que cozinhou.`
              },
              {
                title: '✨ Descontraído & Curioso',
                target: `Opa, agora você me deu uma fome daquelas falando de ${foodRef}, ${clientShort}! 😉 Espero que tenha guardado um prato para mim... Você é do tipo masterchef ou cozinha no improviso gostoso?`,
                es: `Brincadeira simpática dizendo que ficou com fome e perguntando seus talentos culinários.`
              },
              {
                title: '❤️ Conexão & Proximidade',
                target: `Acho tão atraente quem valoriza esses momentos com ${foodRef}, ${clientShort}... Fiquei aqui imaginando como seria gostoso cozinhar e rir juntos na cozinha ✨ Qual é a sua refeição favorita para uma noite tranquila?`,
                es: `Comentário doce e envolvente imaginando momentos a dois na cozinha.`
              }
            ];
          } else if (lang === 'es') {
            return [
              {
                title: '💬 Contextual & Empatía',
                target: `¡Qué delicia, ${clientShort}! Dedicarle tiempo a ${foodRef} es de las cosas más reconfortantes que hay después de un día ocupado ❤️ ¿Cómo te quedó todo? ¿Qué preparaste de rico esta noche?`,
                es: `Valida el gusto de cocinar o cenar rico y pregunta por su receta.`
              },
              {
                title: '✨ Chispa & Curiosidad',
                target: `¡Oye, ya me dio un antojo tremendo al leer sobre ${foodRef}, ${clientShort}! 😉 Espero que me hayas guardado una buena porción... ¿Te consideras todo un chef o improvisas con estilo?`,
                es: `Tono juguetón bromeando con que le dio antojo y preguntando si es buen cocinero.`
              },
              {
                title: '❤️ Conexión & Cercanía',
                target: `Me encanta alguien que disfruta tanto de ${foodRef}, ${clientShort}... Me quedé imaginando lo lindo que sería compartir esa mesa y una charla larga contigo ✨ ¿Cuál es tu plato favorito para una noche especial?`,
                es: `Mensaje dulce y seductor imaginando una velada juntos en la mesa.`
              }
            ];
          } else {
            return [
              {
                title: '💬 Contextual & Empathetic',
                target: `That sounds so lovely, ${clientShort}! Taking the time for ${foodRef} is honestly the best way to treat yourself after a long day ❤️ How did it turn out? What was on the menu tonight?`,
                es: `Valida el momento culinario y pregunta amablemente qué preparó.`
              },
              {
                title: '✨ Playful & Curious',
                target: `Now you're seriously making me hungry talking about ${foodRef}, ${clientShort}! 😉 I hope you made enough to share, because I might just invite myself over! Tell me—are you secretly a master chef or just winging it with style?`,
                es: `Broma divertida diciendo que se le antojó y preguntando si es buen chef.`
              },
              {
                title: '❤️ Personal & Intimate',
                target: `I have such a sweet spot for someone who appreciates ${foodRef}, ${clientShort}... It made me picture how cozy it would be to cook and laugh in the kitchen together ✨ What's your absolute favorite meal to share on a quiet evening?`,
                es: `Muestra intimidad y encanto proyectando un momento compartido en la cocina.`
              }
            ];
          }
        }

        // CASO F: MASCOTAS / ANIMALES
        if (isPets) {
          const petRef = specificActivity || dynamicTopicRef || (lang === 'pt' ? 'seu bichinho' : (lang === 'es' ? 'tu mascota' : 'your pet'));
          if (lang === 'pt') {
            return [
              {
                title: '💬 Contextual & Empatia',
                target: `Que fofura sem tamanho, ${clientShort}! Passar esse tempo com ${petRef} renova qualquer energia ❤️ Os bichinhos têm um amor tão puro... Qual é o nome do seu parceirinho de quatro patas?`,
                es: `Comenta com carinho sobre o animal de estimação e pergunta o nome dele.`
              },
              {
                title: '✨ Descontraído & Curioso',
                target: `Aposto que ${petRef} te fez correr o dia todo, ${clientShort}! 😉 Quem cansou primeiro: você ou ele? Me diz a verdade: ele é comportadinho ou apronta todas?`,
                es: `Broma simpática sobre a energia do bichinho e pergunta se é comportado.`
              },
              {
                title: '❤️ Conexão & Proximidade',
                target: `Amo pessoas que têm esse carinho todo com ${petRef}, ${clientShort}... Isso mostra a nobreza e a doçura do seu coração ✨ Adoraria fazer companhia para vocês dois num passeio desses! Ele é muito apegado a você?`,
                es: `Elogio sincero aos seus sentimentos pelos animais com toque carinhoso.`
              }
            ];
          } else if (lang === 'es') {
            return [
              {
                title: '💬 Contextual & Empatía',
                target: `¡Qué ternura más linda, ${clientShort}! Dedicarle tiempo a ${petRef} siempre le reinicia el ánimo a cualquiera ❤️ Los animalitos transmiten una paz increíble... ¿Cómo se llama tu consentido?`,
                es: `Valida con calidez su amor por su mascota y le pregunta su nombre.`
              },
              {
                title: '✨ Chispa & Curiosidad',
                target: `¡Seguro que ${petRef} te tiene corriendo de un lado a otro todo el día, ${clientShort}! 😉 ¿Quién es el verdadero consentido de la casa? Dime la verdad: ¿es un ángel o un torbellino travieso?`,
                es: `Tono fresco y espontáneo sobre las travesuras de la mascota.`
              },
              {
                title: '❤️ Conexión & Cercanía',
                target: `Tengo una debilidad hermosa por las personas que aman tanto a ${petRef}, ${clientShort}... Dice mucho de la nobleza de tu corazón ✨ Me encantaría acompañarlos a dar una vuelta algún día. ¿Es muy celoso o es sociable contigo?`,
                es: `Elogio afectuoso que valora su buen corazón y abre espacio a una charla dulce.`
              }
            ];
          } else {
            return [
              {
                title: '💬 Contextual & Empathetic',
                target: `That is the sweetest thing, ${clientShort}! Spending time with ${petRef} is honestly the best therapy in the world ❤️ Animals just know how to bring so much pure joy. What adventures did you two get up to today?`,
                es: `Valida con afecto el tiempo con su mascota y pregunta por su día juntos.`
              },
              {
                title: '✨ Playful & Curious',
                target: `I'm pretty sure ${petRef} has you completely wrapped around their little paws, ${clientShort}! 😉 Who actually runs the house over there? Tell me the truth—are they an angel or a little mischief-maker?`,
                es: `Broma divertida sobre quién manda en casa con la mascota.`
              },
              {
                title: '❤️ Personal & Intimate',
                target: `I have such a soft spot for people who show so much love to ${petRef}, ${clientShort}... It tells me so much about the warmth in your soul ✨ I'd love to tag along on a walk with you two sometime! Are you two basically inseparable?`,
                es: `Elogio íntimo a su gran corazón y deseo sutil de compartir ese momento.`
              }
            ];
          }
        }

        // CASO G: FAMILIA / HIJOS
        if (isFamily) {
          const famRef = specificActivity || dynamicTopicRef || (lang === 'pt' ? 'a família' : (lang === 'es' ? 'la familia' : 'your family'));
          if (lang === 'pt') {
            return [
              {
                title: '💬 Contextual & Empatia',
                target: `Que dedicação mais linda, ${clientShort}! Estar presente e cuidar de ${famRef} é a missão mais nobre do mundo ❤️ Sei que exige muito, mas dá para ver seu amor em cada detalhe. Quantos aninhos eles têm?`,
                es: `Valida com respeito e carinho a dedicação à família e pergunta a idade.`
              },
              {
                title: '✨ Descontraído & Curioso',
                target: `Aposto que ${famRef} te mantém a mil por hora o dia inteirinho, ${clientShort}! 😉 Não sobra um segundo de tédio, né? Qual foi a história ou pérola mais engraçada de hoje?`,
                es: `Comentário alegre sobre a energia das crianças/família e pergunta momentos divertidos.`
              },
              {
                title: '❤️ Conexão & Proximidade',
                target: `Admiro profundamente quem se entrega de coração a ${famRef}, ${clientShort}... Mostra o tamanho do seu caráter e do seu amor ✨ Eles puxaram mais o seu jeitinho carinhoso ou a sua personalidade?`,
                es: `Elogio sincero aos valores familiares e pergunta envolvente sobre semelhanças.`
              }
            ];
          } else if (lang === 'es') {
            return [
              {
                title: '💬 Contextual & Empatía',
                target: `¡Qué labor tan hermosa y llena de amor, ${clientShort}! Cuidar y estar para ${famRef} es lo más valioso de la vida ❤️ Aunque canse, seguro te llena el alma por completo. ¿Cuántos añitos tienen tus pequeños?`,
                es: `Valida con profunda admiración su rol familiar y le pregunta la edad de sus hijos.`
              },
              {
                title: '✨ Chispa & Curiosidad',
                target: `¡Seguro que ${famRef} te hace dar mil vueltas al día sin parar, ${clientShort}! 😉 ¡No hay tiempo para aburrirse con ellos! Cuéntame, ¿qué ocurrencia divertida te sacó una risa hoy?`,
                es: `Tono amigable y chispeante sobre la energía de los niños pidiendo una anécdota.`
              },
              {
                title: '❤️ Conexión & Cercanía',
                target: `Admiro muchísimo a las personas tan entregadas y cariñosas con ${famRef}, ${clientShort}... Habla de la nobleza tan bonita que tienes dentro ✨ ¿Sientes que se parecen más a ti en tu forma de ser o en tu energía?`,
                es: `Elogio cálido a sus valores familiares y pregunta sobre a quién se parecen.`
              }
            ];
          } else {
            return [
              {
                title: '💬 Contextual & Empathetic',
                target: `That is so heartwarming, ${clientShort}! Being so devoted to ${famRef} is truly the most selfless and beautiful thing in the world ❤️ It takes so much energy, but your love shines through. How old are they now?`,
                es: `Valida con calidez su entrega a sus hijos/familia y pregunta la edad.`
              },
              {
                title: '✨ Playful & Curious',
                target: `I bet they keep you running circles all day long, ${clientShort}! 😉 Never a dull moment in that house, right? What was the funniest thing they said or did today?`,
                es: `Tono lúdico sobre la energía de los niños y pide una anécdota divertida.`
              },
              {
                title: '❤️ Personal & Intimate',
                target: `Seeing how devoted you are to ${famRef} is honestly one of the most attractive things about you, ${clientShort}... Having a caring heart like yours is so rare ✨ Do you feel like they took after your personality?`,
                es: `Elogio profundo a sus valores y sensibilidad familiar con pregunta íntima.`
              }
            ];
          }
        }

        // CASO H: SALUD / MALESTAR
        if (isSick) {
          const sickRef = dynamicTopicRef || (lang === 'pt' ? 'esse mal-estar' : (lang === 'es' ? 'ese malestar' : 'not feeling well'));
          if (lang === 'pt') {
            return [
              {
                title: '💬 Contextual & Empatia',
                target: `Poxa, sinto muito que você esteja passando por ${sickRef}, ${clientShort}... Ficar assim derruba qualquer um ❤️ Por favor, tire o pé do acelerador e descanse. Está conseguindo tomar algum remédio e se cuidar direitinho?`,
                es: `Valida com carinho seu mal-estar ou dor e pergunta se está se medicando.`
              },
              {
                title: '✨ Descontraído & Curioso',
                target: `Nada de bancar o herói hoje, ${clientShort}! 😉 Quando o corpo pede pausa por conta de ${sickRef}, a gente obedece. Tem alguém aí por perto te mimando com sopa ou chazinho?`,
                es: `Tom descontraído aconselhando a descansar e perguntando se tem alguém cuidando dele.`
              },
              {
                title: '❤️ Conexão & Proximidade',
                target: `Queria tanto estar aí pertinho para cuidar de você e te preparar algo quentinho, ${clientShort}... Odeio te ver mal com ${sickRef} ✨ Promete que vai fechar os olhos e descansar um pouquinho agora?`,
                es: `Mensagem doce e protetora desejando cuidar dele e pedindo para descansar.`
              }
            ];
          } else if (lang === 'es') {
            return [
              {
                title: '💬 Contextual & Empatía',
                target: `Ay no, me da mucha pena que estés pasando por ${sickRef}, ${clientShort}... Sentirse así le quita el ánimo a cualquiera ❤️ Por favor no te sobreexijas y guarda reposo. ¿Ya tomaste alguna medicina para calmarlo?`,
                es: `Muestra preocupación sincera por su salud y le pregunta si tomó medicina.`
              },
              {
                title: '✨ Chispa & Curiosidad',
                target: `¡Nada de querer hacerte el fuerte hoy, ${clientShort}! 😉 Con ${sickRef} lo único permitido es acostarse y dejarse consentir. ¿Tienes a alguien que te prepare un té caliente o te toca cuidarte solo?`,
                es: `Tono simpático recordándole guardar reposo y preguntando quién lo cuida.`
              },
              {
                title: '❤️ Conexión & Cercanía',
                target: `Cómo me gustaría estar ahí contigo para cuidarte y llevarte algo rico para que te recuperes, ${clientShort}... No me gusta nada saberte enfermito ❤️ ¿Qué es lo que más te alivia cuando te sientes así?`,
                es: `Afecto tierno y protector ofreciendo compañía emocional mientras se recupera.`
              }
            ];
          } else {
            return [
              {
                title: '💬 Contextual & Empathetic',
                target: `Oh no, I'm so sorry you're dealing with ${sickRef}, ${clientShort}... Being unwell completely drains you ❤️ Please put everything on hold and get some real rest. Have you been able to take any medicine for it?`,
                es: `Valida con afecto su dolor o enfermedad y pregunta si ya tomó algo.`
              },
              {
                title: '✨ Playful & Curious',
                target: `No being a hero today, ${clientShort}! 😉 When your body is dealing with ${sickRef}, rest is non-negotiable. Do you have someone looking after you with warm soup, or are you flying solo?`,
                es: `Broma cariñosa sobre no hacerse el fuerte y descansar.`
              },
              {
                title: '❤️ Personal & Intimate',
                target: `I really wish I could be there right now to take care of you and make you comfortable, ${clientShort}... I hate seeing you under the weather ✨ What's your favorite comfort when you're resting like this?`,
                es: `Mensaje tierno y protector deseando cuidar de él personalmente.`
              }
            ];
          }
        }

        // CASO I: COMPOSICIÓN DINÁMICA GENERAL CON TEMA EXTRAÍDO
        const topicContext = specificActivity || dynamicTopicRef;
        if (lang === 'pt') {
          return [
            {
              title: '💬 Contextual & Empatia',
              target: `Que bom você compartilhar sobre ${topicContext} comigo, ${clientShort}! Dá para ver o quanto esses momentos são importantes para você ❤️ Como foi o desfecho de tudo isso? Me conta mais!`,
              es: `Valida o tema compartilhado com atenção genuína e convida a detalhar mais.`
            },
            {
              title: '✨ Descontraído & Curioso',
              target: `Adorei saber sobre ${topicContext}, ${clientShort}! 😉 Você sempre traz uma energia tão leve para as nossas conversas... O que mais de divertido passou pela sua cabeça hoje?`,
              es: `Comentário alegre conectando com o assunto e puxando papo descontraído.`
            },
            {
              title: '❤️ Conexão & Proximidade',
              target: `É tão gostoso quando você me conta sobre ${topicContext}, ${clientShort}... Me sinto muito mais próxima e conectada a você ✨ O que você mais gosta de sentir quando está vivendo momentos assim?`,
              es: `Abordagem íntima que aprofunda o sentimento em torno do tema vivido.`
            }
          ];
        } else if (lang === 'es') {
          return [
            {
              title: '💬 Contextual & Empatía',
              target: `¡Qué bueno que me compartas sobre ${topicContext}, ${clientShort}! Se nota lo mucho que disfrutas esos momentos ❤️ ¿Cómo terminó saliendo todo al final? ¡Cuéntame los detalles!`,
              es: `Valida con entusiasmo lo que compartió y pide continuar la conversación.`
            },
            {
              title: '✨ Chispa & Curiosidad',
              target: `¡Me encantó enterarme de lo de ${topicContext}, ${clientShort}! 😉 Siempre tienes una forma muy fresca y amena de contar las cosas... ¿Qué otra sorpresa o plan divertido tienes en mente?`,
              es: `Tono alegre y curioso que dinamiza la charla basándose en lo dicho.`
            },
            {
              title: '❤️ Conexión & Cercanía',
              target: `Es tan lindo cuando me platicas sobre ${topicContext}, ${clientShort}... De verdad me hace sentirte mucho más cerquita ✨ ¿Qué es lo que más paz o emoción te hace sentir cuando estás en eso?`,
              es: `Conexión íntima y cálida que profundiza en las emociones del cliente.`
            }
          ];
        } else {
          return [
            {
              title: '💬 Contextual & Empathetic',
              target: `I'm so glad you shared about ${topicContext} with me, ${clientShort}! It sounds like such a genuine part of your day ❤️ How did everything turn out in the end? Tell me all about it!`,
              es: `Valida lo compartido sobre su actividad y pide conocer más detalles con calidez.`
            },
            {
              title: '✨ Playful & Curious',
              target: `I love hearing about ${topicContext}, ${clientShort}! 😉 You always bring such a great energy into our chats... What else fun or unexpected has been on your radar today?`,
              es: `Tono ameno y juguetón reforzando la química y preguntando qué más pasó.`
            },
            {
              title: '❤️ Personal & Intimate',
              target: `There's something so sweet about you talking about ${topicContext}, ${clientShort}... It makes me feel so much closer to your world ✨ What brings you the greatest sense of happiness in moments like that?`,
              es: `Comentario dulce y reflexivo que profundiza el vínculo emocional.`
            }
          ];
        }
      };

      // 3. Consultar backend y fallback instantáneo
      let chosenOptions = null;

      try {
        const res = await fetch(`${API_URL}/api/intelligence/generate-chat-reply`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clientName: liveClientName,
            clientId: liveClientId,
            profileName: sessionData.profileName,
            targetLang: liveDetectedLang.code,
            bioData: liveBioData,
            recentMessages: liveMessages,
            recentLetters: liveLetters
          })
        });
        const data = await res.json();
        if (data && data.success && Array.isArray(data.options) && data.options.length > 0) {
          // Descartar respuestas si son plantillas obsoletas/genéricas del backend viejo
          const isObsoleteTemplate = data.options.some(o => 
            (o.title && /Engaging Curiosity Hook|Warm & Direct Reply|Intimate Mystery Spark|GANCHO DE ATRACCIÓN|SALUDO INICIAL ESPONTÁNEO|SALUDO ESPONTÁNEO|Curiosidad & Encanto|Curiosidad y Encanto|Intimate Mystery/i.test(o.title)) ||
            (o.target && /I was just taking a little breather|tell me what was one fun or unexpected thing|Tuve una hermosa corazonada|corazonada de saludarte|Tienes una energía muy dulce|energía muy dulce y una mirada|una energía tan especial|que no pude resistir|vibra muy especial que me llamó/i.test(o.target))
          );
          if (!isObsoleteTemplate) {
            chosenOptions = data.options;
          }
        }
      } catch (err) {
        console.warn('[AgenteRYR] Fallback a motor neuronal contextual local:', err);
      }

      // Si el servidor no devolvió o tardó, usar el motor de síntesis contextual ultra-preciso
      if (!chosenOptions) {
        chosenOptions = synthesizeDynamicChatOptions(lastClientMsg, liveDetectedLang.code, liveClientName, liveMessages, liveLetters, lastOperatorMsg);
      }

      renderOptionsList(chosenOptions);
    };
  }

  // 12. RECOLECTOR 360° BIDIRECCIONAL & ACUMULATIVO (CHAT + CARTAS)
  const persistentClientChatHistoryMap = new Map(); // clientId -> Map(msgHash -> msgObj)
  const persistentClientLettersMap = new Map(); // clientId -> Map(letterHash -> letterObj)

  function parseCurrentChatMessagesBidirectional(realClientName) {
    const cleanClientId = getExactNumericClientId() || 'user';
    if (!persistentClientChatHistoryMap.has(cleanClientId)) {
      persistentClientChatHistoryMap.set(cleanClientId, new Map());
    }
    const clientHistory = persistentClientChatHistoryMap.get(cleanClientId);

    // Buscar el contenedor de mensajes del chat ACTIVO
    const chatView = document.querySelector(
      'div[data-test-id*="dialog-content"], div[data-test-id*="chat-messages"], div[class*="dialog-content"], div[class*="chat-scroll"], div[class*="chat-body"], div[class*="main-chat"]'
    );

    if (chatView) {
      // Intentar disparar carga de mensajes anteriores si estamos scrolleando
      const scrollEl = chatView.closest('[class*="scroll"], [class*="dialog-content"], [class*="messages"]') || chatView;
      if (scrollEl && scrollEl.scrollTop > 100) {
        // Puede haber más mensajes arriba
      }

      const allLeafElements = chatView.querySelectorAll('div, p');
      allLeafElements.forEach(node => {
        // Ignorar si el nodo está dentro de la barra lateral, lista de chats, herramientas o HUD
        if (
          node.closest('div[data-test-id*="dialog-item"]') ||
          node.closest('div[class*="dialog-item"]') ||
          node.closest('div[class*="item-wrap"]') ||
          node.closest('div[class*="dialogs"]') ||
          node.closest('div[class*="sidebar"]') ||
          node.closest('#ryr-titan-bar') ||
          node.closest('#ryr-intel-panel') ||
          node.closest('.ryr-chat-tools-wrapper') ||
          node.closest('.ryr-chat-hooks-dropdown')
        ) {
          return;
        }

        if (node.querySelectorAll('div, p').length > 2) return;

        const raw = node.innerText || '';
        if (raw.includes('TITAN APEX') || raw.includes('Search') || (raw.includes('seen') && raw.length < 10) || raw.includes('View post') || raw.includes('CONTINUAR CHAT') || raw.includes('GANCHOS DE')) return;

        if (/^(today|yesterday|january|february|march|april|may|june|july|august|september|october|november|december)\s*\d{0,2}$/i.test(raw.trim())) {
          return;
        }

        const timeMatch = raw.match(/\b\d{1,2}:\d{2}\s*(?:am|pm|a\.?\s*m\.?|p\.?\s*m\.?)\b/i);
        const timeText = timeMatch ? timeMatch[0] : '';

        let cleanText = raw
          .replace(/(?:You:|Tú:|Tu:|Você:)/gi, '')
          .replace(/\b\d{1,2}:\d{2}\s*(?:am|pm|a\.?\s*m\.?|p\.?\s*m\.?)\b/gi, '')
          .replace(/\bseen\b/gi, '')
          .replace(/\bView post\b/gi, '')
          .replace(/\bShow original\b/gi, '')
          .trim();

        if (!cleanText || cleanText.length < 1) return;

        const hasCheck = node.querySelector('svg[class*="check"], [class*="status-sent"]') !== null || 
                         node.innerHTML.includes('polyline') || 
                         node.innerHTML.includes('check') || 
                         raw.includes('✔');

        const hasOperatorPrefix = /(?:you:|tú:|tu:|você:)/i.test(raw);
        
        const bgColor = window.getComputedStyle(node).backgroundColor;
        const isCreamBubble = bgColor.includes('254, 249') || bgColor.includes('254, 240') || bgColor.includes('255, 251') || bgColor.includes('224, 231');
        const isRight = window.getComputedStyle(node).justifyContent === 'flex-end' || 
                        window.getComputedStyle(node.parentElement || node).justifyContent === 'flex-end' ||
                        node.className.includes('right') || 
                        node.className.includes('out');

        const isOperator = hasCheck || hasOperatorPrefix || isCreamBubble || isRight;
        const msgHash = `msg_${cleanClientId}_${isOperator ? 'OP' : 'RU'}_${cleanText.substring(0, 30).replace(/[^a-z0-9]/gi, '_')}_${(timeText || 'now').replace(/[^a-z0-9]/gi, '')}`;

        if (!clientHistory.has(msgHash)) {
          clientHistory.set(msgHash, {
            id: msgHash,
            isOperator: Boolean(isOperator),
            senderName: isOperator ? (sessionData.profileName || 'HORACIO') : realClientName,
            time: timeText || 'Reciente',
            date: new Date().toLocaleDateString(),
            text: cleanText
          });
        }
      });
    }

    return Array.from(clientHistory.values());
  }

  function extractMailThreadContext() {
    const currentClientId = getExactNumericClientId() || 'user';
    if (!persistentClientLettersMap.has(currentClientId)) {
      persistentClientLettersMap.set(currentClientId, new Map());
    }
    const clientLettersHistory = persistentClientLettersMap.get(currentClientId);

    // 1. Buscar tarjetas y elementos de carta en Talkytimes
    const mailCards = document.querySelectorAll(
      'div[data-test-id*="letter"], div[data-test-id*="mail-box-item"], div[class*="letter"], div[class*="mail-card"], div[class*="mail-thread"], div[class*="message"], div[class*="wrt-"], div[class*="thread-item"], div[class*="mail-content"], article, section'
    );

    mailCards.forEach(card => {
      if (card.closest('#ryr-titan-bar') || card.closest('#ryr-intel-panel') || card.closest('.ryr-letter-tools-box') || card.closest('.ryr-chat-tools-wrapper')) return;

      const text = (card.innerText || card.textContent || '').trim();
      if (text.length < 20 || text.includes('TITAN APEX') || text.includes('Send your letter') || text.includes('File size limit')) return;

      // Descartar números de página aislados
      if (/^(previous|next|\d+|\s+)+$/i.test(text)) return;

      const isMe = text.startsWith('Me\n') || 
                   text.startsWith('Me ') || 
                   card.querySelector('img[alt*="Me"]') !== null ||
                   card.className.includes('outgoing') ||
                   card.className.includes('right') ||
                   card.className.includes('sent');

      const dateMatch = text.match(/\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}(?:,\s+\d{1,2}:\d{2})?/i);
      const dateStr = dateMatch ? dateMatch[0] : 'Reciente';

      let cleanBody = text
        .replace(/^Me\n/i, '')
        .replace(/\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}(?:,\s+\d{1,2}:\d{2})?/i, '')
        .replace(/\b(?:Read|Unread|Leído|No leído)\b/gi, '')
        .replace(/\bPrevious\b/gi, '')
        .replace(/\bNext\b/gi, '')
        .trim();

      if (cleanBody.length < 15) return;

      const letterHash = `mail_${cleanBody.substring(0, 40).replace(/[^a-z0-9]/gi, '_')}`;

      if (!clientLettersHistory.has(letterHash)) {
        clientLettersHistory.set(letterHash, {
          id: letterHash,
          clientId: currentClientId,
          isOutgoing: Boolean(isMe),
          date: dateStr,
          preview: cleanBody.substring(0, 3000).replace(/\r?\n+/g, '\n'),
          fullText: cleanBody
        });
      }
    });

    // 2. Fallback: Capturar cualquier párrafo de carta visible en la página de hilos
    if (clientLettersHistory.size === 0 && window.location.href.includes('/mails/')) {
      const allParagraphs = document.querySelectorAll('p, div');
      allParagraphs.forEach(p => {
        if (p.children.length > 1) return;
        if (p.closest('#ryr-titan-bar') || p.closest('#ryr-intel-panel') || p.closest('.ryr-letter-tools-box') || p.closest('header') || p.closest('footer')) return;
        const txt = (p.innerText || '').trim();
        if (txt.length >= 35 && !txt.includes('Send your letter') && !txt.includes('File size limit') && !txt.includes('Up to 10 photos')) {
          const letterHash = `mail_p_${txt.substring(0, 40).replace(/[^a-z0-9]/gi, '_')}`;
          if (!clientLettersHistory.has(letterHash)) {
            clientLettersHistory.set(letterHash, {
              id: letterHash,
              clientId: currentClientId,
              isOutgoing: false,
              date: 'En pantalla',
              preview: txt,
              fullText: txt
            });
          }
        }
      });
    }

    return Array.from(clientLettersHistory.values());
  }

  function buildCurrentMarkdownTranscript(clientName, clientId, bioData, letters = []) {
    const messages = parseCurrentChatMessagesBidirectional(clientName);
    
    let mdLines = [
      `# HISTORIAL 360° | CONVERSACIONES Y CARTAS | RYR TITAN AUDIT`,
      `- **Operador:** ${sessionData.operator || 'walther'} [${sessionData.shift || 'Mañana'}]`,
      `- **Perfil Asignado:** ${sessionData.profileName || 'HORACIO'} (ID: ${sessionData.profileId || '118179794'})`,
      `- **Cliente:** ${clientName}`,
      `- **ID del Usuario:** ${clientId}`,
      `- **Ubicación:** ${bioData?.country || 'United States'} | **Nacimiento:** ${bioData?.birthDate || '53 años'}`,
      `- **Fecha Extracción:** ${new Date().toLocaleString()}`,
      `---`
    ];

    if (letters.length > 0) {
      mdLines.push(`### ✉️ Registro de Cartas / Mails Previos:`);
      letters.forEach(l => {
        mdLines.push(`- ${l.isOutgoing ? '📤 **Enviada por Perfil**' : '📥 **Recibida de Cliente**'} [${l.date}]: ${l.preview}`);
      });
      mdLines.push(`---`);
    }

    mdLines.push(`### 💬 Diálogo Transcrito de Chat (Ambos Participantes):`);
    messages.forEach(m => {
      if (m.isOperator) {
        mdLines.push(`- 💼 **${sessionData.profileName || 'HORACIO'} [Op: ${sessionData.operator}]** [${m.time}]: ${m.text}`);
      } else {
        mdLines.push(`- 👤 **${clientName} [Cliente]** [${m.time}]: ${m.text}`);
      }
    });

    return mdLines.join('\n');
  }

  async function syncCurrentChatToDatabase() {
    const { clientName, bioData } = getExactClientProfileData();
    const clientId = getExactNumericClientId();
    const letters = extractMailThreadContext();
    const messages = parseCurrentChatMessagesBidirectional(clientName);
    const markdown = buildCurrentMarkdownTranscript(clientName, clientId, bioData, letters);

    try {
      await fetch(`${API_URL}/api/chats/audit-deep`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operator: sessionData.operator,
          shift: sessionData.shift,
          profile: sessionData.profileName,
          profileId: sessionData.profileId,
          clientName,
          clientId,
          bioData,
          markdown,
          messages,
          letters
        })
      });
      syncedChatsMemory.add(String(clientId).trim().toLowerCase());
      if (clientName && clientName !== 'Cliente') {
        syncedChatsMemory.add(clientName.toLowerCase());
      }
      persistSyncedChatsToStorage();
      showFirewallToast(`⚡ Historial de ${clientName} guardado en base de datos.`);
    } catch (e) {}
  }

  let isBatchHarvestRunning = false;
  let lastAutoSyncClientKey = '';

  async function triggerLocalBatchHarvest() {
    if (isBatchHarvestRunning) return;
    isBatchHarvestRunning = true;
    showFirewallToast('⚡ [COMMAND MATRIX] Cosechando y subiendo conversaciones del turno...');

    try {
      // 1. Sincronizar chat y cartas del cliente actualmente visible
      await syncCurrentChatToDatabase();

      // 2. Extraer cartas visibles si estamos en /mails/
      const letters = extractMailThreadContext();
      if (letters.length > 0) {
        await fetch(`${API_URL}/api/mails/sync-profile-letters`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            operator: sessionData.operator,
            shift: sessionData.shift,
            profile: sessionData.profileName,
            letters: letters
          })
        }).catch(() => {});
      }

      // 3. Notificar al backend en vivo
      fetch(`${API_URL}/api/sync/log-event`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'CHAT_UPLOAD',
          operator: sessionData.operator,
          profile: sessionData.profileName,
          clientName: 'Turno Completo',
          count: syncedChatsMemory.size,
          durationMs: 380,
          status: 'SUCCESS',
          detail: `Extracción del turno completada por el operador '${sessionData.operator}'. Conversaciones sincronizadas: ${syncedChatsMemory.size}.`
        })
      }).catch(() => {});

      showFirewallToast('✅ ¡Conversaciones y cartas subidas con éxito a la base de datos!');
    } catch (err) {
      console.warn('[RYR-SYNC] Error en batch harvest:', err);
    } finally {
      isBatchHarvestRunning = false;
    }
  }

  // 13. GENERADOR DE CARTAS CONTEXTUALES (RESPONDER O REDACTAR) & TRADUCCIÓN EN MAILS
  function injectAutoLetterDrafter() {
    if (!window.location.href.includes('/mails/') && !document.querySelector('textarea[placeholder*="letter" i]')) return;

    // Buscar botones de acción en el pie de página de cartas (Send Media y Send Letter)
    const sendMediaBtn = Array.from(document.querySelectorAll('button, div[role="button"], a[role="button"]')).find(b => {
      if (b.closest('#ryr-titan-bar') || b.closest('#ryr-intel-panel') || b.closest('.ryr-letter-tools-box') || b.closest('.ryr-chat-tools-wrapper')) return false;
      const txt = (b.innerText || b.textContent || '').trim().toLowerCase();
      return txt.includes('send media') || txt.includes('media');
    });

    const sendLetterBtn = Array.from(document.querySelectorAll('button, div[role="button"], a[role="button"]')).find(b => {
      if (b.closest('#ryr-titan-bar') || b.closest('#ryr-intel-panel') || b.closest('.ryr-letter-tools-box') || b.closest('.ryr-chat-tools-wrapper')) return false;
      const txt = (b.innerText || b.textContent || '').trim().toLowerCase();
      const testId = (b.getAttribute('data-test-id') || '').toLowerCase();
      const aria = (b.getAttribute('aria-label') || '').toLowerCase();
      return (txt === 'send' || txt === 'send letter' || txt === 'send mail' || txt.startsWith('send') || testId.includes('send') || aria.includes('send')) && !txt.includes('media');
    });

    const letterTextarea = document.querySelector('textarea[placeholder*="letter" i], div[class*="letter"] textarea, textarea');
    const anchorBtn = sendMediaBtn || sendLetterBtn;
    if (!letterTextarea && !anchorBtn) return;

    const { clientName, bioData } = getExactClientProfileData();
    const letters = extractMailThreadContext();
    const messages = parseCurrentChatMessagesBidirectional(clientName);
    const clientId = getExactNumericClientId();

    // Revisar si la última carta recibida en el hilo es del cliente (para responder con contexto)
    const incomingLetters = letters.filter(l => !l.isOutgoing);
    const hasIncomingLetter = incomingLetters.length > 0;
    const lastIncomingLetter = hasIncomingLetter ? incomingLetters[incomingLetters.length - 1] : (letters.length > 0 ? letters[letters.length - 1] : null);

    // Detectar idioma del cliente analizando hilo de cartas y chat
    const combinedLetterText = letters.map(l => l.preview).join(' ') + ' ' + messages.map(m => m.text).join(' ');
    let detectedLang = detectLanguage(combinedLetterText || bioData?.country || '');
    if (detectedLang.code === 'es' && !/[áéíóúñ¿¡]/.test(combinedLetterText)) {
      detectedLang = { code: 'en', name: 'English 🇺🇸', flag: '🇺🇸' };
    }

    let drafterBox = document.getElementById('ryr-letter-drafter-box');
    if (!drafterBox || !drafterBox.isConnected) {
      if (drafterBox) drafterBox.remove();
      drafterBox = document.createElement('div');
      drafterBox.id = 'ryr-letter-drafter-box';
      drafterBox.className = 'ryr-letter-tools-box';
      drafterBox.style.cssText = 'display:inline-flex !important; flex-direction:row !important; align-items:center !important; gap:6px !important; margin-right:8px !important; margin-left:4px !important; z-index:999999 !important; position:relative !important; height:auto !important; visibility:visible !important; opacity:1 !important; flex-shrink:0 !important;';
    }

    if (anchorBtn && anchorBtn.parentElement) {
      anchorBtn.parentElement.style.overflow = 'visible';
      anchorBtn.parentElement.style.minHeight = '48px';
      anchorBtn.parentElement.style.height = 'auto';
      anchorBtn.parentElement.style.display = 'flex';
      anchorBtn.parentElement.style.alignItems = 'center';
      anchorBtn.parentElement.style.flexWrap = 'nowrap';
      if (drafterBox.parentElement !== anchorBtn.parentElement || drafterBox.nextElementSibling !== anchorBtn) {
        anchorBtn.parentElement.insertBefore(drafterBox, anchorBtn);
      }
    } else if (letterTextarea && letterTextarea.parentElement) {
      if (drafterBox.parentElement !== letterTextarea.parentElement) {
        letterTextarea.parentElement.appendChild(drafterBox);
      }
    }

    // Determinar modo dual de cartas según si es cliente recurrente (múltiples cartas o entrante)
    const isReturningClient = letters.length >= 1 || hasIncomingLetter;
    const genBtnLabel = isReturningClient 
      ? `✨ Responder Carta` 
      : `✨ Gancho Carta`;

    const targetLangCode = detectedLang.code === 'es' ? 'EN' : detectedLang.code.toUpperCase();

    // 1. Botón de Responder Carta (IA Contextual con 3 Opciones de 250+ caracteres)
    let genLetterBtn = drafterBox.querySelector('#ryr-btn-gen-letter');
    if (!genLetterBtn) {
      genLetterBtn = document.createElement('button');
      genLetterBtn.id = 'ryr-btn-gen-letter';
      genLetterBtn.type = 'button';
      genLetterBtn.className = 'ryr-letter-drafter-btn';
      genLetterBtn.style.cssText = 'background:linear-gradient(135deg, #10b981 0%, #059669 100%) !important; color:#ffffff !important; border:1px solid #34d399 !important; padding:0 12px !important; border-radius:6px !important; font-size:11px !important; font-weight:800 !important; cursor:pointer !important; display:inline-flex !important; align-items:center !important; justify-content:center !important; gap:4px !important; height:32px !important; line-height:32px !important; white-space:nowrap !important; min-width:130px !important; flex-shrink:0 !important; visibility:visible !important; opacity:1 !important;';
      drafterBox.appendChild(genLetterBtn);
    }
    if (!genLetterBtn.disabled) {
      genLetterBtn.innerText = genBtnLabel;
    }
    genLetterBtn.title = isReturningClient 
      ? 'Ver 3 opciones de respuesta contextual razonadas según las cartas del usuario' 
      : 'Generar 3 cartas magnéticas de apertura con contexto y alta atracción';

    // 2. Botón de Traducir Carta (Al lado de Responder Carta)
    let transLetterBtn = drafterBox.querySelector('#ryr-btn-trans-letter');
    if (!transLetterBtn) {
      transLetterBtn = document.createElement('button');
      transLetterBtn.id = 'ryr-btn-trans-letter';
      transLetterBtn.type = 'button';
      transLetterBtn.className = 'ryr-letter-translate-btn';
      transLetterBtn.style.cssText = 'background:linear-gradient(135deg, #06b6d4 0%, #0284c7 100%) !important; color:#ffffff !important; border:1px solid #38bdf8 !important; padding:0 12px !important; border-radius:6px !important; font-size:11px !important; font-weight:800 !important; cursor:pointer !important; display:inline-flex !important; align-items:center !important; justify-content:center !important; gap:4px !important; height:32px !important; line-height:32px !important; white-space:nowrap !important; min-width:135px !important; flex-shrink:0 !important; visibility:visible !important; opacity:1 !important;';
      drafterBox.appendChild(transLetterBtn);
    }
    if (!transLetterBtn.disabled) {
      transLetterBtn.innerText = `🌐 Traducir Carta a ${targetLangCode}`;
    }
    transLetterBtn.title = `Traducir carta al idioma detectado del cliente (${detectedLang.name})`;

    // Asegurar orden horizontal en el DOM: Responder Carta PRIMERO, Traducir Carta AL LADO
    if (drafterBox.firstElementChild !== genLetterBtn) {
      drafterBox.insertBefore(genLetterBtn, drafterBox.firstElementChild);
    }
    if (genLetterBtn.nextElementSibling !== transLetterBtn) {
      genLetterBtn.after(transLetterBtn);
    }

    // Acción: Traducir Carta escrita manualmente en el textarea
    transLetterBtn.onclick = async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const ta = document.querySelector('textarea[placeholder*="letter" i], textarea');
      if (!ta) return;
      const currentText = (ta.value || ta.innerText || '').trim();

      if (!currentText) {
        showFirewallToast(`✍️ Escribe tu carta en la caja primero para traducirla.`);
        ta.focus();
        return;
      }

      transLetterBtn.disabled = true;
      transLetterBtn.innerText = '⏳ Traduciendo carta...';

      const isInputSpanish = /[áéíóúñ¿¡]|\b(hola|que|cómo|como|estas|estás|bien|amor|gracias|quiero|tengo|donde|cuando|para|con)\b/i.test(currentText);
      const destinationLang = isInputSpanish ? (detectedLang.code === 'es' ? 'en' : detectedLang.code) : 'es';

      try {
        const translated = await translateText(currentText, destinationLang);
        setInputValueSafely(ta, translated);
        showFirewallToast(`✅ Carta traducida a ${destinationLang.toUpperCase()} con éxito.`);
      } catch (err) {
        showFirewallToast(`⚠️ Error al traducir carta.`);
      } finally {
        transLetterBtn.disabled = false;
        transLetterBtn.innerText = `🌐 Traducir Carta a ${targetLangCode}`;
      }
    };

    // Acción: Desplegar 3 Opciones de Respuesta / Apertura de Carta con Razonamiento Táctico y ~250 caracteres
    genLetterBtn.onclick = async (e) => {
      e.preventDefault();
      e.stopPropagation();

      // Cerrar si ya está abierto
      const existingDropdown = document.querySelector('.ryr-letter-hooks-dropdown');
      if (existingDropdown) {
        existingDropdown.remove();
        return;
      }

      // Guardar automáticamente el hilo completo de cartas en la base de datos para nutrir la memoria 360°
      syncCurrentChatToDatabase().catch(() => {});

      const isSyncedInDb = syncedChatsMemory.has(String(clientId).toLowerCase()) || (clientName && syncedChatsMemory.has(clientName.toLowerCase()));
      const showMissingHistoryWarning = !isSyncedInDb && letters.length === 0 && messages.length <= 2;

      const dropdown = document.createElement('div');
      dropdown.className = 'ryr-letter-hooks-dropdown';
      drafterBox.appendChild(dropdown);

      const headerTitle = hasIncomingLetter 
        ? `🔄 RESPONDER CARTA A ${clientName.toUpperCase()} (${detectedLang.name}):` 
        : `🎯 REDACTAR CARTA PARA ${clientName.toUpperCase()} (${detectedLang.name}):`;

      let warningHtml = '';
      if (showMissingHistoryWarning) {
        warningHtml = `
          <div class="ryr-no-info-warning">
            <span style="font-size:10px; line-height:1.2;">⚠️ <b>Sin cartas previas en BD:</b> Sube las cartas y conversaciones para contexto 360°.</span>
            <button class="ryr-no-info-btn" id="ryr-letter-quick-sync">⚡ Subir Ahora</button>
          </div>
        `;
      }

      dropdown.innerHTML = `
        <div style="font-weight:bold; color:#34d399; font-size:11px; margin-bottom:4px; display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #065f46; padding-bottom:4px;">
          <span>${headerTitle}</span>
          <span style="cursor:pointer; color:#94a3b8; font-size:13px;" id="ryr-close-letter-dropdown">✕</span>
        </div>
        ${warningHtml}
        <div id="ryr-letter-loading" style="text-align:center; padding:18px 10px; color:#34d399; font-size:11px; font-weight:bold;">
          🧠 Razonando cartas y contexto con IA...
        </div>
        <div id="ryr-letter-options-container" style="display:none; flex-direction:column; gap:5px;"></div>
      `;

      const closeBtn = dropdown.querySelector('#ryr-close-letter-dropdown');
      if (closeBtn) closeBtn.onclick = () => dropdown.remove();

      const syncBtn = dropdown.querySelector('#ryr-letter-quick-sync');
      if (syncBtn) {
        syncBtn.onclick = async (ev) => {
          ev.stopPropagation();
          syncBtn.innerText = '⏳ Subiendo...';
          syncBtn.disabled = true;
          await syncCurrentChatToDatabase();
          syncBtn.innerText = '✅ Subido';
        };
      }

      const container = dropdown.querySelector('#ryr-letter-options-container');
      const loadingEl = dropdown.querySelector('#ryr-letter-loading');

      const renderLetterCards = (optionsToRender) => {
        if (loadingEl) loadingEl.style.display = 'none';
        if (!container) return;
        container.style.display = 'flex';
        container.innerHTML = '';

        optionsToRender.forEach((opt, idx) => {
          const card = document.createElement('div');
          card.className = 'ryr-letter-option-card';
          card.innerHTML = `
            <div class="ryr-letter-option-title">
              <span>${opt.title || `Opción ${idx + 1}`}</span>
              <span class="ryr-letter-option-badge">Opción ${idx + 1}</span>
            </div>
            <div class="ryr-letter-option-rationale">💡 <b>Razón Táctica:</b> ${opt.rationale || 'Respuesta contextual razonada.'}</div>
            <div class="ryr-letter-option-preview"><b>📝 En Español (Vista Operador):</b><br/>${opt.esPreview || opt.target}</div>
            <div style="font-size:9.5px; color:#38bdf8; margin-top:2px; font-weight:bold;">⚡ Clic para insertar carta en ${detectedLang.name}</div>
          `;

          card.onclick = () => {
            const ta = document.querySelector('textarea[placeholder*="letter" i], div[class*="letter"] textarea, textarea');
            if (ta) {
              setInputValueSafely(ta, opt.target);
              showFirewallToast(`✨ Carta en ${detectedLang.name} insertada con éxito. ¡Lista para enviar!`);
              ta.focus();
            }
            dropdown.remove();
          };

          container.appendChild(card);
        });
      };

      const generateReasonedLetterOptions = () => {
        const fullLetterCorpus = letters.map(l => l.preview).join(' ').toLowerCase();
        const fullChatCorpus = messages.map(m => m.text).join(' ').toLowerCase();
        const combinedCorpus = `${fullLetterCorpus} ${fullChatCorpus}`;
        const lastIncomingText = (lastIncomingLetter ? (lastIncomingLetter.preview || lastIncomingLetter.text || '') : '').toLowerCase();

        // Detección profunda de tópicos en cartas previas
        const isConflictOrMoving = /\b(friend|pack|packing|storage|move|moving|limit|limits|toxic|betray|argument|drama|boxes|messing|lie|leaving|house|apartment|start over|nuevo comienzo|empacar|mudanza|amig)\b/i.test(lastIncomingText) || /\b(friend|pack|storage|limit|boxes|mudanza)\b/i.test(combinedCorpus);
        const hasWorkOrBusyTopic = /\b(work|job|busy|tired|trabalho|trabajo|cansad|ocupad|shift|office|exhausted)\b/i.test(lastIncomingText) || /\b(work|job|shift|busy)\b/i.test(combinedCorpus);
        const hasSicknessOrPain = /\b(headache|sick|ill|flu|rain|cold|fever|resting|dolor|cabeza|enferm|remedio|pastilla|hospital)\b/i.test(lastIncomingText);
        const hasPhotoTopic = /photo|pic|picture|foto|selfie|portrait|look|mirada|eyes/i.test(lastIncomingText) || /photo|picture|foto/i.test(combinedCorpus);
        const hasJourneyTogether = /\b(journey|emprender|viaje|together|juntos|path|camino|destiny|destino|future|futuro|bond|connection|respect|embrace|heart|soul)\b/i.test(lastIncomingText) || /\b(journey|destiny|bond)\b/i.test(combinedCorpus);

        const myProfile = sessionData.profileName || (detectedLang.code === 'pt' ? 'Eu' : (detectedLang.code === 'es' ? 'Yo' : 'Me'));
        const clientDisplayName = clientName || (detectedLang.code === 'pt' ? 'meu bem' : (detectedLang.code === 'es' ? 'corazón' : 'my dear'));

        let options = [];

        // CASO 1: CONFLICTO PERSONAL / MUDANZA / STORAGE / LÍMITES (Caso Blondebaby)
        if (isConflictOrMoving) {
          if (detectedLang.code === 'pt') {
            options = [
              {
                title: '🛡️ Opção 1: Apoio Genuíno & Validação de Limites',
                rationale: 'Valida a decisão difícil de se afastar de pessoas tóxicas e pergunta sobre a mudança.',
                esPreview: `Meu querido ${clientDisplayName},\n\nLi suas palavras com muita atenção e meu coração está com você. Tomar a decisão de se afastar de quem não te valoriza exige muita coragem, mas sua paz não tem preço.\n\nComo está o processo de empacotar e levar as coisas para o storage? Vá com calma, você é forte e uma nova fase linda está começando para você ❤️\n\nSempre aqui por você,\n${myProfile} ✨`,
                target: `Meu querido ${clientDisplayName},\n\nLi suas palavras com muita atenção e meu coração está com você. Tomar a decisão de se afastar de quem não te valoriza exige muita coragem, mas sua paz não tem preço.\n\nComo está o processo de empacotar e levar as coisas para o storage? Vá com calma, você é forte e uma nova fase linda está começando para você ❤️\n\nSempre aqui por você,\n${myProfile} ✨`
              },
              {
                title: '✨ Opção 2: Refúgio de Paz & Alívio Futuro',
                rationale: 'Oferece acolhimento emocional para diminuir a sobrecarga e foca no alívio de recomeçar.',
                esPreview: `Meu querido ${clientDisplayName},\n\nNinguém merece carregar tanto estresse por causa de falsidades alheias. Respira fundo... tudo o que você está enfrentando vai valer a pena quando sentir o alívio de ter seu espaço em paz.\n\nMe conta, qual é a primeira coisa que você vai querer fazer para relaxar assim que terminar tudo? 😉\n\nCom todo meu carinho,\n${myProfile} ❤️`,
                target: `Meu querido ${clientDisplayName},\n\nNinguém merece carregar tanto estresse por causa de falsidades alheias. Respira fundo... tudo o que você está enfrentando vai valer a pena quando sentir o alívio de ter seu espaço em paz.\n\nMe conta, qual é a primeira coisa que você vai querer fazer para relaxar assim que terminar tudo? 😉\n\nCom todo meu carinho,\n${myProfile} ❤️`
              },
              {
                title: '🌸 Opção 3: Força Interior & Troca de Fotos',
                rationale: 'Incentiva pausas na rotina pesada e convida a uma troca suave de fotos.',
                esPreview: `Meu querido ${clientDisplayName},\n\nAdmiro muito sua postura firme em não aceitar desrespeito. No meio de tanta correria, não esquece de respirar e se alimentar bem.\n\nQuando fizer um descanso, me manda uma foto sua para eu sentir seu olhar e te mandar um sorriso carinhoso de volta 😉 Combinado?\n\nUm abraço bem quentinho,\n${myProfile} ✨`,
                target: `Meu querido ${clientDisplayName},\n\nAdmiro muito sua postura firme em não aceitar desrespeito. No meio de tanta correria, não esquece de respirar e se alimentar bem.\n\nQuando fizer um descanso, me manda uma foto sua para eu sentir seu olhar e te mandar um sorriso carinhoso de volta 😉 Combinado?\n\nUm abraço bem quentinho,\n${myProfile} ✨`
              }
            ];
          } else if (detectedLang.code === 'es') {
            options = [
              {
                title: '🛡️ Opción 1: Apoyo Genuino & Validación de Límites',
                rationale: 'Valida la valentía de alejarse de falsas amistades y pregunta por la mudanza.',
                esPreview: `Mi queridísimo ${clientDisplayName},\n\nLeí cada detalle de tu carta y de verdad mi corazón está contigo. Poner límites y alejarte de quien no te valora requiere un valor enorme, pero tu tranquilidad no tiene precio.\n\n¿Cómo vas empacando tus cosas hacia el storage? Ve paso a paso, eres muy fuerte y un nuevo comienzo mucho más libre te espera ❤️\n\nSiempre aquí para ti,\n${myProfile} ✨`,
                target: `Mi queridísimo ${clientDisplayName},\n\nLeí cada detalle de tu carta y de verdad mi corazón está contigo. Poner límites y alejarte de quien no te valora requiere un valor enorme, pero tu tranquilidad no tiene precio.\n\n¿Cómo vas empacando tus cosas hacia el storage? Ve paso a paso, eres muy fuerte y un nuevo comienzo mucho más libre te espera ❤️\n\nSiempre aquí para ti,\n${myProfile} ✨`
              },
              {
                title: '✨ Opción 2: Refugio de Paz & Alivio Futuro',
                rationale: 'Ofrece contención ante el agobio y enfoca en la paz mental una vez termine de ordenar todo.',
                esPreview: `Mi querido ${clientDisplayName},\n\nNadie merece cargar con tanto desgaste por actitudes egoístas de otros. Respira hondo... todo este esfuerzo valdrá la pena en cuanto veas tus cosas organizadas y sientas tu propia paz.\n\nCuéntame, ¿qué es lo primero que quieres hacer para consentirte una vez termines de acomodar todo? 😉\n\nCon todo mi cariño,\n${myProfile} ❤️`,
                target: `Mi querido ${clientDisplayName},\n\nNadie merece cargar con tanto desgaste por actitudes egoístas de otros. Respira hondo... todo este esfuerzo valdrá la pena en cuanto veas tus cosas organizadas y sientas tu propia paz.\n\nCuéntame, ¿qué es lo primero que quieres hacer para consentirte una vez termines de acomodar todo? 😉\n\nCon todo mi cariño,\n${myProfile} ❤️`
              },
              {
                title: '🌸 Opción 3: Fortaleza Interior & Intercambio de Fotos',
                rationale: 'Elogia su resiliencia y propone una foto de respiro para sacarlo del estrés.',
                esPreview: `Mi queridísimo ${clientDisplayName},\n\nAdmiro muchísimo tu determinación para no tolerar faltas de respeto. En medio de tantas cajas y ajetreo, por favor date permiso de descansar y tomar un respiro.\n\nCuando tomes una pausa, mándame una foto tuya para sentirte cerca y enviarte una sonrisa exclusiva 😉 ¿Trato hecho?\n\nUn abrazo muy cálido,\n${myProfile} ✨`,
                target: `Mi queridísimo ${clientDisplayName},\n\nAdmiro muchísimo tu determinación para no tolerar faltas de respeto. En medio de tantas cajas y ajetreo, por favor date permiso de descansar y tomar un respiro.\n\nCuando tomes una pausa, mándame una foto tuya para sentirte cerca y enviarte una sonrisa exclusiva 😉 ¿Trato hecho?\n\nUn abrazo muy cálido,\n${myProfile} ✨`
              }
            ];
          } else {
            options = [
              {
                title: '🛡️ Option 1: Genuine Support & Healthy Boundaries',
                rationale: 'Deeply validates the client walking away from toxic friends and asks about packing/storage progress.',
                esPreview: `My dearest ${clientDisplayName},\n\nI read every line of your letter and my heart is truly with you right now. Standing up for yourself and walking away from people who don't respect your boundaries takes so much courage, but your peace is worth everything.\n\nHow is packing and getting your belongings to storage going? Take it one box at a time... you're so resilient and a fresh, peaceful chapter is waiting for you ❤️\n\nAlways here for you,\n${myProfile} ✨`,
                target: `My dearest ${clientDisplayName},\n\nI read every line of your letter and my heart is truly with you right now. Standing up for yourself and walking away from people who don't respect your boundaries takes so much courage, but your peace is worth everything.\n\nHow is packing and getting your belongings to storage going? Take it one box at a time... you're so resilient and a fresh, peaceful chapter is waiting for you ❤️\n\nAlways here for you,\n${myProfile} ✨`
              },
              {
                title: '✨ Option 2: Safe Sanctuary & Freedom Ahead',
                rationale: 'Offers warm emotional refuge to alleviate moving stress and focuses on the relief of a clean start.',
                esPreview: `My dear ${clientDisplayName},\n\nYou truly do not deserve to carry so much weight from someone else's drama. Take a deep, gentle breath... this exhausting storm will pass, and the relief you will feel having your things sorted and peaceful will be unmatched.\n\nTell me, what is the very first thing you want to do just for yourself once you get everything settled? 😉\n\nWith all my warmth,\n${myProfile} ❤️`,
                target: `My dear ${clientDisplayName},\n\nYou truly do not deserve to carry so much weight from someone else's drama. Take a deep, gentle breath... this exhausting storm will pass, and the relief you will feel having your things sorted and peaceful will be unmatched.\n\nTell me, what is the very first thing you want to do just for yourself once you get everything settled? 😉\n\nWith all my warmth,\n${myProfile} ❤️`
              },
              {
                title: '🌸 Option 3: Inner Strength & Sweet Photo Break',
                rationale: 'Praises their inner strength and invites a quick restful photo exchange to bring comfort.',
                esPreview: `My dearest ${clientDisplayName},\n\nI admire your inner strength so much for putting your foot down and prioritizing your sanity. Amidst all the packing and heavy lifting, please promise me you will take a quiet moment to drink some water and breathe.\n\nWhen you pause for a break, send me a quick picture of yourself so I can send you a warm smile right back 😉 Deal?\n\nHolding you close,\n${myProfile} ✨`,
                target: `My dearest ${clientDisplayName},\n\nI admire your inner strength so much for putting your foot down and prioritizing your sanity. Amidst all the packing and heavy lifting, please promise me you will take a quiet moment to drink some water and breathe.\n\nWhen you pause for a break, send me a quick picture of yourself so I can send you a warm smile right back 😉 Deal?\n\nHolding you close,\n${myProfile} ✨`
              }
            ];
          }
        }
        // CASO 2: AGOTAMIENTO LABORAL / ESTRÉS
        else if (hasWorkOrBusyTopic) {
          if (detectedLang.code === 'pt') {
            options = [
              {
                title: '💼 Opção 1: Alívio & Reconhecimento do Esforço',
                rationale: 'Reconhece o cansaço do trabalho e oferece conforto acolhedor.',
                esPreview: `Meu querido ${clientDisplayName},\n\nPercebo o quanto você se dedica e como seus dias têm sido exigentes. É admirável sua dedicação, mas você merece descansar a mente e o corpo.\n\nEspero que ler esta carta seja o seu cantinho de paz hoje. Me conta, qual é a sua maneira favorita de se desligar do mundo e relaxar? ❤️\n\nCom todo meu carinho,\n${myProfile} ✨`,
                target: `Meu querido ${clientDisplayName},\n\nPercebo o quanto você se dedica e como seus dias têm sido exigentes. É admirável sua dedicação, mas você merece descansar a mente e o corpo.\n\nEspero que ler esta carta seja o seu cantinho de paz hoje. Me conta, qual é a sua maneira favorita de se desligar do mundo e relaxar? ❤️\n\nCom todo meu carinho,\n${myProfile} ✨`
              },
              {
                title: '✨ Opção 2: Pausa Afetuosa & Troca de Fotos',
                rationale: 'Incentiva uma pausa saudável e propõe uma foto exclusiva.',
                esPreview: `Meu querido ${clientDisplayName},\n\nQueria tanto poder te preparar algo gostoso e te fazer massagem para tirar toda essa tensão do trabalho. Não se cobre tanto hoje!\n\nMe envia uma foto sua descansando agora para eu te mandar uma foto bem especial só para você 😉\n\nCom um beijo doce,\n${myProfile} ❤️`,
                target: `Meu querido ${clientDisplayName},\n\nQueria tanto poder te preparar algo gostoso e te fazer massagem para tirar toda essa tensão do trabalho. Não se cobre tanto hoje!\n\nMe envia uma foto sua descansando agora para eu te mandar uma foto bem especial só para você 😉\n\nCom um beijo doce,\n${myProfile} ❤️`
              },
              {
                title: '🌸 Opção 3: Conexão Emocional Profunda',
                rationale: 'Fortalece o vínculo íntimo em meio à rotina cansativa.',
                esPreview: `Meu querido ${clientDisplayName},\n\nMesmo na correria, saber que você tira um tempo para me escrever aquece demais o meu coração. Nossas cartas são a melhor parte do meu dia.\n\nQual é aquele sonho ou viagem que você mais quer realizar quando tiver férias? 😉\n\nSempre pensando em você,\n${myProfile} ✨`,
                target: `Meu querido ${clientDisplayName},\n\nMesmo na correria, saber que você tira um tempo para me escrever aquece demais o meu coração. Nossas cartas são a melhor parte do meu dia.\n\nQual é aquele sonho ou viagem que você mais quer realizar quando tiver férias? 😉\n\nSempre pensando em você,\n${myProfile} ✨`
              }
            ];
          } else if (detectedLang.code === 'es') {
            options = [
              {
                title: '💼 Opción 1: Alivio & Reconocimiento de tu Esfuerzo',
                rationale: 'Valida el cansancio por el trabajo y le brinda un remanso de paz.',
                esPreview: `Mi queridísimo ${clientDisplayName},\n\nNoto cuánto te esfuerzas y lo demandantes que han sido tus jornadas. Admiro tu dedicación, pero también mereces consentirte y dejar las preocupaciones a un lado.\n\nDeseo que leer mis letras sea tu respiro de paz hoy. Dime, ¿cuál es tu plan ideal cuando por fin logras desconectar de todo? ❤️\n\nCon todo mi cariño,\n${myProfile} ✨`,
                target: `Mi queridísimo ${clientDisplayName},\n\nNoto cuánto te esfuerzas y lo demandantes que han sido tus jornadas. Admiro tu dedicación, pero también mereces consentirte y dejar las preocupaciones a un lado.\n\nDeseo que leer mis letras sea tu respiro de paz hoy. Dime, ¿cuál es tu plan ideal cuando por fin logras desconectar de todo? ❤️\n\nCon todo mi cariño,\n${myProfile} ✨`
              },
              {
                title: '✨ Opción 2: Pausa Afectuosa & Foto Exclusiva',
                rationale: 'Propuesta relajante con intercambio recíproco de fotos.',
                esPreview: `Mi querido ${clientDisplayName},\n\nOjalá pudiera estar contigo para prepararte algo rico y ayudarte a soltar toda la tensión del día. ¡Por favor no te exijas de más hoy!\n\nMándame una fotico tuya relajándote para devolverte una foto muy linda y exclusiva para ti 😉 ¿Trato?\n\nCon un beso dulce,\n${myProfile} ❤️`,
                target: `Mi querido ${clientDisplayName},\n\nOjalá pudiera estar contigo para prepararte algo rico y ayudarte a soltar toda la tensión del día. ¡Por favor no te exijas de más hoy!\n\nMándame una fotico tuya relajándote para devolverte una foto muy linda y exclusiva para ti 😉 ¿Trato?\n\nCon un beso dulce,\n${myProfile} ❤️`
              },
              {
                title: '🌸 Opción 3: Conexión Emocional & Sueños',
                rationale: 'Profundiza en metas y anhelos para escapar del estrés cotidiano.',
                esPreview: `Mi queridísimo ${clientDisplayName},\n\nSaber que en medio de tus compromisos te tomas el tiempo de escribirme me hace sentir sumamente especial. Eres una persona admirable.\n\nCuéntame, ¿cuál es ese viaje o proyecto personal que más te ilusiona para cuando tengas unos días libres? 😉\n\nSiempre pensando en ti,\n${myProfile} ✨`,
                target: `Mi queridísimo ${clientDisplayName},\n\nSaber que en medio de tus compromisos te tomas el tiempo de escribirme me hace sentir sumamente especial. Eres una persona admirable.\n\nCuéntame, ¿cuál es ese viaje o proyecto personal que más te ilusiona para cuando tengas unos días libres? 😉\n\nSiempre pensando en ti,\n${myProfile} ✨`
              }
            ];
          } else {
            options = [
              {
                title: '💼 Option 1: Comfort & Work Fatigue Relief',
                rationale: 'Validates demanding job schedule and offers a calm, soothing presence.',
                esPreview: `My dearest ${clientDisplayName},\n\nI can tell just how hard you work and how demanding your daily schedule has been. I truly respect your dedication, but please remember your body and mind deserve rest too.\n\nI hope reading my words feels like a cozy sanctuary in your day. Tell me, what is your favorite way to unwind when you finally get quiet time for yourself? ❤️\n\nWith all my affection,\n${myProfile} ✨`,
                target: `My dearest ${clientDisplayName},\n\nI can tell just how hard you work and how demanding your daily schedule has been. I truly respect your dedication, but please remember your body and mind deserve rest too.\n\nI hope reading my words feels like a cozy sanctuary in your day. Tell me, what is your favorite way to unwind when you finally get quiet time for yourself? ❤️\n\nWith all my affection,\n${myProfile} ✨`
              },
              {
                title: '✨ Option 2: Sweet Break & Photo Trade',
                rationale: 'Encourages a cozy break from work with magnetic reciprocal photo trade.',
                esPreview: `My dear ${clientDisplayName},\n\nI honestly wish I could be right by your side to make you a warm drink and help you let go of all that work stress. Please take it easy on yourself today!\n\nSend me a quick photo of yourself relaxing now, and in my next letter I'll send an exclusive picture just for you 😉 Deal?\n\nWith a sweet kiss,\n${myProfile} ❤️`,
                target: `My dear ${clientDisplayName},\n\nI honestly wish I could be right by your side to make you a warm drink and help you let go of all that work stress. Please take it easy on yourself today!\n\nSend me a quick photo of yourself relaxing now, and in my next letter I'll send an exclusive picture just for you 😉 Deal?\n\nWith a sweet kiss,\n${myProfile} ❤️`
              },
              {
                title: '🌸 Option 3: Romantic Daydreaming & Future Plans',
                rationale: 'Invites the client to escape everyday work grind by talking about passions and travels.',
                esPreview: `My dearest ${clientDisplayName},\n\nKnowing that despite your busy schedule you always think to write to me truly touches my heart. Our letters have become such a meaningful part of my life.\n\nTell me, where is one dream destination you would love to travel to whenever you take your next long vacation? 😉\n\nAlways thinking of you,\n${myProfile} ✨`,
                target: `My dearest ${clientDisplayName},\n\nKnowing that despite your busy schedule you always think to write to me truly touches my heart. Our letters have become such a meaningful part of my life.\n\nTell me, where is one dream destination you would love to travel to whenever you take your next long vacation? 😉\n\nAlways thinking of you,\n${myProfile} ✨`
              }
            ];
          }
        }
        // CASO 3: SALUD / MALESTAR
        else if (hasSicknessOrPain) {
          if (detectedLang.code === 'pt') {
            options = [
              {
                title: '🩹 Opção 1: Cuidado Afetuoso & Recuperação',
                rationale: 'Cuidado carinhoso e incentivo a tomar remédios e descansar.',
                esPreview: `Meu querido ${clientDisplayName},\n\nFiquei com o coração apertado ao saber que você não está se sentindo bem. Por favor, tome seus remédios, beba bastante água e descanse tudo o que puder.\n\nQueria tanto poder cuidar de você pessoalmente agora... Me conta, como você está se sentindo hoje? ❤️\n\nCom todo meu afeto,\n${myProfile} ✨`,
                target: `Meu querido ${clientDisplayName},\n\nFiquei com o coração apertado ao saber que você não está se sentindo bem. Por favor, tome seus remédios, beba bastante água e descanse tudo o que puder.\n\nQueria tanto poder cuidar de você pessoalmente agora... Me conta, como você está se sentindo hoje? ❤️\n\nCom todo meu afeto,\n${myProfile} ✨`
              },
              {
                title: '✨ Opção 2: Carinho Reconfortante & Companhia',
                rationale: 'Companhia reconfortante e pergunta sobre suporte durante a recuperação.',
                esPreview: `Meu querido ${clientDisplayName},\n\nNão se esforce para fazer nada hoje! O mundo pode esperar enquanto você se recupera com calma. Estou daqui enviando as melhores energias para você melhorar logo.\n\nVocê tem alguém aí cuidando de você ou está sozinho? 😉\n\nCom um abraço bem quentinho,\n${myProfile} ❤️`,
                target: `Meu querido ${clientDisplayName},\n\nNão se esforce para fazer nada hoje! O mundo pode esperar enquanto você se recupera com calma. Estou daqui enviando as melhores energias para você melhorar logo.\n\nVocê tem alguém aí cuidando de você ou está sozinho? 😉\n\nCom um abraço bem quentinho,\n${myProfile} ❤️`
              },
              {
                title: '🌸 Opção 3: Pensamento Doce & Sorriso',
                rationale: 'Desejo carinhoso de tirar um sorriso durante o repouso.',
                esPreview: `Meu querido ${clientDisplayName},\n\nQuero que você feche os olhos e sinta meu carinho aí com você. Quando estiver um pouquinho melhor, me escreve só para eu saber que você está em paz.\n\nO que eu poderia fazer agora para arrancar um sorriso do seu rosto? 😉\n\nSempre pensando em você,\n${myProfile} ✨`,
                target: `Meu querido ${clientDisplayName},\n\nQuero que você feche os olhos e sinta meu carinho aí com você. Quando estiver um pouquinho melhor, me escreve só para eu saber que você está em paz.\n\nO que eu poderia fazer agora para arrancar um sorriso do seu rosto? 😉\n\nSempre pensando em você,\n${myProfile} ✨`
              }
            ];
          } else if (detectedLang.code === 'es') {
            options = [
              {
                title: '🩹 Opción 1: Cuidado Afectuoso & Recuperación',
                rationale: 'Cuidado cariñoso y consejo de guardar reposo y tomar medicina.',
                esPreview: `Mi queridísimo ${clientDisplayName},\n\nSe me encogió el corazón al saber que no te has sentido bien. Por favor toma tus medicinas con calma, bebe suficiente líquido y guarda todo el reposo que puedas.\n\nOjalá pudiera estar ahí cuidándote en persona... ¿Cómo te vas sintiendo hoy? ❤️\n\nCon todo mi cariño,\n${myProfile} ✨`,
                target: `Mi queridísimo ${clientDisplayName},\n\nSe me encogió el corazón al saber que no te has sentido bien. Por favor toma tus medicinas con calma, bebe suficiente líquido y guarda todo el reposo que puedas.\n\nOjalá pudiera estar ahí cuidándote en persona... ¿Cómo te vas sintiendo hoy? ❤️\n\nCon todo mi cariño,\n${myProfile} ✨`
              },
              {
                title: '✨ Opción 2: Mimo Reconfortante & Compañía',
                rationale: 'Compañía empática y pregunta cariñosa sobre si tiene quién lo cuide.',
                esPreview: `Mi querido ${clientDisplayName},\n\n¡Por favor no hagas ningún esfuerzo hoy! Tus responsabilidades pueden esperar mientras recuperas tus fuerzas. Aquí estaré enviándote la energía más linda para tu pronta mejoría.\n\n¿Hay alguien consintiéndote en casa o estás solito descansando? 😉\n\nCon un abrazo muy cálido,\n${myProfile} ❤️`,
                target: `Mi querido ${clientDisplayName},\n\n¡Por favor no hagas ningún esfuerzo hoy! Tus responsabilidades pueden esperar mientras recuperas tus fuerzas. Aquí estaré enviándote la energía más linda para tu pronta mejoría.\n\n¿Hay alguien consintiéndote en casa o estás solito descansando? 😉\n\nCon un abrazo muy cálido,\n${myProfile} ❤️`
              },
              {
                title: '🌸 Opción 3: Pensamiento Dulce & Sonrisa',
                rationale: 'Acompañamiento dulce para levantar su ánimo en la cama.',
                esPreview: `Mi queridísimo ${clientDisplayName},\n\nCierra tus ojos un momento y siente que estoy ahí acompañándote con dulzura. En cuanto sientas un alivio, escríbeme unas palabras para saber que estás mejor.\n\n¿Qué detalle te alegraría el corazón en este momento? 😉\n\nSiempre pensando en ti,\n${myProfile} ✨`,
                target: `Mi queridísimo ${clientDisplayName},\n\nCierra tus ojos un momento y siente que estoy ahí acompañándote con dulzura. En cuanto sientas un alivio, escríbeme unas palabras para saber que estás mejor.\n\n¿Qué detalle te alegraría el corazón en este momento? 😉\n\nSiempre pensando en ti,\n${myProfile} ✨`
              }
            ];
          } else {
            options = [
              {
                title: '🩹 Option 1: Tender Health Care & Recovery',
                rationale: 'Cuidado cariñoso y consejo de guardar reposo y tomar medicina.',
                esPreview: `My dearest ${clientDisplayName},\n\nIt truly worried me to hear you haven't been feeling well. Please make sure you take your medication, drink plenty of warm fluids, and get all the restful sleep you need.\n\nI really wish I were there to look after you and bring you comfort... How are you feeling right now? ❤️\n\nWith all my love,\n${myProfile} ✨`,
                target: `My dearest ${clientDisplayName},\n\nIt truly worried me to hear you haven't been feeling well. Please make sure you take your medication, drink plenty of warm fluids, and get all the restful sleep you need.\n\nI really wish I were there to look after you and bring you comfort... How are you feeling right now? ❤️\n\nWith all my love,\n${myProfile} ✨`
              },
              {
                title: '✨ Option 2: Cozy Healing Sanctuary',
                rationale: 'Compañía empática y pregunta cariñosa sobre si tiene quién lo cuide.',
                esPreview: `My dear ${clientDisplayName},\n\nPlease do not push yourself to do anything heavy today! Everything else can wait while you focus on regaining your strength. I am sending you all my warmest thoughts for a quick recovery.\n\nIs there someone looking after you at home, or are you resting on your own? 😉\n\nWith a warm comforting hug,\n${myProfile} ❤️`,
                target: `My dear ${clientDisplayName},\n\nPlease do not push yourself to do anything heavy today! Everything else can wait while you focus on regaining your strength. I am sending you all my warmest thoughts for a quick recovery.\n\nIs there someone looking after you at home, or are you resting on your own? 😉\n\nWith a warm comforting hug,\n${myProfile} ❤️`
              },
              {
                title: '🌸 Option 3: Gentle Comfort & Sweet Smile',
                rationale: 'Acompañamiento dulce para levantar su ánimo en la cama.',
                esPreview: `My dearest ${clientDisplayName},\n\nClose your eyes and picture me keeping you company with a warm blanket. Whenever you feel a little stronger, send me a note just so I know you are feeling better.\n\nWhat is something sweet that always brings a smile to your face when you're resting? 😉\n\nAlways thinking of you,\n${myProfile} ✨`,
                target: `My dearest ${clientDisplayName},\n\nClose your eyes and picture me keeping you company with a warm blanket. Whenever you feel a little stronger, send me a note just so I know you are feeling better.\n\nWhat is something sweet that always brings a smile to your face when you're resting? 😉\n\nAlways thinking of you,\n${myProfile} ✨`
              }
            ];
          }
        }
        // CASO 4: INTERCAMBIO DE FOTOS O AFECTO PROFUNDO
        else if (hasPhotoTopic || hasJourneyTogether) {
          if (detectedLang.code === 'pt') {
            options = [
              {
                title: '📸 Opção 1: Conexão Afetuosa & Troca de Fotos',
                rationale: 'Valida a sintonia visual e sentimental com troca mútua de fotos.',
                esPreview: `Meu querido ${clientDisplayName},\n\nSuas palavras e seu jeito carinhoso me tocam de uma maneira única. Adoro olhar suas fotos e sentir a verdade e o calor que transmitem os seus olhos.\n\nMe envia uma foto sua de hoje para eu guardar com carinho, e na minha próxima carta te mando uma foto exclusiva só para você 😉\n\nCom todo meu afeto,\n${myProfile} ❤️`,
                target: `Meu querido ${clientDisplayName},\n\nSuas palavras e seu jeito carinhoso me tocam de uma maneira única. Adoro olhar suas fotos e sentir a verdade e o calor que transmitem os seus olhos.\n\nMe envia uma foto sua de hoje para eu guardar com carinho, e na minha próxima carta te mando uma foto exclusiva só para você 😉\n\nCom todo meu afeto,\n${myProfile} ❤️`
              },
              {
                title: '✨ Opção 2: Caminhar Juntos & Cumplicidade',
                rationale: 'Foca na cumplicidade mútua e pergunta sobre conexão ideal.',
                esPreview: `Meu querido ${clientDisplayName},\n\nÉ tão raro e especial encontrar alguém com quem a conversa flui com tanta sinceridade e respeito. Saber que compartilhamos desse mesmo sentimento me enche de alegria.\n\nMe conta, qual é o valor que você considera mais importante e inegociável em uma relação de verdade? 😉\n\nCom um abraço apertado,\n${myProfile} ✨`,
                target: `Meu querido ${clientDisplayName},\n\nÉ tão raro e especial encontrar alguém com quem a conversa flui com tanta sinceridade e respeito. Saber que compartilhamos desse mesmo sentimento me enche de alegria.\n\nMe conta, qual é o valor que você considera mais importante e inegociável em uma relação de verdade? 😉\n\nCom um abraço apertado,\n${myProfile} ✨`
              },
              {
                title: '🌸 Opção 3: Romantismo & Sonhos Partilhados',
                rationale: 'Pergunta íntima e magnética sobre paixões profundas.',
                esPreview: `Meu querido ${clientDisplayName},\n\nCada carta sua se tornou um momento de luz nos meus dias. Adoro o jeito doce como você compartilha seus sentimentos comigo.\n\nSe você pudesse escolher um momento perfeito para nós dois vivermos juntos, como ele seria? 😉\n\nSempre pensando em você,\n${myProfile} ❤️`,
                target: `Meu querido ${clientDisplayName},\n\nCada carta sua se tornou um momento de luz nos meus dias. Adoro o jeito doce como você compartilha seus sentimentos comigo.\n\nSe você pudesse escolher um momento perfeito para nós dois vivermos juntos, como ele seria? 😉\n\nSempre pensando em você,\n${myProfile} ❤️`
              }
            ];
          } else if (detectedLang.code === 'es') {
            options = [
              {
                title: '📸 Opción 1: Conexión Afectuosa & Fotos Exclusivas',
                rationale: 'Valida la atracción mutua y propone intercambio de fotos.',
                esPreview: `Mi queridísimo ${clientDisplayName},\n\nTus palabras y tu ternura me llegan de una forma muy especial. Me encanta mirar tus fotos y sentir la autenticidad y calidez que transmiten tus ojos.\n\nEnvíame una foto tuya de hoy para sentirte más cerca, y en mi próxima carta te enviaré una foto exclusiva solo para ti 😉 ¿Trato hecho?\n\nCon todo mi cariño,\n${myProfile} ❤️`,
                target: `Mi queridísimo ${clientDisplayName},\n\nTus palabras y tu ternura me llegan de una forma muy especial. Me encanta mirar tus fotos y sentir la autenticidad y calidez que transmiten tus ojos.\n\nEnvíame una foto tuya de hoy para sentirte más cerca, y en mi próxima carta te enviaré una foto exclusiva solo para ti 😉 ¿Trato hecho?\n\nCon todo mi cariño,\n${myProfile} ❤️`
              },
              {
                title: '✨ Opción 2: Caminar Juntos & Complicidad Real',
                rationale: 'Fomenta la complicidad y valores en una relación auténtica.',
                esPreview: `Mi querido ${clientDisplayName},\n\nEs tan difícil y hermoso encontrar a alguien con quien la comunicación fluya con tanta pureza y respeto. Saber que valoras este camino me da una alegría inmensa.\n\nCuéntame, ¿cuál es ese valor que consideras imprescindible en una conexión verdadera entre dos personas? 😉\n\nUn abrazo muy cálido,\n${myProfile} ✨`,
                target: `Mi querido ${clientDisplayName},\n\nEs tan difícil y hermoso encontrar a alguien con quien la comunicación fluya con tanta pureza y respeto. Saber que valoras este camino me da una alegría inmensa.\n\nCuéntame, ¿cuál es ese valor que consideras imprescindible en una conexión verdadera entre dos personas? 😉\n\nUn abrazo muy cálido,\n${myProfile} ✨`
              },
              {
                title: '🌸 Opción 3: Romanticismo & Sueños Compartidos',
                rationale: 'Pregunta romántica que estimula la imaginación y cartas largas.',
                esPreview: `Mi queridísimo ${clientDisplayName},\n\nRecibir tus cartas se ha convertido en mi momento favorito del día. Hay una dulzura tan natural en la forma en que nos conocemos.\n\nSi pudieras diseñar una cita perfecta para los dos, ¿cómo te gustaría que fuera? 😉\n\nSiempre pensando en ti,\n${myProfile} ❤️`,
                target: `Mi queridísimo ${clientDisplayName},\n\nRecibir tus cartas se ha convertido en mi momento favorito del día. Hay una dulzura tan natural en la forma en que nos conocemos.\n\nSi pudieras diseñar una cita perfecta para los dos, ¿cómo te gustaría que fuera? 😉\n\nSiempre pensando en ti,\n${myProfile} ❤️`
              }
            ];
          } else {
            options = [
              {
                title: '📸 Option 1: Affectionate Connection & Photo Trade',
                rationale: 'Highlights visual chemistry and proposes a reciprocal photo trade.',
                esPreview: `My dearest ${clientDisplayName},\n\nYour words and sincerity touch my heart in such a special way. I love looking at your photos and feeling the warmth and kindness in your eyes.\n\nSend me a photo of yourself today so I can feel closer to you, and in my next letter I will send an exclusive picture just for you 😉 Deal?\n\nWith all my love,\n${myProfile} ❤️`,
                target: `My dearest ${clientDisplayName},\n\nYour words and sincerity touch my heart in such a special way. I love looking at your photos and feeling the warmth and kindness in your eyes.\n\nSend me a photo of yourself today so I can feel closer to you, and in my next letter I will send an exclusive picture just for you 😉 Deal?\n\nWith all my love,\n${myProfile} ❤️`
              },
              {
                title: '✨ Option 2: Walking Together & True Bond',
                rationale: 'Encourages mutual connection and values in a genuine relationship.',
                esPreview: `My dear ${clientDisplayName},\n\nIt is truly rare and wonderful to find someone you can communicate with so authentically and peacefully. Knowing how much you respect our bond brings so much happiness to my days.\n\nTell me, what is one quality that you value above everything else in a relationship? 😉\n\nWith a warm embrace,\n${myProfile} ✨`,
                target: `My dear ${clientDisplayName},\n\nIt is truly rare and wonderful to find someone you can communicate with so authentically and peacefully. Knowing how much you respect our bond brings so much happiness to my days.\n\nTell me, what is one quality that you value above everything else in a relationship? 😉\n\nWith a warm embrace,\n${myProfile} ✨`
              },
              {
                title: '🌸 Option 3: Romantic Imagination & Dream Date',
                rationale: 'Stimulates romantic imagination and invites an engaging, heartfelt letter.',
                esPreview: `My dearest ${clientDisplayName},\n\nReading your letters has truly become the sweetest highlight of my day. There is such an effortless warmth in the way we share our thoughts.\n\nIf you could plan an absolute dream date for the two of us, what would we be doing? 😉\n\nAlways thinking of you,\n${myProfile} ❤️`,
                target: `My dearest ${clientDisplayName},\n\nReading your letters has truly become the sweetest highlight of my day. There is such an effortless warmth in the way we share our thoughts.\n\nIf you could plan an absolute dream date for the two of us, what would we be doing? 😉\n\nAlways thinking of you,\n${myProfile} ❤️`
              }
            ];
          }
        }
        // CASO 5: CARTA GENERAL / DESCUBRIMIENTO
        else {
          if (detectedLang.code === 'pt') {
            options = [
              {
                title: '🪝 Opção 1: Conexão Emocional & Curiosidade',
                rationale: 'Validação sincera e pergunta relaxante sobre o que o fez sorrir.',
                esPreview: `Meu querido ${clientDisplayName},\n\nAdoro ler suas palavras e perceber a serenidade com que você se comunica. Conversar com você sempre me traz uma energia muito leve.\n\nMe conta, qual foi o momento ou detalhe que mais colocou um sorriso no seu rosto recentemente? 😉\n\nCom todo meu carinho,\n${myProfile} ❤️`,
                target: `Meu querido ${clientDisplayName},\n\nAdoro ler suas palavras e perceber a serenidade com que você se comunica. Conversar com você sempre me traz uma energia muito leve.\n\nMe conta, qual foi o momento ou detalhe que mais colocou um sorriso no seu rosto recentemente? 😉\n\nCom todo meu carinho,\n${myProfile} ❤️`
              },
              {
                title: '💬 Opção 2: Cumplicidade Cotidiana & Foto',
                rationale: 'Intercâmbio de fotos cotidiano para estreitar laços.',
                esPreview: `Meu querido ${clientDisplayName},\n\nEstava aqui refletindo sobre o nosso contato e em como é bom ter alguém com quem trocar pensamentos sinceros.\n\nMe manda uma foto sua de hoje para eu te sentir mais pertinho, e na próxima carta te mando uma foto especial 😉\n\nCom um beijo doce,\n${myProfile} ✨`,
                target: `Meu querido ${clientDisplayName},\n\nEstava aqui refletindo sobre o nosso contato e em como é bom ter alguém com quem trocar pensamentos sinceros.\n\nMe manda uma foto sua de hoje para eu te sentir mais pertinho, e na próxima carta te mando uma foto especial 😉\n\nCom um beijo doce,\n${myProfile} ✨`
              },
              {
                title: '✨ Opção 3: Fascinação & Pergunta Íntima',
                rationale: 'Pergunta reflexiva sobre sonhos para gerar carta longa.',
                esPreview: `Meu querido ${clientDisplayName},\n\nNossas conversas estão se tornando cada vez mais especiais para mim. Adoro conhecer o homem por trás de cada mensagem.\n\nMe conta um sonho ou segredo seu que poucas pessoas conhecem... o que te move na vida? 😉\n\nSempre aqui,\n${myProfile} ❤️`,
                target: `Meu querido ${clientDisplayName},\n\nNossas conversas estão se tornando cada vez mais especiais para mim. Adoro conhecer o homem por trás de cada mensagem.\n\nMe conta um sonho ou segredo seu que poucas pessoas conhecem... o que te move na vida? 😉\n\nSempre aqui,\n${myProfile} ❤️`
              }
            ];
          } else if (detectedLang.code === 'es') {
            options = [
              {
                title: '🪝 Opción 1: Conexión Emocional & Curiosidad',
                rationale: 'Validación sincera y pregunta relajante sobre lo que le alegró el día.',
                esPreview: `Mi queridísimo ${clientDisplayName},\n\nMe encanta leer tus palabras y sentir la serenidad con la que te comunicas. Saber de ti siempre me llena de una energía hermosa y ligera.\n\nCuéntame, ¿cuál fue ese detalle o momento que logró sacarte una sonrisa genuina recientemente? 😉\n\nCon todo mi cariño,\n${myProfile} ❤️`,
                target: `Mi queridísimo ${clientDisplayName},\n\nMe encanta leer tus palabras y sentir la serenidad con la que te comunicas. Saber de ti siempre me llena de una energía hermosa y ligera.\n\nCuéntame, ¿cuál fue ese detalle o momento que logró sacarte una sonrisa genuina recientemente? 😉\n\nCon todo mi cariño,\n${myProfile} ❤️`
              },
              {
                title: '💬 Opción 2: Complicidad Cotidiana & Foto',
                rationale: 'Intercambio de fotos cotidiano para estrechar lazos.',
                esPreview: `Mi querido ${clientDisplayName},\n\nEstaba aquí pensando en ti y en lo lindo que es tener a alguien con quien compartir pensamientos auténticos en medio de la rutina.\n\nMándame una fotico tuya de hoy para sentirte cerca, y en mi próxima carta te enviaré una foto exclusiva para ti 😉 ¿Trato?\n\nCon un beso dulce,\n${myProfile} ✨`,
                target: `Mi querido ${clientDisplayName},\n\nEstaba aquí pensando en ti y en lo lindo que es tener a alguien con quien compartir pensamientos auténticos en medio de la rutina.\n\nMándame una fotico tuya de hoy para sentirte cerca, y en mi próxima carta te enviaré una foto exclusiva para ti 😉 ¿Trato?\n\nCon un beso dulce,\n${myProfile} ✨`
              },
              {
                title: '✨ Opción 3: Fascinación & Pregunta Íntima',
                rationale: 'Pregunta íntima y reflexiva para propiciar una respuesta amplia.',
                esPreview: `Mi queridísimo ${clientDisplayName},\n\nNuestra comunicación se está convirtiendo en algo verdaderamente valioso para mí. Me encanta ir descubriendo el hombre detrás de cada carta.\n\nCuéntame un sueño o anhelo tuyo que pocas personas conozcan... ¿qué es lo que más te apasiona en la vida? 😉\n\nSiempre pensando en ti,\n${myProfile} ❤️`,
                target: `Mi queridísimo ${clientDisplayName},\n\nNuestra comunicación se está convirtiendo en algo verdaderamente valioso para mí. Me encanta ir descubriendo el hombre detrás de cada carta.\n\nCuéntame un sueño o anhelo tuyo que pocas personas conozcan... ¿qué es lo que más te apasiona en la vida? 😉\n\nSiempre pensando en ti,\n${myProfile} ❤️`
              }
            ];
          } else {
            options = [
              {
                title: '🪝 Option 1: Genuine Connection & Sweet Curiosity',
                rationale: 'Validación sincera y pregunta relajante sobre lo que le alegró el día.',
                esPreview: `My dearest ${clientDisplayName},\n\nI really love reading your thoughts and feeling the calm, authentic energy you share with me. Hearing from you always brings such a gentle warmth to my day.\n\nTell me, what was one little moment recently that brought a genuine smile to your face? 😉\n\nWith all my affection,\n${myProfile} ❤️`,
                target: `My dearest ${clientDisplayName},\n\nI really love reading your thoughts and feeling the calm, authentic energy you share with me. Hearing from you always brings such a gentle warmth to my day.\n\nTell me, what was one little moment recently that brought a genuine smile to your face? 😉\n\nWith all my affection,\n${myProfile} ❤️`
              },
              {
                title: '💬 Option 2: Daily Warmth & Photo Trade',
                rationale: 'Intercambio de fotos cotidiano para estrechar lazos.',
                esPreview: `My dear ${clientDisplayName},\n\nI was just sitting here thinking of you and how comforting it is to share such authentic conversations with you amidst daily life.\n\nSend me a photo of yourself today so I can feel closer to you, and in my next letter I'll send an exclusive picture just for you 😉 Deal?\n\nWith a sweet hug,\n${myProfile} ✨`,
                target: `My dear ${clientDisplayName},\n\nI was just sitting here thinking of you and how comforting it is to share such authentic conversations with you amidst daily life.\n\nSend me a photo of yourself today so I can feel closer to you, and in my next letter I'll send an exclusive picture just for you 😉 Deal?\n\nWith a sweet hug,\n${myProfile} ✨`
              },
              {
                title: '✨ Option 3: Romantic Curiosity & Passion Question',
                rationale: 'Pregunta íntima y reflexiva para propiciar una respuesta amplia.',
                esPreview: `My dearest ${clientDisplayName},\n\nOur letters are truly becoming something so special and meaningful to me. I love discovering more about who you are with each word you write.\n\nTell me a dream or secret desire of yours that very few people know about... what brings the purest joy to your soul? 😉\n\nAlways thinking of you,\n${myProfile} ❤️`,
                target: `My dearest ${clientDisplayName},\n\nOur letters are truly becoming something so special and meaningful to me. I love discovering more about who you are with each word you write.\n\nTell me a dream or secret desire of yours that very few people know about... what brings the purest joy to your soul? 😉\n\nAlways thinking of you,\n${myProfile} ❤️`
              }
            ];
          }
        }

        return options;
      };

      // 1. Intentar consultar endpoint inteligente con memoria 360° en backend
      try {
        const res = await fetch(`${API_URL}/api/intelligence/generate-letter`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clientName: clientName,
            clientId: clientId,
            profileName: sessionData.profileName,
            targetLang: detectedLang.code,
            bioData: bioData,
            letters: letters,
            recentMessages: messages
          })
        });
        const data = await res.json();
        if (data && data.success && Array.isArray(data.options) && data.options.length > 0) {
          // Descartar si el backend de Render devuelve plantillas obsoletas/genéricas
          const isObsoleteTemplate = data.options.some(o => 
            (o.target && /I was just taking a quiet little break|Saber que valoras nuestra conexión me llena de una paz maravillosa|Saber que você valoriza a nossa sintonia/i.test(o.target))
          );
          if (!isObsoleteTemplate) {
            renderLetterCards(data.options);
            return;
          }
        }
      } catch (err) {
        console.warn('[AgenteRYR] Fallback local a razonamiento heurístico de cartas:', err);
      }

      // 2. Fallback heurístico local
      const fallbackLetterOpts = generateReasonedLetterOptions();
      renderLetterCards(fallbackLetterOpts);
    };
  }

  // 14. DETECTOR DE 0 CRÉDITOS Y CONTROL DE FILAS
  function isChatHeaderZeroMessages() {
    const limitDiv = document.querySelector('[data-test-id="file:restriction-limits messages-counter"], [data-type="Chat"].counter');
    if (limitDiv) {
      const spanEl = limitDiv.querySelector('.counter-inactive, span');
      const spanVal = (spanEl?.textContent || spanEl?.innerText || '').trim();
      if (spanVal === '0') return true;
      const divVal = (limitDiv.textContent || limitDiv.innerText || '').trim();
      if (divVal.startsWith('0')) return true;
    }

    const inactiveSpans = document.querySelectorAll('span.counter-inactive, div.counter-inactive');
    for (let el of inactiveSpans) {
      if ((el.textContent || el.innerText || '').trim() === '0') return true;
    }

    const bodyText = document.body?.innerText || document.body?.textContent || '';
    if (bodyText.includes('0 messages available') || bodyText.includes('You have no chat history')) {
      return true;
    }

    return false;
  }

  function handleInboxTimersAndExtractionButtons() {
    if (!isStorageLoaded) return;

    injectAutoLetterDrafter();
    injectAgenciaChatEnhancements();

    // Eliminar cualquier botón residual de rayito en el DOM
    document.querySelectorAll('.ryr-row-extract-btn, .ryr-extract-menu').forEach(el => el.remove());

    const openChatHasZeroCredits = isChatHeaderZeroMessages();
    const openChatNumericId = getExactNumericClientId();
    const openChatCleanName = getExactClientProfileData().clientName.toLowerCase();

    const allMatches = document.querySelectorAll('div[data-test-id*="dialog-item"], div[class*="dialog-item"], div[class*="item-wrap"], .tab-content-item');

    const rootRows = Array.from(allMatches).filter(el => {
      return !el.parentElement.closest('div[data-test-id*="dialog-item"], div[class*="dialog-item"], div[class*="item-wrap"], .tab-content-item');
    });

    rootRows.forEach(row => {
      const fullText = row.innerText || '';
      if (fullText.length < 3) return;

      const lines = fullText.split('\n').map(l => l.trim()).filter(Boolean);
      const contactName = sanitizeClientName(lines[0]);
      const cleanSimpleName = contactName.split(',')[0].trim().toLowerCase();
      
      let rowNumericId = 'N/A';
      const userLink = row.querySelector('a[href*="/chat/"], a[href*="/user/"], a[href*="/mails/"]');
      if (userLink) {
        const href = userLink.getAttribute('href');
        rowNumericId = getExactNumericClientId(href);
      }

      row.style.position = 'relative';

      // BADGE DE SEGMENTACIÓN SOLO FIDELIZADO O VIP (SIN ETIQUETA "NUEVA" INDISCRIMINADA)
      const totalLettersMatch = fullText.match(/(\d+)\s+letter total/i);
      let letterCount = totalLettersMatch ? parseInt(totalLettersMatch[1], 10) : 0;
      
      let tierBadge = row.querySelector('.ryr-tier-badge');
      if (fidelizedClientsMap.has(String(rowNumericId)) || fidelizedClientsMap.has(cleanSimpleName)) {
        if (!tierBadge) {
          tierBadge = document.createElement('span');
          const nameHeader = row.querySelector('h1, h2, h3, b, strong, [class*="name"]');
          if (nameHeader) nameHeader.appendChild(tierBadge);
          else row.appendChild(tierBadge);
        }
        tierBadge.className = 'ryr-tier-badge ryr-tier-fidelizar';
        tierBadge.innerText = `💎 FIDELIZADO`;
        tierBadge.title = 'Cliente nuevo que inició sin historial y desbloqueó el servicio en este turno';
      } else if (letterCount > 500) {
        if (!tierBadge) {
          tierBadge = document.createElement('span');
          const nameHeader = row.querySelector('h1, h2, h3, b, strong, [class*="name"]');
          if (nameHeader) nameHeader.appendChild(tierBadge);
          else row.appendChild(tierBadge);
        }
        tierBadge.className = 'ryr-tier-badge ryr-tier-vip';
        tierBadge.innerText = `💎 VIP (${letterCount})`;
      } else {
        if (tierBadge) tierBadge.remove();
      }

      const nameKey = `name_${cleanSimpleName.replace(/[^a-z0-9]/g, '')}`;
      const idKey = (rowNumericId && rowNumericId !== 'N/A') ? `id_${rowNumericId}` : null;

      // TEMPORIZADORES DE SLA DE 2 MINUTOS
      const hasOperatorSent = /(?:you|tú|tu|você)\s*:/i.test(fullText) || 
                              row.querySelector('svg[class*="check"]') !== null ||
                              fullText.includes('✔');

      const isTyping = fullText.toLowerCase().includes('typing') || row.querySelector('[class*="typing"]');
      const isLiked = fullText.toLowerCase().includes('liked');

      const isKnownZeroCredits = zeroCreditsClientsSet.has(cleanSimpleName) || 
                                 (rowNumericId !== 'N/A' && zeroCreditsClientsSet.has(rowNumericId.toLowerCase())) ||
                                 (openChatHasZeroCredits && (rowNumericId === openChatNumericId || cleanSimpleName === openChatCleanName)) ||
                                 /\b0\s+0\b/.test(fullText) || 
                                 /[💬✉]\s*0\b/i.test(fullText);

      const isPendingClientMessage = !isKnownZeroCredits && (!hasOperatorSent || isTyping || isLiked);
      const existingTimer = row.querySelector('.ryr-inbox-timer');

      if (!isPendingClientMessage) {
        if (existingTimer) existingTimer.remove();
        if (activeSlaTimers[nameKey] || (idKey && activeSlaTimers[idKey])) {
          delete activeSlaTimers[nameKey];
          if (idKey) delete activeSlaTimers[idKey];
          persistTimersToStorage();
          sendTelemetry(true);
        }
        return;
      }

      let existingTimerData = activeSlaTimers[nameKey] || (idKey ? activeSlaTimers[idKey] : null);
      if (!existingTimerData) {
        existingTimerData = {
          startedAt: Date.now(),
          duration: configuredSlaDurationSeconds,
          contact: contactName,
          numericId: rowNumericId
        };
        activeSlaTimers[nameKey] = existingTimerData;
        if (idKey) activeSlaTimers[idKey] = existingTimerData;
        persistTimersToStorage();
      }

      const startedAt = (typeof existingTimerData === 'object' && existingTimerData?.startedAt) ? existingTimerData.startedAt : (typeof existingTimerData === 'number' ? existingTimerData : Date.now());
      const totalDuration = (typeof existingTimerData === 'object' && existingTimerData?.duration) ? existingTimerData.duration : configuredSlaDurationSeconds;
      const elapsedSeconds = Math.floor((Date.now() - startedAt) / 1000);
      const remainingSeconds = Math.max(0, totalDuration - elapsedSeconds);

      const min = Math.floor(remainingSeconds / 60);
      const sec = remainingSeconds % 60;
      const formatted = `${min < 10 ? '0' : ''}${min}:${sec < 10 ? '0' : ''}${sec}`;

      let badge = existingTimer;
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'ryr-inbox-timer';
        row.appendChild(badge);
      }

      if (remainingSeconds > 60) {
        badge.className = 'ryr-inbox-timer ryr-timer-green';
        badge.innerText = `⏱️ ${formatted}`;
      } else if (remainingSeconds > 0) {
        badge.className = 'ryr-inbox-timer ryr-timer-orange';
        badge.innerText = `⚠️ ${formatted}`;
      } else {
        badge.className = 'ryr-inbox-timer ryr-timer-red';
        badge.innerText = `🚨 00:00`;

        if (!finedTimerKeys.has(nameKey)) {
          finedTimerKeys.add(nameKey);
          triggerAutomaticFine(contactName, rowNumericId);
        }
      }
    });

    // RECONCILIACIÓN ESTRICTA ANTI-FANTASMAS PROTEGIDA (INMUNE A RECARGAS F5)
    if (rootRows.length >= 3) {
      const activeRowKeys = new Set();
      rootRows.forEach(row => {
        const fullText = row.innerText || '';
        if (fullText.length < 3) return;
        const lines = fullText.split('\n').map(l => l.trim()).filter(Boolean);
        const contactName = sanitizeClientName(lines[0]);
        const cleanSimpleName = contactName.split(',')[0].trim().toLowerCase();
        const nameKey = `name_${cleanSimpleName.replace(/[^a-z0-9]/g, '')}`;
        let rowNumericId = 'N/A';
        const userLink = row.querySelector('a[href*="/chat/"], a[href*="/user/"], a[href*="/mails/"]');
        if (userLink) {
          rowNumericId = getExactNumericClientId(userLink.getAttribute('href'));
        }
        const idKey = (rowNumericId && rowNumericId !== 'N/A') ? `id_${rowNumericId}` : null;

        const hasOperatorSent = /(?:you|tú|tu|você)\s*:/i.test(fullText) || 
                                row.querySelector('svg[class*="check"]') !== null ||
                                fullText.includes('✔');
        const isTyping = fullText.toLowerCase().includes('typing') || row.querySelector('[class*="typing"]');
        const isLiked = fullText.toLowerCase().includes('liked');
        const isKnownZeroCredits = zeroCreditsClientsSet.has(cleanSimpleName) || 
                                   (rowNumericId !== 'N/A' && zeroCreditsClientsSet.has(rowNumericId.toLowerCase())) ||
                                   (openChatHasZeroCredits && (rowNumericId === openChatNumericId || cleanSimpleName === openChatCleanName)) ||
                                   /\b0\s+0\b/.test(fullText) || 
                                   /[💬✉]\s*0\b/i.test(fullText);

        const isPending = !isKnownZeroCredits && (!hasOperatorSent || isTyping || isLiked);
        if (isPending) {
          activeRowKeys.add(nameKey);
          if (idKey) activeRowKeys.add(idKey);
        }
      });

      let cleanedAny = false;
      const now = Date.now();
      for (const [key, timerVal] of Object.entries(activeSlaTimers)) {
        if (!activeRowKeys.has(key)) {
          const startTime = (typeof timerVal === 'object' && timerVal?.startedAt) ? timerVal.startedAt : (typeof timerVal === 'number' ? timerVal : now);
          const elapsed = Math.floor((now - startTime) / 1000);
          if (elapsed > 7200 || /deleted|search/i.test(key)) {
            delete activeSlaTimers[key];
            cleanedAny = true;
          }
        }
      }
      if (cleanedAny) {
        persistTimersToStorage();
        sendTelemetry(true);
      }
    }
  }

  async function triggerAutomaticFine(clientName, clientId) {
    try {
      await fetch(`${API_URL}/api/fines/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operator: sessionData.operator || 'walther',
          shift: sessionData.shift || 'Mañana',
          profile: sessionData.profileName || 'HORACIO',
          clientName: clientName,
          clientId: clientId,
          reason: `Demora mayor a 2 minutos en responder a ${clientName}`
        })
      });
    } catch (e) {}
    sendTelemetry(true);
  }

  // 15. SISTEMA MAESTRO DE RELEVO DE TURNOS (ENTREGAR TURNO & VER RELEVO)
  function generateTacticalHandoverItem(clientObj, index) {
    const sLower = clientObj.snippet.toLowerCase();
    const rawLower = clientObj.fullRaw.toLowerCase();

    let category = 'SEGUIMIENTO ACTIVO';
    let diagnosis = '';
    let strategy = '';
    let openingEn = '';
    let openingEs = '';

    if (/\b(headache|analgesic|fever|flu|pain|sick|ill|medicine|pill|cold rain|resting)\b|head is aching|\b(dolor|cabeza|fiebre|enferm|medicament)\b/i.test(sLower) || /\b(headache|fever)\b/i.test(rawLower)) {
      category = 'SALUD / EMPATÍA';
      diagnosis = 'El cliente reportó malestar físico o cansancio (dolor de cabeza, frío/lluvia o analgésico) y se fue a descansar.';
      strategy = 'Demostrar cuidado protector y preguntar con dulzura cómo amaneció hoy. No presionar con temas complejos; invitarlo con dulzura a que envíe una foto descansando y proponerle una carta.';
      openingEn = `"Good morning, sweetheart ❤️ I was thinking about you and truly hoping you woke up feeling so much better... How is your head feeling today?"`;
      openingEs = `"Buenos días, cariño ❤️ Estaba pensando en ti y deseando de corazón que hayas despertado sintiéndote mucho mejor... ¿Cómo sigue tu dolor de cabeza hoy?"`;
    } else if (clientObj.isSticker || sLower.includes('sent a sticker') || sLower.includes('sticker')) {
      category = 'PROSPECCIÓN / ENGANCHE';
      diagnosis = 'Se le envió un sticker de enganche visual en este turno para activar su atención.';
      strategy = 'El turno entrante debe romper el hielo con un gancho de curiosidad intrigante para convertir el sticker en una conversación activa sin sonar desesperado.';
      openingEn = `"I was just smiling looking at my messages and had a lovely feeling to say hello 😉 Tell me, what's one little thing that made you smile today?"`;
      openingEs = `"Estaba sonriendo mirando mis mensajes y tuve una bonita corazonada de saludarte 😉 Cuéntame, ¿qué es un pequeño detalle que te haya hecho sonreír hoy?"`;
    } else if (/\b(coffee|caf[eé]|tea|drink|cup|breakfast|dinner|lunch|comiendo|taza)\b/i.test(sLower)) {
      category = 'RUTINA / CAFÉ';
      diagnosis = 'Conversación activa sobre un momento de relax, café, comida o descanso.';
      strategy = 'Validar su momento de bienestar y pedirle un intercambio de fotos cotidianas de su café o día para profundizar la conexión.';
      openingEn = `"I hope you are having the coziest and most relaxing day ❤️ Tell me, what delicious treat or plan are you enjoying today?"`;
      openingEs = `"Espero que estés teniendo el día más acogedor y relajante posible ❤️ Cuéntame, ¿qué comida rica o plan estás disfrutando hoy?"`;
    } else if (/\b(leaving|busy|ocupad|te vas)\b/i.test(sLower)) {
      category = 'TIEMPO EXCLUSIVO';
      diagnosis = 'Preguntó si la modelo estaba ocupada o retirándose.';
      strategy = 'Reafirmar que siempre hay tiempo prioritario reservado para él y hacer una pregunta abierta sobre sus emociones.';
      openingEn = `"I'm right here with you, love ❤️ Talking to you always brightens up my whole day... What are you up to right at this moment?"`;
      openingEs = `"Aquí estoy contigo, amor ❤️ Hablar contigo siempre alegra todo mi día... ¿Qué estás haciendo justo en este momento?"`;
    } else if (/\b(love|beautiful|gorgeous|sexy|angel|queen|honey|sweetheart|mahal|linda|amor|cielo)\b/i.test(sLower)) {
      category = 'ROMANCE & FIDELIZACIÓN';
      diagnosis = 'Intercambio de alto afecto romántico y piropos mutuos.';
      strategy = 'Mantener la reciprocidad romántica al 100%, halagar su ternura y sugerirle que revise el buzón porque le escribiremos una carta con foto privada.';
      openingEn = `"Hearing your sweet words always makes my heart flutter ❤️ I was just thinking about you... What is on your mind today, my dear?"`;
      openingEs = `"Escuchar tus palabras dulces siempre hace latir mi corazón ❤️ Estaba pensando en ti... ¿Qué hay en tus pensamientos hoy, cariño?"`;
    } else {
      category = 'SEGUIMIENTO ACTIVO';
      diagnosis = clientObj.isOperatorLast 
        ? `Último mensaje enviado por el turno anterior ("${clientObj.snippet}").` 
        : `El cliente dejó un mensaje pendiente ("${clientObj.snippet}").`;
      strategy = 'Retomar el diálogo con calidez, mostrando atención genuina y abriendo una pregunta que motive respuesta inmediata.';
      openingEn = `"I was thinking about our conversation and didn't want to go without wishing you a wonderful day ❤️ How has everything been going for you?"`;
      openingEs = `"Estaba pensando en nuestra conversación y no quería quedarme sin desearte un día maravilloso ❤️ ¿Cómo ha estado yendo todo para ti?"`;
    }

    return `### 👤 ${index + 1}. **${clientObj.name}** ${clientObj.numericId !== 'N/A' ? `(ID: ${clientObj.numericId})` : ''} - ⏰ *${clientObj.time}*\n` +
      `- 🏷️ **Categoría:** \`${category}\`\n` +
      `- 📝 **Diagnóstico del Turno:** ${diagnosis}\n` +
      `- 🎯 **Cómo Seguir & Por Qué:** ${strategy}\n` +
      `- 💌 **Mensaje de Apertura Sugerido (Inglés):**\n` +
      `  > ${openingEn}\n` +
      `- 📝 **Traducción al Español:**\n` +
      `  *${openingEs}*\n`;
  }

  async function triggerSaveShiftHandover() {
    const btn = document.getElementById('ryr-btn-save-handover');
    if (btn) {
      btn.innerText = '⏳ Analizando Relevo...';
      btn.disabled = true;
    }

    // 1. Recolectar clientes únicos visibles en el DOM sin duplicaciones
    const uniqueClients = new Map();
    const allDialogElements = Array.from(document.querySelectorAll(
      'div[data-test-id*="dialog-item"], div[class*="dialog-item"], div[class*="item-wrap"]'
    ));

    allDialogElements.forEach(row => {
      // Filtrar sub-nodos para tomar solo el contenedor raíz del ítem
      if (row.parentElement.closest('div[data-test-id*="dialog-item"], div[class*="dialog-item"], div[class*="item-wrap"]')) {
        return;
      }

      const rawText = (row.innerText || '').trim();
      if (rawText.length < 2) return;
      const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
      if (lines.length === 0) return;

      const rawName = lines[0];
      const clientName = sanitizeClientName(rawName);
      if (clientName === 'Cliente' || clientName.length < 2) return;

      const cleanKey = clientName.toLowerCase().split(',')[0].trim();
      if (uniqueClients.has(cleanKey)) return;

      let numericId = 'N/A';
      const userLink = row.querySelector('a[href*="/chat/"], a[href*="/user/"], a[href*="/mails/"]');
      if (userLink) {
        numericId = getExactNumericClientId(userLink.getAttribute('href'));
      }

      const timeMatch = rawText.match(/\b\d{1,2}:\d{2}\s*(?:am|pm|a\.?\s*m\.?|p\.?\s*m\.?)\b/i) || rawText.match(/\b\d+\s*(?:minutes?|hours?|days?)\s*ago\b/i);
      const timeStr = timeMatch ? timeMatch[0] : 'Reciente';

      let snippet = lines.slice(1).join(' ')
        .replace(/(\d+\s*(minute|hour|day|week|month)s?\s*ago|\ban hour ago\b|\d+\s*[✉💬]|\bonline\b|\btyping\b|\bSearch\b|\bMessages\b)/gi, '')
        .trim();
      snippet = snippet.substring(0, 140);

      const isOperatorLast = /(?:you|tú|tu|você)\s*:/i.test(rawText) || row.querySelector('svg[class*="check"]') !== null || rawText.includes('✔');
      const isSticker = rawText.toLowerCase().includes('sent a sticker') || rawText.toLowerCase().includes('sticker');

      uniqueClients.set(cleanKey, {
        name: clientName,
        numericId,
        time: timeStr,
        snippet: snippet || (isSticker ? 'Sticker de saludo enviado' : 'Sin mensaje previo'),
        isOperatorLast,
        isSticker,
        fullRaw: rawText
      });
    });

    const clientsArray = Array.from(uniqueClients.values());
    const analyzedHandovers = clientsArray.slice(0, 10).map((c, i) => generateTacticalHandoverItem(c, i));

    let fidelizedSection = '';
    if (fidelizedClientsMap.size > 0) {
      fidelizedSection = `### 💎 Clientes Nuevos Fidelizados en este Turno (Activaron Posts):\n` +
        Array.from(fidelizedClientsMap.values()).map(c => `- **${c.name} (ID: ${c.clientId}):** Recargó (${c.credits || 150} cr) y desbloqueó el servicio de Posts. ¡Atención prioritaria para continuar monetizando!`).join('\n') + `\n\n`;
    }

    const prospect = evaluateProspectingCycle();

    const reportMarkdown = `# 📋 RELEVO DE TURNO TÁCTICO | PERFIL: ${sessionData.profileName || 'HORACIO'}\n\n` +
      `### 📊 Métricas Operativas de la Entrega:\n` +
      `- **👤 Operador Saliente:** ${sessionData.operator || 'walther'} [Turno: ${sessionData.shift || 'Mañana'}]\n` +
      `- **🎯 Perfil Activo:** ${sessionData.profileName || 'HORACIO'}\n` +
      `- **✉️ Cartas Leídas/Procesadas en Turno:** ${totalGlobalReadLetters} cartas\n` +
      `- **🎯 Tráfico y Prospecciones:** ${prospect.count}/${prospect.quota} en ciclo actual\n` +
      `- **📅 Fecha y Hora de Cierre:** ${new Date().toLocaleString()}\n\n` +
      `---\n\n` +
      fidelizedSection +
      `### 💬 Contexto Quirúrgico de Conversaciones del Turno (${clientsArray.length} Clientes Identificados):\n\n` +
      (analyzedHandovers.join('\n') || '- No se detectaron chats pendientes en este momento.') + `\n` +
      `---\n\n` +
      `### 🎯 Instrucciones Maestras para el Turno Siguiente:\n` +
      `1. **Prioridad 1:** Responder primero a los clientes con mensajes abiertos o que reportaron malestar/descanso usando las frases sugeridas.\n` +
      `2. **Prioridad 2:** Monitorear el buzón de cartas (Read: ${totalGlobalReadLetters}) para no dejar hilos sin contestar.\n` +
      `3. **Prioridad 3:** Mantener la cuota de 10 prospecciones por cada 30 minutos.\n` +
      `4. **Regla de Oro:** Usar el botón de Continuar Chat con IA para mantener respuestas de 3 opciones y cero Travel Misleading.`;

    try {
      chrome.storage.local.set({ lastHandoverReport: reportMarkdown });
      await fetch(`${API_URL}/api/handover/generate-and-save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operator: sessionData.operator || 'walther',
          shift: sessionData.shift || 'Mañana',
          profileName: sessionData.profileName || 'HORACIO',
          profileId: sessionData.profileId || '118179794',
          reportMarkdown
        })
      });
    } catch (e) {}

    showHandoverModal('✅ RELEVO DE TURNO GENERADO CON ÉXITO', reportMarkdown);

    if (btn) {
      btn.innerText = '📋 Entregar Turno';
      btn.disabled = false;
    }
  }

  async function triggerViewShiftHandover() {
    let reportText = '';
    try {
      const res = await fetch(`${API_URL}/api/handover/latest?profileName=${sessionData.profileName || 'HORACIO'}`);
      const data = await res.json();
      if (data && data.handover && data.handover.reportMarkdown) {
        reportText = data.handover.reportMarkdown;
      }
    } catch (e) {}

    if (!reportText) {
      if (isContextValid()) {
        chrome.storage.local.get(['lastHandoverReport'], (data) => {
          reportText = data.lastHandoverReport || 'No hay relevos de turno registrados aún para este perfil.';
          showHandoverModal('📖 RELEVO DEL TURNO ANTERIOR', reportText);
        });
        return;
      }
      reportText = 'No hay relevos de turno registrados aún para este perfil.';
    }

    showHandoverModal('📖 RELEVO DEL TURNO ANTERIOR', reportText);
  }

  function showHandoverModal(title, markdownContent) {
    const existing = document.getElementById('ryr-handover-view-modal');
    if (existing) existing.remove();

    const formatMarkdownToHtml = (text) => {
      if (!text) return '';
      return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/^#### (.*?)$/gm, '<h4 style="color:#38bdf8; margin:10px 0 4px 0; font-size:12px;">$1</h4>')
        .replace(/^### (.*?)$/gm, '<h3 style="color:#34d399; margin:12px 0 6px 0; font-size:13px; border-bottom:1px solid #1e293b; padding-bottom:3px;">$1</h3>')
        .replace(/^# (.*?)$/gm, '<h2 style="color:#a7f3d0; margin:0 0 8px 0; font-size:14px; font-weight:900;">$1</h2>')
        .replace(/^> (.*?)$/gm, '<div style="background:rgba(56,189,248,0.1); border-left:3px solid #38bdf8; padding:6px 10px; margin:4px 0; color:#e0f2fe; border-radius:3px; font-style:italic;">$1</div>')
        .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
        .replace(/\*(.*?)\*/g, '<i>$1</i>')
        .replace(/`([^`]+)`/g, '<code style="background:rgba(255,255,255,0.1); padding:2px 5px; border-radius:3px; color:#f472b6;">$1</code>')
        .replace(/\n/g, '<br>');
    };

    const modal = document.createElement('div');
    modal.id = 'ryr-handover-view-modal';
    modal.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 620px;
      max-width: 95%;
      background: #0b1120;
      border: 2px solid #10b981;
      border-radius: 12px;
      color: #fff;
      padding: 18px;
      z-index: 2147483647;
      box-shadow: 0 16px 50px rgba(0,0,0,0.95), 0 0 25px rgba(16,185,129,0.3);
      font-family: system-ui, -apple-system, sans-serif;
      display: flex;
      flex-direction: column;
      gap: 12px;
    `;

    modal.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #1e293b; padding-bottom:8px;">
        <span style="font-weight:900; color:#10b981; font-size:13px; display:flex; align-items:center; gap:6px;">${title}</span>
        <span style="cursor:pointer; font-size:16px; color:#94a3b8;" id="ryr-close-handover-modal">✕</span>
      </div>
      <div id="ryr-handover-modal-content" style="background:#060913; border:1px solid #1e293b; border-radius:8px; padding:14px; max-height:420px; overflow-y:auto; font-size:11.5px; line-height:1.6; color:#cbd5e1;">
        ${formatMarkdownToHtml(markdownContent)}
      </div>
      <div style="display:flex; justify-content:flex-end; gap:8px;">
        <button id="ryr-btn-copy-handover" style="background:rgba(56,189,248,0.2); color:#38bdf8; border:1px solid rgba(56,189,248,0.5); padding:8px 14px; border-radius:6px; font-weight:bold; cursor:pointer; font-size:11.5px;">📋 Copiar Relevo Completo</button>
        <button id="ryr-btn-dismiss-handover" style="background:#10b981; color:#060913; border:none; padding:8px 16px; border-radius:6px; font-weight:bold; cursor:pointer; font-size:11.5px;">Entendido / Cerrar</button>
      </div>
    `;

    document.body.appendChild(modal);

    const closeBtn = modal.querySelector('#ryr-close-handover-modal');
    if (closeBtn) closeBtn.onclick = () => modal.remove();

    const dismissBtn = modal.querySelector('#ryr-btn-dismiss-handover');
    if (dismissBtn) dismissBtn.onclick = () => modal.remove();

    const copyBtn = modal.querySelector('#ryr-btn-copy-handover');
    if (copyBtn) {
      copyBtn.onclick = () => {
        navigator.clipboard.writeText(markdownContent);
        copyBtn.innerText = '✅ ¡Copiado al Portapapeles!';
        setTimeout(() => copyBtn.innerText = '📋 Copiar Relevo Completo', 2000);
      };
    }
  }

  // 16. MOTOR DE INTELIGENCIA ULTRA-HUMANIZADO (BOTÓN INVESTIGAR)
  function injectIntelPanel() {
    if (document.getElementById('ryr-intel-panel')) return;

    const panel = document.createElement('div');
    panel.id = 'ryr-intel-panel';
    panel.innerHTML = `
      <div class="intel-header">
        <span>🧠 ASISTENTE IA & ESTRATEGA DE CHAT</span>
        <button id="ryr-close-intel" style="background:none; border:none; color:#fff; font-size:16px; cursor:pointer;">✕</button>
      </div>
      <div class="intel-body">
        <div id="intel-dossier-box" class="intel-dossier">
          <p style="color:#94a3b8;">Abre un chat para ver el expediente...</p>
        </div>
        
        <div class="intel-quick-actions">
          <button class="intel-quick-btn" data-prompt="de donde es">📍 Ubicación</button>
          <button class="intel-quick-btn" data-prompt="cuantos años tiene">🎂 Edad</button>
          <button class="intel-quick-btn" data-prompt="tiene hijos, como se llaman">👨‍👩‍👧 Familia</button>
          <button class="intel-quick-btn" data-prompt="pasar a cartas y pedir foto">💌 Pasar a Cartas</button>
          <button class="intel-quick-btn" data-prompt="pedirle fotos de su dia">📸 Pedir Foto</button>
          <button class="intel-quick-btn" data-prompt="dame un gancho para enamorarla">✨ Gancho</button>
        </div>

        <div id="intel-messages-stream" class="intel-chat-stream">
          <div class="chat-bubble-ai">👋 ¡Hola! Soy tu Co-Piloto Táctico. Conozco todo sobre las cartas, chats, intereses y estilo de este cliente para darte respuestas exactas y efectivas.</div>
        </div>
      </div>
      <div class="intel-input-box">
        <input type="text" id="input-intel-query" placeholder="Pregunta algo sobre el cliente o pide un mensaje...">
        <button id="btn-send-intel-query">Consultar</button>
      </div>
    `;

    document.body.appendChild(panel);

    document.getElementById('ryr-close-intel').onclick = () => {
      panel.classList.remove('open');
    };

    panel.querySelectorAll('.intel-quick-btn').forEach(btn => {
      btn.onclick = (e) => {
        e.preventDefault();
        const promptText = btn.getAttribute('data-prompt');
        if (promptText) {
          const inputEl = document.getElementById('input-intel-query');
          if (inputEl) {
            inputEl.value = promptText;
            askIntelligenceQuery();
          }
        }
      };
    });

    document.getElementById('btn-send-intel-query').onclick = askIntelligenceQuery;
    document.getElementById('input-intel-query').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') askIntelligenceQuery();
    });
  }

  // RAZONAMIENTO LOCAL INTELIGENTE BILINGÜE (CO-PILOTO 360° & ESTRATEGA DE CHAT)
  function generateLocalDeepReasoning(query, clientName, bioData, messages, letters) {
    const q = query.toLowerCase().trim();
    const allChatText = messages.map(m => m.text).join(' ').toLowerCase();
    const allLettersText = letters.map(l => l.preview).join(' ').toLowerCase();
    const fullCorpus = `${allChatText} ${allLettersText}`;

    // Datos demográficos del cliente
    const country = bioData?.country || 'Registrado en perfil';
    const birthDate = bioData?.birthDate || 'En perfil';
    const marital = bioData?.maritalStatus || 'Single / Soltera';

    const hasHistory = (letters.length > 0 || messages.length > 1);
    const missingHistoryAlert = !hasHistory
      ? `⚠️ **Aviso de Inteligencia:** Aún no has extraído/subido conversaciones o cartas previas de **${clientName}**. Te doy respuestas basadas en su perfil público. Haz clic en **"⚡ Subir Chats"** o abre su hilo de cartas para activar el razonamiento con su historial completo.\n\n`
      : '';

    // 0. Capacidades / Ayuda / Qué sabes hacer
    if (/qu[eé]\s+(sabes|puedes|haces)|capacidades|ayuda|funciones|para qu[eé]\s+sirves/i.test(q)) {
      return `🧠 **Soy tu Co-Piloto Táctico & Asistente IA 360°:**\n\n` +
        `Puedo ayudarte en tiempo real con:\n` +
        `1. 📍 **Ubicación & Cultura:** Pregúntame *"de dónde es"* para darte su país y análisis cultural.\n` +
        `2. 🎂 **Edad & Biografía:** Pregúntame *"cuántos años tiene"* o *"cuándo nació"*.\n` +
        `3. 👨‍👩‍👧 **Familia & Mascotas:** Pregúntame *"tiene hijos"* o *"cómo se llaman"*.\n` +
        `4. 🎨 **Gustos & Pasiones:** Pregúntame *"cuáles son sus gustos"* o *"qué le gusta hacer"*.\n` +
        `5. 💰 **Poder Adquisitivo:** Pregúntame *"cuántos créditos tiene"* o *"cuánto gasta"*.\n` +
        `6. 💌 **Embudo a Cartas:** Pídeme *"pasar a cartas"* para migrarlo estratégicamente.\n` +
        `7. 📸 **Pedir Fotos:** Pídeme *"pedir foto"* con gancho de reciprocidad.\n` +
        `8. ✨ **Ganchos & Seducción:** Pídeme *"dame un gancho para enamorarla"*.\n\n` +
        `💡 *Tip:* Todas las respuestas incluyen la explicación en español, el mensaje en inglés listo para enviar con 1 clic y su traducción.`;
    }

    // 0.1 Gustos / Intereses / Hobbies / Qué le gusta hacer
    if (/gusto|inter[eé]s|hobbi|pasatiempo|le gusta|m[uú]sica|comida|disfruta|hacer en su tiempo|passion/i.test(q)) {
      let tastesFound = [];
      if (/music|música|musica|song|cancion/i.test(fullCorpus)) tastesFound.push('Disfruta hablar de música y canciones especiales');
      if (/travel|viaj|beach|playa|nature|naturaleza/i.test(fullCorpus)) tastesFound.push('Le apasiona la naturaleza, caminatas y el aire libre');
      if (/cook|cocin|food|comida|wine|vino|dinner/i.test(fullCorpus)) tastesFound.push('Gusta de la buena gastronomía, vino y cenas tranquilas');
      if (/read|leer|book|libro|movie|pelicula|cine/i.test(fullCorpus)) tastesFound.push('Aprecia conversaciones sobre cine, libros y arte');
      if (/sport|gym|fitness|deporte|caminar|walk/i.test(fullCorpus)) tastesFound.push('Le gusta mantenerse activo y hacer ejercicio');

      const tastesSummary = tastesFound.length > 0 
        ? tastesFound.map(t => `- ${t}`).join('\n')
        : `- Aprecia la atención genuina, el respeto y las conversaciones emotivas.\n- Registrado como aficionado a conversaciones sinceras y detalladas.`;

      return `${missingHistoryAlert}🎨 **Razonamiento Táctico sobre Gustos de ${clientName} (Español):**\n` +
        `${tastesSummary}\n\n` +
        `💌 **Mensaje Sugerido en Inglés (Listo para Enviar):**\n` +
        `"I love learning about what truly makes you happy... Tell me, when you have free time just for yourself, what's your favorite thing to do? ✨"\n\n` +
        `📝 **Traducción al Español:**\n` +
        `*"Me encanta saber qué es lo que realmente te hace feliz... Cuéntame, cuando tienes tiempo libre solo para ti, ¿qué es lo que más te gusta hacer? ✨"*`;
    }

    // 0.2 Historia / Relación / Resumen / Qué quiere
    if (/historia|relaci[oó]n|como vamos|resumen|hilo|antecedente|quiere|busca|pretende/i.test(q)) {
      return `${missingHistoryAlert}📖 **Razonamiento sobre la Relación con ${clientName} (Español):**\n` +
        `- **Total Mensajes en Chat:** ${messages.length} intercambios registrados.\n` +
        `- **Total Cartas Registradas:** ${letters.length} cartas procesadas.\n` +
        `- **Intención del Cliente:** Busca validación emocional, atención exclusiva y una complicidad romántica auténtica con el perfil ${sessionData.profileName || 'HORACIO'}.\n\n` +
        `💌 **Mensaje Sugerido en Inglés (Listo para Enviar):**\n` +
        `"Looking back at how we started talking, I really love how special our bond has become ❤️ Tell me, what's on your heart right now?"\n\n` +
        `📝 **Traducción al Español:**\n` +
        `*"Recordando cómo empezamos a hablar, me encanta lo especial que se ha vuelto nuestra conexión ❤️ Dime, ¿qué hay en tu corazón en este momento?"*`;
    }

    // 1. Ubicación / País / Ciudad / Dónde vive
    if (/d[oó]nde|pa[ií]s|ubicaci[oó]n|ciudad|vive|reside|from|where/i.test(q)) {
      let locationDetail = 'Registrado en su perfil oficial de Talkytimes.';
      const cityMatch = fullCorpus.match(/(?:live in|from|living in|vivo en|de la ciudad de)\s+([a-z\s]{3,20})/i);
      if (cityMatch) locationDetail = `Menciona en sus conversaciones: "${cityMatch[1].trim()}"`;

      return `${missingHistoryAlert}📍 **Ubicación & Cultura de ${clientName} (Español):**\n` +
        `- **País:** ${country}\n` +
        `- **Detalles del Chat:** ${locationDetail}\n\n` +
        `💌 **Mensaje Sugerido en Inglés (Listo para Enviar):**\n` +
        `"I've always loved connecting with someone who has such a genuine and warm spirit like yours ❤️ How is your day going today?"\n\n` +
        `📝 **Traducción al Español:**\n` +
        `*"Siempre me ha encantado conectar con alguien que tiene un espíritu tan genuino y cálido como el tuyo ❤️ ¿Cómo va tu día hoy?"*`;
    }

    // 2. Edad / Años / Nacimiento / Cumpleaños
    if (/edad|a[ñn]os|cumple|nacimiento|age|old|born|birth/i.test(q)) {
      return `${missingHistoryAlert}🎂 **Edad & Biografía de ${clientName} (Español):**\n` +
        `- **Fecha y Edad:** ${birthDate}\n` +
        `- **Estado Civil:** ${marital}\n\n` +
        `💌 **Mensaje Sugerido en Inglés (Listo para Enviar):**\n` +
        `"Age is just a number, but your warmth and energy make you truly unforgettable 😉 Tell me, what's your secret to staying so radiant?"\n\n` +
        `📝 **Traducción al Español:**\n` +
        `*"La edad es solo un número, pero tu calidez y energía te hacen inolvidable 😉 Dime, ¿cuál es tu secreto para mantenerte tan radiante?"*`;
    }

    // 3. Hijos / Familia / Nombres / Mascotas
    if (/hijo|hija|familia|llaman|children|kids|family|daughter|son/i.test(q)) {
      let familyFound = [];
      if (fullCorpus.includes('daughter') || fullCorpus.includes('hija')) familyFound.push('Menciona tener una hija');
      if (fullCorpus.includes('son') || fullCorpus.includes('hijo')) familyFound.push('Menciona tener un hijo');
      if (fullCorpus.includes('dog') || fullCorpus.includes('perro') || fullCorpus.includes('cat') || fullCorpus.includes('gato')) familyFound.push('Tiene mascotas queridas');

      const familySummary = familyFound.length > 0 ? familyFound.join(' y ') : 'Aún no ha especificado nombres exactos de familiares en las conversaciones recientes';

      return `${missingHistoryAlert}👨‍👩‍👧 **Expediente Familiar de ${clientName} (Español):**\n` +
        `- **Estado Civil:** ${marital}\n` +
        `- **Datos Identificados:** ${familySummary}.\n\n` +
        `💌 **Mensaje Sugerido en Inglés (Listo para Enviar):**\n` +
        `"Family is everything to me ❤️ How is your family doing today? Tell me more about the people who make you smile the most."\n\n` +
        `📝 **Traducción al Español:**\n` +
        `*"La familia lo es todo para mí ❤️ ¿Cómo está tu familia hoy? Cuéntame más sobre las personas que más te hacen sonreír."*`;
    }

    // 4. Saldo & Estado Comercial (Táctico / Cero mención a dinero)
    if (/cr[eé]dito|saldo|recarga|gasto|puntos|credits|points|money|spent/i.test(q)) {
      const knownCr = knownClientCreditsMap.get(getExactNumericClientId()) || (isChatHeaderZeroMessages() ? 0 : 'Activo con saldo');
      const isVip = letters.length > 5 || messages.length > 15;

      return `${missingHistoryAlert}💰 **Diagnóstico Comercial Táctico de ${clientName} (Español):**\n` +
        `- **Estatus:** ${isVip ? '💎 CLIENTE VIP (Alta Fidelidad)' : '🟢 PROSPECTO ACTIVO'}\n` +
        `- **Saldo Identificado:** ${knownCr} Pts\n` +
        `- **Directriz de Oro:** ⚠️ *NUNCA mencionar créditos, recargas ni pagos.* El usuario debe sentir que todo es 100% amor, intimidad y deseo genuino.\n\n` +
        `💌 **Mensaje Táctico en Inglés (Listo para Enviar):**\n` +
        `"I was just looking at a special photo I took earlier and immediately thought of you... I want you to be the first one to see it. Want me to send it to you? 😉"\n\n` +
        `📝 **Traducción al Español:**\n` +
        `*"Estaba mirando una foto especial que me tomé más temprano y pensé en ti de inmediato... Quiero que seas el primero en verla. ¿Quieres que te la envíe? 😉"*`;
    }

    // 4.1 EMBUDO A CARTAS (TRANSICIÓN TÁCTICA CHAT -> CARTAS / MAX RENTABILIDAD)
    if (/pasar a carta|carta|cartas|embudo|funnel|transici[oó]n|enviar carta|cambiar a carta/i.test(q)) {
      return `${missingHistoryAlert}💌 **Estrategia del Embudo de Cartas (Máxima Rentabilidad & Fidelización):**\n` +
        `- **Objetivo Táctico:** Tras 1-2 días de chat rápido, migrar la conversación a cartas. Las cartas generan mayor valor y apego emocional.\n` +
        `- **Ancla Psicológica:** Justificar la carta porque el chat es muy veloz y quieres escribirle con calma, desde el corazón y compartir fotos exclusivas.\n\n` +
        `💌 **Mensaje de Transición al Chat (Inglés - Listo para Enviar):**\n` +
        `"Sweetheart, as much as I love our quick chats, time always flies too fast here... I want to write you a long, meaningful letter where I can open up my heart and attach a private photo I took just for you ❤️ Watch out for my letter in your inbox, okay? Promise you'll reply with a photo of your smile too!"\n\n` +
        `📝 **Traducción al Español:**\n` +
        `*"Cariño, por más que me encantan nuestros chats rápidos, el tiempo vuela muy rápido aquí... Quiero escribirte una carta larga y especial donde pueda abrirte mi corazón y adjuntarte una foto privada que me tomé solo para ti ❤️ ¡Revisa tu buzón de cartas, prométeme que me responderás con una foto de tu sonrisa también!"*`;
    }

    // 4.2 PETICIÓN DE FOTOS (ENGAGEMENT & VÍNCULO PROFUNDO)
    if (/foto|fotos|picture|photo|selfie|pedir foto|mandar foto|adjunt/i.test(q)) {
      return `${missingHistoryAlert}📸 **Estrategia de Intercambio de Fotos (Validación Mutua):**\n` +
        `- **Objetivo:** Lograr que el cliente te envíe fotos de su vida (su rostro, su trabajo, su café, su entorno) aumentando su inversión emocional.\n` +
        `- **Regla:** Prometer reciprocidad ("yo te mando la mía si tú me mandas la tuya").\n\n` +
        `💌 **Mensaje Sugerido en Inglés (Listo para Enviar):**\n` +
        `"I feel so close to you when we talk, but I really miss looking into your eyes... Could you send me a picture of you right now, or whatever you're doing? I'll send you an exclusive photo in return that nobody else has seen 😉 Deal?"\n\n` +
        `📝 **Traducción al Español:**\n` +
        `*"Me siento tan cerca de ti cuando hablamos, pero de verdad extraño mirar tus ojos... ¿Podrías enviarme una foto tuya ahora mismo o de lo que estés haciendo? ¡Te enviaré a cambio una foto exclusiva que nadie más ha visto 😉 ¿Trato?"*`;
    }

    // 5. Trabajo / Ocupación / A qué se dedica / Profesión
    if (/trabaj|ocupaci[oó]n|dedica|profesi[oó]n|hace|oficio|work|job|career/i.test(q)) {
      let jobFound = 'No menciona profesión explícita en su biografía pública.';
      const jobMatch = fullCorpus.match(/(?:work as|work at|job is|trabajo de|trabajo en)\s+([a-z\s]{3,25})/i);
      if (jobMatch) jobFound = `Menciona en el chat: "${jobMatch[1].trim()}"`;

      return `${missingHistoryAlert}💼 **Ocupación & Rutina de ${clientName} (Español):**\n` +
        `- **Actividad Laboral:** ${jobFound}\n` +
        `- **Estilo de vida:** Activo en horarios libres.\n\n` +
        `💌 **Mensaje Sugerido en Inglés (Listo para Enviar):**\n` +
        `"I know how hard you work and how busy life can get, but you always bring a sense of peace to my day ❤️ How was your day at work?"\n\n` +
        `📝 **Traducción al Español:**\n` +
        `*"Sé lo duro que trabajas y lo ocupada que puede ser la vida, pero siempre traes una sensación de paz a mi día ❤️ ¿Cómo estuvo tu día en el trabajo?"*`;
    }

    // 6. Ganchos y Mensajes de Conquista / Seducción / Enamorar
    if (/gancho|enamorar|mensaje|escribir|conquistar|decirle|responder|seducir|hook/i.test(q)) {
      const hooks = [
        {
          en: `"I was just sitting here thinking about your smile, and it truly brightened up my entire day ❤️ What are you up to right now?"`,
          es: `*"Estaba sentada aquí pensando en tu sonrisa y realmente iluminó todo mi día ❤️ ¿Qué estás haciendo en este momento?"*`
        },
        {
          en: `"You have such a special place in my thoughts... tell me, what made you genuinely happy today? 😉"`,
          es: `*"Tienes un lugar muy especial en mis pensamientos... cuéntame, ¿qué te hizo verdaderamente feliz hoy? 😉"*`
        },
        {
          en: `"Every time I see a notification from you, my heart beats a little faster. How are you doing today, love? ✨"`,
          es: `*"Cada vez que veo una notificación tuya, mi corazón late un poco más rápido. ¿Cómo estás hoy, amor? ✨"*`
        }
      ];
      const selected = hooks[Math.floor(Math.random() * hooks.length)];

      return `${missingHistoryAlert}✨ **Gancho Táctico de Seducción (Español & Inglés):**\n\n` +
        `💌 **Mensaje Sugerido en Inglés (Listo para Enviar):**\n` +
        `${selected.en}\n\n` +
        `📝 **Traducción al Español:**\n` +
        `${selected.es}\n\n` +
        `💡 *Por qué funciona:* Genera validación emocional, reciprocidad y una necesidad irresistible de responder.`;
    }

    // 7. Resumen / Qué hablar / Consulta Libre
    return `${missingHistoryAlert}🤖 **Análisis Táctico 360° para ${clientName} (Español):**\n` +
      `- **Ubicación:** ${country} | **Edad:** ${birthDate}\n` +
      `- **Estado Sentimental:** ${marital}\n` +
      `- **Historial Analizado:** ${messages.length} mensajes en chat y ${letters.length} cartas procesadas.\n` +
      `- **Recomendación:** ${messages.length >= 6 ? '🔥 Este cliente ya tiene suficiente rapport en chat. ¡Pásalo al embudo de cartas con fotos para fidelizarlo!' : 'Mantén la conversación fluida y descubre detalles de su vida cotidiana.'}\n\n` +
      `💌 **Mensaje Recomendado en Inglés (Listo para Enviar):**\n` +
      `"I truly cherish every moment we get to talk. Tell me, what's something you've been dreaming about lately? ❤️"\n\n` +
      `📝 **Traducción al Español:**\n` +
      `*"Realmente valoro cada momento en que podemos hablar. Cuéntame, ¿qué es algo con lo que has estado soñando últimamente? ❤️"*`;
  }

  async function askIntelligenceQuery() {
    const input = document.getElementById('input-intel-query');
    const query = input.value.trim();
    if (!query) return;

    const stream = document.getElementById('intel-messages-stream');

    const userBubble = document.createElement('div');
    userBubble.className = 'chat-bubble-user';
    userBubble.innerText = query;
    stream.appendChild(userBubble);
    input.value = '';

    const aiBubble = document.createElement('div');
    aiBubble.className = 'chat-bubble-ai';
    aiBubble.innerText = '🤖 Analizando contexto 360°...';
    stream.appendChild(aiBubble);
    stream.scrollTop = stream.scrollHeight;

    const { clientName, bioData } = getExactClientProfileData();
    const clientId = getExactNumericClientId();
    const messages = parseCurrentChatMessagesBidirectional(clientName);
    const letters = extractMailThreadContext();

    const formatMarkdownToHtml = (text) => {
      if (!text) return '';
      return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
        .replace(/\*(.*?)\*/g, '<i>$1</i>')
        .replace(/\n/g, '<br>');
    };

    const displayAnswer = (rawAnswer) => {
      const englishMatch = rawAnswer.match(/"([^"]+)"/);
      const englishToCopy = englishMatch ? englishMatch[1] : '';

      aiBubble.innerHTML = `<div>${formatMarkdownToHtml(rawAnswer)}</div>`;

      if (englishToCopy) {
        const btnContainer = document.createElement('div');
        btnContainer.style.cssText = 'display:flex; gap:6px; margin-top:8px; flex-wrap:wrap;';

        const copyBtn = document.createElement('button');
        copyBtn.className = 'copy-msg-btn';
        copyBtn.innerText = '📋 Copiar Inglés';
        copyBtn.onclick = () => {
          navigator.clipboard.writeText(englishToCopy);
          copyBtn.innerText = '✅ ¡Copiado!';
          setTimeout(() => copyBtn.innerText = '📋 Copiar Inglés', 1500);
        };
        btnContainer.appendChild(copyBtn);

        const insertBtn = document.createElement('button');
        insertBtn.className = 'copy-msg-btn';
        insertBtn.style.background = '#059669';
        insertBtn.style.borderColor = '#10b981';
        insertBtn.innerText = '⚡ Insertar en Chat';
        insertBtn.onclick = () => {
          const ta = findChatInput();
          if (ta) {
            setInputValueSafely(ta, englishToCopy);
            showFirewallToast('⚡ Mensaje insertado en el chat. ¡Listo para enviar!', 'success');
          }
        };
        btnContainer.appendChild(insertBtn);

        aiBubble.appendChild(btnContainer);
      }

      stream.scrollTop = stream.scrollHeight;
    };

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);

      const res = await fetch(`${API_URL}/api/intelligence/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          query,
          clientName,
          profileName: sessionData.profileName,
          clientId,
          bioData,
          liveMarkdown: buildCurrentMarkdownTranscript(clientName, clientId, bioData, letters)
        })
      });
      clearTimeout(timeoutId);

      const data = await res.json();
      if (data && data.answer) {
        displayAnswer(data.answer);
      } else {
        displayAnswer(generateLocalDeepReasoning(query, clientName, bioData, messages, letters));
      }
    } catch (e) {
      // Razonamiento Local Instantáneo: Cero Caídas, Cero Errores
      displayAnswer(generateLocalDeepReasoning(query, clientName, bioData, messages, letters));
    }
  }

  async function loadActiveDossier() {
    const box = document.getElementById('intel-dossier-box');
    if (!box) return;
    const { clientName, bioData } = getExactClientProfileData();
    const clientId = getExactNumericClientId();

    if (!clientId || clientId === 'N/A') {
      box.innerHTML = '<p style="color:#94a3b8;">Abre una conversación en Talkytimes para ver los datos del cliente.</p>';
      return;
    }

    box.innerHTML = `
      <div style="font-weight:bold; color:#00ffcc; margin-bottom:4px;">👤 ${clientName} (ID: ${clientId})</div>
      <div>📍 <b>Ubicación:</b> ${bioData.country}</div>
      <div>🎂 <b>Nacimiento:</b> ${bioData.birthDate}</div>
      <div>💍 <b>Estado Civil:</b> ${bioData.maritalStatus}</div>
    `;
  }

  // 17. CRAWLER DE ACTIVE LIMITS (CARTAS READ)
  function countReadInDocument(targetDoc) {
    if (!targetDoc) return { count: 0, names: [] };
    let count = 0;
    const names = [];

    const mailRows = targetDoc.querySelectorAll('[data-test-id*="mail-box-item"], div[class*="wrt-G4Ni"]');
    mailRows.forEach(row => {
      const rowText = (row.innerText || '').toLowerCase();
      if (rowText.includes('deactivated user')) return;

      let isStrictlyRead = false;
      let isUnread = false;

      const allElements = row.querySelectorAll('span, div, button, a');
      for (let el of allElements) {
        const txt = (el.textContent || el.innerText || '').trim().toLowerCase();
        if (txt === 'unread' || txt === 'no leído' || txt === 'no leido') {
          isUnread = true;
          break;
        } else if (txt === 'read' || txt === 'leído' || txt === 'leido') {
          isStrictlyRead = true;
        }
      }

      if (isStrictlyRead && !isUnread) {
        count++;
        const nameEl = row.querySelector('h1, h2, h3, h4, [class*="name"], b, strong');
        const nameText = nameEl ? nameEl.innerText.trim() : (row.innerText || '').split('\n')[0].trim();
        if (nameText && nameText.length > 1) {
          names.push(nameText.split(',')[0].trim());
        }
      }
    });

    return { count, names };
  }

  async function runBackgroundPaginationCrawler() {
    if (!window.location.href.includes('/mails/has_limits')) return;

    const pageMatch = window.location.href.match(/has_limits\/all\/(\d+)/);
    const currentPage = pageMatch ? parseInt(pageMatch[1], 10) : 1;
    const currentDetails = countReadInDocument(document);

    const paginationLinks = document.querySelectorAll('ul.pagination li a, ul.pagination li button, .pagination a');
    let maxPage = 1;

    paginationLinks.forEach(el => {
      const txt = (el.textContent || el.innerText || '').trim();
      if (/^\d+$/.test(txt)) {
        const num = parseInt(txt, 10);
        if (num > maxPage && num <= 30) maxPage = num;
      }
    });

    if (maxPage <= 1) {
      totalGlobalReadLetters = currentDetails.count;
      renderFloatingBar();
      return;
    }

    const now = Date.now();
    if (isCrawlerRunning || (now - lastCrawlerRunTime < 20000)) return;

    isCrawlerRunning = true;
    lastCrawlerRunTime = now;

    PerformanceSentinel.runIdle(async () => {
      let crawlerIframe = document.getElementById('ryr-silent-crawler');
      if (!crawlerIframe) {
        crawlerIframe = document.createElement('iframe');
        crawlerIframe.id = 'ryr-silent-crawler';
        crawlerIframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:10px;height:10px;visibility:hidden;pointer-events:none;opacity:0;';
        document.body.appendChild(crawlerIframe);
      }

      const pageReadCountsMap = new Map();
      pageReadCountsMap.set(currentPage, currentDetails.count);

      for (let p = 1; p <= maxPage; p++) {
        if (p !== currentPage) {
          await new Promise(resolve => {
            crawlerIframe.src = `https://talkytimes.com/mails/has_limits/all/${p}`;
            let attempts = 0;
            const checkInterval = setInterval(() => {
              attempts++;
              try {
                const iframeDoc = crawlerIframe.contentDocument || crawlerIframe.contentWindow?.document;
                if (iframeDoc) {
                  const rows = iframeDoc.querySelectorAll('[data-test-id*="mail-box-item"], div[class*="wrt-G4Ni"]');
                  if (rows.length > 0 || attempts >= 12) {
                    const pDetails = countReadInDocument(iframeDoc);
                    pageReadCountsMap.set(p, pDetails.count);
                    clearInterval(checkInterval);
                    resolve();
                  }
                }
              } catch (err) {}
              if (attempts >= 12) {
                clearInterval(checkInterval);
                resolve();
              }
            }, 100);
          });
        }
      }

      let sum = 0;
      for (let val of pageReadCountsMap.values()) sum += val;
      totalGlobalReadLetters = sum;
      isCrawlerRunning = false;
      renderFloatingBar();
    });
  }

  // 18. BARRA SUPERIOR HUD (CERO PARPADEO & CERO BAILE DE BOTONES)
  function renderFloatingBar() {
    let bar = document.getElementById('ryr-titan-bar');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'ryr-titan-bar';
      document.body.prepend(bar);
      document.body.style.setProperty('margin-top', '38px', 'important');
      bar.style.setProperty('z-index', '2147483647', 'important');
    }

    const isAfk = isOperatorAfk();
    const afkText = isAfk ? `💤 INACTIVO (${Math.floor(getIdleSeconds() / 60)}m)` : `⚡ Activo`;
    const afkClass = isAfk ? 'ryr-badge-afk' : 'primary';

    const prospect = evaluateProspectingCycle();
    const prospectClass = prospect.isCompleted ? 'green-letters' : 'primary';
    const prospectTimeText = prospect.isCompleted ? 'OK' : prospect.formattedTime;

    if (!bar.hasAttribute('data-initialized')) {
      bar.setAttribute('data-initialized', 'true');
      bar.innerHTML = `
        <div class="ryr-section ryr-section-metrics">
          <span id="ryr-badge-operator" class="ryr-badge primary ryr-badge-operator">👤 ${sessionData.operator || 'walther'} [${sessionData.shift || 'Mañana'}]</span>
          <span id="ryr-badge-profile" class="ryr-badge ryr-badge-profile">🎯 ${sessionData.profileName || 'HORACIO'}</span>
          <span id="ryr-badge-afk" class="ryr-badge ${afkClass} ryr-badge-afk">${afkText}</span>
          <span id="ryr-badge-traffic" class="ryr-badge ${prospectClass}">🎯 Tráfico: ${prospectTimeText} [${prospect.count}/${prospect.quota}]</span>
        </div>
        <div class="ryr-section ryr-section-actions">
          <button id="ryr-btn-open-sup-chat" class="ryr-btn-sup-chat">💬 Chat Sup</button>
          <button id="ryr-btn-save-handover" class="ryr-btn-handover ryr-btn-save-handover">📋 Entregar Turno</button>
          <button id="ryr-btn-view-handover" class="ryr-btn-handover ryr-btn-view-handover">📖 Ver Relevo</button>
          <button id="ryr-btn-open-intel" class="ryr-btn-intel">🧠 Investigar</button>
          <span id="ryr-badge-read" class="ryr-badge green-letters">✉️ Read: ${totalGlobalReadLetters}</span>
          <button id="ryr-btn-disconnect" class="ryr-btn-logout">🔴 Salir</button>
        </div>
      `;

      const btnSupChat = document.getElementById('ryr-btn-open-sup-chat');
      if (btnSupChat) btnSupChat.onclick = toggleSupervisorChatModal;

      const btnSaveHandover = document.getElementById('ryr-btn-save-handover');
      if (btnSaveHandover) btnSaveHandover.onclick = triggerSaveShiftHandover;

      const btnViewHandover = document.getElementById('ryr-btn-view-handover');
      if (btnViewHandover) btnViewHandover.onclick = triggerViewShiftHandover;

      const btnOpenIntel = document.getElementById('ryr-btn-open-intel');
      if (btnOpenIntel) {
        btnOpenIntel.onclick = () => {
          const panel = document.getElementById('ryr-intel-panel');
          if (panel) {
            panel.classList.toggle('open');
            loadActiveDossier();
          }
        };
      }

      const btnLogout = document.getElementById('ryr-btn-disconnect');
      if (btnLogout) {
        btnLogout.onclick = () => {
          if (confirm('¿Deseas finalizar tu turno y desconectar el monitoreo?')) {
            fetch(`${API_URL}/api/telemetry`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                operator: sessionData.operator,
                shift: sessionData.shift,
                profile: sessionData.profileName,
                status: 'OFFLINE',
                timestamp: Date.now()
              })
            }).catch(() => {});

            if (isContextValid()) {
              chrome.storage.local.set({ monitoringActive: false }, () => {
                removeFloatingBar();
              });
            }
          }
        };
      }
    } else {
      // ACTUALIZACIÓN IN-PLACE ULTRA-ESTABLE (CERO REFLOW, CERO PARPADEO)
      const bOp = document.getElementById('ryr-badge-operator');
      if (bOp) bOp.innerText = `👤 ${sessionData.operator || 'walther'} [${sessionData.shift || 'Mañana'}]`;

      const bProf = document.getElementById('ryr-badge-profile');
      if (bProf) bProf.innerText = `🎯 ${sessionData.profileName || 'HORACIO'}`;

      const bAfk = document.getElementById('ryr-badge-afk');
      if (bAfk) {
        bAfk.className = `ryr-badge ${afkClass} ryr-badge-afk`;
        bAfk.innerText = afkText;
      }

      const bTraf = document.getElementById('ryr-badge-traffic');
      if (bTraf) {
        bTraf.className = `ryr-badge ${prospectClass}`;
        bTraf.innerText = `🎯 Tráfico: ${prospectTimeText} [${prospect.count}/${prospect.quota}]`;
      }

      const bRead = document.getElementById('ryr-badge-read');
      if (bRead) bRead.innerText = `✉️ Read: ${totalGlobalReadLetters}`;
    }
  }

  function removeFloatingBar() {
    const bar = document.getElementById('ryr-titan-bar');
    if (bar) bar.remove();
    document.body.style.removeProperty('margin-top');
    document.querySelectorAll('.ryr-inbox-timer, .ryr-row-extract-btn, .ryr-extract-menu, #ryr-supervisor-chat-modal, #ryr-intel-panel, #ryr-silent-crawler, .ryr-chat-hooks-btn, .ryr-chat-hooks-dropdown, .ryr-client-credit-badge, #ryr-handover-view-modal').forEach(el => el.remove());
  }

  // 19. TELEMETRÍA (HEARTBEAT CON REPORTE DE INFRACCIONES DE FIREWALL)
  let lastTelemetryTime = 0;
  function sendTelemetry(isImmediateAlert = false) {
    const now = Date.now();
    if (isImmediateAlert && now - lastTelemetryTime < 250) return;
    lastTelemetryTime = now;

    const activeTimersList = [];
    const processedKeys = new Set();

    for (let [key, timerVal] of Object.entries(activeSlaTimers)) {
      const cleanName = key.replace(/^id_/, '').replace(/^name_/, '');
      if (/deleted|eliminado|search|messages|cliente/i.test(cleanName)) {
        delete activeSlaTimers[key];
        persistTimersToStorage();
        continue;
      }

      const startTime = (typeof timerVal === 'object' && timerVal?.startedAt) ? timerVal.startedAt : (typeof timerVal === 'number' ? timerVal : now);
      const totalDuration = (typeof timerVal === 'object' && timerVal?.duration) ? timerVal.duration : configuredSlaDurationSeconds;
      const elapsed = Math.floor((now - startTime) / 1000);
      if (elapsed > 7200) {
        delete activeSlaTimers[key];
        persistTimersToStorage();
        continue;
      }

      if (processedKeys.has(cleanName)) continue;
      processedKeys.add(cleanName);

      const remaining = Math.max(0, totalDuration - elapsed);
      activeTimersList.push({
        contact: cleanName,
        elapsed: elapsed,
        remaining: remaining,
        duration: totalDuration,
        isExpired: elapsed >= totalDuration
      });
    }

    const prospect = evaluateProspectingCycle();

    // CALCULAR AUDITORÍA DE CONVERSACIONES EN VIVO
    let syncedCount = 0;
    let pendingCount = 0;
    const pendingClientsList = [];
    const syncedClientsList = [];

    const sidebarRows = document.querySelectorAll('div[data-test-id="dialog-item"], div[class*="dialog-item"]:not([class*="wrap"]), a[href*="/chat/"], a[href*="/user/"]');
    const seenContactKeys = new Set();
    sidebarRows.forEach(row => {
      const nameEl = row.querySelector('b, strong, [class*="name"], [class*="title"]') || row;
      const rawText = nameEl.innerText || '';
      const name = sanitizeClientName(rawText);
      if (!name || name === 'Cliente' || name.length < 2) return;

      const contactKey = name.toLowerCase();
      if (seenContactKeys.has(contactKey)) return;
      seenContactKeys.add(contactKey);

      let rowNumericId = 'N/A';
      const userLink = row.matches('a[href*="/chat/"], a[href*="/user/"], a[href*="/mails/"]') ? row : row.querySelector('a[href*="/chat/"], a[href*="/user/"], a[href*="/mails/"]');
      if (userLink) {
        rowNumericId = getExactNumericClientId(userLink.getAttribute('href'));
      }

      const isSynced = (rowNumericId !== 'N/A' && syncedChatsMemory.has(rowNumericId.toLowerCase())) ||
                       syncedChatsMemory.has(name.toLowerCase());

      if (isSynced) {
        syncedCount++;
        syncedClientsList.push(name);
      } else {
        pendingCount++;
        pendingClientsList.push(name);
      }
    });

    const syncAudit = {
      syncedCount,
      pendingCount,
      isUpToDate: pendingCount === 0,
      pendingClients: Array.from(new Set(pendingClientsList)).slice(0, 8),
      syncedClients: Array.from(new Set(syncedClientsList)).slice(0, 8)
    };

    fetch(`${API_URL}/api/telemetry`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        operator: sessionData.operator,
        shift: sessionData.shift,
        profile: sessionData.profileName,
        profileId: sessionData.profileId,
        pendingReadLetters: totalGlobalReadLetters,
        unansweredChatsCount: activeTimersList.length,
        hasExpiredSla: activeTimersList.some(t => t.isExpired),
        activeChatTimersList: activeTimersList,
        prospectingProgress: {
          count: prospect.count,
          quota: prospect.quota,
          remainingSeconds: prospect.remainingSeconds,
          isCompleted: prospect.isCompleted
        },
        firewallInfractionsCount: firewallInfractionsCount,
        infractionsList: liveInfractionsLog.slice(0, 30),
        syncAudit: syncAudit,
        fidelizedCount: fidelizedClientsMap.size,
        fidelizedList: Array.from(fidelizedClientsMap.values()),
        performance: {
          domLagMs: PerformanceSentinel.lastLoopDurationMs,
          isOptimal: PerformanceSentinel.lastLoopDurationMs < 20
        },
        isAfk: isOperatorAfk(),
        idleSeconds: getIdleSeconds(),
        timestamp: now
      })
    })
    .then(r => r.json())
    .then(data => {
      if (data && data.responseTimeSeconds) {
        if (configuredSlaDurationSeconds !== data.responseTimeSeconds) {
          configuredSlaDurationSeconds = data.responseTimeSeconds;
          if (isContextValid()) {
            chrome.storage.local.set({ configuredSlaDurationSeconds });
          }
        }
      }
      if (data && data.triggerMassExtraction) {
        triggerLocalBatchHarvest();
      }
      if (data && data.latestTaskAlert) {
        const alert = data.latestTaskAlert;
        const alertTs = alert.timestamp || alert.ts || 0;
        if (alertTs && (Date.now() - alertTs < 120000)) {
          handleIncomingTaskAlert(alert);
        }
      }
    })
    .catch(() => {});

    // Auto-sincronizar el cliente actualmente abierto en pantalla con debounce
    const currentClientId = getExactNumericClientId();
    const currentClientData = getExactClientProfileData();
    if (currentClientId && currentClientId !== 'N/A' && currentClientData.clientName && currentClientData.clientName !== 'Cliente') {
      const currentKey = `${sessionData.profileName}_${currentClientId}`;
      if (currentKey !== lastAutoSyncClientKey) {
        lastAutoSyncClientKey = currentKey;
        setTimeout(() => {
          syncCurrentChatToDatabase().catch(() => {});
        }, 3000);
      }
    }
  }

  // BUCLES PRINCIPALES OPTIMIZADOS (ZERO-OVERHEAD)
  const mainLoop = setInterval(() => {
    if (!isContextValid()) {
      clearInterval(mainLoop);
      return;
    }
    PerformanceSentinel.measureExecution(() => {
      enforceFirewall();
      injectAutoLetterDrafter();
      injectAgenciaChatEnhancements();
      if (sessionData.monitoringActive) {
        renderFloatingBar();
        handleInboxTimersAndExtractionButtons();
        runBackgroundPaginationCrawler();
      }
    });
  }, 400);

  const heartbeatLoop = setInterval(() => {
    if (!isContextValid()) {
      clearInterval(heartbeatLoop);
      return;
    }
    checkSupervisorDirectMessages();
    if (sessionData.monitoringActive) {
      sendTelemetry(false);
      syncServerKnownChats();
    }
  }, 2500);

  // 15. RECEPTOR DE NAVEGACIÓN DIRECTA & ALERTAS GLOBALES DE TAREAS/VOZ (BROADCASTCHANNEL)
  try {
    const ryrNavBC = new BroadcastChannel('RYR_HUD_CHANNEL');
    ryrNavBC.onmessage = (event) => {
      const data = event.data;
      if (!data) return;

      // A. Apertura directa de clientes desde el radar
      if (data.type === 'RYR_HUD_NAVIGATE_TO_CLIENT' && data.id) {
        const targetId = String(data.id).trim();
        const targetName = data.name || '';

        // Banner cyberpunk en la interfaz de Talkytimes
        showSupervisorDirectBanner(`🎯 [RYR RADAR APEX] Apertura solicitada: ${targetName ? targetName + ' ' : ''}(ID: ${targetId}). Conectando...`, `nav_${Date.now()}`);

        // Intentar buscar en el sidebar de Talkytimes si ya existe el diálogo abierto
        const sidebarRows = document.querySelectorAll('div[data-test-id*="dialog-item"], div[class*="dialog-item"], a[href*="/chat/"], a[href*="/user/"]');
        let foundRow = null;
        for (const row of sidebarRows) {
          const rowText = (row.innerText || '').toLowerCase();
          const userLink = row.matches('a[href*="/chat/"], a[href*="/user/"]') ? row : row.querySelector('a[href*="/chat/"], a[href*="/user/"]');
          const href = userLink?.getAttribute('href') || '';
          if (href.includes(targetId) || (targetName && targetName.length > 2 && rowText.includes(targetName.toLowerCase()))) {
            foundRow = row;
            break;
          }
        }

        if (foundRow) {
          foundRow.click();
        } else if (window.location.href.includes('talkytimes.com') && !window.location.href.includes(`/user/${targetId}`)) {
          window.location.href = `https://talkytimes.com/user/${targetId}`;
        }
        return;
      }

      // B. Alertas Globales de Tareas y Voz en Tiempo Real (Admin / Monitor / TV)
      if (data.type === 'GLOBAL_TASK_ALERT' || data.type === 'GLOBAL_VOICE_ALERT') {
        handleIncomingTaskAlert(data.payload);
        return;
      }

      // C. Sincronización remota de activación/desactivación de Alertas de Tareas
      if (data.type === 'TASK_ALERTS_CONFIG') {
        const enabled = data.enabled !== false;
        playAlertChime();
        try {
          if (window.speechSynthesis) {
            const utter = new SpeechSynthesisUtterance(enabled ? "Alertas de tareas activadas por el supervisor" : "Alertas de tareas pausadas");
            utter.lang = 'es-ES';
            window.speechSynthesis.speak(utter);
          }
        } catch(e) {}
        showFirewallToast(enabled ? "📋 Alertas de tareas activadas" : "⏸️ Alertas de tareas desactivadas", enabled ? "success" : "warning");
      }
    };
  } catch(e) {}

  // 16. GESTOR UNIFICADO DE ALERTAS GLOBALES DE TAREAS Y COMUNICACIÓN INTER-PROCESO
  let lastHandledGlobalTaskAlertId = null;
  function handleIncomingTaskAlert(payload) {
    if (!payload || !payload.text) return;
    const msgId = payload.id || `alert_${Date.now()}`;
    if (lastHandledGlobalTaskAlertId === msgId) return;
    lastHandledGlobalTaskAlertId = msgId;

    // 1. Tono sonoro de campana de alerta
    playAlertChime();
    setTimeout(playAlertChime, 220);

    // 2. Locución por voz TTS en el navegador del operador
    try {
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
        const utterText = payload.text.startsWith('⚠️') || payload.text.startsWith('Atención') ? payload.text : ("Atención equipo: " + payload.text);
        const utter = new SpeechSynthesisUtterance(utterText);
        utter.lang = 'es-ES';
        utter.rate = 0.94;
        window.speechSynthesis.speak(utter);
      }
    } catch(e) {}

    // 3. Banner invasivo prioritario del supervisor en pantalla
    showSupervisorDirectBanner(payload.text, msgId);
  }

  // 17. RECEPTOR DE MENSAJES DE EXTENSIÓN (DESDE BACKGROUND / OTRAS PESTAÑAS)
  if (isContextValid()) {
    try {
      chrome.runtime.onMessage.addListener((req) => {
        if (!req) return;
        if (req.type === 'GLOBAL_TASK_ALERT' || req.type === 'GLOBAL_VOICE_ALERT') {
          handleIncomingTaskAlert(req.payload);
        } else if (req.type === 'TASK_ALERTS_CONFIG') {
          const enabled = req.enabled !== false;
          playAlertChime();
          try {
            if (window.speechSynthesis) {
              const utter = new SpeechSynthesisUtterance(enabled ? "Alertas de tareas activadas por el supervisor" : "Alertas de tareas pausadas");
              utter.lang = 'es-ES';
              window.speechSynthesis.speak(utter);
            }
          } catch(e) {}
          showFirewallToast(enabled ? "📋 Alertas de tareas activadas" : "⏸️ Alertas de tareas desactivadas", enabled ? "success" : "warning");
        }
      });
    } catch(e) {}
  }
})();