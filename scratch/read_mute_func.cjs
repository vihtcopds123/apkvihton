const fs = require('fs');
const content = fs.readFileSync('src/panels/CommunityDetailPanel.tsx', 'utf8');
const lines = content.split('\n');
lines.forEach((line, index) => {
  if (line.includes('handleToggleMuteChannel')) {
    console.log(`Found handleToggleMuteChannel declaration at line ${index + 1}:`);
    for (let i = -1; i <= 20; i++) {
      if (lines[index + i]) {
        console.log(`  Line ${index + 1 + i}: ${lines[index + i]}`);
      }
    }
  }
});
