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
      if (file.endsWith('.css')) {
        const content = fs.readFileSync(full, 'utf8');
        if (content.includes('header-mobile-settings')) {
          console.log(`Found "header-mobile-settings" in: ${full}`);
          const lines = content.split('\n');
          lines.forEach((line, index) => {
            if (line.includes('header-mobile-settings')) {
              console.log(`Line ${index + 1}: ${line}`);
              for (let i = 1; i <= 15; i++) {
                if (lines[index + i]) {
                  console.log(`  Line ${index + 1 + i}: ${lines[index + i]}`);
                }
              }
            }
          });
        }
      }
    }
  }
}

search('.');
