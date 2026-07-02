import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// Read VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY from .env.local
const envLocal = fs.readFileSync('.env.local', 'utf8');
const urlMatch = envLocal.match(/VITE_SUPABASE_URL=(.+)/);
const keyMatch = envLocal.match(/VITE_SUPABASE_ANON_KEY=(.+)/);

if (!urlMatch || !keyMatch) {
  console.error('Could not find Supabase URL or Anon key in .env.local');
  process.exit(1);
}

const supabaseUrl = urlMatch[1].trim();
const supabaseKey = keyMatch[1].trim();

// Since we need to query system tables (or if RLS is enabled, we'll try to query notifications first)
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  // Let's check notifications table content
  const { data: notifications, error: notifError } = await supabase
    .from('notifications')
    .select('id, user_id, type, created_at')
    .order('created_at', { ascending: false })
    .limit(5);

  if (notifError) {
    console.error('Error fetching notifications:', notifError);
  } else {
    console.log('Recent 5 notifications in DB:', notifications);
  }

  // Let's query pg_net requests via SQL if possible (usually needs service_role, let's see if we can query it)
  // Standard anon key might not have access to net schema, let's try RPC or simple queries
}

check();
