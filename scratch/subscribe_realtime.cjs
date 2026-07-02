const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ufihkyhvvqfusgavndmh.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVmaWhreWh2dnFmdXNnYXZuZG1oIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjMxMzAzMCwiZXhwIjoyMDk3ODg5MDMwfQ.wZl0WCdoV7Ywa7DfaeINo129n0D4nrbV8vsIwXjL_b0';

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log('Subscribing to realtime channels...');

  const msgChannel = supabase
    .channel('test-messages-realtime')
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'messages'
    }, (payload) => {
      console.log('REALTIME MESSAGE RECEIVED:', payload);
    })
    .subscribe((status) => {
      console.log('Messages Channel Status:', status);
    });

  const notifChannel = supabase
    .channel('test-notifications-realtime')
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'notifications'
    }, (payload) => {
      console.log('REALTIME NOTIFICATION RECEIVED:', payload);
    })
    .subscribe((status) => {
      console.log('Notifications Channel Status:', status);
    });

  console.log('Waiting for events. Press Ctrl+C to exit.');
  
  // Wait 10 seconds, then insert a test message into an existing conversation to see if it triggers!
  // Let's find a conversation first.
  const { data: convs } = await supabase.from('conversations').select('id').limit(1);
  if (!convs || convs.length === 0) {
    console.log('No conversations found.');
    return;
  }
  const convId = convs[0].id;
  console.log(`Using conversation ID: ${convId}`);

  setTimeout(async () => {
    console.log('Inserting a test message...');
    const { data, error } = await supabase
      .from('messages')
      .insert({
        conversation_id: convId,
        sender_id: 'ba633e22-aa73-4b66-870b-e4dda50407e2', // test sender
        content: 'REALTIME TEST MESSAGE'
      })
      .select();

    if (error) {
      console.error('Insert message error:', error);
    } else {
      console.log('Test message inserted:', data);
    }
  }, 3000);
}

main().catch(console.error);
