const fs = require('fs');
try {
  const content = fs.readFileSync('supabase/notifications_system_v5.sql', 'utf8');
  console.log('CONTENT START');
  console.log(content);
  console.log('CONTENT END');
} catch (e) {
  console.error('Error reading file:', e);
}
