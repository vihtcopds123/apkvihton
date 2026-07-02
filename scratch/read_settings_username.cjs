const fs = require('fs');
const content = fs.readFileSync('src/panels/SettingsPanel.tsx', 'utf8');
const lines = content.split('\n');
lines.forEach((line, index) => {
  if (line.includes('username') && (line.includes('check') || line.includes('error') || line.includes('занят') || line.includes('свободен') || line.includes('loading') || line.includes('supabase'))) {
    console.log(`Line ${index + 1}: ${line}`);
    for (let i = -3; i <= 15; i++) {
      if (lines[index + i]) {
        console.log(`  Line ${index + 1 + i}: ${lines[index + i]}`);
      }
    }
  }
});
