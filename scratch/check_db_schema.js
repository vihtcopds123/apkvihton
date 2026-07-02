import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const envFile = fs.readFileSync(path.join(__dirname, '../.env.local'), 'utf8')

const urlLine = envFile.split('\n').find(l => l.startsWith('VITE_SUPABASE_URL='))
const keyLine = envFile.split('\n').find(l => l.startsWith('VITE_SUPABASE_ANON_KEY='))

const url = urlLine ? urlLine.split('=')[1].trim() : ''
const key = keyLine ? keyLine.split('=')[1].trim() : ''

const supabase = createClient(url, key)

async function run() {
  // Выберем последние сообщения, у которых есть gift_id
  const { data, error } = await supabase
    .from('messages')
    .select('*, audio:music_tracks(*), gift:user_gifts(*)')
    .not('gift_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(3)

  if (error) {
    console.log("Error fetching messages with gifts:", error.message)
  } else {
    console.log("Messages with gifts:", JSON.stringify(data, null, 2))
  }
}
run()
