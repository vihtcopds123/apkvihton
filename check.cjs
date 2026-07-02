const fs = require('fs');
const c = fs.readFileSync('src/panels/ChatPanel.tsx', 'utf8');
// Check all remaining mojibake patterns
const broken = c.match(/[\xC0-\xFF][\x80-\xBF]/g);
console.log('Remaining broken sequences:', broken ? broken.length : 0);
// Check options menu
const optm = c.match(/mutedUserIds[\s\S]{0,300}/);
console.log('Options menu sample:', optm && optm[0].slice(0,150));
// Check placeholder
const ph = c.match(/placeholder=\{[^}]{0,100}/);
console.log('Placeholder:', ph && ph[0]);