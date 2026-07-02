const fs = require('fs');
const https = require('https');
const path = require('path');

const botToken = '8949101826:AAFG1feLFdrnY-rioZWshB5WRPUBwt4suqI';
const chatId = '-1004292795079';

const filePath = path.resolve('fca9ee14-89e0-41e9-9ac4-3e586980f86c.png');
const fileData = fs.readFileSync(filePath);
const boundary = '----BotUpload' + Date.now();

const CRLF = '\r\n';

const header = Buffer.from(
  '--' + boundary + CRLF +
  'Content-Disposition: form-data; name="chat_id"' + CRLF + CRLF +
  chatId + CRLF +
  '--' + boundary + CRLF +
  'Content-Disposition: form-data; name="document"; filename="vihton_avatar.png"' + CRLF +
  'Content-Type: image/png' + CRLF + CRLF
);
const footer = Buffer.from(CRLF + '--' + boundary + '--' + CRLF);
const body = Buffer.concat([header, fileData, footer]);

const options = {
  hostname: 'vihtclub.ru',
  path: `/tg-api/bot${botToken}/sendDocument`,
  method: 'POST',
  headers: {
    'Content-Type': `multipart/form-data; boundary=${boundary}`,
    'Content-Length': body.length
  }
};

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const json = JSON.parse(data);
    if (json.ok) {
      const fileId = json.result.document.file_id;
      // Get file path
      const getFileOpts = {
        hostname: 'vihtclub.ru',
        path: `/tg-api/bot${botToken}/getFile?file_id=${fileId}`,
        method: 'GET'
      };
      const req2 = https.request(getFileOpts, (res2) => {
        let d2 = '';
        res2.on('data', c => d2 += c);
        res2.on('end', () => {
          const j2 = JSON.parse(d2);
          const fp = j2.result.file_path;
          const url = `https://vihtclub.ru/tg-api/file/bot${botToken}/${fp}`;
          console.log('AVATAR_URL=' + url);
        });
      });
      req2.end();
    } else {
      console.error('Upload failed:', JSON.stringify(json));
    }
  });
});

req.on('error', err => console.error('Request error:', err));
req.write(body);
req.end();
