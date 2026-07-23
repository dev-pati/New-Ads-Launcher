import { createClient } from '@supabase/supabase-js'
import { assertSupabaseBoundary, resolveSchema } from './boundary'

/**
 * Admin Supabase client using service_role key.
 * Bypasses RLS — use only in server-side API routes.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  const schema = resolveSchema()

  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set')
  }

  assertSupabaseBoundary(url, schema)

  const cfHeaders: Record<string, string> = {}
  const cfId = process.env.CF_ACCESS_CLIENT_ID
  const cfSecret = process.env.CF_ACCESS_CLIENT_SECRET
  if (cfId) cfHeaders["CF-Access-Client-Id"] = cfId
  if (cfSecret) cfHeaders["CF-Access-Client-Secret"] = cfSecret

  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false },
    db: { schema },
    global: Object.keys(cfHeaders).length ? { headers: cfHeaders } : undefined,
  })
}
