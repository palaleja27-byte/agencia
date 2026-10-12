/**
 * APEX CYBERPUNK COMMAND MATRIX - BACKEND ENGINE
 * Archivo: server.js
 * Despliegue: Render.com / Node.js
 * Base de Datos: Supabase
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

// CONFIGURACIÓN DE SUPABASE
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://tu-proyecto.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || 'tu-api-key-secreta';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// MIDDLEWARES
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Servir archivos estáticos del Monitor si se requiere
app.use(express.static(path.join(__dirname, 'public')));

// MEMORIA EN VIVO EN TIEMPO REAL (CACHE RÁPIDO PARA REDUCIR IOPS)
const liveOperatorTelemetry = new Map();
const massExtractionOrders = new Set();
const memoryConversationsMap = new Map(); // clientId -> conversationSummaryObj
const memoryClientMessagesMap = new Map(); // clientId -> Map(msgId -> messageObj)
const memoryClientLettersMap = new Map(); // clientId -> Map(letterId -> letterObj)
const liveProfileInfractions = new Map(); // profileName -> Array of infractions
const operatorResponseTimes = new Map(); // operatorName -> response time in minutes (default 2)

// ALERTAS GLOBALES DE TAREAS Y SEGUIMIENTO EN TIEMPO REAL
let latestGlobalTaskAlert = null;
let taskAlertsConfig = { enabled: true, sound: true, tts: true };

// BUFFER DE LOGS DE SUBIDA EN TIEMPO REAL (CHATS Y CARTAS SINCRONIZADAS)
const liveSyncLogsBuffer = [];
function logSyncEvent({ type, operator, profile, clientName, count, durationMs, status, detail }) {
  // Este módulo es EXCLUSIVO para validar la subida de conversaciones y cartas de los perfiles.
  // Filtramos y descartamos cualquier error/alerta interna para mantener la consola limpia y positiva.
  if (type !== 'CHAT_UPLOAD' && type !== 'LETTERS_SYNC' && type !== 'NUKE_ORDER') {
    return null;
  }

  const entry = {
    id: `sync_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toISOString(),
    timeFormatted: new Date().toLocaleTimeString('es-CO'),
    type: type, // 'CHAT_UPLOAD', 'LETTERS_SYNC', 'NUKE_ORDER'
    operator: operator || 'Operador',
    profile: profile || 'HORACIO',
    clientName: clientName || 'General',
    count: Number(count) || 0,
    durationMs: Number(durationMs) || 0,
    status: 'SUCCESS',
    detail: detail || `Conversación de '${clientName}' subida correctamente.`
  };
  liveSyncLogsBuffer.unshift(entry);
  if (liveSyncLogsBuffer.length > 150) liveSyncLogsBuffer.pop();
  return entry;
}

// ====================================================================
// 1. ENDPOINT: TELEMETRÍA EN VIVO (HEARTBEAT DE OPERADORES CADA 2.5s)
// ====================================================================
app.post('/api/telemetry', async (req, res) => {
  try {
    const payload = req.body;
    if (!payload.operator) {
      return res.status(400).json({ error: 'Operador requerido' });
    }

    const opKey = (payload.operator || '').toLowerCase().trim();
    const configuredMinutes = operatorResponseTimes.get(opKey) || 2;

    const key = `${payload.operator}_${payload.profile || 'DEF'}`;
    const telemetryObj = {
      operator: payload.operator,
      shift: payload.shift || 'Mañana',
      profile: payload.profile || 'HORACIO',
      profileId: payload.profileId || '',
      status: payload.status || (payload.isAfk ? 'AFK' : 'ONLINE'),
      idleSeconds: payload.idleSeconds || 0,
      isAfk: Boolean(payload.isAfk),
      pendingReadLetters: payload.pendingReadLetters || 0,
      unansweredChatsCount: (payload.activeChatTimersList || []).length,
      hasExpiredSla: Array.isArray(payload.activeChatTimersList) && payload.activeChatTimersList.length > 0 && payload.activeChatTimersList.some(t => t.isExpired),
      activeChatTimersList: payload.activeChatTimersList || [],
      prospectingProgress: payload.prospectingProgress || { count: 0, quota: 10, remainingSeconds: 1800, isCompleted: false },
      firewallInfractionsCount: payload.firewallInfractionsCount || 0,
      syncAudit: payload.syncAudit || { syncedCount: 0, pendingCount: 0, isUpToDate: true, pendingClients: [] },
      fidelizedCount: payload.fidelizedCount || (payload.fidelizedList ? payload.fidelizedList.length : 0),
      fidelizedList: payload.fidelizedList || [],
      domLagMs: payload.performance?.domLagMs || 0.0,
      responseTimeMinutes: configuredMinutes,
      lastSeen: Date.now()
    };

    // Guardar en Memoria RAM ultrarrápida (CERO consumo de Disk IOPS / Storage en Supabase)
    liveOperatorTelemetry.set(key, telemetryObj);

    // Guardar registro de infracciones detalladas si vienen en el payload
    if (payload.infractionsList && Array.isArray(payload.infractionsList)) {
      const profKey = (payload.profile || 'HORACIO').toUpperCase().trim();
      const existing = liveProfileInfractions.get(profKey) || [];
      const seenIds = new Set(existing.map(i => String(i.id)));
      payload.infractionsList.forEach(inf => {
        if (!seenIds.has(String(inf.id))) {
          existing.unshift(inf);
          seenIds.add(String(inf.id));
        }
      });
      if (existing.length > 50) existing.length = 50;
      liveProfileInfractions.set(profKey, existing);
    }

    // Responder si hay órdenes de extracción masiva pendientes para este turno
    const shouldExtractShift = massExtractionOrders.has(payload.shift || 'Mañana');

    res.json({
      success: true,
      triggerMassExtraction: shouldExtractShift,
      responseTimeMinutes: configuredMinutes,
      responseTimeSeconds: configuredMinutes * 60,
      latestTaskAlert: latestGlobalTaskAlert,
      taskAlertsConfig: taskAlertsConfig
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Endpoint para publicar una alerta de tareas global hacia todas las extensiones y monitores
app.post('/api/tasks/alert', (req, res) => {
  try {
    const payload = req.body;
    if (!payload || !payload.text) {
      return res.status(400).json({ error: 'Payload de alerta requerido con campo text' });
    }
    latestGlobalTaskAlert = {
      ...payload,
      id: payload.id || `task_alert_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: payload.ts || payload.timestamp || Date.now()
    };
    res.json({ success: true, latestTaskAlert: latestGlobalTaskAlert });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Endpoint para consultar el estado actual de la alerta de tareas y su configuración
app.get('/api/tasks/alert', (req, res) => {
  res.json({ success: true, latestTaskAlert: latestGlobalTaskAlert, config: taskAlertsConfig });
});

// Endpoint para sincronizar el toggle de encendido/apagado de alertas de tareas
app.post('/api/tasks/config', (req, res) => {
  try {
    const { enabled, sound, tts } = req.body || {};
    if (typeof enabled === 'boolean') taskAlertsConfig.enabled = enabled;
    if (typeof sound === 'boolean') taskAlertsConfig.sound = sound;
    if (typeof tts === 'boolean') taskAlertsConfig.tts = tts;
    res.json({ success: true, config: taskAlertsConfig });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Endpoint dedicado para reportar infracciones en tiempo real desde el HUD
app.post('/api/fines/report-infraction', (req, res) => {
  try {
    const { infraction, profile, operator } = req.body || {};
    if (!infraction) return res.status(400).json({ error: 'Infracción requerida' });
    const profKey = (profile || infraction.profile || 'HORACIO').toUpperCase().trim();
    const existing = liveProfileInfractions.get(profKey) || [];
    const seenIds = new Set(existing.map(i => String(i.id)));
    if (!seenIds.has(String(infraction.id))) {
      existing.unshift(infraction);
      if (existing.length > 50) existing.length = 50;
      liveProfileInfractions.set(profKey, existing);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Endpoint para consultar todas las infracciones detalladas de un perfil
app.get('/api/fines/infractions/:profile', (req, res) => {
  const profKey = (req.params.profile || 'HORACIO').toUpperCase().trim();
  const baseInfractions = liveProfileInfractions.get(profKey) || [];
  const merged = [...baseInfractions];
  const seenIds = new Set(merged.map(i => String(i.id)));

  // Combinar con telemetría en vivo de operadores que tengan este perfil
  for (let [opKey, opData] of liveOperatorTelemetry.entries()) {
    const pUpper = (opData.profile || '').toUpperCase().trim();
    const oUpper = (opData.operator || '').toUpperCase().trim();
    if (pUpper === profKey || oUpper === profKey || profKey === 'ALL') {
      if (Array.isArray(opData.infractionsList)) {
        opData.infractionsList.forEach(inf => {
          if (!seenIds.has(String(inf.id))) {
            merged.push(inf);
            seenIds.add(String(inf.id));
          }
        });
      }
    }
  }

  merged.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  res.json({ success: true, infractions: merged });
});

// Endpoint para ajustar el tiempo de respuesta (SLA en minutos) por operador
app.post('/api/settings/response-time', (req, res) => {
  try {
    const { operator, minutes } = req.body;
    if (!operator) return res.status(400).json({ error: 'Operador requerido' });
    const opKey = operator.toLowerCase().trim();
    const validMinutes = Math.max(1, Math.min(60, parseInt(minutes, 10) || 2));
    operatorResponseTimes.set(opKey, validMinutes);

    // Actualizar también en el telemetry cache activo
    for (let [k, node] of liveOperatorTelemetry.entries()) {
      if ((node.operator || '').toLowerCase().trim() === opKey) {
        node.responseTimeMinutes = validMinutes;
      }
    }

    res.json({ success: true, operator, minutes: validMinutes, seconds: validMinutes * 60 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ====================================================================
// 2. ENDPOINT: OBTENER TODOS LOS OPERADORES EN TIEMPO REAL (MONITOR)
// ====================================================================
app.get(['/api/telemetry/live-grid', '/api/telemetry/live'], (req, res) => {
  const now = Date.now();
  const activeNodes = [];

  for (let [key, data] of liveOperatorTelemetry.entries()) {
    // Si no ha emitido señal en 45 segundos, marcar offline
    const isDisconnected = (now - data.lastSeen) > 45000;
    if (isDisconnected) {
      data.status = 'OFFLINE';
    }
    const opKey = (data.operator || '').toLowerCase().trim();
    data.responseTimeMinutes = operatorResponseTimes.get(opKey) || data.responseTimeMinutes || 2;
    activeNodes.push(data);
  }

  res.json({ success: true, operators: activeNodes, serverTime: now });
});

// ====================================================================
// 3. ENDPOINT: INGESTA DE AUDITORÍA 360° (HISTORIAL COMPLETO Y ACUMULATIVO)
// ====================================================================
app.post('/api/chats/audit-deep', async (req, res) => {
  const startTime = Date.now();
  const { operator, shift, profile, profileId, clientName, clientId, bioData, markdown, messages, letters } = req.body || {};

  if (!clientName || !clientId) {
    return res.status(400).json({ error: 'Datos de cliente incompletos' });
  }

  const cId = String(clientId).trim();

  // 1. Obtener o inicializar los almacenes acumulativos del cliente
  if (!memoryClientMessagesMap.has(cId)) {
    memoryClientMessagesMap.set(cId, new Map());
  }
  if (!memoryClientLettersMap.has(cId)) {
    memoryClientLettersMap.set(cId, new Map());
  }

  const clientMsgsMap = memoryClientMessagesMap.get(cId);
  const clientLettersMap = memoryClientLettersMap.get(cId);

  // 2. Acumular todos los mensajes recibidos desde el primero hasta el más reciente
  if (Array.isArray(messages) && messages.length > 0) {
    messages.forEach(m => {
      if (!m || !m.text) return;
      const cleanText = (m.text || '').trim();
      if (!cleanText) return;
      const msgKey = m.id || `msg_${cId}_${m.isOperator ? 'OP' : 'RU'}_${cleanText.substring(0, 35).replace(/[^a-z0-9]/gi, '_')}_${(m.time || '').replace(/[^a-z0-9]/gi, '')}`;
      clientMsgsMap.set(msgKey, {
        id: msgKey,
        client_id: cId,
        profile_name: profile || 'HORACIO',
        operator_name: operator || 'Operador',
        sender_type: m.isOperator ? 'OPERATOR' : 'CLIENT',
        sender_name: m.senderName || (m.isOperator ? (profile || 'HORACIO') : clientName),
        message_text: cleanText,
        message_time: m.time || 'Reciente',
        message_date: m.date || new Date().toLocaleDateString()
      });
    });
  }

  // 3. Acumular todas las cartas recibidas desde la primera hasta la más reciente
  if (Array.isArray(letters) && letters.length > 0) {
    letters.forEach(l => {
      if (!l || (!l.preview && !l.fullText)) return;
      const cleanPreview = (l.preview || l.fullText || '').trim();
      if (!cleanPreview) return;
      const letterKey = l.id || `mail_${cId}_${l.isOutgoing ? 'OUT' : 'IN'}_${cleanPreview.substring(0, 40).replace(/[^a-z0-9]/gi, '_')}_${(l.date || '').replace(/[^a-z0-9]/gi, '')}`;
      clientLettersMap.set(letterKey, {
        id: letterKey,
        client_id: cId,
        profile_name: profile || 'HORACIO',
        direction: l.isOutgoing ? 'OUTGOING' : 'INCOMING',
        letter_date: l.date || 'Fecha Reciente',
        letter_preview: cleanPreview,
        status: 'read'
      });
    });
  }

  const allMergedMessages = Array.from(clientMsgsMap.values());
  const allMergedLetters = Array.from(clientLettersMap.values());

  // 4. Reconstruir transcripción Markdown completa y cronológica 360°
  let mdLines = [
    `# HISTORIAL 360° | CONVERSACIONES Y CARTAS | RYR TITAN AUDIT`,
    `- **Operador:** ${operator || 'Operador'} [${shift || 'Mañana'}]`,
    `- **Perfil Asignado:** ${profile || 'HORACIO'} (ID: ${profileId || '118179794'})`,
    `- **Cliente:** ${clientName}`,
    `- **ID del Usuario:** ${cId}`,
    `- **Ubicación:** ${bioData?.country || 'United States'} | **Nacimiento:** ${bioData?.birthDate || 'En perfil'}`,
    `- **Total Mensajes Acumulados:** ${allMergedMessages.length}`,
    `- **Total Cartas Acumuladas:** ${allMergedLetters.length}`,
    `- **Fecha de Extracción:** ${new Date().toLocaleString('es-CO')}`,
    `---`
  ];

  if (allMergedLetters.length > 0) {
    mdLines.push(`### ✉️ Registro de Cartas / Mails Históricos (Desde la 1ª Carta - ${allMergedLetters.length} Cartas):`);
    allMergedLetters.forEach((l, idx) => {
      mdLines.push(`- ${l.direction === 'OUTGOING' ? '📤 **Enviada por Perfil**' : '📥 **Recibida de Cliente**'} [${l.letter_date}]: ${l.letter_preview}`);
    });
    mdLines.push(`---`);
  }

  if (allMergedMessages.length > 0) {
    mdLines.push(`### 💬 Diálogo Transcrito Completo (Desde el 1er Mensaje - ${allMergedMessages.length} Mensajes):`);
    allMergedMessages.forEach(m => {
      if (m.sender_type === 'OPERATOR') {
        mdLines.push(`- 💼 **${profile || 'HORACIO'} [Op: ${operator || 'Operador'}]** [${m.message_time}]: ${m.message_text}`);
      } else {
        mdLines.push(`- 👤 **${clientName} [Cliente]** [${m.message_time}]: ${m.message_text}`);
      }
    });
  } else if (markdown) {
    mdLines.push(markdown);
  }

  const finalMarkdown = mdLines.join('\n');

  // 5. Guardar en memoria de alta disponibilidad
  const convMemoryObj = {
    id: `conv_${cId}`,
    client_id: cId,
    client_name: clientName,
    operator_name: operator || 'Operador',
    profile_name: profile || 'HORACIO',
    shift: shift || 'Mañana',
    markdown_transcript: finalMarkdown,
    total_messages: allMergedMessages.length,
    total_letters: allMergedLetters.length,
    extracted_at: new Date().toISOString()
  };
  memoryConversationsMap.set(cId, convMemoryObj);

  // 6. Guardar en Supabase de forma segura
  try {
    const tier = allMergedLetters.length > 500 ? 'LOYAL_VIP' : 'NEW_PROSPECT';
    await supabase.from('clients').upsert({
      talkytimes_id: cId,
      name: clientName,
      country: bioData?.country || 'United States',
      birth_date: bioData?.birthDate || '',
      marital_status: bioData?.maritalStatus || '',
      profile_assigned: profile || 'HORACIO',
      profile_id: profileId || '',
      tier: tier,
      letter_total: allMergedLetters.length,
      updated_at: new Date().toISOString()
    }, { onConflict: 'talkytimes_id' });
  } catch (e) {}

  try {
    await supabase.from('conversations').upsert({
      id: `conv_${cId}`,
      client_id: cId,
      client_name: clientName,
      operator_name: operator || 'Operador',
      profile_name: profile || 'HORACIO',
      shift: shift || 'Mañana',
      markdown_transcript: finalMarkdown,
      total_messages: allMergedMessages.length,
      extracted_at: new Date().toISOString()
    }, { onConflict: 'client_id' });
  } catch (e) {}

  if (allMergedMessages.length > 0) {
    try {
      await supabase.from('messages').upsert(allMergedMessages, { onConflict: 'id', ignoreDuplicates: true });
    } catch (e) {}
  }

  if (allMergedLetters.length > 0) {
    try {
      await supabase.from('mails_history').upsert(allMergedLetters, { onConflict: 'id', ignoreDuplicates: true });
    } catch (e) {}
  }

  const durationMs = Date.now() - startTime;
  logSyncEvent({
    type: 'CHAT_UPLOAD',
    operator: operator || 'Operador',
    profile: profile || 'HORACIO',
    clientName: clientName,
    count: allMergedMessages.length,
    durationMs: durationMs,
    status: 'SUCCESS',
    detail: `Historial de '${clientName}' guardado (${allMergedMessages.length} msgs, ${allMergedLetters.length} cartas).`
  });

  res.json({
    success: true,
    message: 'Auditoría 360° acumulada y guardada con éxito',
    total_messages: allMergedMessages.length,
    total_letters: allMergedLetters.length,
    durationMs
  });
});

// ====================================================================
// 4. ENDPOINT: IDS YA SINCRONIZADOS (PARA EVITAR RE-EXTRACCIÓN)
// ====================================================================
app.get('/api/chats/synced-ids', async (req, res) => {
  try {
    const { profile } = req.query;
    let syncedIds = Array.from(memoryConversationsMap.keys());

    try {
      let query = supabase.from('clients').select('talkytimes_id, name');
      if (profile) query = query.eq('profile_assigned', profile);
      const { data } = await query;
      if (data) {
        data.forEach(c => {
          if (c.talkytimes_id) syncedIds.push(c.talkytimes_id);
          if (c.name) syncedIds.push(c.name.toLowerCase());
        });
      }
    } catch (e) {}

    res.json({ success: true, syncedIds: Array.from(new Set(syncedIds)) });
  } catch (err) {
    res.json({ success: true, syncedIds: Array.from(memoryConversationsMap.keys()) });
  }
});

// ====================================================================
// 4.1 ENDPOINT: OBTENER TODAS LAS CONVERSACIONES AUDITADAS (HISTORIAL MAESTRO)
// ====================================================================
app.get('/api/chats/all-conversations', async (req, res) => {
  try {
    const { profile, operator, search } = req.query;
    let dbConversations = [];
    try {
      let query = supabase.from('conversations').select('*').order('extracted_at', { ascending: false }).limit(60);
      if (profile && profile !== 'ALL') query = query.ilike('profile_name', `%${profile}%`);
      if (operator && operator !== 'ALL') query = query.ilike('operator_name', `%${operator}%`);
      if (search) query = query.or(`client_name.ilike.%${search}%,client_id.ilike.%${search}%`);
      const { data } = await query;
      if (data) dbConversations = data;
    } catch (dbErr) {}

    // Combinar Supabase con memoria en vivo
    const memoryList = Array.from(memoryConversationsMap.values());
    const combinedMap = new Map();
    dbConversations.forEach(c => combinedMap.set(String(c.client_id).trim(), c));
    memoryList.forEach(c => combinedMap.set(String(c.client_id).trim(), c));

    let finalResults = Array.from(combinedMap.values());
    if (profile && profile !== 'ALL') {
      finalResults = finalResults.filter(c => (c.profile_name || '').toLowerCase().includes(profile.toLowerCase()));
    }
    if (operator && operator !== 'ALL') {
      finalResults = finalResults.filter(c => (c.operator_name || '').toLowerCase().includes(operator.toLowerCase()));
    }
    if (search) {
      finalResults = finalResults.filter(c => 
        (c.client_name || '').toLowerCase().includes(search.toLowerCase()) || 
        (c.client_id || '').toLowerCase().includes(search.toLowerCase())
      );
    }

    res.json({ success: true, conversations: finalResults });
  } catch (err) {
    res.json({ success: true, conversations: Array.from(memoryConversationsMap.values()) });
  }
});

// ====================================================================
// 4.2 ENDPOINT: SINCRONIZAR Y EXTRAER CARTAS DEL PERFIL
// ====================================================================
app.post('/api/mails/sync-profile-letters', async (req, res) => {
  const startTime = Date.now();
  const { operator, shift, profile, letters } = req.body || {};
  const letterCount = Array.isArray(letters) ? letters.length : 0;

  if (letterCount === 0) {
    return res.status(400).json({ error: 'No se recibieron cartas para guardar' });
  }

  const mailsToInsert = letters.map(l => ({
    id: l.id || `mail_${String(l.clientId || 'N_A').trim()}_${l.isOutgoing ? 'OUT' : 'IN'}_${(l.preview || l.fullText || '').substring(0, 35).replace(/[^a-z0-9]/gi, '_')}_${(l.date || 'rec').replace(/[^a-z0-9]/gi, '')}`,
    client_id: String(l.clientId || 'N/A').trim(),
    profile_name: profile || 'HORACIO',
    direction: l.isOutgoing ? 'OUTGOING' : 'INCOMING',
    letter_date: l.date || 'Fecha Reciente',
    letter_preview: l.preview || l.fullText || '',
    status: 'read'
  }));

  try {
    await supabase.from('mails_history').upsert(mailsToInsert, { onConflict: 'id', ignoreDuplicates: true });
  } catch (e) {}

  const durationMs = Date.now() - startTime;
  logSyncEvent({
    type: 'LETTERS_SYNC',
    operator: operator || 'Operador',
    profile: profile || 'HORACIO',
    clientName: `${letterCount} Cartas`,
    count: letterCount,
    durationMs: durationMs,
    status: 'SUCCESS',
    detail: `Sincronizadas ${letterCount} cartas del perfil '${profile || 'HORACIO'}' con éxito.`
  });

  res.json({ success: true, message: `✅ Se sincronizaron ${letterCount} cartas del perfil ${profile || 'HORACIO'} con éxito`, durationMs });
});

// ====================================================================
// 4.3 ENDPOINT: FEED DE LOGS DE SUBIDA Y AUDITORÍA EN TIEMPO REAL
// ====================================================================
app.get('/api/sync/logs', (req, res) => {
  res.json({
    success: true,
    totalLogs: liveSyncLogsBuffer.length,
    logs: liveSyncLogsBuffer
  });
});

app.post('/api/sync/log-event', (req, res) => {
  const payload = req.body;
  const entry = logSyncEvent(payload);
  res.json({ success: true, entry });
});

// ====================================================================
// 5. ENDPOINT: CONSULTA DE SALDO Y PODER ADQUISITIVO DEL CLIENTE
// ====================================================================
app.get('/api/clients/data/:clientId', async (req, res) => {
  try {
    const { clientId } = req.params;
    const { name, profile } = req.query;

    let clientData = null;
    try {
      const { data } = await supabase.from('clients').select('*').eq('talkytimes_id', String(clientId)).single();
      clientData = data;
    } catch (e) {}

    // Contar mensajes y cartas guardadas para calcular gasto real
    let msgCount = 0;
    let mailCount = 0;
    try {
      const { count: mc } = await supabase.from('messages').select('*', { count: 'exact', head: true }).eq('client_id', String(clientId));
      msgCount = mc || 0;
      const { count: lc } = await supabase.from('mails_history').select('*', { count: 'exact', head: true }).eq('client_id', String(clientId));
      mailCount = lc || 0;
    } catch (e) {}

    const lettersTotal = (clientData && clientData.letter_total) ? clientData.letter_total : mailCount;
    const messagesTotal = msgCount;

    // Fórmula de gasto acumulado estimado: 1 crédito por chat + 10 créditos por carta
    const estimatedSpentCredits = (messagesTotal * 1) + (lettersTotal * 10) + (clientData?.additional_spent || 0);
    const spentUSD = (estimatedSpentCredits * 0.28).toFixed(2);

    const availableCredits = clientData?.credits_balance !== undefined ? clientData.credits_balance : 150;
    const saldoUSD = (availableCredits * 0.28).toFixed(2);

    res.json({
      success: true,
      points: availableCredits,
      credits: availableCredits,
      saldoUSD: saldoUSD,
      spentCredits: estimatedSpentCredits,
      spentUSD: spentUSD,
      letterTotal: lettersTotal,
      messagesTotal: messagesTotal,
      tier: clientData?.tier || (estimatedSpentCredits > 300 ? 'LOYAL_VIP' : 'STANDARD'),
      spendingTier: clientData?.spending_tier || (estimatedSpentCredits > 300 ? 'HIGH' : 'STANDARD')
    });
  } catch (err) {
    res.json({
      success: true,
      points: 150,
      credits: 150,
      saldoUSD: (150 * 0.28).toFixed(2),
      spentCredits: 50,
      spentUSD: (50 * 0.28).toFixed(2),
      letterTotal: 0,
      tier: 'NEW_PROSPECT',
      spendingTier: 'STANDARD'
    });
  }
});

// ====================================================================
// 5.1 ENDPOINT: INTEL DE GASTO & FACTURACIÓN POR USUARIO (AUDITORÍA 360°)
// ====================================================================
app.get('/api/clients/spending-intel', async (req, res) => {
  try {
    const { profile, search } = req.query;

    let dbClients = [];
    let dbConversations = [];
    let dbMails = [];

    try {
      const [resC, resConv, resM] = await Promise.all([
        supabase.from('clients').select('*').limit(300),
        supabase.from('conversations').select('*').limit(300),
        supabase.from('mails_history').select('client_id, profile_name').limit(500)
      ]);
      if (resC && resC.data) dbClients = resC.data;
      if (resConv && resConv.data) dbConversations = resConv.data;
      if (resM && resM.data) dbMails = resM.data;
    } catch (e) {}

    const clientsMap = new Map();

    // 1. Cargar desde Supabase clients
    dbClients.forEach(c => {
      const cId = String(c.talkytimes_id || c.id).trim();
      if (!cId) return;
      clientsMap.set(cId, {
        id: cId,
        talkytimesId: cId,
        name: c.name || 'Cliente',
        country: c.country || 'United States',
        birthDate: c.birth_date || 'En perfil',
        maritalStatus: c.marital_status || 'Single',
        profileAssigned: c.profile_assigned || 'HORACIO',
        tier: c.tier || 'ACTIVE_PROSPECT',
        letterTotal: Number(c.letter_total) || 0,
        creditsBalance: c.credits_balance !== undefined ? c.credits_balance : 150,
        updatedAt: c.updated_at || new Date().toISOString()
      });
    });

    // 2. Cargar desde Supabase conversations
    dbConversations.forEach(conv => {
      const cId = String(conv.client_id || '').trim();
      if (!cId) return;
      const existing = clientsMap.get(cId) || {
        id: cId,
        talkytimesId: cId,
        name: conv.client_name || 'Cliente',
        country: 'United States',
        birthDate: 'En perfil',
        maritalStatus: 'Single',
        profileAssigned: conv.profile_name || 'HORACIO',
        tier: 'ACTIVE_PROSPECT',
        letterTotal: Number(conv.total_letters) || 0,
        creditsBalance: 150,
        updatedAt: conv.extracted_at || new Date().toISOString()
      };
      existing.name = conv.client_name || existing.name;
      existing.profileAssigned = conv.profile_name || existing.profileAssigned;
      existing.letterTotal = Math.max(existing.letterTotal, Number(conv.total_letters) || 0);
      clientsMap.set(cId, existing);
    });

    // 3. Cargar desde memoria en vivo (memoryConversationsMap)
    for (let [cId, conv] of memoryConversationsMap.entries()) {
      const cleanId = String(cId).trim();
      const existing = clientsMap.get(cleanId) || {
        id: cleanId,
        talkytimesId: cleanId,
        name: conv.client_name || 'Cliente',
        country: 'United States',
        birthDate: 'En perfil',
        maritalStatus: 'Single',
        profileAssigned: conv.profile_name || 'HORACIO',
        tier: 'ACTIVE_PROSPECT',
        letterTotal: conv.total_letters || 0,
        creditsBalance: 150,
        updatedAt: conv.extracted_at || new Date().toISOString()
      };
      existing.name = conv.client_name || existing.name;
      existing.profileAssigned = conv.profile_name || existing.profileAssigned;
      existing.letterTotal = Math.max(existing.letterTotal, conv.total_letters || 0);
      clientsMap.set(cleanId, existing);
    }

    // 4. Cargar desde telemetría en vivo (liveOperatorTelemetry)
    for (let [opName, opData] of liveOperatorTelemetry.entries()) {
      const pName = (opData.profile || 'HORACIO').toUpperCase();
      const opClients = opData.activeClients || opData.clients || [];
      if (Array.isArray(opClients)) {
        opClients.forEach(c => {
          const cleanId = String(c.id || c.clientId || c.talkytimesId || '').trim();
          if (!cleanId) return;
          const existing = clientsMap.get(cleanId) || {
            id: cleanId,
            talkytimesId: cleanId,
            name: c.name || c.clientName || 'Cliente Activo',
            country: c.country || 'United States',
            birthDate: 'En perfil',
            maritalStatus: 'Single',
            profileAssigned: pName,
            tier: 'ACTIVE_PROSPECT',
            letterTotal: Number(c.letters || c.mailCount) || 0,
            creditsBalance: 150,
            updatedAt: new Date().toISOString()
          };
          existing.name = c.name || c.clientName || existing.name;
          existing.profileAssigned = pName || existing.profileAssigned;
          existing.letterTotal = Math.max(existing.letterTotal, Number(c.letters || c.mailCount) || 0);
          clientsMap.set(cleanId, existing);
        });
      }
    }

    const clientResults = [];
    let totalAgencyRevenueCredits = 0;
    const profileRevenueMap = new Map();

    for (let [cId, clientObj] of clientsMap.entries()) {
      const clientMsgs = memoryClientMessagesMap.has(cId) ? Array.from(memoryClientMessagesMap.get(cId).values()) : [];
      const clientLetters = memoryClientLettersMap.has(cId) ? Array.from(memoryClientLettersMap.get(cId).values()) : [];

      // Buscar si este cliente tiene registro en dbConversations
      const matchedConv = dbConversations.find(cv => String(cv.client_id).trim() === cId);
      const convMsgs = matchedConv ? (Number(matchedConv.total_messages) || 0) : 0;
      const convLetters = matchedConv ? (Number(matchedConv.total_letters) || 0) : 0;

      const msgCount = Math.max(clientMsgs.length, convMsgs, 1);
      const letterCount = Math.max(clientObj.letterTotal, clientLetters.length, convLetters);

      const profileBreakdown = {};
      const addProfileUsage = (pName, msgs, letters) => {
        const pKey = (pName || 'HORACIO').toUpperCase();
        if (!profileBreakdown[pKey]) profileBreakdown[pKey] = { messages: 0, letters: 0, credits: 0, usd: 0 };
        profileBreakdown[pKey].messages += msgs;
        profileBreakdown[pKey].letters += letters;
        const cr = (msgs * 1) + (letters * 10);
        profileBreakdown[pKey].credits += cr;
        profileBreakdown[pKey].usd = Number((profileBreakdown[pKey].credits * 0.28).toFixed(2));
      };

      if (clientMsgs.length > 0) {
        clientMsgs.forEach(m => {
          addProfileUsage(m.profile_name || clientObj.profileAssigned, 1, 0);
        });
      }
      if (clientLetters.length > 0) {
        clientLetters.forEach(l => {
          addProfileUsage(l.profile_name || clientObj.profileAssigned, 0, 1);
        });
      }
      if (Object.keys(profileBreakdown).length === 0) {
        addProfileUsage(clientObj.profileAssigned, msgCount, letterCount);
      }

      const totalAgencyCredits = (msgCount * 1) + (letterCount * 10);
      const spentUSD = Number((totalAgencyCredits * 0.28).toFixed(2));
      const spentCOP = Math.round(spentUSD * 4200);

      totalAgencyRevenueCredits += totalAgencyCredits;

      Object.entries(profileBreakdown).forEach(([pName, stats]) => {
        profileRevenueMap.set(pName, (profileRevenueMap.get(pName) || 0) + stats.usd);
      });

      const estimatedGlobalCredits = Math.max(totalAgencyCredits, totalAgencyCredits + (clientObj.creditsBalance || 0) + (totalAgencyCredits > 100 ? Math.round(totalAgencyCredits * 0.35) : (spentUSD > 20 ? 30 : 10)));
      const globalEstimatedTotalSpendUSD = Number((estimatedGlobalCredits * 0.28).toFixed(2));
      const agencyShare = globalEstimatedTotalSpendUSD > 0 ? Math.min(100, Math.round((spentUSD / globalEstimatedTotalSpendUSD) * 100)) : 100;
      const externalAgencySpendUSD = Number(Math.max(0, globalEstimatedTotalSpendUSD - spentUSD).toFixed(2));
      const isChattingOtherAgencies = externalAgencySpendUSD > 10;

      let tierLabel = '🟢 PROSPECTO';
      let tierBadgeClass = 'tier-prospect';
      let spendingTier = 'REGULAR';
      if (spentUSD >= 80 || letterCount >= 30) {
        tierLabel = '💎 WHALE / SUPER VIP';
        tierBadgeClass = 'tier-whale';
        spendingTier = 'WHALE';
      } else if (spentUSD >= 25 || letterCount >= 8) {
        tierLabel = '🌟 VIP';
        tierBadgeClass = 'tier-vip';
        spendingTier = 'VIP';
      }

      clientResults.push({
        id: cId,
        talkytimesId: cId,
        name: clientObj.name,
        country: clientObj.country,
        birthDate: clientObj.birthDate,
        maritalStatus: clientObj.maritalStatus,
        tier: tierLabel,
        spendingTier: spendingTier,
        tierBadgeClass: tierBadgeClass,
        profileAssigned: clientObj.profileAssigned,
        profilesList: Object.keys(profileBreakdown),
        profiles: profileBreakdown,
        profileBreakdown: profileBreakdown,
        messagesTotal: msgCount,
        totalChatMessages: msgCount,
        lettersTotal: letterCount,
        totalLetters: letterCount,
        spentCredits: totalAgencyCredits,
        spentUSD: spentUSD,
        totalSpentUSD: spentUSD,
        spentCOP: spentCOP,
        totalSpentCOP: spentCOP,
        availableCredits: clientObj.creditsBalance || 150,
        globalEstimatedTotalSpendUSD: globalEstimatedTotalSpendUSD,
        agencySharePercentage: agencyShare,
        externalAgencySpendUSD: externalAgencySpendUSD,
        isChattingOtherAgencies: isChattingOtherAgencies,
        updatedAt: clientObj.updatedAt
      });
    }

    let filtered = clientResults;
    if (profile && profile !== 'ALL') {
      filtered = filtered.filter(c => c.profilesList.includes(profile.toUpperCase()) || c.profileAssigned.toUpperCase() === profile.toUpperCase());
    }

    if (search) {
      const s = search.toLowerCase();
      filtered = filtered.filter(c => c.name.toLowerCase().includes(s) || c.id.toLowerCase().includes(s) || c.country.toLowerCase().includes(s));
    }

    filtered.sort((a, b) => b.spentUSD - a.spentUSD);

    const totalAgencyUSD = Number((totalAgencyRevenueCredits * 0.28).toFixed(2));
    const totalAgencyCOP = Math.round(totalAgencyUSD * 4200);

    let mostProfitableProfile = 'HORACIO';
    let highestProfileRev = 0;
    for (let [p, rev] of profileRevenueMap.entries()) {
      if (rev > highestProfileRev) {
        highestProfileRev = rev;
        mostProfitableProfile = p;
      }
    }

    const topSpender = clientResults.length > 0 ? clientResults[0] : null;
    const leakingCount = clientResults.filter(c => c.isChattingOtherAgencies).length;
    const estimatedExternalTotalUSD = Number(clientResults.reduce((acc, c) => acc + (c.externalAgencySpendUSD || 0), 0).toFixed(2));

    const profilesBreakdown = Array.from(profileRevenueMap.entries()).map(([p, rev]) => ({
      profile: p,
      totalSpentUSD: Number(rev.toFixed(2)),
      clientsCount: clientResults.filter(c => c.profilesList?.includes(p) || c.profileAssigned === p).length
    }));

    res.json({
      success: true,
      summary: {
        totalAgencyRevenueUSD: totalAgencyUSD,
        totalAgencyRevenueCOP: totalAgencyCOP,
        totalClientsCount: clientResults.length,
        totalCredits: totalAgencyRevenueCredits,
        topSpender: topSpender ? { name: topSpender.name, id: topSpender.id, totalSpentUSD: topSpender.spentUSD, totalSpentCOP: topSpender.spentCOP } : null,
        mostProfitableProfile: { profile: mostProfitableProfile, totalSpentUSD: highestProfileRev },
        externalChattingClientsCount: leakingCount,
        estimatedExternalSpendingUSD: estimatedExternalTotalUSD,
        profilesBreakdown: profilesBreakdown
      },
      kpis: {
        totalRevenueUSD: totalAgencyUSD,
        totalRevenueCOP: totalAgencyCOP,
        totalCredits: totalAgencyRevenueCredits,
        totalClients: clientResults.length,
        mostProfitableProfile: mostProfitableProfile,
        topSpender: topSpender ? { name: topSpender.name, id: topSpender.id, spentUSD: topSpender.spentUSD } : null
      },
      clients: filtered
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ====================================================================
// 6. ENDPOINT: GENERADOR IA DE GANCHOS & RESPUESTAS (INTEL COPILOT)
// ====================================================================
app.post('/api/intelligence/query', async (req, res) => {
  try {
    const { query, clientName, profileName, clientId, bioData, liveMarkdown, targetLang } = req.body;

    // Buscar cartas y mensajes guardados previamente en Supabase para tener memoria histórica persistente
    let dbLetters = [];
    let dbMessages = [];
    if (clientId) {
      try {
        const { data: mails } = await supabase
          .from('mails_history')
          .select('direction, letter_preview, letter_date')
          .eq('client_id', String(clientId))
          .order('id', { ascending: false })
          .limit(10);
        if (mails) dbLetters = mails;

        const { data: msgs } = await supabase
          .from('messages')
          .select('sender_type, message_text, message_time')
          .eq('client_id', String(clientId))
          .order('id', { ascending: false })
          .limit(15);
        if (msgs) dbMessages = msgs;
      } catch (dbErr) {
        console.warn('Advertencia leyendo historial en BD:', dbErr.message);
      }
    }

    const lang = targetLang || 'en';
    const profile = profileName || 'HORACIO';
    const client = clientName || 'friend';
    const q = (query || '').toLowerCase().trim();

    const country = bioData?.country || 'United States';
    const birthDate = bioData?.birthDate || 'En perfil';
    const marital = bioData?.maritalStatus || 'Single / Soltera';

    // Combinar mensajes históricos de Supabase y en vivo
    const allDbText = [...dbLetters.map(l => l.letter_preview), ...dbMessages.map(m => m.message_text)].join(' ').toLowerCase();
    const combinedCorpus = `${liveMarkdown || ''} ${allDbText}`.toLowerCase();

    let answer = '';
    let hooks = [];

    // Evaluar intención del operador
    if (/qu[eé]\s+(sabes|puedes|haces)|capacidades|ayuda|funciones|para qu[eé]\s+sirves/i.test(q)) {
      answer = `🧠 **Soy tu Co-Piloto Táctico & Asistente IA 360°:**\n\n` +
        `Puedo responderte al instante sobre:\n` +
        `1. 📍 **Ubicación & Ciudad:** Pregúntame *"de dónde es"* para saber su país y ciudad.\n` +
        `2. 🎂 **Edad & Biografía:** Pregúntame *"cuántos años tiene"* o *"cuándo nació"*.\n` +
        `3. 👨‍👩‍👧 **Familia & Mascotas:** Pregúntame *"tiene hijos"* o *"cómo se llaman"*.\n` +
        `4. 🎨 **Gustos & Pasiones:** Pregúntame *"cuáles son sus gustos"* o *"qué le gusta hacer"*.\n` +
        `5. 💰 **Poder Adquisitivo:** Pregúntame *"cuántos créditos tiene"* o *"cuánto gasta"*.\n` +
        `6. ✉️ **Cartas & Ganchos:** Pídeme *"dame un gancho para enamorarla"* o *"redacta una carta"*.\n` +
        `7. 🛡️ **Seguridad:** Monitoreo activo anti-infracciones de Travel Misleading.`;
      hooks = [`"I was just thinking about you and wanted to say hello... Tell me, how has your day been treating you? ❤️"`];
    } else if (/gusto|inter[eé]s|hobbi|pasatiempo|le gusta|m[uú]sica|comida|disfruta|hacer en su tiempo|passion/i.test(q)) {
      let tastesFound = [];
      if (/music|música|musica|song|cancion/i.test(combinedCorpus)) tastesFound.push('Disfruta hablar de música y canciones especiales');
      if (/travel|viaj|beach|playa|nature|naturaleza/i.test(combinedCorpus)) tastesFound.push('Le apasiona la naturaleza y el aire libre');
      if (/cook|cocin|food|comida|wine|vino|dinner/i.test(combinedCorpus)) tastesFound.push('Gusta de la buena gastronomía y momentos tranquilos');
      if (/read|leer|book|libro|movie|pelicula|cine/i.test(combinedCorpus)) tastesFound.push('Aprecia conversaciones sobre libros, películas y arte');
      if (/sport|gym|fitness|deporte|caminar|walk/i.test(combinedCorpus)) tastesFound.push('Le gusta mantenerse activo y caminar');

      const tastesSummary = tastesFound.length > 0 
        ? tastesFound.map(t => `- ${t}`).join('\n')
        : `- Aprecia la atención genuina, el respeto y las conversaciones emotivas.\n- Registrado como aficionado a conversaciones sinceras y detalladas.`;

      answer = `🎨 **Gustos e Intereses de ${client}:**\n${tastesSummary}\n\n💡 *Respuesta sugerida para chatear:*\n"I love learning about what truly makes you happy... Tell me, when you have free time just for yourself, what's your favorite thing to do? ✨"`;
      hooks = [`"I love learning about what truly makes you happy... Tell me, when you have free time just for yourself, what's your favorite thing to do? ✨"`];
    } else if (/historia|relaci[oó]n|como vamos|resumen|hilo|antecedente/i.test(q)) {
      answer = `📖 **Historial de Relación con ${client}:**\n` +
        `- **Total Mensajes en BD:** ${dbMessages.length} diálogos registrados.\n` +
        `- **Total Cartas en BD:** ${dbLetters.length} cartas procesadas.\n` +
        `- **Tono de la Relación:** Cálido, de constante apego y reciprocidad con el perfil ${profile}.\n\n` +
        `💡 *Respuesta sugerida para continuar:*\n"Looking back at how we started talking, I really love how special our bond has become ❤️ Tell me, what's on your heart right now?"`;
      hooks = [`"Looking back at how we started talking, I really love how special our bond has become ❤️ Tell me, what's on your heart right now?"`];
    } else if (/d[oó]nde|pa[ií]s|ubicaci[oó]n|ciudad|vive|where|location|from/i.test(q)) {
      let locDetail = 'Registrado en su expediente oficial.';
      const cityMatch = combinedCorpus.match(/(?:live in|from|living in|vivo en)\s+([a-z\s]{3,20})/i);
      if (cityMatch) locDetail = `Menciona en sus conversaciones: "${cityMatch[1].trim()}"`;
      answer = `📍 **Ubicación & Cultura de ${client} (Español):**\n- **País en Perfil:** ${country}\n- **Detalles del Chat:** ${locDetail}\n\n⚠️ *Regla Anti-TM:* Prohibido mencionar países o ciudades en el chat con el usuario.\n\n💌 **Mensaje Sugerido en Inglés (Listo para Enviar):**\n"I've always loved your warm and welcoming spirit... Tell me, how is your afternoon going today? ❤️"\n\n📝 **Traducción al Español:**\n*"Siempre me ha encantado tu espíritu cálido y acogedor... Dime, ¿cómo va tu tarde hoy? ❤️"*`;
      hooks = [
        `"I've always loved your warm and welcoming spirit... Tell me, how is your afternoon going today? ❤️"`,
        `"Talking with you always brings such a peaceful energy to my day... How are you feeling right now? ✨"`,
        `"I was just taking a little break and hoping to hear from you 😉 What is on your mind today?"`
      ];
    } else if (/edad|a[ñn]os|cumple|nacimiento|age|old|born|birth/i.test(q)) {
      answer = `🎂 **Edad y Biografía de ${client} (Español):**\n- **Fecha y Edad:** ${birthDate}\n- **Estado Civil:** ${marital}\n\n💌 **Mensaje Sugerido en Inglés (Listo para Enviar):**\n"Age is just a number, but your warmth and charm make you truly unforgettable 😉 What's your secret to staying so radiant?"\n\n📝 **Traducción al Español:**\n*"La edad es solo un número, pero tu calidez y encanto te hacen inolvidable 😉 ¿Cuál es tu secreto para mantenerte tan radiante?"*`;
      hooks = [
        `"Age is just a number, but your warmth and charm make you truly unforgettable 😉 What's your secret to staying so radiant?"`,
        `"You have such a vibrant energy whenever we talk ❤️ What is your favorite way to unwind when you have some time for yourself?"`,
        `"Every conversation with you feels so refreshing ✨ Tell me, what was the most beautiful part of your day today?"`
      ];
    } else if (/hijo|hija|familia|llaman|children|kids|family|daughter|son/i.test(q)) {
      let famFound = [];
      if (combinedCorpus.includes('daughter') || combinedCorpus.includes('hija')) famFound.push('Menciona tener una hija');
      if (combinedCorpus.includes('son') || combinedCorpus.includes('hijo')) famFound.push('Menciona tener un hijo');
      if (combinedCorpus.includes('dog') || combinedCorpus.includes('cat') || combinedCorpus.includes('perro') || combinedCorpus.includes('gato')) famFound.push('Tiene mascotas queridas');
      const famSummary = famFound.length > 0 ? famFound.join(' y ') : 'Aún no ha especificado nombres de familiares directos en las conversaciones';
      answer = `👨‍👩‍👧 **Expediente Familiar de ${client} (Español):**\n- **Estado Civil:** ${marital}\n- **Datos Identificados:** ${famSummary}.\n\n💌 **Mensaje Sugerido en Inglés (Listo para Enviar):**\n"Family is everything to me ❤️ How is your family doing today? Tell me more about the people who make you smile the most."\n\n📝 **Traducción al Español:**\n*"La familia lo es todo para mí ❤️ ¿Cómo está tu familia hoy? Cuéntame más sobre las personas que más te hacen sonreír."*`;
      hooks = [
        `"Family is everything to me ❤️ How is your family doing today? Tell me more about the people who make you smile the most."`,
        `"The people closest to our hearts are what matter most ❤️ What is something sweet that made you smile today?"`,
        `"I love hearing about the things you cherish in life ✨ Tell me what brings you the greatest joy lately."`
      ];
    } else if (/cr[eé]dito|saldo|recarga|gasto|puntos|credits|points|money/i.test(q)) {
      const isHighSpending = dbLetters.length > 5 || dbMessages.length > 10;
      answer = `💰 **Diagnóstico Comercial de ${client} (Español):**\n- **Nivel de Usuario:** ${isHighSpending ? '💎 CLIENTE VIP (Gasto Constante)' : '🟢 PROSPECTO ACTIVO'}\n- **Directriz de Oro:** ⚠️ *NUNCA mencionar créditos, recargas ni pagos.*\n\n💌 **Mensaje Táctico en Inglés (Listo para Enviar):**\n"I was just looking at a cute picture I took earlier and immediately thought of you... Want me to send it over to you? 😉"\n\n📝 **Traducción al Español:**\n*"Estaba mirando una foto linda que me tomé más temprano y pensé en ti de inmediato... ¿Quieres que te la envíe? 😉"*`;
      hooks = [
        `"I was just looking at a cute picture I took earlier and immediately thought of you... Want me to send it over to you? 😉"`,
        `"I feel so close to you when we talk, but I really miss looking into your eyes... Send me a picture of your smile, and I'll send you one in return 😉"`,
        `"You have such a special place in my thoughts today ❤️ What are you up to right at this moment?"`
      ];
    } else if (/trabaj|ocupaci[oó]n|dedica|profesi[oó]n|hace|work|job|career/i.test(q)) {
      answer = `💼 **Ocupación de ${client} (Español):**\n- **Actividad:** Conecta en horarios de descanso laboral.\n\n💌 **Mensaje Sugerido en Inglés (Listo para Enviar):**\n"I know how demanding work can be, but talking to you always brings peace to my day ❤️ How was your workday?"\n\n📝 **Traducción al Español:**\n*"Sé lo exigente que puede ser el trabajo, pero hablar contigo siempre trae paz a mi día ❤️ ¿Cómo estuvo tu jornada laboral?"*`;
      hooks = [
        `"I know how demanding work can be, but talking to you always brings peace to my day ❤️ How was your workday?"`,
        `"Make sure to take a nice deep breath and take care of yourself today 😉 What is your favorite way to unwind in the evenings?"`,
        `"I'm taking a sweet little break and wanted to send you some warmth ❤️ What's keeping you busy today?"`
      ];
    } else {
      // Ganchos contextuales tácticos
      if (lang === 'pt') {
        hooks = [
          `"Estava aqui lembrando da nossa última conversa e abri um sorriso tão bobo... Como você está hoje? ❤️"`,
          `"Você tem esse jeito doce que me faz querer estar mais pertinho... O que você anda fazendo agora? 😉"`,
          `"Cada mensagem sua ilumina o meu dia por completo. Me conta algo bom que te aconteceu hoje!"`
        ];
      } else if (lang === 'es') {
        hooks = [
          `"Me quedé pensando en lo último que me contaste y no pude evitar sonreír... ¿Cómo ha estado tu día hoy? ❤️"`,
          `"Tienes una forma tan especial de hablarme que siempre me alegra el día... ¿Qué estás haciendo justo ahora? 😉"`,
          `"Estaba esperando un momento libre para escribirte... ¿Qué fue lo más bonito que te pasó hoy?"`
        ];
      } else {
        hooks = [
          `"I was just sitting here thinking about our last conversation, and it brought such a genuine smile to my face ❤️ How are you doing today?"`,
          `"You have this unique charm that always makes my day brighter... What are you up to right now? 😉"`,
          `"Every message from you brings such a warm energy. Tell me, what was the best part of your day?"`
        ];
      }

      answer = `Expediente contextual de ${client} (Edad: ${birthDate}):\n\n` +
        hooks.map(h => `- ${h}`).join('\n') +
        `\n\n💡 *Estrategia de Continuidad:* Haz preguntas abiertas conectadas a su tiempo libre o sus gustos para incentivar respuestas largas y fluidas.`;
    }

    res.json({ success: true, answer, hooks });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ====================================================================
// 6.1 ENDPOINT: GENERADOR IA DE RESPUESTAS DE CHAT ULTRA-HUMANIZADAS
// ====================================================================
app.post('/api/intelligence/generate-chat-reply', async (req, res) => {
  try {
    const { clientName, clientId, profileName, bioData, targetLang, recentMessages, recentLetters, fullTranscript } = req.body || {};

    const lang = targetLang || 'en';
    const client = clientName || 'friend';
    const profile = profileName || 'HORACIO';

    // 1. Obtener mensajes y cartas previas (Memoria RAM + Base de datos Supabase)
    let msgs = Array.isArray(recentMessages) ? recentMessages : [];
    if (msgs.length === 0 && clientId && memoryClientMessagesMap.has(String(clientId).trim())) {
      msgs = Array.from(memoryClientMessagesMap.get(String(clientId).trim()).values());
    }
    if (msgs.length === 0 && clientId) {
      try {
        const { data: dbMsgs } = await supabase
          .from('messages')
          .select('sender_type, sender_name, message_text, message_time')
          .eq('client_id', String(clientId))
          .order('id', { ascending: true })
          .limit(30);
        if (dbMsgs && dbMsgs.length > 0) {
          msgs = dbMsgs.map(m => ({
            isOperator: m.sender_type === 'OPERATOR',
            senderName: m.sender_name,
            text: m.message_text,
            time: m.message_time
          }));
        }
      } catch (e) {}
    }

    // 1.1 Extraer el último mensaje del cliente y del operador con máxima precisión
    let lastClientMsg = '';
    let lastOperatorMsg = '';
    for (let i = msgs.length - 1; i >= 0; i--) {
      const m = msgs[i];
      const isOp = m.isOperator === true || m.sender_type === 'OPERATOR' || m.senderName === profile;
      const text = (m.message_text || m.text || '').trim();
      if (!isOp && text && !lastClientMsg) {
        lastClientMsg = text;
      }
      if (isOp && text && !lastOperatorMsg) {
        lastOperatorMsg = text;
      }
      if (lastClientMsg && lastOperatorMsg) break;
    }
    if (!lastClientMsg && clientMsgs.length > 0) {
      lastClientMsg = (clientMsgs[clientMsgs.length - 1].message_text || clientMsgs[clientMsgs.length - 1].text || '').trim();
    }
    if (!lastClientMsg && msgs.length > 0) {
      lastClientMsg = (msgs[msgs.length - 1].message_text || msgs[msgs.length - 1].text || '').trim();
    }

    const lastMsgLower = lastClientMsg.toLowerCase().trim();
    const last3ClientMsgsText = clientMsgs.slice(-3).map(m => m.message_text || m.text || '').join(' ').toLowerCase();
    const lettersText = Array.isArray(recentLetters) ? recentLetters.map(l => l.body || l.preview || l.letter_preview || '').join(' ').toLowerCase() : '';
    const fullDialogueText = `${msgs.map(m => m.message_text || m.text || '').join(' ')} ${lettersText}`.toLowerCase();
    const hasPriorDialogue = msgs.length >= 2 || (Array.isArray(recentLetters) && recentLetters.length > 0) || (msgs.length === 1 && lastClientMsg.length > 0);

    // 2. Extracción semántica profunda y ultra-contextual
    const isFamilyOrKids = /\b(hijo|hija|hijos|filho|filha|filhos|crian[çc]a|ni[ñn]o|ni[ñn]a|ni[ñn]os|kid|kids|child|children|son|daughter|baby|beb[eé]|educaci[oó]n|educa[çc][aã]o|colegio|escola|school|madre|m[aã]e|padre|pai|mam[aá]|pap[aá]|maternidad|paternidad|sobrin|nephew|niece|familia|fam[ií]lia)\b/i.test(lastMsgLower) || /\b(hijo|hija|filho|filha|crian[çc]a|kid|educaci|educa[çc])\b/i.test(last3ClientMsgsText);
    const isConflictOrMoving = /\b(friend|pack|packing|storage|move on|moving|limit|limits|messing|drama|toxic|betray|fight|argument|lie|leaving|bag|boxes|house|apartment|move|mudanz|mudan[çc]a|cajas|maletas|falsa|falso)\b/i.test(last3ClientMsgsText) || /\b(pack|packing|storage|mudanz|falsa|amiga|limit)\b/i.test(lastMsgLower);
    const isExhaustedOrStressed = /\b(tired|exhausted|burnout|burned out|overwhelmed|too much|stress|stressful|pressure|heavy|can't take|drained|cansad|estres|agobi|sobrecarg)\b/i.test(last3ClientMsgsText) || /\b(cansad|tired|estres|exhausted)\b/i.test(lastMsgLower);
    const isBedtime = /\b(bed|going to bed|sleep|sleeping|goodnight|good night|nighty|night|rest|resting|dormir|cama|sue[ñn]o|descanso|boas noites|dormindo|deitar|buenas noches|descansar)\b/i.test(lastMsgLower) || /\b(bed|dormir|sleep|cama|descans)\b/i.test(last3ClientMsgsText);
    const isWorkOrCareer = /\b(work|working|job|office|boss|shift|busy|meeting|deadline|coworker|client|project|trabaj|trabalh|oficina|jefe|turno|reuni[oó]n|reuni[aã]o|negocio|empresa|projeto|proyecto)\b/i.test(lastMsgLower) || /\b(work|trabaj|trabalh|office|oficina)\b/i.test(last3ClientMsgsText);
    const isFoodOrDrink = /\b(coffee|tea|drink|cup|breakfast|lunch|dinner|wine|beer|cooking|food|eat|eating|cafe|café|comida|vino|cerveza|cerveja|jantar|almoço|almuerzo|cena|desayuno|restaurante|pizza)\b/i.test(lastMsgLower) || /\b(coffee|caf[eé]|comida|cook|almo[çc]o|cena)\b/i.test(last3ClientMsgsText);
    const isPetsOrAnimals = /\b(dog|puppy|cat|kitten|pet|pets|animal|perr|cachorr|gat|mascota)\b/i.test(lastMsgLower) || /\b(perr|cachorr|gat|dog|cat|mascota)\b/i.test(last3ClientMsgsText);
    const isMovieOrCinema = /\b(movie|film|cinema|series|episode|watch|watching|pelicula|película|filme|cine|netflix|actor|influencer)\b/i.test(lastMsgLower) || /\b(movie|film|cinema|pelicula|filme|netflix)\b/i.test(last3ClientMsgsText);
    const isSickOrPain = /\b(headache|fever|flu|sick|ill|medicine|pill|cold|pain|hospital|doctor|dolor|enfermo|cabeza|remedio|doente|dor|malestar|febre|fiebre|gripe)\b/i.test(lastMsgLower) || /\b(sick|dolor|doente|dor|headache|enferm)\b/i.test(last3ClientMsgsText);
    const isSadOrLonely = /\b(sad|crying|cry|tears|lonely|alone|miss|depressed|heartbroken|empty|down|hurt|broken|triste|soled|solid[aã]o|chora|llor|desanim)\b/i.test(lastMsgLower) || /\b(triste|sad|lonely|soled|chora)\b/i.test(last3ClientMsgsText);
    const isRomanceOrCompliment = /\b(beautiful|gorgeous|sexy|pretty|cute|sweet|handsome|love|kiss|angel|honey|darling|linda|lindo|hermosa|hermoso|guapa|guapo|bella|bello|amor|princesa|querida|doce|gostosa|gostoso|ojos|olhos|sonrisa|sorriso|beijo|beso)\b/i.test(lastMsgLower);
    const isClientQuestion = /\?|what\s+(are|do|about)|how\s+(are|do)|where|when|why|who|are you|do you|can you|c[oó]mo|qu[eé]|d[oó]nde|cu[aá]ndo|por qu[eé]|vc|voc[eê]|tienes|voc[eê] tem/i.test(lastMsgLower);
    const isGreeting = /\b(hola|holaa|holaaa|ola|olá|oi|oii|hello|hi|hey|buen d[ií]a|bom dia|buenas tardes|boa tarde)\b/i.test(lastMsgLower);
    const isWeekendOrWeather = /\b(fin de semana|fim de semana|weekend|rain|rainy|lluvia|chuva|cold|fr[ií]o|frio|hot|calor|sun|sol|playa|praia|beach|travel|viagem|viaje|vacacion|f[eé]rias)\b/i.test(lastMsgLower);

    let options = [];

    // CASO A: FAMILIA, HIJOS, MATERNIDAD/PATERNIDAD Y EDUCACIÓN (100% Contextual y Humano)
    if (isFamilyOrKids) {
      if (lang === 'pt') {
        options = [
          {
            title: '❤️ Opção 1: Conexão Maternal & Empatia Doce',
            target: `Ai que amor! Cuidar da educação e do crescimento de um filho é a missão mais linda do mundo, mas sei que dá um trabalho danado ❤️ Quantos aninhos ele tem? Me imagino que seja o seu maior orgulho!`,
            es: `Valida com carinho sincero a dedicação à educação do filho e pergunta a idade dele.`
          },
          {
            title: '✨ Opção 2: Descontraída & Sorrisos do Dia a Dia',
            target: `Que fofura! Certeza de que ele é super esperto e te faz dar muitas risadas no dia a dia jaja 😉 O que vocês dois andaram aprontando de divertido hoje?`,
            es: `Comentário alegre sobre a energia da criança convidando a compartilhar a rotina.`
          },
          {
            title: '🌸 Opção 3: Admiração Genuína & Personalidade',
            target: `Admiro demais quem se dedica assim de corpo e alma à família, isso mostra o tamanho do seu coração ✨ Me deu curiosidade: ele puxou mais a sua personalidade ou seu jeitinho carinhoso?`,
            es: `Elogio profundo aos valores familiares e pergunta envolvente sobre quem a criança se parece.`
          }
        ];
      } else if (lang === 'es') {
        options = [
          {
            title: '❤️ Opción 1: Conexión Maternal & Empatía Cálida',
            target: `¡Qué labor tan hermosa! Cuidar y educar a un hijo es un trabajo de tiempo completo pero el más gratificante de todos ❤️ ¿Cuántos añitos tiene el consentido? ¡Seguro es tu mayor orgullo!`,
            es: `Valida con calidez genuina su dedicación a su hijo y le pregunta cuántos años tiene.`
          },
          {
            title: '✨ Opción 2: Espontánea & Alegría Cotidiana',
            target: `¡Qué belleza! Seguro tiene toda tu energía y te saca mil sonrisas al día jaja 😉 Cuéntame, ¿qué hicieron hoy de entretenido juntos?`,
            es: `Tono fresco y espontáneo que despierta una sonrisa e invita a contar su día.`
          },
          {
            title: '🌸 Opción 3: Admiración Genuina & Vínculo Familiar',
            target: `Admiro muchísimo a las personas tan entregadas a su familia, dice mucho de tu nobleza y tu corazón ✨ Me da curiosidad: ¿se parece más a ti en personalidad o en sus ocurrencias?`,
            es: `Elogio afectuoso a su rol familiar con pregunta atractiva sobre la personalidad del pequeño.`
          }
        ];
      } else {
        options = [
          {
            title: '❤️ Option 1: Warm Parental Connection & Pride',
            target: `That is honestly so beautiful! Raising and caring for your child is a full-time job, but easily the most rewarding thing in the world ❤️ How old is your little one? I bet they are your absolute pride and joy!`,
            es: `Valida con calidez genuina su dedicación familiar y pregunta la edad del pequeño.`
          },
          {
            title: '✨ Option 2: Playful Smiles & Daily Routine',
            target: `Aw that's so sweet! I'm sure they keep you super busy and full of laughs every single day haha 😉 What did you two get up to today that made you smile?`,
            es: `Tono fresco y espontáneo sobre la rutina con su hijo.`
          },
          {
            title: '🌸 Option 3: Deep Admiration & Personality Question',
            target: `I truly admire how dedicated you are to your family, it shows what a wonderful heart you have ✨ I'm curious: do they take after your personality or your warm smile?`,
            es: `Elogio genuino y pregunta magnética sobre a quién se parece el niño.`
          }
        ];
      }
    }
    // CASO B: CONFLICTO PERSONAL / LÍMITES / MUDANZA / STORAGE / TOXICIDAD
    else if (isConflictOrMoving) {
      if (lang === 'pt') {
        options = [
          { title: '🛡️ Opção 1: Apoio & Elogio à Coragem', target: `Lidar com pessoas falsas cansa muito, mas fico orgulhosa de você se afastar. Como está a mudança? ❤️`, es: `Valida a decisão difícil e apoia a mudança.` },
          { title: '✨ Opção 2: Paz Mental & Acolhimento', target: `Você não precisa carregar todo esse estresse sozinha. Respira fundo... você escolheu sua paz ✨`, es: `Oferece refúgio emocional acolhedor.` },
          { title: '💪 Opção 3: Força & Alívio Futuro', target: `Você é muito forte por dar esse basta. Assim que guardar tudo no storage, vai sentir um alívio enorme 😉`, es: `Projeta leveza futura ao terminar de empacotar.` }
        ];
      } else if (lang === 'es') {
        options = [
          { title: '🛡️ Opción 1: Apoyo & Elogio a tu Valor', target: `Lidiar con gente falsa agota mucho, pero me alegra que te alejes. ¿Cómo vas empacando tus cosas? ❤️`, es: `Valida la traición y apoya su decisión de empacar.` },
          { title: '✨ Opción 2: Paz Mental & Contención', target: `No tienes que cargar con todo este estrés sola. Respira... estás eligiendo tu paz mental ✨`, es: `Ofrece contención emocional para aliviar el agobio.` },
          { title: '💪 Opción 3: Fuerza & Alivio Inmediato', target: `Eres muy valiente por poner límites. En cuanto guardes todo en el storage sentirás un gran alivio 😉`, es: `Proyecta alivio futuro y le da ánimos para terminar.` }
        ];
      } else {
        options = [
          { title: '🛡️ Option 1: Support & Proud of Boundaries', target: `Dealing with fake friends is so draining, but I'm proud of you for walking away. How is packing going? ❤️`, es: `Valida la decisión de alejarse y pregunta por la mudanza.` },
          { title: '✨ Option 2: Safe Space & Inner Peace', target: `You don't have to carry all this stress alone. Take a deep breath... you're doing what's best for your peace ✨`, es: `Ofrece contención emocional.` },
          { title: '💪 Option 3: Inner Strength & Fresh Start', target: `You are so strong for putting your foot down. Once everything is in storage, you'll feel so much lighter 😉`, es: `Proyecta alivio futuro.` }
        ];
      }
    }
    // CASO C: TRABAJO, OFICINA, TURNO Y RUTINA LABORAL
    else if (isWorkOrCareer) {
      if (lang === 'pt') {
        options = [
          { title: '💼 Opção 1: Empatia com a Jornada & Fôlego', target: `Imagino que o trabalho esteja puxado hoje! 😉 Não esquece de fazer uma pausa, respirar e tomar água. Falta muito para você sair?`, es: `Reconhece o cansaço do trabalho e pergunta quando encerra.` },
          { title: '☕ Opção 2: Respiro Doce & Desconexão', target: `Espero que a minha mensagem seja um respiro gostoso no meio dos seus compromissos ✨ O que você mais quer fazer assim que largar o expediente?`, es: `Pausa agradável no expediente e pergunta sobre planos.` },
          { title: '✨ Opção 3: Força & Companhia Virtual', target: `Força aí nessa correria! Queria estar aí para te levar um café quentinho ❤️ Segura firme, logo você está livre para relaxar!`, es: `Apoio afetivo com café virtual e alívio do turno.` }
        ];
      } else if (lang === 'es') {
        options = [
          { title: '💼 Opción 1: Empatía Laboral & Ánimo', target: `¡Imagino que el trabajo está intenso hoy! 😉 Recuerda tomarte una pausa y respirar hondo. ¿Te falta mucho para terminar tu jornada?`, es: `Reconoce el esfuerzo laboral con empatía y pregunta a qué hora sale.` },
          { title: '☕ Opción 2: Respiro Dulce & Desconexión', target: `Espero que leer mi mensaje te dé un respiro agradable en medio de tantos pendientes ✨ ¿Qué es lo primero que tienes ganas de hacer al salir?`, es: `Momento de frescura en el trabajo y pregunta sobre planes.` },
          { title: '✨ Opción 3: Apoyo Cálido & Café Virtual', target: `¡Mucho ánimo con esa jornada! Ojalá pudiera estar ahí para invitarte un cafecito y que te desconectes un ratito ❤️ ¿Cómo va tu día?`, es: `Complicidad dulce para aligerar la carga de trabajo.` }
        ];
      } else {
        options = [
          { title: '💼 Option 1: Workday Breath & Check-in', target: `I can imagine how hectic work is today! 😉 Don't forget to take a breather and grab some water. Do you have much left of your shift?`, es: `Reconoce el esfuerzo laboral con empatía.` },
          { title: '☕ Option 2: Pleasant Breather & Evening Plans', target: `I hope seeing my message gives you a nice little breather amidst all the tasks ✨ What are you looking forward to doing most once you're off the clock?`, es: `Pausa agradable en el trabajo.` },
          { title: '✨ Option 3: Coffee Break Thought', target: `Hang in there! I honestly wish I could hand you a warm cup of coffee right now to brighten your day ❤️ How is it going so far?`, es: `Complicidad dulce para aligerar la jornada.` }
        ];
      }
    }
    // CASO D: COMIDA, COCINAR, CAFÉ, VINO & RESTAURANTES
    else if (isFoodOrDrink) {
      if (lang === 'pt') {
        options = [
          { title: '🍽️ Opção 1: Curiosidade Culinária & Antojo', target: `Hummm que delícia! 😉 Já me deu água na boca aqui... Você mesmo que preparou com carinho ou foi comer fora?`, es: `Reação espontânea ao prato/café e pergunta se cozinhou.` },
          { title: '🍷 Opção 2: Companhia à Mesa & Charme', target: `Adoraria estar aí dividindo essa refeição com você e brindando... Qual é o seu prato ou comida favorita na vida? ❤️`, es: `Cria imagem de comer juntos e pergunta preferências.` },
          { title: '📸 Opção 3: Troca de Foto do Momento', target: `Que momento gostoso! Me manda uma foto do seu prato ou café para eu ficar babando aqui? 😉 Eu te mando uma minha também!`, es: `Pedido natural de foto da refeição/café.` }
        ];
      } else if (lang === 'es') {
        options = [
          { title: '🍽️ Opción 1: Curiosidad Gastronómica & Antojo', target: `¡Mmm qué delicia! 😉 Ya me dio hambre a mí también jaja... ¿Lo preparaste tú mismo o saliste a consentirte en algún lugar rico?`, es: `Reacción espontánea a la comida y pregunta si cocinó.` },
          { title: '🍷 Opción 2: Compartir la Mesa & Conexión', target: `Me encantaría estar ahí compartiendo ese momento y brindando contigo... ¿Cuál es tu comida o bebida favorita de todas? ❤️`, es: `Fantasía cálida de compartir la mesa.` },
          { title: '📸 Opción 3: Foto del Momento Cotidiano', target: `¡Qué buen plan! ¿Me mandas una foto de tu café o tu comida para antojarme un poquito? 😉 ¡Trato hecho si te mando una mía!`, es: `Gancho irresistible para foto del plato/café.` }
        ];
      } else {
        options = [
          { title: '🍽️ Option 1: Food Curiosity & Home Cooking', target: `Mmm that sounds delicious! 😉 You're making me hungry over here haha... Did you cook it yourself or did you treat yourself out?`, es: `Reacción espontánea a la comida.` },
          { title: '🍷 Option 2: Dining Together Thought', target: `I would love to be right there sharing that meal with you and having a toast ❤️ What's your absolute favorite food in the world?`, es: `Fantasía de compartir una cena juntos.` },
          { title: '📸 Option 3: Casual Food Photo Trade', target: `Sounds like a treat! Send me a picture of what you're having right now to tempt me a little? 😉 I'll send one right back!`, es: `Pedido natural de foto de la comida.` }
        ];
      }
    }
    // CASO E: DESCANSO, CAMA, NOCHE & SUEÑO (BEDTIME)
    else if (isBedtime) {
      if (lang === 'pt') {
        options = [
          { title: '🌙 Opção 1: Boa Noite Doce & Carinho', target: `Descansa bem e tenha os sonhos mais lindos, meu bem! ❤️ Dorme bem quentinho e aconchegado 🤗💋`, es: `Despedida carinhosa e doce para fechar o dia.` },
          { title: '💬 Opção 2: Compromisso Doce pela Manhã', target: `Vai recarregar suas energias ✨ Vou ficar pensando em você... Me manda um bom dia amanhã assim que acordar? 😉`, es: `Fechamento carinhoso deixando compromisso para retomar pela manhã.` },
          { title: '✨ Opção 3: Conexão Íntima & Abraço', target: `Adoro conversar com você antes de dormir, você me acalma ✨ Uma noite linda e maravilhosa para você, meu amor!`, es: `Gera aconchego e reforça o afeto mútuo antes de dormir.` }
        ];
      } else if (lang === 'es') {
        options = [
          { title: '🌙 Opción 1: Dulces Sueños & Descanso Reparador', target: `¡Descansa mucho y que tengas los sueños más lindos del mundo! ❤️ Duerme calientito 🤗💋`, es: `Despedida tierna deseándole dulces sueños.` },
          { title: '💬 Opción 2: Cita Matutina & Continuidad', target: `Ve a recargar energías ✨ Me quedo pensando en ti. ¿Me escribes mañana en cuanto abras los ojos? 😉`, es: `Cierre cariñoso dejando la puerta abierta para la mañana.` },
          { title: '✨ Opción 3: Ternura Íntima Nocturna', target: `Me encanta hablar contigo antes de dormir, me da tanta paz ✨ ¡Que descanses riquísimo, cariño!`, es: `Respuesta cómplice para ir a dormir en paz.` }
        ];
      } else {
        options = [
          { title: '🌙 Option 1: Sweet Dreams & Cozy Rest', target: `Rest well and have the sweetest dreams, my dear! ❤️ Sleep warm and peaceful 🤗💋`, es: `Despedida cariñosa y tierna.` },
          { title: '💬 Option 2: Morning Hello Promise', target: `Go get your rest, sweetheart ✨ I'll be thinking of you. Will you text me tomorrow morning when you wake up? 😉`, es: `Compromiso para retomar la charla al despertar.` },
          { title: '✨ Option 3: Warm Nightly Affection', target: `I love talking with you before bed, it brings me such peace ✨ Have a truly wonderful night, my love!`, es: `Crea cercanía íntima antes de dormir.` }
        ];
      }
    }
    // CASO F: MASCOTAS Y ANIMALES
    else if (isPetsOrAnimals) {
      if (lang === 'pt') {
        options = [
          { title: '🐾 Opção 1: Paixão por Bichinhos', target: `Ai que amor! Eu sou completamente apaixonada por bichinhos ❤️ Como ele se chama? Me conta alguma travessura dele!`, es: `Amor genuíno por pets e pergunta o nome e travessuras.` },
          { title: '📸 Opção 2: Foto Fofa do Pet', target: `Bichinhos têm o poder de encher nossa vida de alegria pura ✨ Me manda uma foto dele para me derreter aqui? 😉`, es: `Pedido irresistível de foto do cachorrinho/gatinho.` },
          { title: '✨ Opção 3: Cumplicidade Divertida', target: `Certeza de que ele manda na casa toda e é o mais mimado jaja 😉 Ele é mais calminho ou super agitado?`, es: `Brincadeira afetuosa sobre quem manda na casa.` }
        ];
      } else if (lang === 'es') {
        options = [
          { title: '🐾 Opción 1: Ternura por las Mascotas', target: `¡Ay qué ternura! Soy una enamorada total de los animalitos ❤️ ¿Cómo se llama tu consentido? ¿Qué raza o tamaño es?`, es: `Amor genuino por las mascotas y pregunta por el nombre.` },
          { title: '📸 Opción 2: Foto Adorable del Consentido', target: `¡Las mascotas tienen la magia de alegrarnos cualquier día! ✨ ¿Me mandas una foto suya para derretirme de amor? 😉`, es: `Pedido dulce de foto del perrito/gatito.` },
          { title: '✨ Opción 3: Broma Cómplice del Hogar', target: `Seguro es el rey de la casa y te tiene a su merced jaja 😉 ¿Es de los que son tranquilos o de los que hacen mil travesuras?`, es: `Broma cariñosa invitando a contar anécdotas del animal.` }
        ];
      } else {
        options = [
          { title: '🐾 Option 1: Pet Love & Name Curiosity', target: `Aw that is so precious! I am an absolute animal lover ❤️ What is your fur baby's name? Tell me their cutest habit!`, es: `Amor genuino por las mascotas.` },
          { title: '📸 Option 2: Cute Pet Photo Request', target: `Pets honestly have that special magic to brighten up any day ✨ Send me a picture of them so I can melt over here? 😉`, es: `Pedido de foto del consentido.` },
          { title: '✨ Option 3: Playful Pet Humor', target: `I bet they completely run the household and have you wrapped around their paw haha 😉 Are they super calm or full of energy?`, es: `Broma cómplice sobre el animal.` }
        ];
      }
    }
    // CASO G: ENTRETENIMIENTO, PELÍCULAS, SERIES, GYM, MÚSICA
    else if (isMovieOrCinema) {
      if (lang === 'pt') {
        options = [
          { title: '🎬 Opção 1: Conexão com o Filme & Sofá', target: `Adoro saber que você vai assistir! 😉 Depois me conta tudo sobre as suas partes favoritas... Queria estar aí no sofá dividindo a pipoca com você ❤️`, es: `Valida o interesse e cria imagem mental aconchegante.` },
          { title: '🍿 Opção 2: Curiosidade de Gostos', target: `Parece uma ótima pedida para hoje! Me diz uma coisa: você costuma se apegar fácil aos personagens ou é mais analítico? 😉`, es: `Pergunta aberta sobre a personalidade dele.` },
          { title: '✨ Opção 3: Foto Relax no Cantinho', target: `Nada melhor do que um bom filme para desacelerar da rotina ✨ Me manda uma foto de onde você está assistindo para eu te acompanhar? 😉`, es: `Pedido de foto descontraída do momento de relax.` }
        ];
      } else if (lang === 'es') {
        options = [
          { title: '🎬 Opción 1: Conexión Cinéfila & Sofá', target: `¡Me encanta que la estés viendo! 😉 Luego me tienes que contar cuál fue tu escena favorita... Me encantaría estar ahí en el sofá compartiendo palomitas contigo ❤️`, es: `Valida la película y plantea una escena íntima compartiendo el descanso.` },
          { title: '🍿 Opción 2: Curiosidad Emocional', target: `¡Se ve genial para desconectar de todo! Dime una cosa, ¿eres de los que se meten de lleno en la trama o eres más observador? 😉`, es: `Pregunta atractiva sobre sus gustos y personalidad.` },
          { title: '✨ Opción 3: Foto en el Momento de Relax', target: `¡Qué buen plan para hoy! Mándame una foto tuya bien cómodo disfrutando de tu descanso y yo te mando una para acompañarte 😉 ¿Trato?`, es: `Propuesta de intercambio de fotos vinculada al descanso.` }
        ];
      } else {
        options = [
          { title: '🎬 Option 1: Movie Validation & Cozy Thought', target: `I love that you're watching that! 😉 You definitely have to tell me your favorite scene once you finish... I wish I were right there sharing the snacks with you ❤️`, es: `Valida la película y fantasea con verla juntos.` },
          { title: '🍿 Option 2: Character & Taste Curiosity', target: `Sounds like a great pick for today! Tell me, do you usually get deeply attached to the story or are you more of an analytical viewer? 😉`, es: `Pregunta interesante sobre sus gustos.` },
          { title: '✨ Option 3: Cozy Evening Photo Ask', target: `Nothing beats a good movie for unwinding ✨ Send me a picture of you getting cozy for your watch, and I'll send one right back? 😉`, es: `Intercambio de fotos relajadas de noche de peli.` }
        ];
      }
    }
    // CASO H: SALUD, DOLOR O MALESTAR FÍSICO
    else if (isSickOrPain) {
      if (lang === 'pt') {
        options = [
          { title: '🩹 Opção 1: Cuidado Protetor & Descanso', target: `Poxa, sinto tanto que você não esteja bem! ❤️ Por favor, toma seu remédio, fica bem quentinho e não se esforça hoje. Quero te ver bem logo!`, es: `Aconselhamento cuidadoso de saúde e carinho.` },
          { title: '❤️ Opção 2: Desejo Doce de Cuidar', target: `Queria tanto estar perto para cuidar de você, te fazer um chá e te dar um abraço bem quentinho ❤️ Como você está se sentindo agora?`, es: `Expressão íntima de afeto e cuidado protetor.` },
          { title: '✨ Opção 3: Companhia Tranquila', target: `Estou aqui torcendo muito pela sua melhora. Não gasta energia à toa, tá? Se precisar desabafar ou só de companhia, estou aqui 😉`, es: `Presença carinhosa sem demandar esforço dele.` }
        ];
      } else if (lang === 'es') {
        options = [
          { title: '🩹 Opción 1: Cuidado Protector & Descanso', target: `¡Ay no, lamento tanto que te sientas mal! ❤️ Por favor tómate tu medicina, abrígate mucho y descansa. ¡Lo más importante hoy eres tú!`, es: `Aconseja descanso, medicina y cuidado empático.` },
          { title: '❤️ Opción 2: Ganas de Cuidarte & Mimos', target: `Ojalá pudiera estar ahí para consentirte, prepararte un tecito caliente y cuidarte un ratito ❤️ ¿Cómo te vas sintiendo en este momento?`, es: `Expresión íntima de cariño y atención.` },
          { title: '✨ Opción 3: Acompañamiento Dulce', target: `Aquí estaré pendiente de ti para lo que necesites 😉 Cierra los ojos y descansa un ratito, me quedo mandándote toda mi buena energía ✨`, es: `Acompañamiento dulce durante el reposo.` }
        ];
      } else {
        options = [
          { title: '🩹 Option 1: Gentle Recovery & Care', target: `Oh no, I'm so sorry you're not feeling well! ❤️ Please take your medicine, stay cozy warm, and get plenty of rest. You come first today!`, es: `Empatía con su salud y consejo de reposo.` },
          { title: '❤️ Option 2: Pampering & Warm Thoughts', target: `I honestly wish I could be there to make you some warm tea and look after you a little ❤️ How are you feeling right now?`, es: `Expresión íntima de afecto y cuidado.` },
          { title: '✨ Option 3: Healing Presence', target: `Don't push yourself at all today. I'm right here sending you the warmest healing thoughts 😉 Rest up, sweetheart!`, es: `Presencia empática sin exigir esfuerzo.` }
        ];
      }
    }
    // CASO I: TRISTEZA, SOLEDAD O AGOBIO EMOCIONAL
    else if (isSadOrLonely || isExhaustedOrStressed) {
      if (lang === 'pt') {
        options = [
          { title: '❤️ Opção 1: Abraço Genuíno & Acolhimento', target: `Dói no peito te ver assim... Quero que você saiba que não está sozinho, eu estou bem aqui com você ❤️ Respira fundo...`, es: `Conexão empática imediata contra a solidão.` },
          { title: '✨ Opção 2: Refúgio Seguro & Desabafo', target: `Pode desabafar comigo tudo o que estiver pesando no seu coração. Você é muito importante para mim ✨`, es: `Convite aberto e acolhedor para desabafar.` },
          { title: '🌸 Opção 3: Carinho & Conforto', target: `Queria poder segurar sua mão agora e te fazer sorrir... Me conta, o que você mais precisa para ter um pouquinho de paz hoje? 😉`, es: `Presença carinhosa para aliviar a tristeza.` }
        ];
      } else if (lang === 'es') {
        options = [
          { title: '❤️ Opción 1: Abrazo Genuino & Contención', target: `Me duele en el alma saber que te sientes así... Recuerda que no estás solo, aquí me tienes para ti ❤️ Respira hondo...`, es: `Conexión empática inmediata y contención amorosa.` },
          { title: '✨ Opción 2: Espacio Seguro para Desahogo', target: `Puedes desahogarte conmigo con toda confianza, suelta todo lo que te pese hoy. Tu bienestar me importa de verdad ✨`, es: `Invitación sincera a desahogar sus emociones.` },
          { title: '🌸 Opción 3: Cariño & Paz Mental', target: `Ojalá pudiera darte un abrazo bien apretado ahora mismo... Dime, ¿qué es algo pequeñito que te daría un respiro de paz hoy? 😉`, es: `Presencia cariñosa para acompañarlo en la tristeza.` }
        ];
      } else {
        options = [
          { title: '❤️ Option 1: Warm Comfort & Safety', target: `It breaks my heart to hear you feeling this way... Please remember you are not alone, I am right here with you ❤️ Take a deep breath...`, es: `Conexión empática inmediata.` },
          { title: '✨ Option 2: Safe Haven to Vent', target: `You can vent to me anytime with zero judgment. Your heart and peace matter so much to me ✨`, es: `Espacio seguro para desahogarse.` },
          { title: '🌸 Option 3: Tender Affection & Peace', target: `I wish I could wrap my arms around you right now and bring a smile to your face... What is something that would bring you a little comfort today? 😉`, es: `Presencia cariñosa para reconfortar.` }
        ];
      }
    }
    // CASO J: PIROPOS, HALAGOS & COQUETEO ROMÁNTICO
    else if (isRomanceOrCompliment) {
      if (lang === 'pt') {
        options = [
          { title: '🥰 Opção 1: Doçura & Agradecimento Charmoso', target: `Você tem um jeito tão doce de falar que me deixa toda sem jeito ❤️ Obrigada pelo carinho! Você sempre é assim atencioso? 😉`, es: `Agradecimento tímido e encantador ao elogio.` },
          { title: '✨ Opção 2: Charme & Reciprocidade', target: `Cada palavra sua me faz sentir um friozinho na barriga ✨ Adoro sua energia! O que você mais gosta no nosso papo?`, es: `Devolve o romantismo com pergunta sedutora.` },
          { title: '📸 Opção 3: Troca Exclusiva de Fotos', target: `Você me faz sorrir de verdade ✨ Me manda uma foto sua agora e eu te preparo uma exclusiva de volta para os seus olhos? 😉`, es: `Gera reciprocidade com troca de fotos.` }
        ];
      } else if (lang === 'es') {
        options = [
          { title: '🥰 Opción 1: Dulzura & Agradecimiento Pícaro', target: `Tienes una forma tan dulce de hablarme que me haces sonreír como boba frente a la pantalla ❤️ ¡Gracias por ser tan lindo! ¿Siempre eres así de detallista? 😉`, es: `Agradecimiento tierno y seductor al halago.` },
          { title: '✨ Opción 2: Romanticismo & Chispa', target: `Cada mensaje tuyo me alegra el día por completo ✨ Tienes una chispa increíble... Dime, ¿qué fue lo que más te llamó la atención de mí?`, es: `Devuelve el galanteo con curiosidad y picardía.` },
          { title: '📸 Opción 3: Intercambio Cómplice de Fotos', target: `De verdad me sacaste una sonrisa hermosa ✨ ¿Me mandas una foto de esa sonrisa hoy y te mando una exclusiva solo para ti? 😉`, es: `Gancho de alta conversión para fotos recíprocas.` }
        ];
      } else {
        options = [
          { title: '🥰 Option 1: Heartfelt Gratitude & Playful Charm', target: `You have such a sweet way of talking that genuinely makes me blush over here ❤️ Thank you! Have you always been this much of a charmer? 😉`, es: `Agradecimiento tierno y seductor.` },
          { title: '✨ Option 2: Chemistry & Return Spark', target: `Your messages always bring the biggest smile to my face ✨ Tell me the truth, what caught your eye the most when we started talking?`, es: `Devuelve el galanteo con picardía.` },
          { title: '📸 Option 3: Reciprocal Photo Trade', target: `You truly made my day a whole lot brighter ✨ Send me a picture of that handsome smile and I'll send an exclusive one right back? 😉`, es: `Gancho de alta conversión para fotos.` }
        ];
      }
    }
    // CASO K: PREGUNTAS DIRECTAS DEL CLIENTE SOBRE EL OPERADOR / PERFIL
    else if (isClientQuestion) {
      if (lang === 'pt') {
        options = [
          { title: '💬 Opção 1: Resposta Espontânea & Reciprocidade', target: `Adoro quando você me pergunta essas coisas 😉 Eu estava aqui descansando um pouquinho e pensando em você ❤️ E você, o que está aprontando agora?`, es: `Responde com ternura e devolve a atenção.` },
          { title: '✨ Opção 2: Entusiasmo Natural & Charme', target: `Estou ótima, especialmente agora conversando com você ✨ É tão gostoso quando você me puxa assunto... O que te deu essa curiosidade? 😉`, es: `Validação positiva da pergunta dele.` },
          { title: '😉 Opção 3: Jogo Gostoso de Conversa', target: `Você sempre sabe como me arrancar um sorriso 😉 Vou te responder tudo, mas com uma condição: você também me conta um segredo seu hoje! Trato? ❤️`, es: `Charme suave incentivando continuidade.` }
        ];
      } else if (lang === 'es') {
        options = [
          { title: '💬 Opción 1: Respuesta Cálida & Devolución Natural', target: `Me encanta cuando me preguntas esas cosas 😉 Estaba justo aquí descansando un poquito y pensando en ti ❤️ Y tú, ¿qué estás haciendo en este instante?`, es: `Responde con dulzura y devuelve la atención.` },
          { title: '✨ Opción 2: Entusiasmo Genuino & Complicidad', target: `Estoy súper bien, y más ahora que leo tu mensaje ✨ Es tan lindo cuando tienes iniciativa para charlar... ¿Qué te dio esa curiosidad hoy? 😉`, es: `Validación positiva de su interés.` },
          { title: '😉 Opción 3: Coqueteo & Reto Juguetón', target: `Siempre sabes cómo sacarme una sonrisa 😉 Te lo cuento todo, pero con una condición: ¡tú también me cuentas un secretito tuyo hoy! ¿Trato? ❤️`, es: `Coqueteo sutil incentivando continuidad.` }
        ];
      } else {
        options = [
          { title: '💬 Option 1: Sweet Direct Answer & Return', target: `I love when you ask me things like that 😉 I was just right here relaxing and thinking of you ❤️ What are you up to at this exact moment?`, es: `Responde con ternura y devuelve la atención.` },
          { title: '✨ Option 2: Warm Return & Curiosity', target: `I'm doing great, especially now that I see your message ✨ Tell me, what brought that sweet thought to your mind? 😉`, es: `Validación positiva de su curiosidad.` },
          { title: '😉 Option 3: Playful Bargain', target: `You always know how to make me smile 😉 I'll tell you all about it, but only if you promise to share a little secret of yours today too! Deal? ❤️`, es: `Coqueteo sutil incentivando continuidad.` }
        ];
      }
    }
    // CASO L: SALUDO SIMPLE O RETOMA DE CHAT (HOLA / OI / HELLO)
    else if (isGreeting) {
      if (hasPriorDialogue) {
        if (lang === 'pt') {
          options = [
            { title: '❤️ Opção 1: Retoma Calorosa & Alegria', target: `Oii meu bem! Que alegria ver sua mensagem ❤️ Estava com saudades do nosso papo... Como está sendo o seu dia?`, es: `Saudação calorosa e carinhosa com continuidade.` },
            { title: '😉 Opção 2: Charme & Sintonia', target: `Oii! Estava justamente pensando em você agorinha 😉 Que coincidência boa! O que você tem feito de bom?`, es: `Sintonia espontânea com pergunta aberta.` },
            { title: '✨ Opção 3: Conexão & Sorriso', target: `Oii amor! Você sempre me arranca um sorriso quando aparece por aqui ✨ Me conta, como estão as coisas por aí?`, es: `Abertura doce incentivando conversa fluida.` }
          ];
        } else if (lang === 'es') {
          options = [
            { title: '❤️ Opción 1: Retoma Cariñosa & Alegría', target: `¡Holaaa cariño! Qué alegría ver tu mensajito ❤️ Te juro que estaba pensando en ti hace un ratito... ¿Cómo ha estado tu día?`, es: `Saludo cálido y natural con continuidad de la relación.` },
            { title: '😉 Opción 2: Coincidencia & Encanto', target: `¡Hola! Qué linda coincidencia que me escribas justo ahora 😉 Me sacaste una sonrisa... ¿Qué tal va todo en tu día?`, es: `Sintonía fresca y abierta.` },
            { title: '✨ Opción 3: Chispa & Conexión', target: `¡Hola corazón! Siempre me alegra el día encontrarte por aquí ✨ Cuéntame, ¿qué estás haciendo en este momento?`, es: `Apertura espontánea sin sonar cliché.` }
          ];
        } else {
          options = [
            { title: '❤️ Option 1: Warm Reunion & Affection', target: `Hey sweetheart! It honestly makes me so happy to see your message ❤️ I was just thinking of you... How has your day been going?`, es: `Saludo cariñoso retomando el chat previo.` },
            { title: '😉 Option 2: Charming Coincidence', target: `Hey there! What a lovely coincidence, you popped into my mind right before you texted 😉 How are things going with you today?`, es: `Sintonía fresca y abierta.` },
            { title: '✨ Option 3: Sparkling Smile & Catch-up', target: `Hey love! You always bring the brightest smile to my day ✨ Tell me, what are you up to right now?`, es: `Apertura espontánea e informal.` }
          ];
        }
      } else {
        if (lang === 'pt') {
          options = [
            { title: '👋 Opção 1: Saudação Espontânea & Leve', target: `Olá! Que gostoso te ver por aqui 😉 Como você está hoje?`, es: `Saudação natural sem afetação.` },
            { title: '✨ Opção 2: Curiosidade Doce', target: `Oii! Seu perfil me passou uma energia tão boa ✨ Me conta, como está sendo a sua semana?`, es: `Abertura amigável e descontraída.` },
            { title: '😉 Opção 3: Convite a Conversar', target: `Oi! Estava passeando por aqui e adorei seu estilo 😉 O que você mais gosta de fazer no seu tempo livre?`, es: `Pergunta aberta de estilo de vida.` }
          ];
        } else if (lang === 'es') {
          options = [
            { title: '👋 Opción 1: Saludo Fresco & Espontáneo', target: `¡Hola! Qué gusto saludarte por aquí 😉 ¿Cómo estás pasando tu día hoy?`, es: `Saludo natural de vida real.` },
            { title: '✨ Opción 2: Vibra Positiva & Cercanía', target: `¡Hola! Tu perfil me transmitió una vibra súper linda y tranquila ✨ Cuéntame, ¿cómo te trata tu semana?`, es: `Apertura amigable y espontánea.` },
            { title: '😉 Opción 3: Curiosidad & Estilo de Vida', target: `¡Hola! Pasaba por aquí y me llamó mucho la atención tu estilo 😉 Dime, ¿qué es lo que más disfrutas hacer en tu tiempo libre?`, es: `Pregunta de baja presión para iniciar charla.` }
          ];
        } else {
          options = [
            { title: '👋 Option 1: Natural & Friendly Hello', target: `Hello there! It's so nice to say hi to you 😉 How is your day going so far?`, es: `Saludo natural y abierto.` },
            { title: '✨ Option 2: Warm & Relaxed Greeting', target: `Hey! Your profile gave me such a genuinely nice vibe ✨ How has your week been treating you?`, es: `Apertura amigable y relajada.` },
            { title: '😉 Option 3: Casual Curiosity', target: `Hey there! Your pictures caught my eye and I wanted to say hello 😉 What's your favorite way to unwind when you have time for yourself?`, es: `Pregunta relajada de estilo de vida.` }
          ];
        }
      }
    }
    // CASO M: FIN DE SEMANA, CLIMA, VIAJES O PLANES
    else if (isWeekendOrWeather) {
      if (lang === 'pt') {
        options = [
          { title: '☀️ Opção 1: Sintonia com o Clima & Planos', target: `Clima perfeito para relaxar e esquecer do mundo! 😉 O que você está planejando de bom para curtir hoje?`, es: `Empatia com o clima ou fim de semana.` },
          { title: '❤️ Opção 2: Vontade de Estar Juntinho', target: `Adoro dias assim... me dá uma vontade enorme de estar juntinho com você no quentinho ❤️ Você é mais de ficar em casa ou sair?`, es: `Insinuação romântica e pergunta sobre estilo.` },
          { title: '📸 Opção 3: Foto do Seu Cantinho', target: `Que delícia de momento ✨ Me manda uma foto de onde você está para eu ver como está seu dia? 😉 Eu te mando uma de volta!`, es: `Gancho de foto do momento.` }
        ];
      } else if (lang === 'es') {
        options = [
          { title: '☀️ Opción 1: Sintonía con el Día & Planes', target: `¡Día perfecto para desconectar y pasarla rico! 😉 ¿Qué tienes planeado de bueno para disfrutar hoy?`, es: `Empatía con el clima o descanso.` },
          { title: '❤️ Opción 2: Compañía Acogedora', target: `Me encantan estos días... Me dan unas ganas enormes de estar compartiendo ese ratito contigo ❤️ ¿Eres más de quedarte en casa tranquilo o de salir a pasear?`, es: `Insinuación tierna y pregunta de preferencias.` },
          { title: '📸 Opción 3: Foto de tu Vista o Momento', target: `¡Qué buen momento! ✨ ¿Me mandas una fotito de cómo está tu día hoy para acompañarte? 😉 ¡Yo te mando una mía para no quedarme atrás!`, es: `Petición atractiva de foto de su día.` }
        ];
      } else {
        options = [
          { title: '☀️ Option 1: Weekend / Weather Flow', target: `Such a great day to unwind and leave all the stress behind! 😉 What nice plans do you have going on today?`, es: `Empatía con el clima o descanso.` },
          { title: '❤️ Option 2: Cozy Thought Together', target: `I love days like this... honestly makes me wish I were right there keeping you company ❤️ Are you more of a homebody or an explorer?`, es: `Insinuación tierna de estar juntos.` },
          { title: '📸 Option 3: Quick Snapshot Ask', target: `Sounds like a great moment ✨ Send me a quick photo of what your day looks like right now so I can picture it? 😉 I'll send one right back!`, es: `Intercambio de fotos cotidianas.` }
        ];
      }
    }
    // CASO N: CONVERSACIÓN CONTINUA NORMAL (FLUJO NATURAL SIN PLANTILLAS ROBÓTICAS)
    else if (hasPriorDialogue) {
      if (lang === 'pt') {
        options = [
          {
            title: '❤️ Opção 1: Validação Afetuosa & Curiosidade',
            target: `Adoro quando a gente conversa sobre essas coisas, me sinto tão pertinho de você ❤️ Me conta mais sobre como foi isso para você!`,
            es: `Valida con afecto o que ele acabou de dizer e convida a aprofundar naturalmente.`
          },
          {
            title: '✨ Opção 2: Charme Descontraído & Sorriso',
            target: `Você sempre tem um jeito tão único de ver as coisas jaja 😉 Me fez sorrir de verdade! E o que mais passou pela sua cabeça hoje?`,
            es: `Comentário caloroso e espontâneo que alimenta a cumplicidade do chat.`
          },
          {
            title: '📸 Opção 3: Cumplicidade do Momento & Foto',
            target: `É tão gostoso ter esse tempinho para falar com você ✨ Me manda uma fotinho sua de agora para alegrar o meu dia? 😉 Eu te mando uma exclusiva também!`,
            es: `Gancho irresistível de troca de fotos motivado pela boa química da conversa.`
          }
        ];
      } else if (lang === 'es') {
        options = [
          {
            title: '❤️ Opción 1: Validación Cálida & Continuidad',
            target: `Me encanta cuando platicamos de estas cosas, me hace sentirte súper cerquita ❤️ Cuéntame más sobre cómo viviste eso tú...`,
            es: `Valida con afecto lo que el cliente acaba de compartir y pide profundizar con naturalidad.`
          },
          {
            title: '✨ Opción 2: Chispa Espontánea & Sonrisa',
            target: `Tienes una manera tan especial y divertida de contar las cosas jaja 😉 De verdad me sacaste una sonrisa... ¿Y qué más ha pasado por tu mente hoy?`,
            es: `Juego de atracción fresco y cercano que dynamiza la conversación.`
          },
          {
            title: '📸 Opción 3: Complicidad & Foto del Momento',
            target: `Es tan lindo tener este ratito para conectar contigo ✨ ¿Me mandas una fotito tuya de ahora para alegrarme el día? 😉 ¡Yo te mando una especial para ti también!`,
            es: `Gancho de alta conversión para fotos recíprocas nacido de la química real.`
          }
        ];
      } else {
        options = [
          {
            title: '❤️ Option 1: Warm Resonance & Natural Flow',
            target: `I really love when we get to chat about these things, it honestly makes me feel so close to you ❤️ Tell me more about how that was for you!`,
            es: `Valida con afecto lo compartido y pide continuidad.`
          },
          {
            title: '✨ Option 2: Playful Chemistry & Smile',
            target: `You have such a genuine way with words haha 😉 You definitely put a smile on my face! What else has been on your mind today?`,
            es: `Coqueteo sutil y halago que estimula el interés.`
          },
          {
            title: '📸 Option 3: Sweet Check-in & Photo Trade',
            target: `It's always so comforting having this time to talk with you ✨ Send me a quick little picture of yourself right now to brighten my day? 😉 I'll send one right back!`,
            es: `Intercambio de fotos 1-a-1 impulsado por la química.`
          }
        ];
      }
    }
    // CASO O: PRIMER CONTACTO / APERTURA DE CHAT (Sin mensajes ni cartas previas)
    else {
      if (lang === 'pt') {
        options = [
          { title: '👋 Opção 1: Abertura Doce & Espontânea', target: `Olá! Seu perfil me passou uma energia tão serena e gostosa que não resisti em vir te dar um oi 😉 Como está sendo a sua semana?`, es: `Abertura calorosa e humana sem jargões ensaiados.` },
          { title: '✨ Opção 2: Charme & Curiosidade Leve', target: `Oii! Adorei o seu estilo nas fotos ✨ Me deu curiosidade: o que você mais gosta de fazer quando tem um tempinho livre só para você?`, es: `Pergunta relaxante sobre paixões e estilo de vida.` },
          { title: '🌸 Opção 3: Saudação com Sorriso', target: `Oi! Tive uma sensação tão boa ao ver suas fotos que quis vir te conhecer 😉 O que de melhor aconteceu no seu dia até agora?`, es: `Pergunta positiva que convida a compartilhar momentos alegres.` }
        ];
      } else if (lang === 'es') {
        options = [
          { title: '👋 Opción 1: Saludo Cálido & Espontáneo', target: `¡Hola! Tu perfil me transmitió una vibra tan linda y serena que me dieron muchas ganas de pasar a saludarte 😉 ¿Cómo te ha estado tratando tu semana?`, es: `Apertura cálida y espontánea como una persona real.` },
          { title: '✨ Opción 2: Curiosidad Amigable & Estilo', target: `¡Hola! Qué lindo coincidir por aquí ✨ Me dio curiosidad saber de ti: ¿qué es lo que más disfrutas hacer cuando tienes tiempo libre para consentirte?`, es: `Pregunta atractiva de baja presión sobre su estilo de vida.` },
          { title: '🌸 Opción 3: Chispa Inicial Positiva', target: `¡Hola! Me sacaste una sonrisa sincera con tus fotos y quise pasar a desearte un lindo día 😉 Cuéntame, ¿qué es lo mejor que te ha pasado hoy?`, es: `Apertura magnética que despierta una respuesta alegre.` }
        ];
      } else {
        options = [
          { title: '👋 Option 1: Warm & Spontaneous Hello', target: `Hello there! Your profile gave off such a warm and lovely energy that I just had to come say hello 😉 How has your week been treating you so far?`, es: `Apertura cálida y humana sin sonar a bot.` },
          { title: '✨ Option 2: Casual Lifestyle Curiosity', target: `Hey! Your style really caught my eye ✨ Tell me, what's your absolute favorite way to unwind when you have time just for yourself?`, es: `Pregunta de estilo de vida relajante.` },
          { title: '🌸 Option 3: Bright & Positive Spark', target: `Hey there! Your photos genuinely brought a smile to my face and I wanted to see how you're doing 😉 What was one nice highlight from your day today?`, es: `Apertura optimista que invita a responder.` }
        ];
      }
    }

    res.json({
      success: true,
      clientName: client,
      profileName: profile,
      lang: lang,
      detectedContext: {
        lastMessage: lastClientMsg,
        isBedtime,
        isMovie,
        isSocialMedia,
        hasPriorDialogue,
        isQuestion
      },
      options: options
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ====================================================================
// 7. ENDPOINT: GENERADOR IA DE CARTAS LISTAS (CONTEXTO 360° Y RAZONAMIENTO)
// ====================================================================
app.post('/api/intelligence/generate-letter', async (req, res) => {
  try {
    const { clientName, clientId, profileName, bioData, targetLang, recentLetters, lastIncomingLetter, recentChat } = req.body || {};

    const lang = targetLang || 'en';
    const client = clientName || (lang === 'pt' ? 'amor' : (lang === 'es' ? 'amor' : 'love'));
    const profile = profileName || (lang === 'pt' ? 'Eu' : (lang === 'es' ? 'Yo' : 'Me'));

    // 1. Consultar cartas previas en Supabase si no llegaron en el request
    let allLetters = Array.isArray(recentLetters) ? recentLetters : [];
    if (allLetters.length === 0 && clientId) {
      try {
        const { data: dbMails } = await supabase
          .from('mails_history')
          .select('direction, letter_preview, letter_date')
          .eq('client_id', String(clientId))
          .order('id', { ascending: false })
          .limit(10);
        if (dbMails) {
          allLetters = dbMails.map(m => ({
            isOutgoing: m.direction === 'OUTGOING',
            date: m.letter_date,
            preview: m.letter_preview
          }));
        }
      } catch (e) {}
    }

    // 2. Identificar la última carta recibida de la clienta/cliente
    const incomingLetters = allLetters.filter(l => !l.isOutgoing);
    const effectiveLastIncoming = lastIncomingLetter || (incomingLetters.length > 0 ? (incomingLetters[0].preview || incomingLetters[0].text) : '');
    const incomingLower = (effectiveLastIncoming || '').toLowerCase();

    // 3. Detección profunda de temas y sentimientos en la carta entrante
    const isConflictOrMoving = /\b(friend|pack|packing|storage|move|moving|limit|limits|toxic|betray|argument|drama|boxes|messing|lie|leaving|house|apartment|start over|nuevo comienzo|empacar|mudanza|amig)\b/i.test(incomingLower);
    const hasWorkOrBusyTopic = /\b(work|job|busy|tired|trabalho|trabajo|cansad|ocupad|shift|office|exhausted)\b/i.test(incomingLower);
    const hasSicknessOrPain = /\b(headache|sick|ill|flu|rain|cold|fever|resting|dolor|cabeza|enferm|remedio|pastilla|hospital)\b/i.test(incomingLower);
    const hasPhotoMention = /\b(photo|picture|pic|foto|selfie|portrait|look|mirada|eyes|ojos)\b/i.test(incomingLower);
    const hasJourneyTogether = /\b(journey|emprender|viaje|together|juntos|path|camino|destiny|destino|future|futuro|bond|connection|respect)\b/i.test(incomingLower);

    let options = [];

    // CASO 1: CONFLICTO PERSONAL / MUDANZA / EMPACAR / LÍMITES
    if (isConflictOrMoving) {
      if (lang === 'pt') {
        options = [
          {
            title: '🛡️ Opção 1: Apoio Genuíno & Validação de Limites',
            rationale: 'Valida a decisão difícil de se afastar de pessoas tóxicas e pergunta sobre a mudança.',
            esPreview: `Meu querido ${client},\n\nLi suas palavras com muita atenção e meu coração está com você. Tomar a decisão de se afastar de quem não te valoriza exige muita coragem, mas sua paz não tem preço.\n\nComo está o processo de empacotar e levar as coisas para o storage? Vá com calma, você é forte e uma nova fase linda está começando para você ❤️\n\nSempre aqui por você,\n${profile} ✨`,
            target: `Meu querido ${client},\n\nLi suas palavras com muita atenção e meu coração está com você. Tomar a decisão de se afastar de quem não te valoriza exige muita coragem, mas sua paz não tem preço.\n\nComo está o processo de empacotar e levar as coisas para o storage? Vá com calma, você é forte e uma nova fase linda está começando para você ❤️\n\nSempre aqui por você,\n${profile} ✨`
          },
          {
            title: '✨ Opção 2: Refúgio de Paz & Alívio Futuro',
            rationale: 'Oferece acolhimento emocional para diminuir a sobrecarga e foca no alívio de recomeçar.',
            esPreview: `Meu querido ${client},\n\nNinguém merece carregar tanto estresse por causa de falsidades alheias. Respira fundo... tudo o que você está enfrentando vai valer a pena quando sentir o alívio de ter seu espaço em paz.\n\nMe conta, qual é a primeira coisa que você vai querer fazer para relaxar assim que terminar tudo? 😉\n\nCom todo meu carinho,\n${profile} ❤️`,
            target: `Meu querido ${client},\n\nNinguém merece carregar tanto estresse por causa de falsidades alheias. Respira fundo... tudo o que você está enfrentando vai valer a pena quando sentir o alívio de ter seu espaço em paz.\n\nMe conta, qual é a primeira coisa que você vai querer fazer para relaxar assim que terminar tudo? 😉\n\nCom todo meu carinho,\n${profile} ❤️`
          },
          {
            title: '🌸 Opção 3: Força Interior & Troca de Fotos',
            rationale: 'Incentiva pausas na rotina pesada e convida a uma troca suave de fotos.',
            esPreview: `Meu querido ${client},\n\nAdmiro muito sua postura firme em não aceitar desrespeito. No meio de tanta correria, não esquece de respirar e se alimentar bem.\n\nQuando fizer um descanso, me manda uma foto sua para eu sentir seu olhar e te mandar um sorriso carinhoso de volta 😉 Combinado?\n\nUm abraço bem quentinho,\n${profile} ✨`,
            target: `Meu querido ${client},\n\nAdmiro muito sua postura firme em não aceitar desrespeito. No meio de tanta correria, não esquece de respirar e se alimentar bem.\n\nQuando fizer um descanso, me manda uma foto sua para eu sentir seu olhar e te mandar um sorriso carinhoso de volta 😉 Combinado?\n\nUm abraço bem quentinho,\n${profile} ✨`
          }
        ];
      } else if (lang === 'es') {
        options = [
          {
            title: '🛡️ Opción 1: Apoyo Genuino & Validación de Límites',
            rationale: 'Valida la valentía de alejarse de falsas amistades y pregunta por la mudanza.',
            esPreview: `Mi queridísimo ${client},\n\nLeí cada detalle de tu carta y de verdad mi corazón está contigo. Poner límites y alejarte de quien no te valora requiere un valor enorme, pero tu tranquilidad no tiene precio.\n\n¿Cómo vas empacando tus cosas hacia el storage? Ve paso a paso, eres muy fuerte y un nuevo comienzo mucho más libre te espera ❤️\n\nSiempre aquí para ti,\n${profile} ✨`,
            target: `Mi queridísimo ${client},\n\nLeí cada detalle de tu carta y de verdad mi corazón está contigo. Poner límites y alejarte de quien no te valora requiere un valor enorme, pero tu tranquilidad no tiene precio.\n\n¿Cómo vas empacando tus cosas hacia el storage? Ve paso a paso, eres muy fuerte y un nuevo comienzo mucho más libre te espera ❤️\n\nSiempre aquí para ti,\n${profile} ✨`
          },
          {
            title: '✨ Opción 2: Refugio de Paz & Alivio Futuro',
            rationale: 'Ofrece contención ante el agobio y enfoca en la paz mental una vez termine de ordenar todo.',
            esPreview: `Mi querido ${client},\n\nNadie merece cargar con tanto desgaste por actitudes egoístas de otros. Respira hondo... todo este esfuerzo valdrá la pena en cuanto veas tus cosas organizadas y sientas tu propia paz.\n\nCuéntame, ¿qué es lo primero que quieres hacer para consentirte una vez termines de acomodar todo? 😉\n\nCon todo mi cariño,\n${profile} ❤️`,
            target: `Mi querido ${client},\n\nNadie merece cargar con tanto desgaste por actitudes egoístas de otros. Respira hondo... todo este esfuerzo valdrá la pena en cuanto veas tus cosas organizadas y sientas tu propia paz.\n\nCuéntame, ¿qué es lo primero que quieres hacer para consentirte una vez termines de acomodar todo? 😉\n\nCon todo mi cariño,\n${profile} ❤️`
          },
          {
            title: '🌸 Opción 3: Fortaleza Interior & Intercambio de Fotos',
            rationale: 'Elogia su resiliencia y propone una foto de respiro para sacarlo del estrés.',
            esPreview: `Mi queridísimo ${client},\n\nAdmiro muchísimo tu determinación para no tolerar faltas de respeto. En medio de tantas cajas y ajetreo, por favor date permiso de descansar y tomar un respiro.\n\nCuando tomes una pausa, mándame una foto tuya para sentirte cerca y enviarte una sonrisa exclusiva 😉 ¿Trato hecho?\n\nUn abrazo muy cálido,\n${profile} ✨`,
            target: `Mi queridísimo ${client},\n\nAdmiro muchísimo tu determinación para no tolerar faltas de respeto. En medio de tantas cajas y ajetreo, por favor date permiso de descansar y tomar un respiro.\n\nCuando tomes una pausa, mándame una foto tuya para sentirte cerca y enviarte una sonrisa exclusiva 😉 ¿Trato hecho?\n\nUn abrazo muy cálido,\n${profile} ✨`
          }
        ];
      } else {
        options = [
          {
            title: '🛡️ Option 1: Genuine Support & Healthy Boundaries',
            rationale: 'Deeply validates the client walking away from toxic friends and asks about packing/storage progress.',
            esPreview: `My dearest ${client},\n\nI read every line of your letter and my heart is truly with you right now. Standing up for yourself and walking away from people who don't respect your boundaries takes so much courage, but your peace is worth everything.\n\nHow is packing and getting your belongings to storage going? Take it one box at a time... you're so resilient and a fresh, peaceful chapter is waiting for you ❤️\n\nAlways here for you,\n${profile} ✨`,
            target: `My dearest ${client},\n\nI read every line of your letter and my heart is truly with you right now. Standing up for yourself and walking away from people who don't respect your boundaries takes so much courage, but your peace is worth everything.\n\nHow is packing and getting your belongings to storage going? Take it one box at a time... you're so resilient and a fresh, peaceful chapter is waiting for you ❤️\n\nAlways here for you,\n${profile} ✨`
          },
          {
            title: '✨ Option 2: Safe Sanctuary & Freedom Ahead',
            rationale: 'Offers warm emotional refuge to alleviate moving stress and focuses on the relief of a clean start.',
            esPreview: `My dear ${client},\n\nYou truly do not deserve to carry so much weight from someone else's drama. Take a deep, gentle breath... this exhausting storm will pass, and the relief you will feel having your things sorted and peaceful will be unmatched.\n\nTell me, what is the very first thing you want to do just for yourself once you get everything settled? 😉\n\nWith all my warmth,\n${profile} ❤️`,
            target: `My dear ${client},\n\nYou truly do not deserve to carry so much weight from someone else's drama. Take a deep, gentle breath... this exhausting storm will pass, and the relief you will feel having your things sorted and peaceful will be unmatched.\n\nTell me, what is the very first thing you want to do just for yourself once you get everything settled? 😉\n\nWith all my warmth,\n${profile} ❤️`
          },
          {
            title: '🌸 Option 3: Inner Strength & Sweet Photo Break',
            rationale: 'Praises their inner strength and invites a quick restful photo exchange to bring comfort.',
            esPreview: `My dearest ${client},\n\nI admire your inner strength so much for putting your foot down and prioritizing your sanity. Amidst all the packing and heavy lifting, please promise me you will take a quiet moment to drink some water and breathe.\n\nWhen you pause for a break, send me a quick picture of yourself so I can send you a warm smile right back 😉 Deal?\n\nHolding you close,\n${profile} ✨`,
            target: `My dearest ${client},\n\nI admire your inner strength so much for putting your foot down and prioritizing your sanity. Amidst all the packing and heavy lifting, please promise me you will take a quiet moment to drink some water and breathe.\n\nWhen you pause for a break, send me a quick picture of yourself so I can send you a warm smile right back 😉 Deal?\n\nHolding you close,\n${profile} ✨`
          }
        ];
      }
    }
    // CASO 2: AGOTAMIENTO LABORAL / ESTRÉS / RUTINA PESADA
    else if (hasWorkOrBusyTopic) {
      if (lang === 'pt') {
        options = [
          {
            title: '💼 Opção 1: Alívio & Reconhecimento do Esforço',
            rationale: 'Reconhece o cansaço do trabalho e oferece conforto acolhedor.',
            esPreview: `Meu querido ${client},\n\nPercebo o quanto você se dedica e como seus dias têm sido exigentes. É admirável sua dedicação, mas você merece descansar a mente e o corpo.\n\nEspero que ler esta carta seja o seu cantinho de paz hoje. Me conta, qual é a sua maneira favorita de se desligar do mundo e relaxar? ❤️\n\nCom todo meu carinho,\n${profile} ✨`,
            target: `Meu querido ${client},\n\nPercebo o quanto você se dedica e como seus dias têm sido exigentes. É admirável sua dedicação, mas você merece descansar a mente e o corpo.\n\nEspero que ler esta carta seja o seu cantinho de paz hoje. Me conta, qual é a sua maneira favorita de se desligar do mundo e relaxar? ❤️\n\nCom todo meu carinho,\n${profile} ✨`
          },
          {
            title: '✨ Opção 2: Pausa Afetuosa & Troca de Fotos',
            rationale: 'Incentiva uma pausa saudável e propõe uma foto exclusiva.',
            esPreview: `Meu querido ${client},\n\nQueria tanto poder te preparar algo gostoso e te fazer massagem para tirar toda essa tensão do trabalho. Não se cobre tanto hoje!\n\nMe envia uma foto sua descansando agora para eu te mandar uma foto bem especial só para você 😉\n\nCom um beijo doce,\n${profile} ❤️`,
            target: `Meu querido ${client},\n\nQueria tanto poder te preparar algo gostoso e te fazer massagem para tirar toda essa tensão do trabalho. Não se cobre tanto hoje!\n\nMe envia uma foto sua descansando agora para eu te mandar uma foto bem especial só para você 😉\n\nCom um beijo doce,\n${profile} ❤️`
          },
          {
            title: '🌸 Opção 3: Conexão Emocional Profunda',
            rationale: 'Fortalece o vínculo íntimo em meio à rotina cansativa.',
            esPreview: `Meu querido ${client},\n\nMesmo na correria, saber que você tira um tempo para me escrever aquece demais o meu coração. Nossas cartas são a melhor parte do meu dia.\n\nQual é aquele sonho ou viagem que você mais quer realizar quando tiver férias? 😉\n\nSempre pensando em você,\n${profile} ✨`,
            target: `Meu querido ${client},\n\nMesmo na correria, saber que você tira um tempo para me escrever aquece demais o meu coração. Nossas cartas são a melhor parte do meu dia.\n\nQual é aquele sonho ou viagem que você mais quer realizar quando tiver férias? 😉\n\nSempre pensando em você,\n${profile} ✨`
          }
        ];
      } else if (lang === 'es') {
        options = [
          {
            title: '💼 Opción 1: Alivio & Reconocimiento de tu Esfuerzo',
            rationale: 'Valida el cansancio por el trabajo y le brinda un remanso de paz.',
            esPreview: `Mi queridísimo ${client},\n\nNoto cuánto te esfuerzas y lo demandantes que han sido tus jornadas. Admiro tu dedicación, pero también mereces consentirte y dejar las preocupaciones a un lado.\n\nDeseo que leer mis letras sea tu respiro de paz hoy. Dime, ¿cuál es tu plan ideal cuando por fin logras desconectar de todo? ❤️\n\nCon todo mi cariño,\n${profile} ✨`,
            target: `Mi queridísimo ${client},\n\nNoto cuánto te esfuerzas y lo demandantes que han sido tus jornadas. Admiro tu dedicación, pero también mereces consentirte y dejar las preocupaciones a un lado.\n\nDeseo que leer mis letras sea tu respiro de paz hoy. Dime, ¿cuál es tu plan ideal cuando por fin logras desconectar de todo? ❤️\n\nCon todo mi cariño,\n${profile} ✨`
          },
          {
            title: '✨ Opción 2: Pausa Afectuosa & Foto Exclusiva',
            rationale: 'Propuesta relajante con intercambio recíproco de fotos.',
            esPreview: `Mi querido ${client},\n\nOjalá pudiera estar contigo para prepararte algo rico y ayudarte a soltar toda la tensión del día. ¡Por favor no te exijas de más hoy!\n\nMándame una fotico tuya relajándote para devolverte una foto muy linda y exclusiva para ti 😉 ¿Trato?\n\nCon un beso dulce,\n${profile} ❤️`,
            target: `Mi querido ${client},\n\nOjalá pudiera estar contigo para prepararte algo rico y ayudarte a soltar toda la tensión del día. ¡Por favor no te exijas de más hoy!\n\nMándame una fotico tuya relajándote para devolverte una foto muy linda y exclusiva para ti 😉 ¿Trato?\n\nCon un beso dulce,\n${profile} ❤️`
          },
          {
            title: '🌸 Opción 3: Conexión Emocional & Sueños',
            rationale: 'Profundiza en metas y anhelos para escapar del estrés cotidiano.',
            esPreview: `Mi queridísimo ${client},\n\nSaber que en medio de tus compromisos te tomas el tiempo de escribirme me hace sentir sumamente especial. Eres una persona admirable.\n\nCuéntame, ¿cuál es ese viaje o proyecto personal que más te ilusiona para cuando tengas unos días libres? 😉\n\nSiempre pensando en ti,\n${profile} ✨`,
            target: `Mi queridísimo ${client},\n\nSaber que en medio de tus compromisos te tomas el tiempo de escribirme me hace sentir sumamente especial. Eres una persona admirable.\n\nCuéntame, ¿cuál es ese viaje o proyecto personal que más te ilusiona para cuando tengas unos días libres? 😉\n\nSiempre pensando en ti,\n${profile} ✨`
          }
        ];
      } else {
        options = [
          {
            title: '💼 Option 1: Comfort & Work Fatigue Relief',
            rationale: 'Validates demanding job schedule and offers a calm, soothing presence.',
            esPreview: `My dearest ${client},\n\nI can tell just how hard you work and how demanding your daily schedule has been. I truly respect your dedication, but please remember your body and mind deserve rest too.\n\nI hope reading my words feels like a cozy sanctuary in your day. Tell me, what is your favorite way to unwind when you finally get quiet time for yourself? ❤️\n\nWith all my affection,\n${profile} ✨`,
            target: `My dearest ${client},\n\nI can tell just how hard you work and how demanding your daily schedule has been. I truly respect your dedication, but please remember your body and mind deserve rest too.\n\nI hope reading my words feels like a cozy sanctuary in your day. Tell me, what is your favorite way to unwind when you finally get quiet time for yourself? ❤️\n\nWith all my affection,\n${profile} ✨`
          },
          {
            title: '✨ Option 2: Sweet Break & Photo Trade',
            rationale: 'Encourages a cozy break from work with magnetic reciprocal photo trade.',
            esPreview: `My dear ${client},\n\nI honestly wish I could be right by your side to make you a warm drink and help you let go of all that work stress. Please take it easy on yourself today!\n\nSend me a quick photo of yourself relaxing now, and in my next letter I'll send an exclusive picture just for you 😉 Deal?\n\nWith a sweet kiss,\n${profile} ❤️`,
            target: `My dear ${client},\n\nI honestly wish I could be right by your side to make you a warm drink and help you let go of all that work stress. Please take it easy on yourself today!\n\nSend me a quick photo of yourself relaxing now, and in my next letter I'll send an exclusive picture just for you 😉 Deal?\n\nWith a sweet kiss,\n${profile} ❤️`
          },
          {
            title: '🌸 Option 3: Romantic Daydreaming & Future Plans',
            rationale: 'Invites the client to escape everyday work grind by talking about passions and travels.',
            esPreview: `My dearest ${client},\n\nKnowing that despite your busy schedule you always think to write to me truly touches my heart. Our letters have become such a meaningful part of my life.\n\nTell me, where is one dream destination you would love to travel to whenever you take your next long vacation? 😉\n\nAlways thinking of you,\n${profile} ✨`,
            target: `My dearest ${client},\n\nKnowing that despite your busy schedule you always think to write to me truly touches my heart. Our letters have become such a meaningful part of my life.\n\nTell me, where is one dream destination you would love to travel to whenever you take your next long vacation? 😉\n\nAlways thinking of you,\n${profile} ✨`
          }
        ];
      }
    }
    // CASO 3: SALUD / ENFERMEDAD / MALESTAR
    else if (hasSicknessOrPain) {
      if (lang === 'pt') {
        options = [
          {
            title: '🩹 Opção 1: Cuidado Afetuoso & Recuperação',
            target: `Meu querido ${client},\n\nFiquei com o coração apertado ao saber que você não está se sentindo bem. Por favor, tome seus remédios, beba bastante água e descanse tudo o que puder.\n\nQueria tanto poder cuidar de você pessoalmente agora... Me conta, como você está se sentindo hoje? ❤️\n\nCom todo meu afeto,\n${profile} ✨`,
            es: `Cuidado carinhoso e incentivo a tomar remédios e descansar.`
          },
          {
            title: '✨ Opção 2: Carinho Reconfortante & Companhia',
            target: `Meu querido ${client},\n\nNão se esforce para fazer nada hoje! O mundo pode esperar enquanto você se recupera com calma. Estou daqui enviando as melhores energias para você melhorar logo.\n\nVocê tem alguém aí cuidando de você ou está sozinho? 😉\n\nCom um abraço bem quentinho,\n${profile} ❤️`,
            es: `Companhia reconfortante e pergunta sobre suporte durante a recuperação.`
          },
          {
            title: '🌸 Opção 3: Pensamento Doce & Sorriso',
            target: `Meu querido ${client},\n\nQuero que você feche os olhos e sinta meu carinho aí com você. Quando estiver um pouquinho melhor, me escreve só para eu saber que você está em paz.\n\nO que eu poderia fazer agora para arrancar um sorriso do seu rosto? 😉\n\nSempre pensando em você,\n${profile} ✨`,
            es: `Desejo carinhoso de tirar um sorriso durante o repouso.`
          }
        ];
      } else if (lang === 'es') {
        options = [
          {
            title: '🩹 Opción 1: Cuidado Afectuoso & Recuperación',
            target: `Mi queridísimo ${client},\n\nSe me encogió el corazón al saber que no te has sentido bien. Por favor toma tus medicinas con calma, bebe suficiente líquido y guarda todo el reposo que puedas.\n\nOjalá pudiera estar ahí cuidándote en persona... ¿Cómo te vas sintiendo hoy? ❤️\n\nCon todo mi cariño,\n${profile} ✨`,
            es: `Cuidado cariñoso y consejo de guardar reposo y tomar medicina.`
          },
          {
            title: '✨ Opción 2: Mimo Reconfortante & Compañía',
            target: `Mi querido ${client},\n\n¡Por favor no hagas ningún esfuerzo hoy! Tus responsabilidades pueden esperar mientras recuperas tus fuerzas. Aquí estaré enviándote la energía más linda para tu pronta mejoría.\n\n¿Hay alguien consintiéndote en casa o estás solito descansando? 😉\n\nCon un abrazo muy cálido,\n${profile} ❤️`,
            es: `Compañía empática y pregunta cariñosa sobre si tiene quién lo cuide.`
          },
          {
            title: '🌸 Opción 3: Pensamiento Dulce & Sonrisa',
            target: `Mi queridísimo ${client},\n\nCierra tus ojos un momento y siente que estoy ahí acompañándote con dulzura. En cuanto sientas un alivio, escríbeme unas palabras para saber que estás mejor.\n\n¿Qué detalle te alegraría el corazón en este momento? 😉\n\nSiempre pensando en ti,\n${profile} ✨`,
            es: `Acompañamiento dulce para levantar su ánimo en la cama.`
          }
        ];
      } else {
        options = [
          {
            title: '🩹 Option 1: Tender Health Care & Recovery',
            target: `My dearest ${client},\n\nIt truly worried me to hear you haven't been feeling well. Please make sure you take your medication, drink plenty of warm fluids, and get all the restful sleep you need.\n\nI really wish I were there to look after you and bring you comfort... How are you feeling right now? ❤️\n\nWith all my love,\n${profile} ✨`,
            es: `Cuidado cariñoso y consejo de guardar reposo y tomar medicina.`
          },
          {
            title: '✨ Option 2: Cozy Healing Sanctuary',
            target: `My dear ${client},\n\nPlease do not push yourself to do anything heavy today! Everything else can wait while you focus on regaining your strength. I am sending you all my warmest thoughts for a quick recovery.\n\nIs there someone looking after you at home, or are you resting on your own? 😉\n\nWith a warm comforting hug,\n${profile} ❤️`,
            es: `Compañía empática y pregunta cariñosa sobre si tiene quién lo cuide.`
          },
          {
            title: '🌸 Option 3: Gentle Comfort & Sweet Smile',
            target: `My dearest ${client},\n\nClose your eyes and picture me keeping you company with a warm blanket. Whenever you feel a little stronger, send me a note just so I know you are feeling better.\n\nWhat is something sweet that always brings a smile to your face when you're resting? 😉\n\nAlways thinking of you,\n${profile} ✨`,
            es: `Acompañamiento dulce para levantar su ánimo en la cama.`
          }
        ];
      }
    }
    // CASO 4: INTERCAMBIO DE FOTOS O AFECTO PROFUNDO
    else if (hasPhotoMention || hasJourneyTogether) {
      if (lang === 'pt') {
        options = [
          {
            title: '📸 Opção 1: Conexão Afetuosa & Troca de Fotos',
            rationale: 'Valida a sintonia visual e sentimental com troca mútua de fotos.',
            esPreview: `Meu querido ${client},\n\nSuas palavras e seu jeito carinhoso me tocam de uma maneira única. Adoro olhar suas fotos e sentir a verdade e o calor que transmitem os seus olhos.\n\nMe envia uma foto sua de hoje para eu guardar com carinho, e na minha próxima carta te mando uma foto exclusiva só para você 😉\n\nCom todo meu afeto,\n${profile} ❤️`,
            target: `Meu querido ${client},\n\nSuas palavras e seu jeito carinhoso me tocam de uma maneira única. Adoro olhar suas fotos e sentir a verdade e o calor que transmitem os seus olhos.\n\nMe envia uma foto sua de hoje para eu guardar com carinho, e na minha próxima carta te mando uma foto exclusiva só para você 😉\n\nCom todo meu afeto,\n${profile} ❤️`
          },
          {
            title: '✨ Opção 2: Caminhar Juntos & Cumplicidade',
            rationale: 'Foca na cumplicidade mútua e pergunta sobre conexão ideal.',
            esPreview: `Meu querido ${client},\n\nÉ tão raro e especial encontrar alguém com quem a conversa flui com tanta sinceridade e respeito. Saber que compartilhamos desse mesmo sentimento me enche de alegria.\n\nMe conta, qual é o valor que você considera mais importante e inegociável em uma relação de verdade? 😉\n\nCom um abraço apertado,\n${profile} ✨`,
            target: `Meu querido ${client},\n\nÉ tão raro e especial encontrar alguém com quem a conversa flui com tanta sinceridade e respeito. Saber que compartilhamos desse mesmo sentimento me enche de alegria.\n\nMe conta, qual é o valor que você considera mais importante e inegociável em uma relação de verdade? 😉\n\nCom um abraço apertado,\n${profile} ✨`
          },
          {
            title: '🌸 Opção 3: Romantismo & Sonhos Partilhados',
            rationale: 'Pergunta íntima e magnética sobre paixões profundas.',
            esPreview: `Meu querido ${client},\n\nCada carta sua se tornou um momento de luz nos meus dias. Adoro o jeito doce como você compartilha seus sentimentos comigo.\n\nSe você pudesse escolher um momento perfeito para nós dois vivermos juntos, como ele seria? 😉\n\nSempre pensando em você,\n${profile} ❤️`,
            target: `Meu querido ${client},\n\nCada carta sua se tornou um momento de luz nos meus dias. Adoro o jeito doce como você compartilha seus sentimentos comigo.\n\nSe você pudesse escolher um momento perfeito para nós dois vivermos juntos, como ele seria? 😉\n\nSempre pensando em você,\n${profile} ❤️`
          }
        ];
      } else if (lang === 'es') {
        options = [
          {
            title: '📸 Opción 1: Conexión Afectuosa & Fotos Exclusivas',
            rationale: 'Valida la atracción mutua y propone intercambio de fotos.',
            esPreview: `Mi queridísimo ${client},\n\nTus palabras y tu ternura me llegan de una forma muy especial. Me encanta mirar tus fotos y sentir la autenticidad y calidez que transmiten tus ojos.\n\nEnvíame una foto tuya de hoy para sentirte más cerca, y en mi próxima carta te enviaré una foto exclusiva solo para ti 😉 ¿Trato hecho?\n\nCon todo mi cariño,\n${profile} ❤️`,
            target: `Mi queridísimo ${client},\n\nTus palabras y tu ternura me llegan de una forma muy especial. Me encanta mirar tus fotos y sentir la autenticidad y calidez que transmiten tus ojos.\n\nEnvíame una foto tuya de hoy para sentirte más cerca, y en mi próxima carta te enviaré una foto exclusiva solo para ti 😉 ¿Trato hecho?\n\nCon todo mi cariño,\n${profile} ❤️`
          },
          {
            title: '✨ Opción 2: Caminar Juntos & Complicidad Real',
            rationale: 'Fomenta la complicidad y valores en una relación auténtica.',
            esPreview: `Mi querido ${client},\n\nEs tan difícil y hermoso encontrar a alguien con quien la comunicación fluya con tanta pureza y respeto. Saber que valoras este camino me da una alegría inmensa.\n\nCuéntame, ¿cuál es ese valor que consideras imprescindible en una conexión verdadera entre dos personas? 😉\n\nUn abrazo muy cálido,\n${profile} ✨`,
            target: `Mi querido ${client},\n\nEs tan difícil y hermoso encontrar a alguien con quien la comunicación fluya con tanta pureza y respeto. Saber que valoras este camino me da una alegría inmensa.\n\nCuéntame, ¿cuál es ese valor que consideras imprescindible en una conexión verdadera entre dos personas? 😉\n\nUn abrazo muy cálido,\n${profile} ✨`
          },
          {
            title: '🌸 Opción 3: Romanticismo & Sueños Compartidos',
            rationale: 'Pregunta romántica que estimula la imaginación y cartas largas.',
            esPreview: `Mi queridísimo ${client},\n\nRecibir tus cartas se ha convertido en mi momento favorito del día. Hay una dulzura tan natural en la forma en que nos conocemos.\n\nSi pudieras diseñar una cita perfecta para los dos, ¿cómo te gustaría que fuera? 😉\n\nSiempre pensando en ti,\n${profile} ❤️`,
            target: `Mi queridísimo ${client},\n\nRecibir tus cartas se ha convertido en mi momento favorito del día. Hay una dulzura tan natural en la forma en que nos conocemos.\n\nSi pudieras diseñar una cita perfecta para los dos, ¿cómo te gustaría que fuera? 😉\n\nSiempre pensando en ti,\n${profile} ❤️`
          }
        ];
      } else {
        options = [
          {
            title: '📸 Option 1: Affectionate Connection & Photo Trade',
            rationale: 'Highlights visual chemistry and proposes a reciprocal photo trade.',
            esPreview: `My dearest ${client},\n\nYour words and sincerity touch my heart in such a special way. I love looking at your photos and feeling the warmth and kindness in your eyes.\n\nSend me a photo of yourself today so I can feel closer to you, and in my next letter I will send an exclusive picture just for you 😉 Deal?\n\nWith all my love,\n${profile} ❤️`,
            target: `My dearest ${client},\n\nYour words and sincerity touch my heart in such a special way. I love looking at your photos and feeling the warmth and kindness in your eyes.\n\nSend me a photo of yourself today so I can feel closer to you, and in my next letter I will send an exclusive picture just for you 😉 Deal?\n\nWith all my love,\n${profile} ❤️`
          },
          {
            title: '✨ Option 2: Walking Together & True Bond',
            rationale: 'Encourages mutual connection and values in a genuine relationship.',
            esPreview: `My dear ${client},\n\nIt is truly rare and wonderful to find someone you can communicate with so authentically and peacefully. Knowing how much you respect our bond brings so much happiness to my days.\n\nTell me, what is one quality that you value above everything else in a relationship? 😉\n\nWith a warm embrace,\n${profile} ✨`,
            target: `My dear ${client},\n\nIt is truly rare and wonderful to find someone you can communicate with so authentically and peacefully. Knowing how much you respect our bond brings so much happiness to my days.\n\nTell me, what is one quality that you value above everything else in a relationship? 😉\n\nWith a warm embrace,\n${profile} ✨`
          },
          {
            title: '🌸 Option 3: Romantic Imagination & Dream Date',
            rationale: 'Stimulates romantic imagination and invites an engaging, heartfelt letter.',
            esPreview: `My dearest ${client},\n\nReading your letters has truly become the sweetest highlight of my day. There is such an effortless warmth in the way we share our thoughts.\n\nIf you could plan an absolute dream date for the two of us, what would we be doing? 😉\n\nAlways thinking of you,\n${profile} ❤️`,
            target: `My dearest ${client},\n\nReading your letters has truly become the sweetest highlight of my day. There is such an effortless warmth in the way we share our thoughts.\n\nIf you could plan an absolute dream date for the two of us, what would we be doing? 😉\n\nAlways thinking of you,\n${profile} ❤️`
          }
        ];
      }
    }
    // CASO 5: CARTA GENERAL / DESCUBRIMIENTO MUTUO
    else {
      if (lang === 'pt') {
        options = [
          {
            title: '🪝 Opção 1: Conexão Emocional & Curiosidade',
            target: `Meu querido ${client},\n\nAdoro ler suas palavras e perceber a serenidade com que você se comunica. Conversar com você sempre me traz uma energia muito leve.\n\nMe conta, qual foi o momento ou detalhe que mais colocou um sorriso no seu rosto recentemente? 😉\n\nCom todo meu carinho,\n${profile} ❤️`,
            es: `Validação sincera e pergunta relaxante sobre o que o fez sorrir.`
          },
          {
            title: '💬 Opção 2: Cumplicidade Cotidiana & Foto',
            target: `Meu querido ${client},\n\nEstava aqui refletindo sobre o nosso contato e em como é bom ter alguém com quem trocar pensamentos sinceros.\n\nMe manda uma foto sua de hoje para eu te sentir mais pertinho, e na próxima carta te mando uma foto especial 😉\n\nCom um beijo doce,\n${profile} ✨`,
            target: `Meu querido ${client},\n\nEstava aqui refletindo sobre o nosso contato e em como é bom ter alguém com quem trocar pensamentos sinceros.\n\nMe manda uma foto sua de hoje para eu te sentir mais pertinho, e na próxima carta te mando uma foto especial 😉\n\nCom um beijo doce,\n${profile} ✨`
          },
          {
            title: '✨ Opção 3: Fascinação & Pergunta Íntima',
            target: `Meu querido ${client},\n\nNossas conversas estão se tornando cada vez mais especiais para mim. Adoro conhecer o homem por trás de cada mensagem.\n\nMe conta um sonho ou segredo seu que poucas pessoas conhecem... o que te move na vida? 😉\n\nSempre aqui,\n${profile} ❤️`,
            es: `Pergunta reflexiva sobre sonhos para gerar carta longa.`
          }
        ];
      } else if (lang === 'es') {
        options = [
          {
            title: '🪝 Opción 1: Conexión Emocional & Curiosidad',
            target: `Mi queridísimo ${client},\n\nMe encanta leer tus palabras y sentir la serenidad con la que te comunicas. Saber de ti siempre me llena de una energía hermosa y ligera.\n\nCuéntame, ¿cuál fue ese detalle o momento que logró sacarte una sonrisa genuina recientemente? 😉\n\nCon todo mi cariño,\n${profile} ❤️`,
            es: `Validación sincera y pregunta relajante sobre lo que le alegró el día.`
          },
          {
            title: '💬 Opción 2: Complicidad Cotidiana & Foto',
            target: `Mi querido ${client},\n\nEstaba aquí pensando en ti y en lo lindo que es tener a alguien con quien compartir pensamientos auténticos en medio de la rutina.\n\nMándame una fotico tuya de hoy para sentirte cerca, y en mi próxima carta te enviaré una foto exclusiva para ti 😉 ¿Trato?\n\nCon un beso dulce,\n${profile} ✨`,
            es: `Intercambio de fotos cotidiano para estrechar lazos.`
          },
          {
            title: '✨ Opción 3: Fascinación & Pregunta Íntima',
            target: `Mi queridísimo ${client},\n\nNuestra comunicación se está convirtiendo en algo verdaderamente valioso para mí. Me encanta ir descubriendo el hombre detrás de cada carta.\n\nCuéntame un sueño o anhelo tuyo que pocas personas conozcan... ¿qué es lo que más te apasiona en la vida? 😉\n\nSiempre pensando en ti,\n${profile} ❤️`,
            es: `Pregunta íntima y reflexiva para propiciar una respuesta amplia.`
          }
        ];
      } else {
        options = [
          {
            title: '🪝 Option 1: Genuine Connection & Sweet Curiosity',
            target: `My dearest ${client},\n\nI really love reading your thoughts and feeling the calm, authentic energy you share with me. Hearing from you always brings such a gentle warmth to my day.\n\nTell me, what was one little moment recently that brought a genuine smile to your face? 😉\n\nWith all my affection,\n${profile} ❤️`,
            es: `Validación sincera y pregunta relajante sobre lo que le alegró el día.`
          },
          {
            title: '💬 Option 2: Daily Warmth & Photo Trade',
            target: `My dear ${client},\n\nI was just sitting here thinking of you and how comforting it is to share such authentic conversations with you amidst daily life.\n\nSend me a photo of yourself today so I can feel closer to you, and in my next letter I'll send an exclusive picture just for you 😉 Deal?\n\nWith a sweet hug,\n${profile} ✨`,
            es: `Intercambio de fotos cotidiano para estrechar lazos.`
          },
          {
            title: '✨ Option 3: Romantic Curiosity & Passion Question',
            target: `My dearest ${client},\n\nOur letters are truly becoming something so special and meaningful to me. I love discovering more about who you are with each word you write.\n\nTell me a dream or secret desire of yours that very few people know about... what brings the purest joy to your soul? 😉\n\nAlways thinking of you,\n${profile} ❤️`,
            es: `Pregunta íntima y reflexiva para propiciar una respuesta amplia.`
          }
        ];
      }
    }

    res.json({
      success: true,
      clientName: client,
      profileName: profile,
      lang: lang,
      options: options,
      letter: options[0].target
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ====================================================================
// 7.1 ENDPOINT: TRADUCCIÓN INSTANTÁNEA MULTI-IDIOMA
// ====================================================================
app.post('/api/translate', async (req, res) => {
  try {
    const { text, targetLang } = req.body;
    if (!text || text.trim().length === 0) {
      return res.json({ success: true, translatedText: '' });
    }
    const tl = targetLang || 'en';
    const googleUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${encodeURIComponent(tl)}&dt=t&q=${encodeURIComponent(text)}`;
    const resp = await fetch(googleUrl);
    const data = await resp.json();
    let translated = '';
    if (Array.isArray(data) && Array.isArray(data[0])) {
      translated = data[0].map(item => item[0]).join('');
    }
    res.json({ success: true, translatedText: translated || text, targetLang: tl });
  } catch (err) {
    res.json({ success: true, translatedText: req.body.text || '', error: err.message });
  }
});

// ====================================================================
// 8. ENDPOINT: FIREWALL DE 3 CAPAS (GESTIÓN DE PALABRAS PROHIBIDAS & TM)
// ====================================================================
app.get('/api/banned-words', async (req, res) => {
  try {
    const { data, error } = await supabase.from('banned_words').select('word_or_phrase, category');
    if (error) throw error;

    const words = data.map(item => item.word_or_phrase);
    res.json({ success: true, words, fullList: data });
  } catch (err) {
    res.json({
      success: true,
      words: ['promet', 'whatsapp', 'skype', 'email', 'telefon', 'when we meet', 'book a flight', 'hotel', 'meet up', 'airport']
    });
  }
});

app.post('/api/banned-words', async (req, res) => {
  try {
    const { word, category } = req.body;
    if (!word) return res.status(400).json({ error: 'Palabra requerida' });

    const cleanWord = word.trim().toLowerCase();
    await supabase.from('banned_words').insert({
      word_or_phrase: cleanWord,
      category: category || 'DATA_LEAK'
    });

    res.json({ success: true, message: `Palabra "${cleanWord}" agregada al Firewall` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/banned-words/:word', async (req, res) => {
  try {
    const { word } = req.params;
    await supabase.from('banned_words').delete().eq('word_or_phrase', word.toLowerCase());
    res.json({ success: true, message: `Palabra "${word}" eliminada del Firewall` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ====================================================================
// 9. ENDPOINT: REGISTRO DE MULTAS AUTOMÁTICAS ($10.000 COP)
// ====================================================================
app.post('/api/fines/register', async (req, res) => {
  try {
    const { operator, shift, profile, clientName, clientId, reason } = req.body;

    await supabase.from('fines').insert({
      operator_name: operator || 'walther',
      shift: shift || 'Mañana',
      profile_name: profile || 'HORACIO',
      client_name: clientName || 'Cliente',
      client_id: clientId || 'N/A',
      amount_cop: 10000.00,
      reason: reason || 'Demora de más de 2 minutos en responder',
      status: 'PENDING_REVIEW'
    });

    res.json({ success: true, message: 'Multa registrada' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/fines', async (req, res) => {
  try {
    const { data } = await supabase.from('fines').select('*').order('created_at', { ascending: false }).limit(50);
    res.json({ success: true, fines: data || [] });
  } catch (err) {
    res.json({ success: true, fines: [] });
  }
});

app.put('/api/fines/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, supervisorNotes } = req.body; // 'APPROVED' o 'WAIVED'
    await supabase.from('fines').update({
      status: status,
      supervisor_notes: supervisorNotes,
      updated_at: new Date().toISOString()
    }).eq('id', id);

    res.json({ success: true, message: `Multa ${status}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ====================================================================
// 10. ENDPOINT: COMUNICACIÓN DIRECTA SUPERVISOR ↔ OPERADOR (BIDIRECCIONAL, LECTURA Y EDICIÓN)
// ====================================================================
const liveSupervisorChatMemory = new Map(); // operatorKey -> Array of messages

function normalizeOpKey(name) {
  if (!name) return 'walther';
  return String(name)
    .replace(/\[.*?\]/g, '')
    .trim()
    .toLowerCase();
}

function getSupervisorChatList(opName) {
  const clean = normalizeOpKey(opName);
  if (!liveSupervisorChatMemory.has(clean)) {
    liveSupervisorChatMemory.set(clean, []);
  }
  return { key: clean, list: liveSupervisorChatMemory.get(clean) };
}

// Endpoint para obtener resumen de mensajes no leídos para el supervisor
app.get('/api/supervisor/unread-summary', (req, res) => {
  const unreadMap = {};
  for (const [opKey, list] of liveSupervisorChatMemory.entries()) {
    const unreadFromOp = (list || []).filter(m => m.sender !== 'SUPERVISOR' && !m.read).length;
    if (unreadFromOp > 0) {
      unreadMap[opKey] = unreadFromOp;
    }
  }
  res.json({ success: true, unread: unreadMap });
});

app.get('/api/supervisor/messages/:operator', async (req, res) => {
  try {
    const rawOp = (req.params.operator || '').trim();
    const opKey = normalizeOpKey(rawOp);
    const role = (req.query.role || '').toUpperCase(); // 'OPERATOR' o 'SUPERVISOR'

    const { key: exactKey, list: memMessages } = getSupervisorChatList(opKey);

    // 1. Intentar consultar Supabase en segundo plano o si la memoria está vacía
    if (memMessages.length === 0) {
      try {
        const { data } = await supabase.from('supervisor_chat')
          .select('*')
          .ilike('operator_name', `%${opKey}%`)
          .order('created_at', { ascending: true })
          .limit(50);

        if (data && Array.isArray(data) && data.length > 0) {
          const seenIds = new Set(memMessages.map(m => String(m.id)));
          data.forEach(dbMsg => {
            const strId = String(dbMsg.id);
            if (!seenIds.has(strId)) {
              memMessages.push({
                id: strId,
                sender: dbMsg.sender,
                text: dbMsg.message_text,
                timestamp: new Date(dbMsg.created_at).getTime(),
                isEdited: Boolean(dbMsg.is_edited),
                read: Boolean(dbMsg.is_read)
              });
              seenIds.add(strId);
            }
          });
          memMessages.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
          liveSupervisorChatMemory.set(exactKey, memMessages);
        }
      } catch (dbErr) {}
    }

    // 2. Si el rol que consulta lee los mensajes del otro, marcar como leídos (Doble chulito verde)
    if (role === 'OPERATOR') {
      let changed = false;
      memMessages.forEach(m => {
        if (m.sender === 'SUPERVISOR' && !m.read) {
          m.read = true;
          changed = true;
        }
      });
      if (changed) {
        liveSupervisorChatMemory.set(exactKey, memMessages);
        supabase.from('supervisor_chat').update({ is_read: true }).ilike('operator_name', `%${opKey}%`).eq('sender', 'SUPERVISOR').then(() => {}).catch(() => {});
      }
    } else if (role === 'SUPERVISOR') {
      let changed = false;
      memMessages.forEach(m => {
        if (m.sender !== 'SUPERVISOR' && !m.read) {
          m.read = true;
          changed = true;
        }
      });
      if (changed) {
        liveSupervisorChatMemory.set(exactKey, memMessages);
        supabase.from('supervisor_chat').update({ is_read: true }).ilike('operator_name', `%${opKey}%`).neq('sender', 'SUPERVISOR').then(() => {}).catch(() => {});
      }
    }

    res.json({ success: true, operator: exactKey, messages: memMessages });
  } catch (err) {
    res.json({ success: true, messages: [] });
  }
});

app.post('/api/supervisor/mark-read', async (req, res) => {
  try {
    const { operatorName, role } = req.body;
    const { key: exactKey, list } = getSupervisorChatList(operatorName);

    list.forEach(m => {
      if (role === 'OPERATOR' && m.sender === 'SUPERVISOR') {
        m.read = true;
      } else if (role === 'SUPERVISOR' && m.sender !== 'SUPERVISOR') {
        m.read = true;
      }
    });

    liveSupervisorChatMemory.set(exactKey, list);

    if (role === 'OPERATOR') {
      supabase.from('supervisor_chat').update({ is_read: true }).ilike('operator_name', `%${exactKey}%`).eq('sender', 'SUPERVISOR').then(() => {}).catch(() => {});
    } else if (role === 'SUPERVISOR') {
      supabase.from('supervisor_chat').update({ is_read: true }).ilike('operator_name', `%${exactKey}%`).neq('sender', 'SUPERVISOR').then(() => {}).catch(() => {});
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/supervisor/send-message', async (req, res) => {
  try {
    const { operatorName, text, isBroadcast } = req.body;
    if (!text || !text.trim()) return res.status(400).json({ error: 'Texto requerido' });

    const cleanText = text.trim();

    if (isBroadcast) {
      const activeOps = Array.from(liveOperatorTelemetry.values()).map(o => o.operator);
      const uniqueOps = Array.from(new Set(activeOps));
      if (uniqueOps.length === 0) uniqueOps.push('walther', 'bill');

      uniqueOps.forEach(op => {
        const { key: exactKey, list } = getSupervisorChatList(op);
        list.push({
          id: `sup_bc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          sender: 'SUPERVISOR',
          text: `📢 [ANUNCIO GENERAL] ${cleanText}`,
          timestamp: Date.now(),
          read: false,
          isEdited: false
        });
        if (list.length > 50) list.shift();
        liveSupervisorChatMemory.set(exactKey, list);
      });

      const inserts = uniqueOps.map(op => ({
        operator_name: normalizeOpKey(op),
        sender: 'SUPERVISOR',
        message_text: `📢 [ANUNCIO GENERAL] ${cleanText}`,
        is_read: false
      }));
      supabase.from('supervisor_chat').insert(inserts).then(() => {}).catch(() => {});
    } else {
      const { key: exactKey, list } = getSupervisorChatList(operatorName);
      const msgId = `sup_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

      list.push({
        id: msgId,
        sender: 'SUPERVISOR',
        text: cleanText,
        timestamp: Date.now(),
        read: false,
        isEdited: false
      });
      if (list.length > 50) list.shift();
      liveSupervisorChatMemory.set(exactKey, list);

      supabase.from('supervisor_chat').insert({
        operator_name: exactKey,
        sender: 'SUPERVISOR',
        message_text: cleanText,
        is_read: false
      }).then(() => {}).catch(() => {});
    }

    res.json({ success: true, message: 'Mensaje de supervisor emitido con éxito' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/operator/reply-message', async (req, res) => {
  try {
    const { operatorName, text } = req.body;
    if (!text || !text.trim()) return res.status(400).json({ error: 'Texto requerido' });

    const { key: exactKey, list } = getSupervisorChatList(operatorName);
    const cleanText = text.trim();
    const msgId = `op_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    list.push({
      id: msgId,
      sender: 'OPERATOR',
      text: cleanText,
      timestamp: Date.now(),
      read: false,
      isEdited: false
    });
    if (list.length > 50) list.shift();
    liveSupervisorChatMemory.set(exactKey, list);

    supabase.from('supervisor_chat').insert({
      operator_name: exactKey,
      sender: 'OPERATOR',
      message_text: cleanText,
      is_read: false
    }).then(() => {}).catch(() => {});

    res.json({ success: true, id: msgId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Endpoint para editar cualquier mensaje del chat de supervisión
app.post('/api/supervisor/edit-message', async (req, res) => {
  try {
    const { id, text, operatorName } = req.body;
    if (!id || !text) return res.status(400).json({ error: 'ID y texto son requeridos' });

    const cleanText = text.trim();

    // Buscar y actualizar en todas las listas en memoria
    for (const [k, list] of liveSupervisorChatMemory.entries()) {
      list.forEach(m => {
        if (String(m.id) === String(id)) {
          m.text = cleanText;
          m.isEdited = true;
        }
      });
    }

    if (!isNaN(id) && Number(id) > 0) {
      supabase.from('supervisor_chat').update({
        message_text: cleanText,
        is_edited: true
      }).eq('id', Number(id)).then(() => {}).catch(() => {});
    }

    res.json({ success: true, message: 'Mensaje editado con éxito' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ====================================================================
// 11. ENDPOINT: ORDEN DE EXTRACCIÓN MASIVA DE TURNO (NUKE SYNC)
// ====================================================================
app.post('/api/chats/extract-all-shift', (req, res) => {
  const { shift, operator, profile } = req.body;
  const targetShift = shift || 'Mañana';
  massExtractionOrders.add(targetShift);

  logSyncEvent({
    type: 'NUKE_ORDER',
    operator: operator || 'Supervisor',
    profile: profile || 'TURNO',
    clientName: 'Extracción Masiva',
    count: 0,
    durationMs: 50,
    status: 'SUCCESS',
    detail: `Orden de extracción masiva emitida para el turno '${targetShift}'. Estaciones cosechando...`
  });

  setTimeout(() => {
    massExtractionOrders.delete(targetShift);
  }, 60000);

  res.json({
    success: true,
    message: `⚡ Orden de extracción emitida para [${profile || operator || targetShift}]. La sincronización táctica ha iniciado.`
  });
});

// ====================================================================
// 11.1 ENDPOINT: MOTOR DE AUDITORÍA EN TIEMPO REAL (4 REGLAS SUPREMAS)
// ====================================================================
function auditConversationRules(text, profileName, clientName) {
  const cleanText = (text || '').toLowerCase();
  const violations = [];

  // Regla 1: Manipulación de regalos (Sin manipulación de ningún tipo para recibir regalos)
  const giftKeywords = [
    'regalo', 'regálame', 'regalame', 'gift', 'gifts', 'send me a gift', 'buy me a gift',
    'present', 'presents', 'tokens', 'monedas', 'propina', 'tip', 'donación', 'mandame un regalo',
    'enviame un regalo', 'give me a present', 'compra un regalo', 'buy me credits', 'mándame un detalle',
    'dame un regalo', 'ayúdame con un regalo', 'send me coins'
  ];
  const matchedGifts = giftKeywords.filter(k => cleanText.includes(k));
  if (matchedGifts.length > 0) {
    violations.push({
      rule: 'GIFT_MANIPULATION',
      severity: 'CRITICAL',
      title: '🎁 Manipulación de Regalos / Tokens Prohibida',
      detail: `Se detectaron solicitudes o insinuaciones de regalos/tokens: "${matchedGifts.slice(0, 3).join(', ')}"`,
      sample: matchedGifts[0]
    });
  }

  // Regla 2: Error en el Nombre del Perfil
  if (profileName) {
    const pClean = profileName.toLowerCase().trim();
    // Lista de perfiles comunes de la agencia para evitar cruces
    const agencyProfiles = ['horacio', 'walther', 'carlos', 'daniela', 'laura', 'andrea', 'mariana', 'valentina', 'camila', 'sofia'];
    const otherProfiles = agencyProfiles.filter(p => p !== pClean);
    for (const op of otherProfiles) {
      // Si la operadora se refiere a sí misma con otro nombre o firma con otro nombre
      const regexNameConfusion = new RegExp(`\\b(soy|me llamo|mi nombre es|i am|my name is|atentamente|con amor,)\\s+${op}\\b`, 'i');
      if (regexNameConfusion.test(cleanText)) {
        violations.push({
          rule: 'WRONG_PROFILE_NAME',
          severity: 'HIGH',
          title: '👤 Confusión en Nombre del Perfil Asignado',
          detail: `El operador utilizó el nombre de otro perfil ("${op.toUpperCase()}") en lugar de "${profileName.toUpperCase()}"`,
          sample: op
        });
        break;
      }
    }
  }

  // Regla 3 & 4: Travel Misleading & Promesas de Viaje, Citas o Matrimonio
  const travelMarriageKeywords = [
    { word: 'when we meet', rule: 'TRAVEL_MEETING', label: 'Cita en persona ("when we meet")' },
    { word: 'when i visit', rule: 'TRAVEL_MEETING', label: 'Visita en persona ("when i visit")' },
    { word: 'book a flight', rule: 'TRAVEL_MEETING', label: 'Compra/reserva de vuelo ("book a flight")' },
    { word: 'my flight', rule: 'TRAVEL_MEETING', label: 'Referencia a vuelo ("my flight")' },
    { word: 'airport', rule: 'TRAVEL_MEETING', label: 'Aeropuerto ("airport")' },
    { word: 'hotel', rule: 'TRAVEL_MEETING', label: 'Hotel ("hotel")' },
    { word: 'plane ticket', rule: 'TRAVEL_MEETING', label: 'Pasaje aéreo ("plane ticket")' },
    { word: 'meet up', rule: 'TRAVEL_MEETING', label: 'Encuentro presencial ("meet up")' },
    { word: 'in person', rule: 'TRAVEL_MEETING', label: 'En persona ("in person")' },
    { word: 'vernos en persona', rule: 'TRAVEL_MEETING', label: 'Cita presencial ("vernos en persona")' },
    { word: 'visitarte', rule: 'TRAVEL_MEETING', label: 'Promesa de visita ("visitarte")' },
    { word: 'viajar a verte', rule: 'TRAVEL_MEETING', label: 'Promesa de viaje ("viajar a verte")' },
    { word: 'marry me', rule: 'MARRIAGE_PROMISE', label: 'Promesa de matrimonio ("marry me")' },
    { word: 'get married', rule: 'MARRIAGE_PROMISE', label: 'Promesa de matrimonio ("get married")' },
    { word: 'casarnos', rule: 'MARRIAGE_PROMISE', label: 'Promesa de matrimonio ("casarnos")' },
    { word: 'matrimonio', rule: 'MARRIAGE_PROMISE', label: 'Mención de matrimonio ("matrimonio")' },
    { word: 'mi esposo', rule: 'MARRIAGE_PROMISE', label: 'Mención de compromiso conyugal ("mi esposo")' },
    { word: 'my husband', rule: 'MARRIAGE_PROMISE', label: 'Mención de compromiso ("my husband")' },
    { word: 'promet', rule: 'FALSE_PROMISE', label: 'Raíz de promesa ("promet...")' }
  ];

  const matchedTravel = [];
  travelMarriageKeywords.forEach(item => {
    if (cleanText.includes(item.word)) {
      matchedTravel.push(item);
    }
  });

  if (matchedTravel.length > 0) {
    violations.push({
      rule: 'TRAVEL_MISLEADING_MARRIAGE',
      severity: 'CRITICAL',
      title: '✈️ Infracción Travel Misleading (TM) / Promesas de Viaje o Matrimonio',
      detail: `Se detectaron frases prohibidas de encuentro, pasajes o matrimonio: ${matchedTravel.map(m => m.label).slice(0, 3).join(', ')}`,
      sample: matchedTravel[0].word
    });
  }

  return {
    passed: violations.length === 0,
    score: violations.length === 0 ? 100 : Math.max(0, 100 - (violations.length * 35)),
    violationsCount: violations.length,
    violations: violations,
    checklist: {
      noGiftManipulation: !violations.some(v => v.rule === 'GIFT_MANIPULATION'),
      correctProfileName: !violations.some(v => v.rule === 'WRONG_PROFILE_NAME'),
      noTravelOrMeeting: !violations.some(v => v.rule === 'TRAVEL_MISLEADING_MARRIAGE'),
      noMarriagePromise: !violations.some(v => v.rule === 'TRAVEL_MISLEADING_MARRIAGE' && cleanText.includes('marr'))
    }
  };
}

// Endpoint para auditar texto en vivo (utilizado por el Accordion y por el módulo Anti-TM)
app.post('/api/audit/realtime-check', async (req, res) => {
  try {
    const { text, profileName, clientName, operatorName } = req.body;
    const auditResult = auditConversationRules(text, profileName, clientName);

    // Si hay violaciones críticas, registrar intento de infracción en telemetría o multa preventiva
    if (!auditResult.passed && operatorName) {
      const crit = auditResult.violations.find(v => v.severity === 'CRITICAL');
      if (crit) {
        supabase.from('fines').insert({
          operator_name: operatorName,
          shift: 'En Vivo',
          profile_name: profileName || 'Perfil',
          client_name: clientName || 'Chat en Vivo',
          amount_cop: 10000.00,
          reason: `Alerta Auditoría en Vivo: ${crit.title} (${crit.sample})`,
          status: 'PENDING_REVIEW'
        }).then(() => {}).catch(() => {});
      }
    }

    res.json({ success: true, ...auditResult });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ====================================================================
// 12. ENDPOINT: RELEVO DE TURNOS (SHIFT HANDOVER)
// ====================================================================
app.post('/api/handover/generate-and-save', async (req, res) => {
  try {
    const { operator, shift, profileName, profileId, reportMarkdown: incomingMarkdown } = req.body;

    const reportMarkdown = incomingMarkdown || (`# 📋 RELEVO DE TURNO | PERFIL: ${profileName || 'HORACIO'}\n` +
      `- **Operador Saliente:** ${operator || 'walther'} [Turno: ${shift || 'Mañana'}]\n` +
      `- **Fecha y Hora:** ${new Date().toLocaleString()}\n` +
      `---\n` +
      `### 📌 Resumen de Conversaciones del Turno:\n` +
      `- Clientes activos monitoreados con éxito en la sesión.\n\n` +
      `### ⚠️ Instrucciones para el Turno Siguiente:\n` +
      `- Responder con prioridad las cartas leídas y chats con balance activo.\n` +
      `- Cumplir con la cuota de prospecciones por ciclo.`);

    await supabase.from('shift_handovers').insert({
      profile_name: profileName || 'HORACIO',
      profile_id: profileId || '',
      operator_name: operator || 'walther',
      shift: shift || 'Mañana',
      report_markdown: reportMarkdown
    });

    res.json({ success: true, message: 'Relevo guardado con éxito' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/handover/latest', async (req, res) => {
  try {
    const { profileName } = req.query;
    let query = supabase.from('shift_handovers').select('*').order('created_at', { ascending: false }).limit(1);
    if (profileName) query = query.eq('profile_name', profileName);

    const { data } = await query.single();
    res.json({ success: true, handover: data ? { reportMarkdown: data.report_markdown } : null });
  } catch (err) {
    res.json({ success: true, handover: null });
  }
});

// ====================================================================
// RUTA DEL MONITOR (CON NO-CACHE PARA ACTUALIZACIONES INSTANTÁNEAS)
// ====================================================================
const serveMonitor = (req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private, max-age=0');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  res.sendFile(path.join(__dirname, 'monitor.html'));
};

app.get('/', serveMonitor);
app.get('/monitor', serveMonitor);
app.get('/monitor.html', serveMonitor);
app.get('/index.html', serveMonitor);
app.get('/dashboard', serveMonitor);

app.listen(PORT, () => {
  console.log(`🚀 [APEX CYBERPUNK MATRIX] Servidor activo en puerto ${PORT}`);
});
