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
  // Попробуем сделать insert в messages
  // Для теста возьмем любой conversation_id
  const { data: convs } = await supabase.from('conversations').select('id').limit(1)
  if (!convs || convs.length === 0) {
    console.log("No conversations found to test insert")
    return
  }
  const convId = convs[0].id

  const { data: profiles } = await supabase.from('profiles').select('id').limit(1)
  const profileId = profiles[0].id

  console.log("Testing insert into messages table for conv:", convId, "sender:", profileId)
  const { data, error } = await supabase
    .from('messages')
    .insert({
      conversation_id: convId,
      sender_id: profileId,
      content: JSON.stringify({ type: 'channel_forward', channelName: 'TestChannel' })
    })
    .select()
    
  if (error) {
    console.error("Insert error:", error)
  } else {
    console.log("Insert success, returned data:", data)
  }
}
run()
