const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://ufihkyhvvqfusgavndmh.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVmaWhreWh2dnFmdXNnYXZuZG1oIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjMxMzAzMCwiZXhwIjoyMDk3ODg5MDMwfQ.wZl0WCdoV7Ywa7DfaeINo129n0D4nrbV8vsIwXjL_b0'
);

async function main() {
  const { data, error } = await supabase.from('post_views').select('*').limit(1);
  if (error) {
    console.log('TABLE post_views CHECK ERROR:', error.message);
  } else {
    console.log('TABLE post_views EXISTS! Rows:', data);
  }
}

main();
