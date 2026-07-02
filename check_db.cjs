const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://ufihkyhvvqfusgavndmh.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVmaWhreWh2dnFmdXNnYXZuZG1oIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjMxMzAzMCwiZXhwIjoyMDk3ODg5MDMwfQ.wZl0WCdoV7Ywa7DfaeINo129n0D4nrbV8vsIwXjL_b0'
);

async function checkAll() {
  console.log('=== CHECKING DATABASE STATE ===\n');

  // 1. All conversations
  const { data: convs } = await supabase.from('conversations').select('id, is_group, group_name, participant_1, participant_2, deleted_by');
  console.log('ALL CONVERSATIONS:', JSON.stringify(convs, null, 2));

  // 2. All conversation_members
  const { data: members } = await supabase.from('conversation_members').select('*');
  console.log('\nALL CONVERSATION_MEMBERS:', JSON.stringify(members, null, 2));

  // 3. Messages count per conversation
  for (const c of (convs || [])) {
    const { count } = await supabase.from('messages').select('*', { count: 'exact', head: true }).eq('conversation_id', c.id);
    console.log(`\nMessages in ${c.id}: ${count}`);
  }

  // 4. Check profiles
  const { data: profiles } = await supabase.from('profiles').select('id, full_name, username');
  console.log('\nPROFILES:', JSON.stringify(profiles, null, 2));
}

checkAll().catch(e => console.error(e));
