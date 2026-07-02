import pg from 'pg';

const { Client } = pg;

const client = new Client({
  host: 'aws-0-eu-central-1.pooler.supabase.com',
  port: 5432,
  user: 'postgres.ufihkyhvvqfusgavndmh',
  password: 'VihtAdmin2026',
  database: 'postgres',
  ssl: {
    rejectUnauthorized: false
  }
});

async function run() {
  await client.connect();
  console.log('Connected to PostgreSQL database successfully.');

  // 1. Check if messages table is in the supabase_realtime publication
  const pubRes = await client.query(`
    SELECT schemaname, tablename 
    FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime'
  `);
  console.log('\n--- Tables in supabase_realtime publication ---');
  for (const row of pubRes.rows) {
    console.log(`${row.schemaname}.${row.tablename}`);
  }

  // 2. Check replica identity on messages table
  const repRes = await client.query(`
    SELECT relreplident 
    FROM pg_class 
    WHERE oid = 'public.messages'::regclass
  `);
  console.log('\n--- Replica Identity on messages table ---');
  for (const row of repRes.rows) {
    const ident = row.relreplident === 'd' ? 'default' :
                  row.relreplident === 'n' ? 'nothing' :
                  row.relreplident === 'f' ? 'full' :
                  row.relreplident === 'i' ? 'index' : row.relreplident;
    console.log(`Identity: ${ident}`);
  }

  await client.end();
}

run().catch(console.error);
