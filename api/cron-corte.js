import { createClient } from '@supabase/supabase-js';

// Helper de zona horaria de Colombia
function getColombiaTime() {
  const d = new Date();
  const bogotaTimeStr = d.toLocaleString('en-US', { timeZone: 'America/Bogota' });
  return new Date(bogotaTimeStr);
}

// Día lógico (corte a las 6:00 AM)
function getLogicalDate(colombiaDate) {
  const logical = new Date(colombiaDate.getTime() - (6 * 3600000)); // Restar 6 horas
  const yyyy = logical.getFullYear();
  const mm = String(logical.getMonth() + 1).padStart(2, '0');
  const dd = String(logical.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export default async function handler(req, res) {
  // Configuración de CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Token simple de seguridad para evitar invocaciones no deseadas (opcional)
  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  const supabaseUrl = process.env.SUPABASE_URL || 'https://bhewmidnkldjpdnvassj.supabase.co';
  // Usamos la KEY Service Role si está disponible, sino Anon
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJoZXdtaWRua2xkanBkbnZhc3NqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU0NjMyNzAsImV4cCI6MjEwMTAzOTI3MH0.4DXjV8jH9Yj0jwNPg2DvRCqTgObiKULGCxFRf0lwIpI';
  
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const colDate = getColombiaTime();
    const hCol = colDate.getHours();

    // Determinar la jornada activa según la hora de Colombia
    const tAct = hCol >= 6 && hCol < 14 ? 'Mañana' : hCol >= 14 && hCol < 22 ? 'Tarde' : 'Noche';
    const logicalDate = getLogicalDate(colDate);

    // Calcular el slot más cercano de corte automático
    let roundedHour = Math.round(hCol / 2) * 2;
    if (roundedHour === 24) roundedHour = 0;
    const targetSlot = String(roundedHour).padStart(2, '0') + ':00';

    console.log(`[Cron Corte] Iniciando para slot ${targetSlot} | Jornada: ${tAct} | Día Lógico: ${logicalDate}`);

    // 1. Obtener la lista de operadores y perfiles (primeOperatorsData2026)
    const { data: opsRow, error: opsError } = await supabase
      .from('kv_store')
      .select('value')
      .eq('key', 'primeOperatorsData2026')
      .maybeSingle();

    if (opsError || !opsRow || !opsRow.value) {
      throw new Error('No se pudo leer la definición de operadores en primeOperatorsData2026');
    }

    const operatorsData = typeof opsRow.value === 'string' ? JSON.parse(opsRow.value) : opsRow.value;

    // 2. Obtener todas las operaciones registradas para el día lógico actual
    const { data: operaciones, error: opError } = await supabase
      .from('operaciones')
      .select('id_perfil, puntos_neto, jornada, agencia, puntos, puntos_baseline, puntos_total, fecha_dia')
      .eq('fecha_dia', logicalDate)
      .eq('jornada', tAct);

    if (opError) {
      throw new Error('Error al leer operaciones desde la base de datos: ' + opError.message);
    }

    if (!operaciones || operaciones.length === 0) {
      return res.status(200).json({ 
        message: 'No hay datos de operaciones hoy para procesar.',
        details: { logicalDate, tAct, targetSlot }
      });
    }

    // 3. Mapear perfiles a operadores
    const perfilToOp = {};
    operatorsData.forEach(op => {
      (op.profiles || []).forEach(p => {
        perfilToOp[String(p.id).trim()] = { operador: op.name, modelo: p.model || p.modelo || ('ID ' + p.id) };
      });
    });

    // 4. Calcular los puntos netos por operador
    const opMap = {};
    let totalPts = 0;

    operaciones.forEach(r => {
      const pts = r.puntos_neto || 0;
      if (pts <= 0 || pts > 800) return; // Evitar basura o picos anormales
      totalPts += pts;
      const info = perfilToOp[String(r.id_perfil).trim()] || { operador: 'ID: ' + r.id_perfil, modelo: 'Perfil ' + r.id_perfil };
      if (!opMap[info.operador]) opMap[info.operador] = { pts: 0, perfiles: [] };
      opMap[info.operador].pts += pts;
      opMap[info.operador].perfiles.push({ id: r.id_perfil, modelo: info.modelo, pts });
    });

    if (totalPts === 0) {
      return res.status(200).json({
        message: 'El total de puntos netos en este corte es 0. No se guarda corte vacío.',
        details: { logicalDate, tAct, targetSlot }
      });
    }

    // 5. Leer historial actual de la bitácora
    const { data: bitacoraRow, error: bitError } = await supabase
      .from('kv_store')
      .select('value')
      .eq('key', 'rr_corte_bitacora_history')
      .maybeSingle();

    let history = [];
    if (!bitError && bitacoraRow && bitacoraRow.value) {
      history = typeof bitacoraRow.value === 'string' ? JSON.parse(bitacoraRow.value) : bitacoraRow.value;
    }

    // Verificar si ya existe este corte para evitar duplicados exactos
    const exists = history.some(b => b.fecha === logicalDate && b.jornada === tAct && b.hora === targetSlot);
    if (exists) {
      return res.status(200).json({ 
        message: 'El corte para este slot ya había sido registrado anteriormente.',
        details: { logicalDate, tAct, targetSlot }
      });
    }

    // 6. Crear el snapshot del corte
    const snapshot = {
      id: 'corte_' + Date.now(),
      fecha: logicalDate,
      hora: targetSlot,
      label: `Server Auto ${targetSlot}`,
      jornada: tAct,
      tipo: 'auto',
      totalPts: Number(totalPts.toFixed(1)),
      timestamp: Date.now(),
      operadores: []
    };

    Object.entries(opMap).forEach(([opName, data]) => {
      snapshot.operadores.push({
        name: opName,
        pts: Number(data.pts.toFixed(1)),
        perfiles: data.perfiles.map(p => ({ id: p.id, modelo: p.modelo, pts: Number(p.pts.toFixed(1)) }))
      });
    });

    // Guardar en el historial
    history.unshift(snapshot);
    if (history.length > 300) history.splice(300); // Límite de tamaño

    const { error: saveHistErr } = await supabase
      .from('kv_store')
      .upsert({ key: 'rr_corte_bitacora_history', value: JSON.stringify(history) }, { onConflict: 'key' });

    if (saveHistErr) throw new Error('Error al guardar historial de bitácora: ' + saveHistErr.message);

    // 7. Actualizar el registro individual de cortes por operador en rr_prime_cortes
    const { data: cortesRow, error: cortesGetErr } = await supabase
      .from('kv_store')
      .select('value')
      .eq('key', 'rr_prime_cortes')
      .maybeSingle();

    let remoteAllCortes = {};
    if (!cortesGetErr && cortesRow && cortesRow.value) {
      remoteAllCortes = typeof cortesRow.value === 'string' ? JSON.parse(cortesRow.value) : cortesRow.value;
    }

    const horaLocalStr = colDate.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false });
    
    for (const [opName, data] of Object.entries(opMap)) {
      const existKey = Object.keys(remoteAllCortes).find(k => k.toUpperCase().trim() === opName.toUpperCase().trim()) || opName;
      if (!remoteAllCortes[existKey]) remoteAllCortes[existKey] = [];
      
      const arr = remoteAllCortes[existKey];
      const existIdx = arr.findIndex(c => c.fecha === logicalDate && c.jornada === tAct);
      
      const nuevoPts = parseFloat(data.pts) || 0;
      
      if (existIdx >= 0) {
        if (nuevoPts >= arr[existIdx].puntos) {
          arr[existIdx].puntos = nuevoPts;
        }
        arr[existIdx].hora = horaLocalStr;
        arr[existIdx].ts = Date.now();
      } else {
        arr.push({ 
          fecha: logicalDate, 
          jornada: tAct, 
          hora: horaLocalStr, 
          puntos: nuevoPts, 
          ts: Date.now(), 
          horas: 8 
        });
        if (arr.length > 270) {
          arr.sort((a, b) => b.ts - a.ts).splice(270);
        }
      }
      remoteAllCortes[existKey] = arr;
    }

    const { error: saveCortesErr } = await supabase
      .from('kv_store')
      .upsert({ key: 'rr_prime_cortes', value: JSON.stringify(remoteAllCortes) }, { onConflict: 'key' });

    if (saveCortesErr) throw new Error('Error al guardar cortes en rr_prime_cortes: ' + saveCortesErr.message);

    return res.status(200).json({ 
      success: true, 
      message: `Corte automático para ${targetSlot} guardado con éxito.`,
      summary: { totalPts, logicalDate, jornada: tAct } 
    });

  } catch (err) {
    console.error('[Cron Corte Error]', err);
    return res.status(500).json({ error: err.message });
  }
}
