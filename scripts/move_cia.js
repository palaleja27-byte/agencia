const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '..', 'index.html');
let content = fs.readFileSync(file, 'utf8');

// Use regex to find the start of the CIA block
const ciaStartMatch = content.match(/<!-- ════════════════════════════════════════════════════════\s*CENTRAL DE INTELIGENCIA ROMERO — Analytics en Tiempo Real\s*════════════════════════════════════════════════════════ -->/);

if (!ciaStartMatch) { console.log('No CIA start'); process.exit(1); }
const startIndex = ciaStartMatch.index;

let scriptEnd = content.indexOf('</script>', startIndex);
while (scriptEnd !== -1) {
    const nextText = content.substring(scriptEnd, scriptEnd + 300);
    if (nextText.includes('<div style="background:var(--panel); border:1px solid rgba(99,102,241,0.2); border-radius:16px; overflow:hidden;">')) { break; }
    scriptEnd = content.indexOf('</script>', scriptEnd + 1);
}
if (scriptEnd === -1) { console.log('No CIA end'); process.exit(1); }

const endIndex = scriptEnd + '</script>'.length;
const ciaBlock = content.substring(startIndex, endIndex);

console.log('Extracted CIA block of length:', ciaBlock.length);

content = content.substring(0, startIndex) + content.substring(endIndex);

const tab5StartMatch = content.match(/<!-- TAB 5: TABLEAU ANALYTICS -->/);
if (!tab5StartMatch) { console.log('No TAB 5 start'); process.exit(1); }
const tab5Start = tab5StartMatch.index;

const tab5EndMatch = content.substring(tab5Start).match(/<!-- TAB 6: RANKING PSA -->/);
if (!tab5EndMatch) { console.log('No TAB 5 end'); process.exit(1); }
const tab5End = tab5Start + tab5EndMatch.index;

const newTab5 = `
  <!-- TAB 5: TABLEAU ANALYTICS (CENTRAL DE INTELIGENCIA) -->
  <div id="tab-tableau" class="tab-content" style="display:none; padding-bottom: 40px; max-width:1200px; margin:20px auto; padding-top:20px;">
    \n${ciaBlock.replace(/id="tableau-panel-wrap"[^>]*>/, 'id="tableau-panel-wrap" style="width:100%; margin:0 auto;">')}\n
  </div>\n
`;

content = content.substring(0, tab5Start) + newTab5 + content.substring(tab5End);
fs.writeFileSync(file, content, 'utf8');
console.log('Done moving CIA block');
