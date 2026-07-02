const fs = require('fs');
const content = fs.readFileSync('src/panels/GroupsPanel.tsx', 'utf8');
const lines = content.split('\n');
lines.forEach((line, index) => {
  if (line.includes('has-profile-bg') || line.includes('--profile-cover-url')) {
    console.log(`Line ${index + 1}: ${line}`);
    // Print 5 lines before and 15 lines after
    for (let i = -5; i <= 15; i++) {
      if (lines[index + i]) {
        console.log(`Line ${index + 1 + i}: ${lines[index + i]}`);
      }
    }
  }
});
