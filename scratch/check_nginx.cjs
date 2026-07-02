const { spawn } = require('child_process');

function checkNginx() {
  console.log('Checking Nginx status on server...');
  const child = spawn('ssh', [
    '-o', 'StrictHostKeyChecking=no',
    'root@194.5.78.150',
    'nginx -t && systemctl status nginx'
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

checkNginx();
