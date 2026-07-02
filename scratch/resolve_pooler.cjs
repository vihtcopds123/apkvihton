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
  const password = 'W7Aq01By2mVeyWaY56'; // Исправленный пароль

  for (const region of regions) {
    const host = `aws-0-${region}.pooler.supabase.com`;
    try {
      const ips = await dns.resolve4(host);
      console.log(`Region ${region}: Host ${host} resolved to ${ips.join(', ')}`);
      
      const client = new Client({
        host,
        port: 6543,
        user: tenant,
        password,
        database: 'postgres',
        connectionTimeoutMillis: 3000,
        ssl: { rejectUnauthorized: false }
      });
      
      try {
        await client.connect();
        console.log(`>>> SUCCESS: Connected to region ${region}! <<<`);
        const res = await client.query('SELECT 1');
        console.log('Query result:', res.rows);
        await client.end();
        break; // found it!
      } catch (err) {
        console.log(`Connection to ${region} failed:`, err.message);
      }
    } catch (e) {
      // dns failed
    }
  }
}

main().catch(console.error);
