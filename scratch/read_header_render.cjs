const fs = require('fs');
const content = fs.readFileSync('src/components/Header.tsx', 'utf8');
const lines = content.split('\n');
for (let i = 580; i < 680; i++) {
  if (lines[i]) {
    console.log(`${i + 1}: ${lines[i]}`);
  }
}
