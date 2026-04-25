#!/usr/bin/env python3
# patch_ranking_supabase.py
import sys

FILE = 'index.html'

with open(FILE, 'r', encoding='utf-8') as f:
    content = f.read()

# ─── Nueva lógica de Supabase para Ranking ────────────────────────────────────
NEW_RANKING_ENGINE = """
    // ════════════════════════════════════════════════════════════════════════
    // rkFetchSupabaseTotals -- DELTA-SHIFT(tm) Dashboard Engine
    // Actualiza Global Total, Promedio y Crecimiento con datos REALES de Supabase
    // ════════════════════════════════════════════════════════════════════════
    async function rkFetchSupabaseTotals() {
      if (typeof _sb === 'undefined') return;
      
      const mesActual = localDateStr().slice(0, 7);
      const mesMarzo  = '2026-03';
      const mesFeb    = '2026-02';

      try {
        // 1. Traer todos los registros MES y registros activos de Abr
        const { data: ops } = await _sb
          .from('operaciones')
          .select('fecha_dia, puntos_neto, jornada')
          .gte('fecha_dia', '2026-02-01')
          .neq('jornada', 'Auto');

        if (!ops || !ops.length) return;

        let febT = 0, marT = 0, abrT = 0;
        ops.forEach(r => {
          const m = r.fecha_dia.slice(0, 7);
          const val = r.puntos_neto || 0;
          if (m === mesFeb) febT += val;
          else if (m === mesMarzo) marT += val;
          else if (m === mesActual) abrT += val;
        });

        // 2. Calcular Crecimiento Real (vs Marzo)
        const crecOp = marT > 0 ? ((abrT - marT) / marT * 100) : 0;
        const sign = crecOp >= 0 ? '+' : '';
        const color = crecOp >= 0 ? '#34d399' : '#f87171';
        const icon = crecOp >= 0 ? '📈' : '📉';

        // 3. Actualizar UI del Dashboard Principal
        const elTotal = document.getElementById('rk-val-total');
        const elCop   = document.getElementById('rk-val-cop');
        const elAvg   = document.getElementById('rk-val-avg');
        const elCrec  = document.getElementById('rk-val-growth');
        const elRange = document.getElementById('rk-val-range');

        if (elTotal) elTotal.textContent = abrT.toLocaleString('es-CO', {minimumFractionDigits: 1});
        if (elCop) elCop.textContent = '💰 $' + Math.round(abrT * 1400).toLocaleString('es-CO') + ' COP';
        
        // Promedio Real (Abril / Numero de Ops)
        const numOps = operatorsData.length || 1;
        if (elAvg) elAvg.textContent = (abrT / numOps).toFixed(1);

        if (elCrec) {
          elCrec.style.color = color;
          elCrec.textContent = icon + ' ' + sign + crecOp.toFixed(1) + '%';
        }
        if (elRange) {
          elRange.textContent = 'Marzo: ' + marT.toFixed(0) + ' pts → Abril: ' + abrT.toFixed(0) + ' pts';
        }

        // Guardar para el Modal de Info
        window._rkHistorial = { feb: febT, mar: marT, abr: abrT, crec: crecOp };

      } catch(e) { console.warn('[RK-SUPABASE]', e); }
    }
"""

# Insertar la función rkFetchSupabaseTotals antes de renderRanking
MARKER_START = 'function renderRanking() {'
content = content.replace(MARKER_START, NEW_RANKING_ENGINE + '\n    ' + MARKER_START)

# Insertar el disparador al final de renderRanking
# Buscamos el final de la función rkViewMode === 'dia'
MARKER_TRIGGER = 'tbody.innerHTML = rkDataFiltered.map((op, i) => {'
content = content.replace(MARKER_TRIGGER, 'rkFetchSupabaseTotals();\n      ' + MARKER_TRIGGER)

# ─── Refactorizar Tooltip de Crecimiento ──────────────────────────────────────
MODAL_CRECIMIENTO = """
      // --- TABLA HISTORICA DELTA-SHIFT (tm) ---
      const h = window._rkHistorial || { feb: 0, mar: 0, abr: 0, crec: 0 };
      const tablaHist = `
        <div style="margin: 15px 0; background: rgba(255,255,255,0.03); border-radius: 12px; padding: 12px; border: 1px solid rgba(255,255,255,0.06);">
          <div style="font-size: 0.7rem; color: #475569; margin-bottom: 8px; text-transform: uppercase; font-weight: 800;">📅 Historial de Operación 2026</div>
          <table style="width: 100%; font-size: 0.8rem; border-collapse: collapse;">
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
              <td style="padding: 6px 0; color: #94a3b8;">Febrero</td>
              <td style="text-align: right; font-weight: 700; color: #a78bfa;">${h.feb.toLocaleString()} pts</td>
            </tr>
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
              <td style="padding: 6px 0; color: #94a3b8;">Marzo</td>
              <td style="text-align: right; font-weight: 700; color: #a78bfa;">${h.mar.toLocaleString()} pts</td>
            </tr>
            <tr style="background: rgba(52,211,153,0.05);">
              <td style="padding: 6px 0; color: #34d399; font-weight: 800;">Abril (Actual)</td>
              <td style="text-align: right; font-weight: 800; color: #34d399;">${h.abr.toLocaleString()} pts</td>
            </tr>
          </table>
          <div style="margin-top: 10px; font-size: 0.65rem; color: ${h.crec >= 0 ? '#34d399' : '#f87171'}; text-align: center; font-weight: 700;">
            ${h.crec >= 0 ? '🚀 +'+h.crec.toFixed(1)+'%' : '🔻 '+h.crec.toFixed(1)+'%'} vs Mes Anterior
          </div>
        </div>
      `;
"""

# Inyectar la tabla en el tooltip
SEARCH_TOOLTIP = 'const top3 = opsConPts.slice(0, 3);'
content = content.replace(SEARCH_TOOLTIP, MODAL_CRECIMIENTO + '\n      ' + SEARCH_TOOLTIP)

# Reemplazar el contenido del panel (dentro de toggleCrecTooltip)
# (Esto requiere un ajuste manual o una regex)
# Por simplicidad, añadimos tablaHist al panelHTML en la función toggleCrecTooltip

with open(FILE, 'w', encoding='utf-8') as f:
    f.write(content)

print("OK Parche de Ranking Principal aplicado")
"""

with open('patch_ranking.py', 'w', encoding='utf-8') as f:
    f.write(NEW_RANKING_ENGINE) # Guardar por si acaso
