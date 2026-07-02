const fs = require('fs');
const content = fs.readFileSync('src/panels/CommunityDetailPanel.tsx', 'utf8');
const lines = content.split('\n');
lines.forEach((line, index) => {
  if (line.includes('showInfoOverlay') || line.includes('info-overlay') || line.includes('InfoOverlay')) {
    console.log(`Line ${index + 1}: ${line}`);
    // Print 15 lines before and after
    for (let i = -10; i <= 35; i++) {
      if (lines[index + i]) {
        console.log(`  Line ${index + 1 + i}: ${lines[index + i]}`);
      }
    }
  }
});
