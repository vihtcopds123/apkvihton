const fs = require('fs');
let content = fs.readFileSync('src/panels/CommunityDetailPanel.tsx', 'utf8');
content = content.replace(/Icon28NotificationsSlashOutline/g, 'Icon28NotificationDisableOutline');
fs.writeFileSync('src/panels/CommunityDetailPanel.tsx', content, 'utf8');
console.log('Replacements done!');
