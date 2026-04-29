import { createClient } from '@supabase/supabase-js'

/**
 * Admin Supabase client using service_role key.
 * Bypasses RLS — use only in server-side API routes.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set')
  }

  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false },
  })
}
