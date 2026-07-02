const { spawn } = require('child_process');

function runNslookup() {
  console.log('Spawning SSH for nslookup...');
  const child = spawn('ssh', [
    '-o', 'StrictHostKeyChecking=no',
    'root@46.226.167.4',
    'nslookup db.ufihkyhvvqfusgavndmh.supabase.co'
  ]);

  child.stdout.on('data', (data) => {
    console.log('STDOUT:', data.toString());
  });

  child.stderr.on('data', (data) => {
    const output = data.toString();
    console.log('STDERR:', output);
    if (output.toLowerCase().includes('password')) {
      child.stdin.write('SRsUbh9shH2B\n');
    }
  });

  child.on('close', (code) => {
    console.log(`Process exited with code ${code}`);
  });
}

runNslookup();
