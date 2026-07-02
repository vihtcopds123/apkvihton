const http = require('https');

http.get('https://ufihkyhvvqfusgavndmh.supabase.co', (res) => {
  console.log('Headers:', res.headers);
}).on('error', (e) => {
  console.error(e);
});
