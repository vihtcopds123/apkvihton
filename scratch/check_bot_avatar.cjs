const https = require('https');
const fs = require('fs');

const envContent = fs.readFileSync('.env', 'utf8');
const match = envContent.match(/VITE_SUPABASE_ANON_KEY=(.+)/);
const anonKey = match[1].trim();

const options = {
  hostname: 'ufihkyhvvqfusgavndmh.supabase.co',
  path: '/rest/v1/profiles?id=eq.00000000-0000-0000-0000-000000000000&select=id,full_name,avatar_url',
  method: 'GET',
  headers: {
    'apikey': anonKey,
    'Authorization': `Bearer ${anonKey}`,
    'Content-Type': 'application/json'
  }
};

https.request(options, (res) => {
  let data = '';
  res.on('data', c => data += c);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log('Data:', data);
  });
}).end();
