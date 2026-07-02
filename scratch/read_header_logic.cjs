const fs = require('fs');
const content = fs.readFileSync('src/components/Header.tsx', 'utf8');
const lines = content.split('\n');
console.log('Total lines:', lines.length);
lines.forEach((line, index) => {
  if (line.includes('selectedGroupId') || line.includes('groups') || line.includes('activeStory === \'groups\'')) {
    console.log(`Line ${index + 1}: ${line}`);
    for (let i = -2; i <= 15; i++) {
      if (lines[index + i]) {
        console.log(`  Line ${index + 1 + i}: ${lines[index + i]}`);
      }
    }
  }
});
