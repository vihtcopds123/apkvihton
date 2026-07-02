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

async function check() {
  // Let's get the 5 most recent messages sent to see if there are any new ones today
  const { data: messages, error: msgError } = await supabase
    .from('messages')
    .select('id, sender_id, conversation_id, content, created_at')
    .order('created_at', { ascending: false })
    .limit(5);

  if (msgError) {
    console.error('Error messages:', msgError);
    return;
  }

  console.log('Recent 5 messages:', messages);

  for (const msg of messages) {
    const { data: conv } = await supabase
      .from('conversations')
      .select('*')
      .eq('id', msg.conversation_id)
      .single();
    
    console.log(`\nMessage ID: ${msg.id}`);
    console.log(`Sent at: ${msg.created_at}`);
    console.log(`Content: "${msg.content}"`);
    console.log(`Conversation details:`, conv);
  }
}

check();
