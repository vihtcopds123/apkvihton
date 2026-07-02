import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://ufihkyhvvqfusgavndmh.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVmaWhreWh2dnFmdXNnYXZuZG1oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIzMTMwMzAsImV4cCI6MjA5Nzg4OTAzMH0.QP_2pBEBHZcjqEnKAA20lU0ti5C9YmosYu_-MAWyOu4'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function test() {
  console.log('Testing profile search...')
  const { data: usersData, error: err1 } = await supabase
    .from('profiles')
    .select('id, full_name, avatar_url, username, role')
    .or(`full_name.ilike.%Andrey%,username.ilike.%Andrey%`)
    .limit(5)

  if (err1) {
    console.error('PROFILES SEARCH ERROR:', err1)
  } else {
    console.log('PROFILES SEARCH SUCCESS:', usersData)
  }

  console.log('Testing posts search...')
  const { data: postsData, error: err2 } = await supabase
    .from('posts')
    .select('id, content, author:profiles!posts_author_id_fkey(full_name)')
    .ilike('content', `%Andrey%`)
    .limit(5)

  if (err2) {
    console.error('POSTS SEARCH ERROR:', err2)
  } else {
    console.log('POSTS SEARCH SUCCESS:', postsData)
  }
}

test()
