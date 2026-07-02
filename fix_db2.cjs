const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://ufihkyhvvqfusgavndmh.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVmaWhreWh2dnFmdXNnYXZuZG1oIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjMxMzAzMCwiZXhwIjoyMDk3ODg5MDMwfQ.wZl0WCdoV7Ywa7DfaeINo129n0D4nrbV8vsIwXjL_b0'
);

async function fixDB() {
  // Group "222" (e845f097) has no members in conversation_members - add them
  const groupId222 = 'e845f097-ab48-4a96-af42-442f223023f3';
  
  const { data: existing } = await supabase
    .from('conversation_members')
    .select('*')
    .eq('conversation_id', groupId222);
  
  console.log('Existing members for "222":', existing);
  
  if (!existing || existing.length === 0) {
    const { data: msgs } = await supabase
      .from('messages')
      .select('sender_id')
      .eq('conversation_id', groupId222);
    
    console.log('Messages in "222":', msgs);
    
    const creator = 'ba633e22-aa73-4b66-870b-e4dda50407e2';
    const members = [
      { conversation_id: groupId222, user_id: creator, role: 'admin' }
    ];
    
    const otherIds = [...new Set((msgs || []).map(m => m.sender_id).filter(id => id !== creator))];
    for (const uid of otherIds) {
      members.push({ conversation_id: groupId222, user_id: uid, role: 'member' });
    }
    
    console.log('Inserting members:', members);
    const { error } = await supabase.from('conversation_members').insert(members);
    if (error) console.error('Insert error:', error);
    else console.log('Members added for "222"!');
  }

  console.log('\nDone!');
}

fixDB().catch(e => console.error(e));
