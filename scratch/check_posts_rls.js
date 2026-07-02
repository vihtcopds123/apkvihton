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
  const { data, error } = await supabase.rpc('get_policies', { table_name: 'posts' })
  if (error) {
    // Если RPC нет, сделаем запрос к pg_policies через кастомный SQL или RPC
    console.log("Error calling get_policies RPC, trying direct SQL run...")
    const { data: policies, error: sqlError } = await supabase
      .from('pg_policies')
      .select('*')
      .eq('tablename', 'posts')
    if (sqlError) {
      console.error("Failed to query policies:", sqlError)
    } else {
      console.log("Policies:", policies)
    }
  } else {
    console.log("Policies:", data)
  }
}
run()
