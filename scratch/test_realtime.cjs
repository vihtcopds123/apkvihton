const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://ufihkyhvvqfusgavndmh.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVmaWhreWh2dnFmdXNnYXZuZG1oIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjMxMzAzMCwiZXhwIjoyMDk3ODg5MDMwfQ.wZl0WCdoV7Ywa7DfaeINo129n0D4nrbV8vsIwXjL_b0'
);

async function main() {
  console.log('Testing exec_sql...');
  
  // Try to query pg_publication via rpc or just standard queries.
  try {
    const { data, error } = await supabase.rpc('exec_sql', { 
      sql: `
        SELECT 
          pubname, 
          schemaname, 
          tablename 
        FROM pg_publication_tables;
      ` 
    });
    if (error) {
      console.error('Error executing sql RPC:', error);
    } else {
      console.log('Publication tables:', data);
    }
  } catch (err) {
    console.error('RPC thrown error:', err);
  }

  // Also query if we have any other info or tables.
  try {
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: `
        SELECT 
          c.relname AS table_name,
          c.relreplident AS replica_identity
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname IN ('messages', 'notifications', 'conversations', 'profiles', 'groups', 'conversation_members');
      `
    });
    if (error) {
      console.error('Error query replica identity:', error);
    } else {
      console.log('Replica identities (d=default, n=nothing, f=full, i=index):', data);
    }
  } catch (err) {
    console.error('Replica identity query thrown error:', err);
  }
}

main().catch(console.error);
