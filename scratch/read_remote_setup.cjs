const fs = require('fs');

const content = fs.readFileSync('supabase/remote_setup.sql', 'utf8');
const lines = content.split('\n');

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('rls_auto_enable')) {
    console.log(`Line ${i}:`);
    console.log(lines.slice(i, i + 25).join('\n'));
    console.log('------------------');
  }
}
