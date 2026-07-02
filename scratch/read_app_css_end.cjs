const fs = require('fs');
const content = fs.readFileSync('src/App.css', 'utf8');
const lines = content.split('\n');
console.log('Total lines in App.css:', lines.length);
for (let i = lines.length - 20; i < lines.length; i++) {
  if (lines[i]) {
    console.log(`${i + 1}: ${lines[i]}`);
  }
}
