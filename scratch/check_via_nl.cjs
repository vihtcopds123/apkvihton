const { spawn } = require('child_process');

function checkViaNL() {
  console.log('Connecting to Netherlands VPS to test vihtclub.ru...');
  
  // Используем sshpass или просто ssh с sshpass для ввода пароля, 
  // но на Windows sshpass нет по умолчанию.
  // Зато у нас есть node-ssh или мы можем использовать PowerShell, 
  // или просто запустить ssh с передачей пароля в stdin (через plink или ssh-pass).
  // Но подождите! Мы можем подключиться к NL VPS с помощью простой библиотеки ssh2,
  // или написать скрипт на чистом Node.js с использованием библиотеки 'ssh2'.
  // Есть ли библиотека 'ssh2' в node_modules?
  // Давайте проверим, или просто попробуем запустить ssh без пароля? 
  // Вдруг ключ пользователя авторизован и на NL VPS?
  // Давайте попробуем сначала обычный ssh на root@46.226.167.4
  const child = spawn('ssh', [
    '-o', 'StrictHostKeyChecking=no',
    'root@46.226.167.4',
    'curl -Iv https://vihtclub.ru/'
  ]);

  child.stdout.on('data', (data) => {
    console.log('STDOUT:', data.toString());
  });

  child.stderr.on('data', (data) => {
    console.error('STDERR:', data.toString());
  });

  child.on('close', (code) => {
    console.log(`Process exited with code ${code}`);
  });
}

checkViaNL();
