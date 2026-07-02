const { spawn } = require('child_process');

function runNslookup() {
  console.log('Spawning SSH to main VPS for nslookup...');
  const child = spawn('ssh', [
    '-o', 'StrictHostKeyChecking=no',
    'root@194.5.78.150',
    'nslookup db.ufihkyhvvqfusgavndmh.supabase.co 8.8.8.8'
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

runNslookup();
