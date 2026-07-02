const { spawn } = require('child_process');

function testSsh() {
  console.log('Spawning SSH without shell option...');
  const child = spawn('ssh', [
    '-o', 'StrictHostKeyChecking=no',
    'root@46.226.167.4',
    'docker run --rm -e PGPASSWORD=VihtAdmin2026 postgres:alpine psql -h db.ufihkyhvvqfusgavndmh.supabase.co -p 6543 -U postgres.ufihkyhvvqfusgavndmh -d postgres -c "SELECT 1;"'
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

testSsh();
