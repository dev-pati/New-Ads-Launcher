/**
 * One-shot migration: encrypt existing plaintext secret columns at rest.
 *
 * Run ONCE after deploying the lib/crypto.ts integration:
 *   node --env-file=.env scripts/migrate-encrypt-secrets.mjs
 *   CUSTOM_AUTH_SECRET=... node scripts/migrate-encrypt-secrets.mjs   # if no --env-file
 *
 * Idempotent: skips rows whose value already starts with "enc:v1:".
 * DRY_RUN=1 prints what would change without writing.
 *
 * pon​ytail: this is a raw-loop migration; not a reusable runtime path.
 * Remove the file after verifying the live migration report.
 */
import { createClient } from "@supabase/supabase-js"
import { createCipheriv, randomBytes, createHash } from "node:crypto"

const PREFIX = "enc:v1:"

function key() {
  const raw = process.env.DB_ENCRYPTION_KEY || process.env.CUSTOM_AUTH_SECRET || process.env.JWT_SECRET
  if (!raw) throw new Error("Set DB_ENCRYPTION_KEY / CUSTOM_AUTH_SECRET before running")
  if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, "hex")
  return createHash("sha256").update(raw).digest()
}

function encrypt(plaintext) {
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", key(), iv)
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${PREFIX}${iv.toString("hex")}:${tag.toString("hex")}:${enc.toString("hex")}`
}

function isEnc(v) {
  return typeof v === "string" && v.startsWith(PREFIX)
}

const DRY = process.env.DRY_RUN === "1"

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const schema = process.env.NEXT_PUBLIC_SUPABASE_DB_SCHEMA || "ads_launcher"
if (!url || !serviceKey) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required")

const supabase = createClient(url, serviceKey, { db: { schema } })

// table → { pk, columns: [{ name, allowEmpty }] }
const TARGETS = [
  { table: "facebook_connections", pk: "id", columns: ["access_token"] },
  { table: "google_connections", pk: "org_id", columns: ["access_token", "refresh_token"] },
  { table: "pages", pk: "id", columns: ["page_access_token"] },
  { table: "org_ai_keys", pk: "org_id", columns: ["gemini_api_key", "openai_api_key"] },
  { table: "meta_accounts", pk: "id", columns: ["access_token_encrypted"] },
  { table: "meta_pages", pk: "id", columns: ["access_token_encrypted"] },
]

let scanned = 0, changed = 0, skipped = 0, failed = 0

for (const target of TARGETS) {
  const { table, pk, columns } = target
  let page = 0
  const pageSize = 500
  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select(`${pk}, ${columns.join(", ")}`)
      .range(page * pageSize, page * pageSize + pageSize - 1)
    if (error) {
      if (error.code === "42P01" || error.code === "PGRST205") {
        console.log(`[skip] table ${table} not found (${error.code})`)
        break
      }
      console.error(`[error] ${table}:`, error.message)
      break
    }
    if (!data || data.length === 0) break

    for (const row of data) {
      scanned++
      const patch = {}
      let dirty = false
      for (const col of columns) {
        const v = row[col]
        if (v == null || v === "" || isEnc(v)) { skipped++; continue }
        patch[col] = encrypt(v)
        dirty = true
      }
      if (!dirty) continue
      changed++
      if (DRY) {
        console.log(`[dry] ${table} ${pk}=${row[pk]} → encrypt ${Object.keys(patch).join(", ")}`)
        continue
      }
      const { error: upErr } = await supabase.from(table).update(patch).eq(pk, row[pk])
      if (upErr) { failed++; console.error(`[fail] ${table} ${pk}=${row[pk]}:`, upErr.message) }
    }

    if (data.length < pageSize) break
    page++
  }
}

console.log(`\nDone. scanned=${scanned} changed=${changed} skipped(already/null)=${skipped} failed=${failed}${DRY ? " (DRY_RUN)" : ""}`)
if (failed > 0) process.exit(1)
