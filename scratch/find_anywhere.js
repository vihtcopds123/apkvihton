import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ufihkyhvvqfusgavndmh.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVmaWhreWh2dnFmdXNnYXZuZG1oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIzMTMwMzAsImV4cCI6MjA5Nzg4OTAzMH0.QP_2pBEBHZcjqEnKAA20lU0ti5C9YmosYu_-MAWyOu4';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function main() {
  // Let's get a list of all tables we might have by querying a dummy query or using postgres schemas
  // Since we don't have direct access to pg_catalog via REST API easily without RPC, let's list the common tables:
  const tables = [
    'profiles',
    'messages',
    'conversations',
    'conversation_members',
    'posts',
    'comments',
    'stories',
    'user_gifts',
    'music_tracks',
    'member_tags',
    'chat_blocks_mutes',
    'notifications',
    'post_likes',
    'story_views',
    'bookmarks',
    'stickers',
    'sticker_packs'
  ];

  for (const table of tables) {
    try {
      const { data, error } = await supabase.from(table).select('*');
      if (error) {
        // Table might not exist, skip
        continue;
      }
      
      const matched = (data || []).filter(row => {
        const str = JSON.stringify(row);
        return str.includes('file_7.mp4') || 
               str.includes('file_8.mp4') || 
               str.includes('file_10.mp4') || 
               str.includes('file_1.jpg') || 
               str.includes('file_48.webm');
      });

      if (matched.length > 0) {
        console.log(`FOUND in table: ${table}`, JSON.stringify(matched, null, 2));
      }
    } catch (e) {
      // Ignore error
    }
  }
  console.log('Search complete.');
}

main();
