import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ufihkyhvvqfusgavndmh.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVmaWhreWh2dnFmdXNnYXZuZG1oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIzMTMwMzAsImV4cCI6MjA5Nzg4OTAzMH0.QP_2pBEBHZcjqEnKAA20lU0ti5C9YmosYu_-MAWyOu4';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function searchTable(tableName, columns) {
  console.log(`Searching table ${tableName}...`);
  let query = supabase.from(tableName).select(columns.join(','));
  
  const { data, error } = await query;
  if (error) {
    console.error(`Error searching ${tableName}:`, error.message);
    return;
  }

  const matches = [];
  for (const row of data || []) {
    const rowStr = JSON.stringify(row);
    if (rowStr.includes('file_7.mp4') || 
        rowStr.includes('file_8.mp4') || 
        rowStr.includes('file_10.mp4') || 
        rowStr.includes('file_1.jpg') || 
        rowStr.includes('file_48.webm')) {
      matches.push(row);
    }
  }
  
  if (matches.length > 0) {
    console.log(`FOUND MATCHES in ${tableName}:`, JSON.stringify(matches, null, 2));
  } else {
    console.log(`No matches in ${tableName}`);
  }
}

async function main() {
  await searchTable('messages', ['id', 'content', 'image_url', 'audio_url', 'created_at']);
  await searchTable('posts', ['id', 'content', 'images', 'created_at']);
  await searchTable('stories', ['id', 'media_url', 'created_at']);
  await searchTable('profiles', ['id', 'avatar_url', 'full_name']);
}

main();
