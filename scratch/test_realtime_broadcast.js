import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envLocal = fs.readFileSync('.env.local', 'utf8');
const urlMatch = envLocal.match(/VITE_SUPABASE_URL=(.+)/);
const keyMatch = envLocal.match(/VITE_SUPABASE_ANON_KEY=(.+)/);

if (!urlMatch || !keyMatch) {
  console.error('Could not find Supabase URL or Anon key');
  process.exit(1);
}

const supabaseUrl = urlMatch[1].trim();
const supabaseKey = keyMatch[1].trim();
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  console.log('Testing Realtime events...');

  // Get a conversation ID to use
  const { data: convs, error: convError } = await supabase
    .from('conversations')
    .select('id')
    .limit(1);

  if (convError || !convs || convs.length === 0) {
    console.error('Could not fetch conversations:', convError);
    process.exit(1);
  }

  const conversationId = convs[0].id;
  console.log('Using conversation ID:', conversationId);

  let eventReceived = false;

  const channel = supabase
    .channel('test-channel')
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'messages',
      filter: `conversation_id=eq.${conversationId}`
    }, (payload) => {
      console.log('\n[SUCCESS] REALTIME EVENT RECEIVED:', payload.new.content);
      eventReceived = true;
    })
    .subscribe((status) => {
      console.log('Subscription status:', status);
    });

  // Wait for subscription to establish
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Insert a test message (we need to be authenticated, or RLS must allow it.
  // Wait, does RLS allow anonymous insertion?
  // Let's check. If it fails, we will know.
  console.log('Inserting test message...');
  const { data: msg, error: insertError } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      sender_id: 'ba633e22-aa73-4b66-870b-e4dda50407e2', // viht's ID
      content: 'TEST_REALTIME_MESSAGE_' + Date.now()
    })
    .select()
    .single();

  if (insertError) {
    console.error('Insert error (might be RLS):', insertError.message);
  } else {
    console.log('Inserted message ID:', msg.id);
  }

  // Wait 5 seconds for the event
  await new Promise(resolve => setTimeout(resolve, 5000));

  // Cleanup test message if inserted
  if (msg) {
    console.log('Cleaning up test message...');
    await supabase.from('messages').delete().eq('id', msg.id);
  }

  supabase.removeChannel(channel);

  if (eventReceived) {
    console.log('\nRealtime is working correctly!');
  } else {
    console.log('\n[FAILURE] Realtime event was NOT received.');
  }

  process.exit(0);
}

test().catch(console.error);
