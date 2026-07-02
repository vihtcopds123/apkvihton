const fs = require('fs');

const content = fs.readFileSync('c:\\Users\\andnv\\Desktop\\ID VH\\src\\App.css', 'utf8');
const lines = content.split('\n');
lines.forEach((line, idx) => {
  if (line.includes('mpb-close')) {
    console.log(`Match at line ${idx + 1}:`);
    for (let i = Math.max(0, idx - 5); i < Math.min(lines.length, idx + 10); i++) {
      console.log(`${i + 1}: ${lines[i]}`);
    }
    console.log('---');
  }
});
