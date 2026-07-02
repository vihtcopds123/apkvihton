const fs = require('fs');
const content = fs.readFileSync('supabase/remote_setup.sql', 'utf8');
const lines = content.split('\n');
lines.forEach((line, index) => {
  if (line.includes('CREATE TABLE') && line.includes('groups')) {
    console.log(`Line ${index + 1}: ${line}`);
    for (let i = 1; i <= 25; i++) {
      if (lines[index + i]) {
        console.log(`Line ${index + 1 + i}: ${lines[index + i]}`);
      }
    }
  }
});
