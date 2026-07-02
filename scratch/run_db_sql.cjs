const { spawn } = require('child_process');

function executeSsh() {
  console.log('Spawning SSH to copy and run SQL query...');
  
  // Команда для записи sql файла на сервере и запуска psql
  const cmd = "printf \"SELECT schemaname, tablename, policyname, cmd, qual, with_check FROM pg_policies WHERE tablename = 'messages';\\n\" > /tmp/query.sql && docker run --rm -v /tmp/query.sql:/tmp/query.sql --network host -e PGPASSWORD=VihtAdmin2026 postgres:alpine psql -h db.ufihkyhvvqfusgavndmh.supabase.co -p 6543 -U postgres.ufihkyhvvqfusgavndmh -d postgres -f /tmp/query.sql";

  const child = spawn('ssh', [
    '-o', 'StrictHostKeyChecking=no',
    'root@46.226.167.4',
    cmd
  ], {
    shell: true
  });

  child.stdout.on('data', (data) => {
    console.log('STDOUT:', data.toString());
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
    console.log(`Process exited with code ${code}`);
  });
}

executeSsh();
