const fs = require('fs');
const content = fs.readFileSync('src/index.css', 'utf8');
const lines = content.split('\n');
lines.forEach((line, index) => {
  if (line.includes('profile-bg-blur')) {
    console.log(`Line ${index + 1}: ${line}`);
    // Print next 20 lines
    for (let i = 1; i <= 25; i++) {
      if (lines[index + i]) {
        console.log(`Line ${index + 1 + i}: ${lines[index + i]}`);
      }
    }
  }
});
