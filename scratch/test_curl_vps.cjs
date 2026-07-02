const { spawn } = require('child_process');

function testCurl() {
  console.log('Spawning SSH to main VPS for curl...');
  const child = spawn('ssh', [
    '-o', 'StrictHostKeyChecking=no',
    'root@194.5.78.150',
    'curl -6 -I https://ufihkyhvvqfusgavndmh.supabase.co'
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

testCurl();
