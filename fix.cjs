const fs = require('fs');
let c = fs.readFileSync('src/panels/ChatPanel.tsx', 'utf8');
// Fix mojibake: Latin-1 encoded UTF-8 bytes -> real UTF-8 Cyrillic
c = c.replace(/[\xC0-\xFF][\x80-\xBF](?:[\x80-\xBF])?/g, function(match) {
  try { var f = Buffer.from(match, 'latin1').toString('utf8'); if (/[\u0400-\u04FF]/.test(f)) return f; return match; } catch(e) { return match; }
});
// Rewrite formatLastSeen cleanly
var fn = "const formatLastSeen = (s) => {\n  if (!s) return '\u0431\u044b\u043b(\u0430) \u043d\u0435\u0434\u0430\u0432\u043d\u043e'\n  if (isRecentlyOnline(s)) return '\u0432 \u0441\u0435\u0442\u0438'\n  const diff = Date.now() - new Date(s).getTime()\n  const min = Math.floor(diff / 60000), h = Math.floor(min / 60), d = Math.floor(h / 24)\n  if (min < 1) return '\u0431\u044b\u043b(\u0430) \u0442\u043e\u043b\u044c\u043a\u043e \u0447\u0442\u043e'\n  if (min < 60) return '\u0431\u044b\u043b(\u0430) ' + min + ' \u043c\u0438\u043d. \u043d\u0430\u0437\u0430\u0434'\n  if (h < 24) return '\u0431\u044b\u043b(\u0430) ' + h + ' \u0447. \u043d\u0430\u0437\u0430\u0434'\n  if (d === 1) return '\u0431\u044b\u043b(\u0430) \u0432\u0447\u0435\u0440\u0430'\n  if (d < 7) return '\u0431\u044b\u043b(\u0430) ' + d + ' \u0434\u043d. \u043d\u0430\u0437\u0430\u0434'\n  return '\u0431\u044b\u043b(\u0430) ' + new Date(s).toLocaleDateString('ru-RU')\n}";
c = c.replace(/const formatLastSeen = \(s: string \| null\) => \{[\s\S]*?\n\}/, fn);
// Fix months
c = c.replace(/const months = \[[\s\S]*?\]/, "const months = ['\u044f\u043d\u0432\u0430\u0440\u044f','\u0444\u0435\u0432\u0440\u0430\u043b\u044f','\u043c\u0430\u0440\u0442\u0430','\u0430\u043f\u0440\u0435\u043b\u044f','\u043c\u0430\u044f','\u0438\u044e\u043d\u044f','\u0438\u044e\u043b\u044f','\u0430\u0432\u0433\u0443\u0441\u0442\u0430','\u0441\u0435\u043d\u0442\u044f\u0431\u0440\u044f','\u043e\u043a\u0442\u044f\u0431\u0440\u044f','\u043d\u043e\u044f\u0431\u0440\u044f','\u0434\u0435\u043a\u0430\u0431\u0440\u044f']");
// Fix options menu strings
c = c.replace(/'[^']{0,30}'\s*:\s*'[^']{0,30}'\}/g, function(m) { return m; }); // keep
fs.writeFileSync('src/panels/ChatPanel.tsx', c, 'utf8');
console.log('Done', c.length);
// Sample check
var m = c.match(/formatLastSeen = \(s\)[\s\S]{0,100}/);
console.log(m && m[0].slice(0,80));