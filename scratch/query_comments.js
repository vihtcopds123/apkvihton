import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ufihkyhvvqfusgavndmh.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVmaWhreWh2dnFmdXNnYXZuZG1oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIzMTMwMzAsImV4cCI6MjA5Nzg4OTAzMH0.QP_2pBEBHZcjqEnKAA20lU0ti5C9YmosYu_-MAWyOu4';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function main() {
  const { data: comments, error } = await supabase.from('comments').select('*');
  if (error) {
    console.error('Comments query error:', error.message);
    return;
  }
  
  console.log(`Total comments: ${comments?.length || 0}`);
  
  const matched = (comments || []).filter(c => {
    const rowStr = JSON.stringify(c);
    return rowStr.includes('file_7.mp4') || 
           rowStr.includes('file_8.mp4') || 
           rowStr.includes('file_10.mp4') || 
           rowStr.includes('file_1.jpg') || 
           rowStr.includes('file_48.webm');
  });

  console.log('Matched Comments:', JSON.stringify(matched, null, 2));
}

main();
