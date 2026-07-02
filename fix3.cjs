const fs = require('fs');
let c = fs.readFileSync('src/panels/ChatPanel.tsx', 'utf8');
function fixStr(s) { try { const f = Buffer.from(s,'latin1').toString('utf8'); if (/[\u0400-\u04FF]/.test(f) && f.length < s.length*0.85) return f; } catch(e){} return s; }
c = c.replace(/'([^'`\n]{1,300})'/g, function(m,i){ const f=fixStr(i); return f!==i ? '''+f+''' : m; });
c = c.replace(/"([^"`\n]{1,300})"/g, function(m,i){ const f=fixStr(i); return f!==i ? '"'+f+'"' : m; });
fs.writeFileSync('src/panels/ChatPanel.tsx', c, 'utf8');
const ph=c.match(/placeholder=\{[^}]{0,100}/); console.log('PH:', ph&&ph[0]);
const rem=c.match(/[\xC0-\xFF][\x80-\xBF]/g); console.log('Broken left:', rem?rem.length:0);