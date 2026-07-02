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

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data, error } = await supabase.from('user_push_tokens').select('id, user_id, created_at');
  if (error) {
    console.error('Error fetching user_push_tokens:', error);
  } else {
    console.log('Total push tokens registered:', data.length);
    console.log('Tokens data:', data);
  }
}

check();
