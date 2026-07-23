// Shared Supabase boundary rules — see share/SHARED_SUPABASE_BOUNDARY.md.
// AdLauncher owns schema `ads_launcher` in shared project `vrnstjkxumaaduqswkji`.
// Creative Portal owns `creative_portal` in the same physical Postgres.

const PRODUCTION_PROJECT_REF = "vrnstjkxumaaduqswkji"
const ALLOWED_SCHEMA = "ads_launcher"

function refFromUrl(url: string): string | null {
  const m = url.match(/^https?:\/\/([a-z0-9]+)\.supabase\./i)
  return m ? m[1] : null
}

function isNonProduction(): boolean {
  return process.env.ALLOW_NON_PRODUCTION_SUPABASE === "yes"
}

/**
 * Reject runtime configs that violate the shared-database boundary.
 * Production refuses a URL outside the shared project and a schema other
 * than `ads_launcher`. Non-production override requires
 * ALLOW_NON_PRODUCTION_SUPABASE=yes.
 */
export function assertSupabaseBoundary(url: string, schema: string): void {
  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set")

  const ref = refFromUrl(url)
  if (!ref) {
    if (!isNonProduction()) {
      throw new Error(`Unrecognized Supabase URL: ${url}`)
    }
    return
  }

  const schemaOk = schema === ALLOWED_SCHEMA
  const projectOk = ref === PRODUCTION_PROJECT_REF

  // Cross-config: production project must use ads_launcher, non-production
  // project must NOT silently hit production with a foreign schema.
  if (projectOk && !schemaOk && !isNonProduction()) {
    throw new Error(
      `Production project requires schema "${ALLOWED_SCHEMA}", got "${schema}"`
    )
  }

  if (!projectOk && !isNonProduction()) {
    throw new Error(
      `Supabase URL ref "${ref}" is outside the production project "${PRODUCTION_PROJECT_REF}"`
    )
  }
}

export function resolveSchema(): string {
  return process.env.NEXT_PUBLIC_SUPABASE_DB_SCHEMA || ALLOWED_SCHEMA
}
