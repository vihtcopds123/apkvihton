const fs = require('fs');
const content = fs.readFileSync('src/panels/CommunityDetailPanel.tsx', 'utf8');
const lines = content.split('\n');
for (let i = 0; i < 40; i++) {
  if (lines[i] && lines[i].includes('icons')) {
    console.log(`Line ${i + 1}: ${lines[i]}`);
    for (let j = 1; j <= 15; j++) {
      console.log(`  Line ${i + 1 + j}: ${lines[i + j]}`);
    }
  }
}
