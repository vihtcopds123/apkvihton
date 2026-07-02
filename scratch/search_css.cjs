const fs = require('fs');

function searchInFile(filepath, term) {
  if (!fs.existsSync(filepath)) return;
  const content = fs.readFileSync(filepath, 'utf8');
  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    if (line.toLowerCase().includes(term.toLowerCase())) {
      console.log(`${filepath}:${idx + 1}: ${line.trim()}`);
    }
  });
}

const term = process.argv[2] || 'glass-island';
searchInFile('src/App.css', term);
searchInFile('src/index.css', term);
