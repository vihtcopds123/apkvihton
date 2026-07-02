const { spawn } = require('child_process');

function fixPermissions() {
  console.log('Fixing server permissions including profile_effects...');
  const child = spawn('ssh', [
    '-o', 'StrictHostKeyChecking=no',
    'root@194.5.78.150',
    'chmod 755 /var/www/vihtclub/dist/assets && chmod 644 /var/www/vihtclub/dist/assets/* && chmod 755 /var/www/vihtclub/dist/profile_effects && chmod 644 /var/www/vihtclub/dist/profile_effects/*'
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

fixPermissions();
