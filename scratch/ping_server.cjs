const { exec } = require('child_process');

function pingServer() {
  console.log('Pinging 194.5.78.150...');
  exec('ping 194.5.78.150', (err, stdout, stderr) => {
    console.log('PING STDOUT:', stdout);
    console.error('PING STDERR:', stderr);
    if (err) {
      console.error('Ping failed:', err);
    }
  });
}

pingServer();
