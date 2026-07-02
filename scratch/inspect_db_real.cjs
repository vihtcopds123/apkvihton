const { Client } = require('pg');

const client = new Client({
  host: 'aws-0-us-east-1.pooler.supabase.com',
  port: 6543, // try port 6543 first (or 5432)
  user: 'postgres.ufihkyhvvqfusgavndmh',
  password: 'VihtAdmin2026',
  database: 'postgres',
  ssl: {
    rejectUnauthorized: false
  }
});

async function main() {
  await client.connect();
  console.log('Connected to DB successfully!');

  // 1. Check publication tables
  const pubRes = await client.query(`
    SELECT 
      pubname, 
      schemaname, 
      tablename 
    FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime';
  `);
  console.log('=== Tables in supabase_realtime publication ===');
  console.log(pubRes.rows);

  await client.end();
}

main().catch(console.error);
