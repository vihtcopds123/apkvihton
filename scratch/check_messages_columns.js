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
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .limit(1)

  if (error) {
    console.error("Error fetching message:", error)
  } else if (data && data.length > 0) {
    console.log("Message columns:", Object.keys(data[0]))
  } else {
    console.log("No messages found in DB to extract columns from, trying select info...")
  }
}
run()
