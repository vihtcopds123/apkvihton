const https = require('https');

// Update avatar_url for system bot profile
const supabaseUrl = 'ufihkyhvvqfusgavndmh.supabase.co';

// Read SUPABASE_KEY from env or hardcode anon key from project
// We need the service role key - let's read it from the .env file
const fs = require('fs');
let envContent = '';
try {
  envContent = fs.readFileSync('.env', 'utf8');
} catch(e) {
  try {
    envContent = fs.readFileSync('.env.local', 'utf8');
  } catch(e2) {
    console.log('Could not read .env');
  }
}

const match = envContent.match(/VITE_SUPABASE_ANON_KEY=(.+)/);
const anonKey = match ? match[1].trim() : null;

if (!anonKey) {
  console.error('Could not find VITE_SUPABASE_ANON_KEY in .env');
  process.exit(1);
}

const avatarUrl = 'https://vihtclub.ru/tg-api/file/bot8949101826:AAFG1feLFdrnY-rioZWshB5WRPUBwt4suqI//var/lib/telegram-bot-api/8949101826:AAFG1feLFdrnY-rioZWshB5WRPUBwt4suqI/documents/file_171.png';

const body = JSON.stringify({ avatar_url: avatarUrl });

const options = {
  hostname: supabaseUrl,
  path: '/rest/v1/profiles?id=eq.00000000-0000-0000-0000-000000000000',
  method: 'PATCH',
  headers: {
    'apikey': anonKey,
    'Authorization': `Bearer ${anonKey}`,
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
    'Prefer': 'return=minimal'
  }
};

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    if (data) console.log('Response:', data);
    else console.log('Success - avatar updated!');
  });
});

req.on('error', err => console.error('Error:', err));
req.write(body);
req.end();
