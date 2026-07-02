const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    if (isDirectory) {
      walkDir(dirPath, callback);
    } else {
      callback(dirPath);
    }
  });
}

const term = 'Информация';
walkDir('src', (filepath) => {
  if (filepath.endsWith('.tsx') || filepath.endsWith('.ts') || filepath.endsWith('.css') || filepath.endsWith('.html')) {
    const content = fs.readFileSync(filepath, 'utf8');
    const lines = content.split('\n');
    lines.forEach((line, idx) => {
      if (line.toLowerCase().includes(term.toLowerCase())) {
        console.log(`${filepath}:${idx + 1}: ${line.trim()}`);
      }
    });
  }
});
