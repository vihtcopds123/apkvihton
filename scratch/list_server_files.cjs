const { spawn } = require('child_process');

function listFiles() {
  console.log('Listing server files...');
  const child = spawn('ssh', [
    '-o', 'StrictHostKeyChecking=no',
    'root@194.5.78.150',
    'ls -la /var/www/vihtclub/dist/ && ls -la /var/www/vihtclub/dist/assets/'
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

listFiles();
