const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '..', 'index.html');
const lines = fs.readFileSync(file, 'utf8').split('\n');

let ciaStartLine = -1;
let ciaEndLine = -1;

for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('CENTRAL DE INTELIGENCIA ROMERO — Analytics en Tiempo Real')) {
        ciaStartLine = i - 1; 
    }
    if (ciaStartLine !== -1 && i > ciaStartLine + 100 && lines[i].includes('</script>')) {
        let nextLinesStr = lines.slice(i+1, i+10).join('\n');
        if (nextLinesStr.includes('<div style="background:var(--panel); border:1px solid rgba(99,102,241,0.2); border-radius:16px; overflow:hidden;">')) {
            ciaEndLine = i;
            break;
        }
    }
}

if (ciaStartLine === -1 || ciaEndLine === -1) {
    console.log('Could not find bounds: start', ciaStartLine, 'end', ciaEndLine);
    process.exit(1);
}

const ciaLines = lines.slice(ciaStartLine, ciaEndLine + 1);
let ciaBlockStr = ciaLines.join('\n');

ciaBlockStr = ciaBlockStr.replace('id="tableau-panel-wrap" style="max-width:1200px; margin:0 auto 20px; padding:0 16px;"', 'id="tableau-panel-wrap" style="width:100%; margin:0 auto;"');

lines.splice(ciaStartLine, ciaEndLine - ciaStartLine + 1);

let tab5StartLine = lines.findIndex(l => l.includes('TAB 5: TABLEAU ANALYTICS'));
let tab5EndLine = -1;
let divCount = 0;
for(let i = tab5StartLine; i < lines.length; i++) {
    if (lines[i].includes('<div')) divCount += (lines[i].match(/<div/g) || []).length;
    if (lines[i].includes('</div')) divCount -= (lines[i].match(/<\/div/g) || []).length;
    if (divCount === 0 && i > tab5StartLine) {
        tab5EndLine = i;
        break;
    }
}

if (tab5StartLine === -1 || tab5EndLine === -1) {
    console.log('Could not find Tab 5 bounds: start', tab5StartLine, 'end', tab5EndLine);
    process.exit(1);
}

const newTab5Lines = [
    '  <!-- TAB 5: TABLEAU ANALYTICS (CENTRAL DE INTELIGENCIA) -->',
    '  <div id="tab-tableau" class="tab-content" style="display:none; padding-bottom: 40px; max-width:1200px; margin:20px auto; padding-top:20px;">',
    ciaBlockStr,
    '  </div>'
];

lines.splice(tab5StartLine, tab5EndLine - tab5StartLine + 1, ...newTab5Lines);

fs.writeFileSync(file, lines.join('\n'), 'utf8');
console.log('Surgery complete. CIA relocated.');
