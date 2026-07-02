const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres:VihtAdmin2026@db.ufihkyhvvqfusgavndmh.supabase.co:6543/postgres'
});

async function main() {
  try {
    await client.connect();
    console.log('Connected successfully!');
    const res = await client.query(`
      SELECT schemaname, tablename, policyname, cmd, qual, with_check 
      FROM pg_policies 
      WHERE tablename = 'messages';
    `);
    console.log('Messages Policies:', JSON.stringify(res.rows, null, 2));
  } catch (err) {
    console.error('Error connecting or querying:', err);
  } finally {
    await client.end();
  }
}

main();
