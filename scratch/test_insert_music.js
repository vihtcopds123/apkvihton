import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const envFile = fs.readFileSync(path.join(__dirname, '../.env.local'), 'utf8')

const urlLine = envFile.split('\n').find(l => l.trim().startsWith('VITE_SUPABASE_URL='))
const keyLine = envFile.split('\n').find(l => l.trim().startsWith('VITE_SUPABASE_ANON_KEY='))

const url = urlLine ? urlLine.split('=')[1].trim().replace(/['"]/g, '') : ''
const key = keyLine ? keyLine.split('=')[1].trim().replace(/['"]/g, '') : ''

const supabase = createClient(url, key)

async function run() {
  const { data: profiles } = await supabase.from('profiles').select('id').limit(1)
  const profileId = profiles[0].id

  console.log("Testing insert into music_tracks for user:", profileId)
  const { data, error } = await supabase
    .from('music_tracks')
    .insert({
      user_id: profileId,
      title: 'Test Title',
      artist: 'Test Artist',
      duration: 120,
      file_url: 'https://example.com/test.mp3'
    })
    .select('*, profiles(full_name, avatar_url, username)')
    
  if (error) {
    console.error("Insert music_track error:", error)
  } else {
    console.log("Insert success:", data)
  }
}
run()
