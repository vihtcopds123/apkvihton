const { spawn } = require('child_process');
const path = require('path');

function runScpAndSsh() {
  console.log('Spawning SCP to copy query.sql...');
  
  const scp = spawn('scp', [
    '-o', 'StrictHostKeyChecking=no',
    'scratch/query.sql',
    'root@46.226.167.4:/tmp/query.sql'
  ], { shell: true });

  scp.stderr.on('data', (data) => {
    const output = data.toString();
    if (output.toLowerCase().includes('password')) {
      scp.stdin.write('SRsUbh9shH2B\n');
    }
  });

  scp.on('close', (code) => {
    console.log(`SCP exited with code ${code}`);
    if (code === 0) {
      runSsh();
    }
  });
}

function runSsh() {
  console.log('Spawning SSH to execute query.sql...');
  const child = spawn('ssh', [
    '-o', 'StrictHostKeyChecking=no',
    'root@46.226.167.4',
    'docker run --rm -v /tmp/query.sql:/tmp/query.sql --network host -e PGPASSWORD=VihtAdmin2026 postgres:alpine psql -h db.ufihkyhvvqfusgavndmh.supabase.co -p 6543 -U postgres.ufihkyhvvqfusgavndmh -d postgres -f /tmp/query.sql'
  ], { shell: true });

  child.stdout.on('data', (data) => {
    console.log(data.toString());
  });

  child.stderr.on('data', (data) => {
    const output = data.toString();
    if (output.toLowerCase().includes('password')) {
      child.stdin.write('SRsUbh9shH2B\n');
    }
  });

  child.on('close', (code) => {
    console.log(`SSH exited with code ${code}`);
  });
}

runScpAndSsh();
