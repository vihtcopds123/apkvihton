const icons = require('@vkontakte/icons');
const keys = Object.keys(icons);
console.log('Notification related icons:');
keys.forEach(k => {
  if (k.toLowerCase().includes('notification') || k.toLowerCase().includes('volume')) {
    console.log(k);
  }
});
