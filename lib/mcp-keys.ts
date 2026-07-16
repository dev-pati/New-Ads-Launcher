import { createHash, randomBytes } from "crypto"

/**
 * MCP API keys.
 *
 * Storage model:
 *   - api_key_prefix : first 10 chars, e.g. "al_abc123" — shown in UI to identify a key
 *   - api_key_hash   : sha256 hex of the full key — used for lookup at request time
 *
 * The full plaintext is returned to the caller exactly ONCE at creation.
 * It is never persisted in a recoverable form.
 */

const PREFIX = "al_"

export function generateMcpApiKey(): string {
  const body = randomBytes(20).toString("hex") // 40 hex chars
  return `${PREFIX}${body}`
}

export function hashMcpApiKey(plain: string): string {
  return createHash("sha256").update(plain).digest("hex")
}

export function keyPrefix(plain: string): string {
  return plain.slice(0, 10)
}
