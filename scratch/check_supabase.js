import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

async function checkTables() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    console.error('Missing Supabase env vars')
    return
  }
  
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  )

  const { data, error } = await supabase
    .from('facebook_connections')
    .select('*')
    .limit(1)

  if (error) {
    console.error('Error fetching facebook_connections:', error)
  } else {
    console.log('Successfully connected to facebook_connections table')
    console.log('Data:', data)
  }
}

checkTables()
