import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'http://localhost:8000',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJzZXJ2aWNlX3JvbGUiLAogICAgImlzcyI6ICJzdXBhYmFzZS1kZW1vIiwKICAgICJpYXQiOiAxNjQxNzY5MjAwLAogICAgImV4cCI6IDE3OTk1MzU2MDAKfQ.DaYlNEoUrrEn2Ig7tqibS-PHK5vgusbcbo7X36XVt4Q'
)

async function test() {
  const { data, error } = await supabase
    .from('bookmarks')
    .select(`
      post_id,
      post:posts(
        *,
        author:profiles!posts_author_id_fkey(id, full_name, avatar_url, username, role),
        group:groups(id, name, avatar_url),
        repost_source:repost_source_id(
          *,
          author:profiles!posts_author_id_fkey(id, full_name, avatar_url, username, role),
          group:groups(id, name, avatar_url)
        ),
        poll:polls(
          id,
          question,
          options:poll_options(
            id,
            poll_id,
            text,
            votes_count
          )
        )
      )
    `)
    .eq('user_id', 'fee894db-c5b0-4022-bb9f-56c60decac86')

  if (error) {
    console.error('BOOKMARKS QUERY ERROR:', error)
  } else {
    console.log('SUCCESS BOOKMARKS:', JSON.stringify(data, null, 2))
  }
}

test()
