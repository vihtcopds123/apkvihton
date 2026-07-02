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
  // We can query pg_trigger using a custom rpc or just check if notifications trigger works
  // Since we cannot run raw SQL directly through anon client unless there's an RPC,
  // let's try to insert a test notification to see if it triggers the push server!
  console.log('Inserting test notification into public.notifications to see if trigger fires...');
  
  const { data: myProfile } = await supabase.from('profiles').select('id').limit(1).single();
  
  if (!myProfile) {
    console.error('No profiles found in DB.');
    return;
  }
  
  // Insert a test notification for myself
  const { data, error } = await supabase
    .from('notifications')
    .insert({
      user_id: myProfile.id,
      type: 'like',
      from_user_id: myProfile.id
    })
    .select();

  if (error) {
    console.error('Error inserting test notification:', error.message);
  } else {
    console.log('Inserted test notification successfully:', data);
    console.log('Check the docker logs on the VPS now to see if it printed "Sending push to..."');
  }
}

check();
