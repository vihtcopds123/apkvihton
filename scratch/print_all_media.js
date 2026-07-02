import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ufihkyhvvqfusgavndmh.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVmaWhreWh2dnFmdXNnYXZuZG1oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIzMTMwMzAsImV4cCI6MjA5Nzg4OTAzMH0.QP_2pBEBHZcjqEnKAA20lU0ti5C9YmosYu_-MAWyOu4';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function main() {
  const { data: messages } = await supabase.from('messages').select('id, image_url, audio_url, content');
  
  console.log('Messages media URLs:');
  messages?.forEach(m => {
    if (m.image_url) {
      console.log(`Msg ${m.id} (image_url):`, m.image_url);
    }
    if (m.audio_url) {
      console.log(`Msg ${m.id} (audio_url):`, m.audio_url);
    }
  });
}

main();
