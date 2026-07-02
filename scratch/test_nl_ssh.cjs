const { spawn } = require('child_process');

function runSSH() {
  console.log('Spawning SSH to NL VPS...');
  const child = spawn('ssh', ['-o', 'StrictHostKeyChecking=no', 'root@46.226.167.4', 'nslookup db.ufihkyhvvqfusgavndmh.supabase.co'], {
    shell: true
  });

  child.stdout.on('data', (data) => {
    console.log('STDOUT:', data.toString());
  });

  child.stderr.on('data', (data) => {
    const output = data.toString();
    console.log('STDERR:', output);
    if (output.toLowerCase().includes('password')) {
      console.log('Password prompt detected, sending password...');
      child.stdin.write('SRsUbh9shH2B\n');
    }
  });

  child.on('close', (code) => {
    console.log(`SSH process exited with code ${code}`);
  });
}

runSSH();
