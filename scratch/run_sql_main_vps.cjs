const { spawn } = require('child_process');

function runSql() {
  console.log('Spawning SSH to main VPS 194.5.78.150 with port 6543...');
  
  const child = spawn('ssh', [
    '-o', 'StrictHostKeyChecking=no',
    'root@194.5.78.150',
    'docker run --rm --network host -e PGPASSWORD=VihtAdmin2026 postgres:alpine psql -h db.ufihkyhvvqfusgavndmh.supabase.co -p 6543 -U postgres.ufihkyhvvqfusgavndmh -d postgres -c "SELECT schemaname, tablename, policyname, cmd, qual, with_check FROM pg_policies WHERE tablename = \'messages\';"'
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

runSql();
