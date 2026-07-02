const fs = require('fs');
const https = require('https');

const botToken = '8949101826:AAFG1feLFdrnY-rioZWshB5WRPUBwt4suqI';
const chatId = '-1004292795079';
const svcKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVmaWhreWh2dnFmdXNnYXZuZG1oIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjMxMzAzMCwiZXhwIjoyMDk3ODg5MDMwfQ.wZl0WCdoV7Ywa7DfaeINo129n0D4nrbV8vsIwXjL_b0';

const filePath = 'ChatGPT Image 1 июл. 2026 г., 00_42_06.png';
const fileBytes = fs.readFileSync(filePath);
const boundary = '----Upload' + Date.now();
const CRLF = '\r\n';

const header = Buffer.from(
  '--' + boundary + CRLF +
  'Content-Disposition: form-data; name="chat_id"' + CRLF + CRLF +
  chatId + CRLF +
  '--' + boundary + CRLF +
  'Content-Disposition: form-data; name="document"; filename="vihton_avatar2.png"' + CRLF +
  'Content-Type: image/png' + CRLF + CRLF
);
const footer = Buffer.from(CRLF + '--' + boundary + '--' + CRLF);
const body = Buffer.concat([header, fileBytes, footer]);

// Step 1: Upload to Telegram
const uploadOpts = {
  hostname: 'vihtclub.ru',
  path: `/tg-api/bot${botToken}/sendDocument`,
  method: 'POST',
  headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}`, 'Content-Length': body.length }
};

const req = https.request(uploadOpts, res => {
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => {
    const j = JSON.parse(d);
    if (!j.ok) { console.error('Upload failed:', d); return; }
    const fileId = j.result.document.file_id;

    // Step 2: Get file path
    https.request({ hostname: 'vihtclub.ru', path: `/tg-api/bot${botToken}/getFile?file_id=${fileId}` }, res2 => {
      let d2 = '';
      res2.on('data', c => d2 += c);
      res2.on('end', () => {
        const j2 = JSON.parse(d2);
        const fp = j2.result.file_path; // e.g. documents/file_172.png
        const avatarUrl = `https://vihtclub.ru/tg-api/file/bot${botToken}/${fp}`;
        console.log('Avatar URL:', avatarUrl);

        // Step 3: Update in DB
        const patchBody = Buffer.from(JSON.stringify({ avatar_url: avatarUrl }));
        const patchOpts = {
          hostname: 'ufihkyhvvqfusgavndmh.supabase.co',
          path: '/rest/v1/profiles?id=eq.00000000-0000-0000-0000-000000000000',
          method: 'PATCH',
          headers: {
            'apikey': svcKey,
            'Authorization': `Bearer ${svcKey}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal',
            'Content-Length': patchBody.length
          }
        };
        const req3 = https.request(patchOpts, res3 => {
          let d3 = '';
          res3.on('data', c => d3 += c);
          res3.on('end', () => {
            console.log('DB update status:', res3.statusCode);
            if (res3.statusCode === 204) console.log('Done! Avatar updated successfully.');
            else console.log(d3);
          });
        });
        req3.write(patchBody);
        req3.end();
      });
    }).end();
  });
});
req.write(body);
req.end();
