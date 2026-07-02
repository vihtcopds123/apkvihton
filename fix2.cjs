const fs = require('fs');
let c = fs.readFileSync('src/panels/ChatPanel.tsx', 'utf8');

// These strings have mojibake but DON'T match the byte pattern because they use different encoding
// Let's find all single-quoted string contents with mojibake chars (Р,С,Ё,р,с etc)
// and convert them

// Map of known broken -> correct strings (using unicode escapes)
const fixes = [
  [/'\u0420\u0420\xb7\u0420\u00bc\u0420\u00b5\u0420\u00bd\u0420\u00b8\u0421\u201a\u0421\u2018 \u0421\u0081\u0420\u00be\u0420\u00be\u0420\u00b1\u0421\u0137\u0420\u00b5\u0420\u00bd\u0420\u00b8\u0420\u00b5\.\.\.'/g, "'\u0418\u0437\u043c\u0435\u043d\u0438\u0442\u044c \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435...'"],
  [/'\u0420\u040d\u0420\u00b0\u0420\u00bf\u0420\u00b8\u0421\u0081\u0420\u00b0\u0421\u201a\u0421\u2018 \u0420\u00be\u0421\u201a\u0420\u00b2\u0420\u00b5\u0421\u201a\.\.\.'/g, "'\u041d\u0430\u043f\u0438\u0441\u0430\u0442\u044c \u043e\u0442\u0432\u0435\u0442...'"],
  [/'\u0420\u040d\u0420\u00b0\u0420\u00bf\u0420\u00b8\u0421\u0081\u0420\u00b0\u0421\u201a\u0421\u2018 \u0421\u0081\u0420\u00be\u0420\u00be\u0420\u00b1\u0421\u0137\u0420\u00b5\u0420\u00bd\u0420\u00b8\u0420\u00b5\.\.\.'/g, "'\u041d\u0430\u043f\u0438\u0441\u0430\u0442\u044c \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435...'"],
];

// Better approach: find strings that look like Р... mojibake and re-encode them
// The pattern is: double-byte sequences stored as code points >127
c = c.replace(/'([^'\n]{1,200})'/g, function(full, inner) {
  // Check if inner has mojibake-style chars (high latin chars mixed)
  if (!/[\u00C0-\u00FF]/.test(inner)) return full;
  // Try to re-encode as latin1->utf8
  try {
    const fixed = Buffer.from(inner, 'latin1').toString('utf8');
    if (/[\u0400-\u04FF]/.test(fixed) && fixed.length < inner.length * 0.8) {
      return "'" + fixed + "'";
    }
  } catch(e) {}
  return full;
});

// Same for double-quoted strings
c = c.replace(/"([^"\n]{1,200})"/g, function(full, inner) {
  if (!/[\u00C0-\u00FF]/.test(inner)) return full;
  try {
    const fixed = Buffer.from(inner, 'latin1').toString('utf8');
    if (/[\u0400-\u04FF]/.test(fixed) && fixed.length < inner.length * 0.8) {
      return '"' + fixed + '"';
    }
  } catch(e) {}
  return full;
});

// Same for template literals parts
c = c.replace(/\([^\\n]{1,200})\/g, function(full, inner) {
  if (!/[\u00C0-\u00FF]/.test(inner)) return full;
  try {
    const fixed = Buffer.from(inner, 'latin1').toString('utf8');
    if (/[\u0400-\u04FF]/.test(fixed) && fixed.length < inner.length * 0.8) {
      return '\' + fixed + '\';
    }
  } catch(e) {}
  return full;
});

fs.writeFileSync('src/panels/ChatPanel.tsx', c, 'utf8');
const remaining = c.match(/[\u00C0-\u00FF][\u0080-\u00BF]/g);
console.log('Remaining broken after fix:', remaining ? remaining.length : 0);
const ph = c.match(/placeholder=\{[^}]{0,100}/);
console.log('Placeholder check:', ph && ph[0]);