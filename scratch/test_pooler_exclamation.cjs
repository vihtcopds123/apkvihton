const { Client } = require('pg');

async function main() {
  const pwds = ['VihtAdmin2026', 'VihtAdmin2026!', 'VihtSemaphoreAdmin2026!', 'VihtAdmin2025'];
  
  for (const password of pwds) {
    console.log(`Trying pooler with password: ${password}`);
    const client = new Client({
      host: 'aws-0-us-east-1.pooler.supabase.com',
      port: 6543,
      user: 'postgres.ufihkyhvvqfusgavndmh',
      password: password,
      database: 'postgres',
      ssl: {
        rejectUnauthorized: false
      }
    });

    try {
      await client.connect();
      console.log('>>> CONNECTED SUCCESSFULLY WITH PASSWORD:', password);
      const res = await client.query('SELECT 1');
      console.log('Query result:', res.rows);
      await client.end();
      return;
    } catch (e) {
      console.log('Failed:', e.message);
    }
  }
}

main().catch(console.error);
