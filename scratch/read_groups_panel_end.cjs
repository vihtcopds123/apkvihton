const fs = require('fs');
const content = fs.readFileSync('src/panels/GroupsPanel.tsx', 'utf8');
const lines = content.split('\n');
console.log('Total lines:', lines.length);
// Print lines from 230 to end
for (let i = 230; i < lines.length; i++) {
  console.log(`${i + 1}: ${lines[i]}`);
}
