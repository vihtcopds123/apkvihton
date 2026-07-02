const fs = require('fs');
const content = fs.readFileSync('src/panels/CommunityDetailPanel.tsx', 'utf8');
const lines = content.split('\n');
console.log('Total lines:', lines.length);
lines.forEach((line, index) => {
  if (line.includes('username') || line.includes('avatar') || line.includes('name') || line.includes('info')) {
    if (index > 50 && index < 250) {
      console.log(`Line ${index + 1}: ${line}`);
    }
  }
});
