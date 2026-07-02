const fs = require('fs');
const content = fs.readFileSync('src/panels/FriendsPanel.tsx', 'utf8');
const lines = content.split('\n');
lines.forEach((line, index) => {
  if (line.includes('PanelHeader')) {
    console.log(`Line ${index + 1}: ${line}`);
  }
});
