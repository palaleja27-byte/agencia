const fs = require('fs');
const path = require('path');

const filePath = 'c:/Users/ADMIN/Documents/AgenciaRR/AgenciaRROriginal/agencia/index.html';
let content = fs.readFileSync(filePath, 'utf8');

console.log("Starting surgical modifications to index.html...");

// ── 1. Wrapping Tableau Global and removing premature closing div ──
const tableauTarget = `      <div style="background:var(--panel); border:1px solid rgba(99,102,241,0.2); border-radius:16px; overflow:hidden;">`;
const tableauReplacement = `    <div id="tableau-panel-wrap" style="max-width:1200px; margin: 15px auto 20px; padding: 0 16px; box-sizing: border-box;">
      <div style="background:var(--panel); border:1px solid rgba(99,102,241,0.2); border-radius:16px; overflow:hidden;">`;

if (content.includes(tableauTarget)) {
  content = content.replace(tableauTarget, tableauReplacement);
  console.log("✅ 1. Tableau Global panel wrapped successfully.");
} else {
  console.error("❌ 1. Could not find Tableau Global target!");
  process.exit(1);
}

// ── 2. Add scroll & sticky header to summary Action Map ──
const summaryTarget = `        content = \`<div style="overflow-x:auto;background:rgba(0,0,0,0.5);border-radius:10px;" class="custom-scrollbar"><table style="width:100%;border-collapse:collapse;min-width:700px;"><thead><tr><th style="padding:10px;text-align:left;font-size:0.55rem;color:#94a3b8;position:sticky;left:0;background:#1e293b;z-index:10;border-bottom:1px solid rgba(255,255,255,0.05);">OPERADOR</th><th style="padding:10px;text-align:left;font-size:0.55rem;color:#94a3b8;background:#1e293b;border-bottom:1px solid rgba(255,255,255,0.05);">PERFIL</th><th style="padding:10px;background:#1e293b;color:#f1f5f9;font-size:0.55rem;border-bottom:1px solid rgba(255,255,255,0.05);">5m<br><small>LIVE</small></th><th style="padding:10px;background:#1e293b;color:#f1f5f9;font-size:0.55rem;border-bottom:1px solid rgba(255,255,255,0.05);">10m<br><small>PULSO</small></th><th style="padding:10px;background:#1e293b;color:#f1f5f9;font-size:0.55rem;border-bottom:1px solid rgba(255,255,255,0.05);">DÍA<br><small>PROM</small></th><th style="padding:10px;background:#1e293b;color:#f1f5f9;font-size:0.55rem;border-bottom:1px solid rgba(255,255,255,0.05);">SEM<br><small>ACUM</small></th><th style="padding:10px;background:#1e293b;color:#f1f5f9;font-size:0.55rem;border-bottom:1px solid rgba(255,255,255,0.05);">MES<br><small>TOTAL</small></th></tr></thead><tbody>\${trs}</tbody></table></div>\`;`;

const summaryReplacement = `        content = \`<div style="max-height:400px;overflow-y:auto;overflow-x:auto;background:rgba(0,0,0,0.5);border-radius:10px;" class="custom-scrollbar"><table style="width:100%;border-collapse:collapse;min-width:700px;"><thead style="position:sticky;top:0;z-index:15;background:#1e293b;"><tr><th style="padding:10px;text-align:left;font-size:0.55rem;color:#94a3b8;position:sticky;left:0;top:0;background:#1e293b;z-index:20;border-bottom:1px solid rgba(255,255,255,0.05);">OPERADOR</th><th style="padding:10px;text-align:left;font-size:0.55rem;color:#94a3b8;position:sticky;top:0;background:#1e293b;z-index:15;border-bottom:1px solid rgba(255,255,255,0.05);">PERFIL</th><th style="padding:10px;position:sticky;top:0;background:#1e293b;color:#f1f5f9;font-size:0.55rem;z-index:15;border-bottom:1px solid rgba(255,255,255,0.05);">5m<br><small>LIVE</small></th><th style="padding:10px;position:sticky;top:0;background:#1e293b;color:#f1f5f9;font-size:0.55rem;z-index:15;border-bottom:1px solid rgba(255,255,255,0.05);">10m<br><small>PULSO</small></th><th style="padding:10px;position:sticky;top:0;background:#1e293b;color:#f1f5f9;font-size:0.55rem;z-index:15;border-bottom:1px solid rgba(255,255,255,0.05);">DÍA<br><small>PROM</small></th><th style="padding:10px;position:sticky;top:0;background:#1e293b;color:#f1f5f9;font-size:0.55rem;z-index:15;border-bottom:1px solid rgba(255,255,255,0.05);">SEM<br><small>ACUM</small></th><th style="padding:10px;position:sticky;top:0;background:#1e293b;color:#f1f5f9;font-size:0.55rem;z-index:15;border-bottom:1px solid rgba(255,255,255,0.05);">MES<br><small>TOTAL</small></th></tr></thead><tbody>\${trs}</tbody></table></div>\`;`;

