const fs = require('fs');
const path = require('path');

const manifestPath = path.join('android', 'app', 'src', 'main', 'AndroidManifest.xml');

if (!fs.existsSync(manifestPath)) {
  console.error('AndroidManifest.xml not found at:', manifestPath);
  process.exit(1);
}

let content = fs.readFileSync(manifestPath, 'utf8');

// Check if permission is already there
if (!content.includes('android.permission.POST_NOTIFICATIONS')) {
  console.log('Adding POST_NOTIFICATIONS permission to AndroidManifest.xml...');
  
  // Find where <manifest> tag or other permissions are and insert ours
  const targetTag = '<application';
  const permissionTag = '\n    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />\n';
  
  content = content.replace(targetTag, permissionTag + '    ' + targetTag);
  fs.writeFileSync(manifestPath, content, 'utf8');
  console.log('Successfully updated AndroidManifest.xml!');
} else {
  console.log('POST_NOTIFICATIONS permission already present.');
}
