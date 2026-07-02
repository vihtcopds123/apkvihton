const fs = require('fs');
const content = fs.readFileSync('src/panels/FriendsPanel.tsx', 'utf8');
const lines = content.split('\n');
for (let i = 379; i <= 410; i++) {
  if (lines[i]) {
    console.log(`${i + 1}: ${lines[i]}`);
  }
}
