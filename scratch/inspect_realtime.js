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

console.log('Connecting to Supabase:', supabaseUrl);

const channel = supabase
  .channel('test-realtime-global')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'messages'
  }, (payload) => {
    console.log('\n[EVENT RECEIVED]:', payload.eventType, payload.new);
  })
  .subscribe((status, err) => {
    console.log('Subscription status:', status);
    if (err) {
      console.error('Subscription error:', err);
    }
  });

// Keep process alive for 35 seconds
setTimeout(() => {
  console.log('Closing subscription...');
  supabase.removeChannel(channel);
  process.exit(0);
}, 35000);
