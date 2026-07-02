const supabaseUrl = 'https://ufihkyhvvqfusgavndmh.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVmaWhreWh2dnFmdXNnYXZuZG1oIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjMxMzAzMCwiZXhwIjoyMDk3ODg5MDMwfQ.wZl0WCdoV7Ywa7DfaeINo129n0D4nrbV8vsIwXjL_b0';

async function main() {
  const res = await fetch(`${supabaseUrl}/rest/v1/`, {
    headers: {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`
    }
  });
  const schema = await res.json();
  const path = schema.paths['/rpc/rls_auto_enable'];
  if (path && path.post && path.post.parameters) {
    const bodyParam = path.post.parameters.find(p => p.in === 'body');
    if (bodyParam && bodyParam.schema) {
      console.log('Parameters schema:', JSON.stringify(bodyParam.schema, null, 2));
    }
  }
}

main().catch(console.error);
