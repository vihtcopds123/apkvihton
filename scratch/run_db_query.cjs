const { spawn } = require('child_process');

function runQuery() {
  const query = `SELECT schemaname, tablename, policyname, cmd, qual FROM pg_policies WHERE tablename = 'messages';`;
  console.log('Spawning SSH...');
  const child = spawn('ssh', [
    '-o', 'StrictHostKeyChecking=no',
    'root@46.226.167.4',
    `docker run --rm -e PGPASSWORD=VihtAdmin2026 postgres:alpine psql -h db.ufihkyhvvqfusgavndmh.supabase.co -U postgres -d postgres -c "${query}"`
  ], {
    shell: true
  });

  child.stdout.on('data', (data) => {
    console.log(data.toString());
  });

  child.stderr.on('data', (data) => {
    const output = data.toString();
    if (output.toLowerCase().includes('password')) {
      child.stdin.write('SRsUbh9shH2B\n');
    } else {
      console.error('STDERR:', output);
    }
  });

  child.on('close', (code) => {
    console.log(`SSH exited with code ${code}`);
  });
}

runQuery();
