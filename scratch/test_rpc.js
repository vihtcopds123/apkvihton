import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ufihkyhvvqfusgavndmh.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVmaWhreWh2dnFmdXNnYXZuZG1oIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjMxMzAzMCwiZXhwIjoyMDk3ODg5MDMwfQ.wZl0WCdoV7Ywa7DfaeINo129n0D4nrbV8vsIwXjL_b0';

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const candidates = ['exec_sql', 'execute_sql', 'run_sql', 'sql', 'query'];
  for (const name of candidates) {
    const { data, error } = await supabase.rpc(name, { query: 'SELECT 1', sql: 'SELECT 1' });
    console.log(`RPC '${name}':`, error ? error.message : 'Available!');
  }
}

test().catch(console.error);
