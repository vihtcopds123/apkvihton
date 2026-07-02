const { spawn } = require('child_process');

function runCmd() {
  console.log('Connecting to 194.5.78.150 to test local Nginx...');
  const child = spawn('ssh', [
    '-o', 'StrictHostKeyChecking=no',
    'root@194.5.78.150',
    'curl -k -Iv https://127.0.0.1/ -H "Host: vihtclub.ru"'
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

runCmd();
