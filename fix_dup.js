const fs = require('fs');
let content = fs.readFileSync('index.html', 'utf8');

const endTag = '</html>';
const firstIndex = content.indexOf(endTag);

if (firstIndex !== -1) {
  content = content.substring(0, firstIndex + endTag.length) + '\n';
  fs.writeFileSync('index.html', content, 'utf8');
  console.log('Successfully truncated the file after the FIRST </html>.');
} else {
  console.log('</html> not found!');
}
