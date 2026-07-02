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

async function testInsert() {
  // Fetch a user profile ID
  const { data: profile } = await supabase.from('profiles').select('id').limit(1).single();
  if (!profile) {
    console.error('No profiles found');
    return;
  }

  console.log('Testing insert into user_push_tokens for user:', profile.id);
  
  const testSub = {
    endpoint: "https://fcm.googleapis.com/fcm/send/fake-endpoint",
    keys: {
      p256dh: "fake-p256dh",
      auth: "fake-auth"
    }
  };

  // We try inserting without auth login first (since script uses anon key but not authenticated user session)
  // Wait! RLS policy is: "Allow user insert own push tokens" using auth.uid() = user_id.
  // Since the script runs with Anon Key but without logging in as that user, auth.uid() will be null, and it SHOULD fail!
  // But wait! If we want to check if the table exists and if we can insert, let's look at the schema of the table!
  const { data, error } = await supabase
    .from('user_push_tokens')
    .insert({
      user_id: profile.id,
      subscription: testSub
    })
    .select();

  if (error) {
    console.log('Insert failed (expected if RLS is active and we are not logged in as the user):', error.message);
  } else {
    console.log('Insert succeeded! (Wait, if this succeeded, it means RLS is either disabled or not restricting anon inserts!):', data);
  }
}

testInsert();
