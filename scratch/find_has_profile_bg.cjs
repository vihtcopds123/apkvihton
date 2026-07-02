const fs = require('fs');
const path = require('path');

function search(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const full = path.join(dir, file);
    if (fs.statSync(full).isDirectory()) {
      if (file !== 'node_modules' && file !== '.git' && file !== 'dist') {
        search(full);
      }
    } else {
      if (file.endsWith('.tsx') || file.endsWith('.ts')) {
        const content = fs.readFileSync(full, 'utf8');
        if (content.includes('has-profile-bg')) {
          console.log(`Found "has-profile-bg" in: ${full}`);
        }
      }
    }
  }
}

search('.');
