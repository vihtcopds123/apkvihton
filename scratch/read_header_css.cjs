const fs = require('fs');
const content = fs.readFileSync('src/index.css', 'utf8');
const lines = content.split('\n');
lines.forEach((line, index) => {
  if (line.includes('transparent-header')) {
    console.log(`Line ${index + 1}: ${line}`);
    for (let i = 1; i <= 15; i++) {
      if (lines[index + i]) {
        console.log(`Line ${index + 1 + i}: ${lines[index + i]}`);
      }
    }
  }
});
const contentApp = fs.readFileSync('src/App.css', 'utf8');
const linesApp = contentApp.split('\n');
linesApp.forEach((line, index) => {
  if (line.includes('transparent-header')) {
    console.log(`App.css Line ${index + 1}: ${line}`);
    for (let i = 1; i <= 15; i++) {
      if (linesApp[index + i]) {
        console.log(`App.css Line ${index + 1 + i}: ${linesApp[index + i]}`);
      }
    }
  }
});
