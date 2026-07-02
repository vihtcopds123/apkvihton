import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ufihkyhvvqfusgavndmh.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVmaWhreWh2dnFmdXNnYXZuZG1oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIzMTMwMzAsImV4cCI6MjA5Nzg4OTAzMH0.QP_2pBEBHZcjqEnKAA20lU0ti5C9YmosYu_-MAWyOu4';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function main() {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .not('content', 'is', null);

  if (error) {
    console.error('Error:', error.message);
    return;
  }

  const voiceMsgs = data.filter(m => m.content && m.content.includes('Голосовое'));
  console.log('Voice messages:', JSON.stringify(voiceMsgs, null, 2));

  const allWithAudio = data.filter(m => m.audio_id || m.audio_url);
  console.log('All messages with audio fields:', JSON.stringify(allWithAudio, null, 2));
}

main();
