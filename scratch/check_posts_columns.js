import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const envFile = fs.readFileSync(path.join(__dirname, '../.env.local'), 'utf8')

const urlLine = envFile.split('\n').find(l => l.trim().startsWith('VITE_SUPABASE_URL='))
const keyLine = envFile.split('\n').find(l => l.trim().startsWith('VITE_SUPABASE_ANON_KEY='))

const url = urlLine ? urlLine.split('=')[1].trim() : ''
const key = keyLine ? keyLine.split('=')[1].trim() : ''

const supabase = createClient(url, key)

async function run() {
  const { data, error } = await supabase
    .from('post_likes')
    .select('*')
    .limit(1)

  if (error) {
    console.log("Error:", error.message)
  } else {
    console.log("Likes record columns:", Object.keys(data[0] || {}))
  }
}
run()
