import pg from 'pg';

const { Client } = pg;

const client = new Client({
  host: 'db.ufihkyhvvqfusgavndmh.supabase.co',
  port: 5432,
  user: 'postgres',
  password: 'VihtAdmin2026',
  database: 'postgres',
  ssl: {
    rejectUnauthorized: false
  }
});

async function run() {
  await client.connect();
  console.log('Connected to PostgreSQL database successfully.');

  const res = await client.query("SELECT id, username, full_name, role, roles FROM public.profiles WHERE username IN ('viht', 'adm')");
  console.log('Admin profiles:', JSON.stringify(res.rows, null, 2));

  await client.end();
}

run().catch(console.error);
