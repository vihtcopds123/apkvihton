import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ufihkyhvvqfusgavndmh.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVmaWhreWh2dnFmdXNnYXZuZG1oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIzMTMwMzAsImV4cCI6MjA5Nzg4OTAzMH0.QP_2pBEBHZcjqEnKAA20lU0ti5C9YmosYu_-MAWyOu4';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function main() {
  const { data, error } = await supabase
    .from('media_likes')
    .select('*')
    .limit(1);

  if (error) {
    console.error('Error fetching media_likes:', error.message);
  } else {
    console.log('media_likes fields:', Object.keys(data[0] || {}));
    console.log('Sample media_like:', JSON.stringify(data[0] || {}, null, 2));
  }
}

main();
