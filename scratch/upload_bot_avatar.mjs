import fs from 'fs';
import FormData from 'form-data';
import fetch from 'node-fetch';

const botToken = '8949101826:AAFG1feLFdrnY-rioZWshB5WRPUBwt4suqI';
const chatId = '-1004292795079';
const apiBase = `https://vihtclub.ru/tg-api/bot${botToken}`;

const form = new FormData();
form.append('chat_id', chatId);
form.append('document', fs.createReadStream('fca9ee14-89e0-41e9-9ac4-3e586980f86c.png'), {
  filename: 'vihton_avatar.png',
  contentType: 'image/png'
});

console.log('Uploading...');
const res = await fetch(`${apiBase}/sendDocument`, { method: 'POST', body: form });
const data = await res.json();
console.log(JSON.stringify(data, null, 2));

if (data.ok) {
  const fileId = data.result.document.file_id;
  const getFile = await fetch(`${apiBase}/getFile?file_id=${fileId}`);
  const fileData = await getFile.json();
  console.log('\nFile info:', JSON.stringify(fileData, null, 2));
  
  const filePath = fileData.result.file_path;
  const avatarUrl = `https://vihtclub.ru/tg-api/file/bot${botToken}/${filePath}`;
  console.log('\n=== AVATAR URL ===');
  console.log(avatarUrl);
}