if (content.includes(summaryTarget)) {
  content = content.replace(summaryTarget, summaryReplacement);
  console.log("✅ 2. Summary Action Map scroll and sticky headers added successfully.");
} else {
  console.error("❌ 2. Could not find summary Action Map target!");
  process.exit(1);
}

// ── 3. Add scroll & sticky header to other temporalities Action Map ──
const tempTarget = `        content = descHeatmap + unitSelHtml + \`<div style="overflow-x:auto;background:rgba(0,0,0,0.6);border-radius:10px;" class="custom-scrollbar"><table style="width:100%;border-collapse:collapse;table-layout:fixed;min-width:1200px;"><thead><tr><th style="padding:10px;position:sticky;left:0;background:#1e293b;z-index:10;font-size:0.55rem;color:#94a3b8;width:110px;">OPERADOR</th><th style="padding:10px;background:#1e293b;font-size:0.55rem;color:#94a3b8;width:110px;">PERFIL</th>\${hCols}</tr></thead><tbody>\${trs}</tbody></table></div>\`;`;

const tempReplacement = `        content = descHeatmap + unitSelHtml + \`<div style="max-height:400px;overflow-y:auto;overflow-x:auto;background:rgba(0,0,0,0.6);border-radius:10px;" class="custom-scrollbar"><table style="width:100%;border-collapse:collapse;table-layout:fixed;min-width:1200px;"><thead style="position:sticky;top:0;z-index:15;background:#1e293b;"><tr><th style="padding:10px;position:sticky;left:0;top:0;background:#1e293b;z-index:20;font-size:0.55rem;color:#94a3b8;width:110px;">OPERADOR</th><th style="padding:10px;position:sticky;top:0;background:#1e293b;z-index:15;font-size:0.55rem;color:#94a3b8;width:110px;">PERFIL</th>\${hCols}</tr></thead><tbody>\${trs}</tbody></table></div>\`;`;

if (content.includes(tempTarget)) {
  content = content.replace(tempTarget, tempReplacement);
  console.log("✅ 3. Temporalities Action Map scroll and sticky headers added successfully.");
} else {
  console.error("❌ 3. Could not find temporalities Action Map target!");
  process.exit(1);
}

// ── 4. Baseline sanity check threshold adjustment ──
const baselineTarget = `          if (v.baseline <= 0 || neto > v.total * 0.60) {`;
const baselineReplacement = `          if ((v.baseline <= 0 && v.total > 100) || (v.total > 100 && neto > v.total * 0.60)) {`;

if (content.includes(baselineTarget)) {
  content = content.replace(baselineTarget, baselineReplacement);
  console.log("✅ 4. Baseline sanity check threshold adjusted successfully.");
} else {
  console.error("❌ 4. Could not find baseline sanity check target!");
  process.exit(1);
}

// Write the modified content back to index.html
fs.writeFileSync(filePath, content, 'utf8');
console.log("🎉 Surgical modifications written to index.html successfully!");
