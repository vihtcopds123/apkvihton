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
  const { data: messages, error } = await supabase.from('messages').select('id, sender_id, conversation_id, content, created_at').order('created_at', { ascending: false }).limit(5);
  if (error) {
    console.error('Error fetching messages:', error);
  } else {
    console.log('Recent 5 messages:', messages);
  }
}

check();
