const supabaseUrl = 'https://ufihkyhvvqfusgavndmh.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVmaWhreWh2dnFmdXNnYXZuZG1oIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjMxMzAzMCwiZXhwIjoyMDk3ODg5MDMwfQ.wZl0WCdoV7Ywa7DfaeINo129n0D4nrbV8vsIwXjL_b0';

async function main() {
  console.log('Fetching PostgREST OpenAPI spec...');
  const res = await fetch(`${supabaseUrl}/rest/v1/`, {
    headers: {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`
    }
  });
  if (!res.ok) {
    console.error('Failed to fetch:', res.status, res.statusText);
    return;
  }
  const schema = await res.json();
  
  console.log('=== Tables/Views ===');
  console.log(Object.keys(schema.definitions || {}));

  console.log('\n=== RPCs (paths containing /rpc/) ===');
  const rpcs = Object.keys(schema.paths || {}).filter(p => p.startsWith('/rpc/'));
  console.log(rpcs);
}

main().catch(console.error);
