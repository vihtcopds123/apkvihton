const fs = require('fs');

const content = fs.readFileSync('c:\\Users\\andnv\\Desktop\\ID VH\\src\\App.css', 'utf8');
const lines = content.split('\n');
lines.forEach((line, idx) => {
  if (line.includes('mpb-')) {
    console.log(`${idx + 1}: ${line.trim()}`);
  }
});
