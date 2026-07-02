const { spawn } = require('child_process');

function runCmd(cmd) {
  console.log(`Running on server: ${cmd}`);
  const child = spawn('ssh', [
    '-o', 'StrictHostKeyChecking=no',
    'root@194.5.78.150',
    `export SYSTEMD_PAGER=cat && ${cmd}`
  ]);

  child.stdout.on('data', (data) => {
    console.log(data.toString());
  });

  child.stderr.on('data', (data) => {
    console.error('STDERR:', data.toString());
  });

  child.on('close', (code) => {
    console.log(`Process exited with code ${code}`);
  });
}

// Проверяем файрволы и баны
runCmd('ufw status && fail2ban-client status');
