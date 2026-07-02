const { spawn } = require('child_process');

function runOnVps() {
  console.log('Spawning SSH to execute resolve_pooler on main VPS...');
  
  // Код скрипта, который выполнится на VPS
  const scriptContent = `
const dns = require('dns').promises;
const { Client } = require('pg');

const regions = [
  'eu-central-1', 'eu-west-1', 'eu-west-2', 'eu-west-3', 'eu-north-1',
  'us-east-1', 'us-east-2', 'us-west-1', 'us-west-2',
  'ap-northeast-1', 'ap-northeast-2', 'ap-northeast-3', 'ap-southeast-1', 'ap-southeast-2', 'ap-south-1',
  'sa-east-1', 'ca-central-1'
];

async function main() {
  const tenant = 'postgres.ufihkyhvvqfusgavndmh';
  const passwords = ['VihtAdmin2026', 'W7Aq01By2mVeyWaY56'];

  for (const region of regions) {
    const host = "aws-0-" + region + ".pooler.supabase.com";
    try {
      const ips = await dns.resolve4(host);
      console.log("Region " + region + ": Host " + host + " resolved to " + ips.join(', '));
      
      for (const password of passwords) {
        const client = new Client({
          host,
          port: 6543,
          user: tenant,
          password,
          database: 'postgres',
          connectionTimeoutMillis: 2000,
          ssl: { rejectUnauthorized: false }
        });
        
        try {
          await client.connect();
          console.log(">>> SUCCESS: Connected to region " + region + " with password: " + password + " <<<");
          const res = await client.query('SELECT 1');
          console.log('Query result:', res.rows);
          await client.end();
          return; // found it!
        } catch (err) {
          console.log("Connection to " + region + " with password " + password + " failed: " + err.message);
        }
      }
    } catch (e) {
      console.log("DNS fail for " + region + ": " + e.message);
    }
  }
}

main().catch(console.error);
`;

  // Записываем этот скрипт во временный файл на VPS и запускаем его через node
  const child = spawn('ssh', [
    '-o', 'StrictHostKeyChecking=no',
    'root@194.5.78.150',
    `cat << 'EOF' > /tmp/resolve_pooler.js
${scriptContent}
EOF
node /tmp/resolve_pooler.js`
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

runOnVps();
