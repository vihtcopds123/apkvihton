const fs = require('fs');
const content = fs.readFileSync('src/panels/CommunityDetailPanel.tsx', 'utf8');
const lines = content.split('\n');
lines.forEach((line, index) => {
  if (line.includes('handleJoinLeave')) {
    console.log(`Line ${index + 1}: ${line}`);
    for (let i = -1; i <= 35; i++) {
      if (lines[index + i]) {
        console.log(`  Line ${index + 1 + i}: ${lines[index + i]}`);
      }
    }
  }
});
