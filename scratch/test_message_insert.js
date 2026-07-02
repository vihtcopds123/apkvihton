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
  console.log('Attempting to insert a test message...');
  
  // We need a sender and conversation ID. We know ba633e22-aa73-4b66-870b-e4dda50407e2 and b81cd7c8-abfd-4f8d-ae7a-80596d98e2a0 exist.
  const { data, error } = await supabase
    .from('messages')
    .insert({
      conversation_id: 'b81cd7c8-abfd-4f8d-ae7a-80596d98e2a0',
      sender_id: 'ba633e22-aa73-4b66-870b-e4dda50407e2',
      content: 'System diagnostic test message'
    })
    .select();

  if (error) {
    console.error('DATABASE ERROR DURING INSERT:', error);
  } else {
    console.log('INSERT SUCCESSFUL! Message row:', data);
  }
}

test();
