import { createCipheriv, createDecipheriv, randomBytes, createHash } from "crypto"

/**
 * App-layer AES-256-GCM for secret-at-rest columns.
 * Format: enc:v1:<ivHex>:<tagHex>:<cipherHex>
 * decrypt() is backward-compatible with plaintext values.
 */
const PREFIX = "enc:v1:"

function keyFromEnv(): Buffer {
  const dedicated = process.env.DB_ENCRYPTION_KEY
  if (dedicated) {
    if (/^[0-9a-fA-F]{64}$/.test(dedicated)) return Buffer.from(dedicated, "hex")
    // Allow non-hex only outside production
    if (process.env.NODE_ENV === "production") {
      throw new Error("DB_ENCRYPTION_KEY must be 64 hex chars (32 bytes) in production")
    }
    return createHash("sha256").update(dedicated).digest()
  }

  // Production: dedicated key is required — never fall back to auth secrets.
  if (process.env.NODE_ENV === "production") {
    throw new Error("DB_ENCRYPTION_KEY is required in production for secret encryption")
  }

  // Dev fallback only
  const raw = process.env.CUSTOM_AUTH_SECRET || process.env.JWT_SECRET
  if (!raw) {
    throw new Error("DB_ENCRYPTION_KEY (or CUSTOM_AUTH_SECRET in dev) is required for secret encryption")
  }
  if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, "hex")
  return createHash("sha256").update(raw).digest()
}

export function isEncrypted(value: string | null | undefined): boolean {
  return typeof value === "string" && value.startsWith(PREFIX)
}

export function encryptSecret(plaintext: string | null | undefined): string | null {
  if (plaintext == null || plaintext === "") return plaintext ?? null
  if (isEncrypted(plaintext)) return plaintext
  const key = keyFromEnv()
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${PREFIX}${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`
}

export function decryptSecret(value: string | null | undefined): string | null {
  if (value == null || value === "") return value ?? null
  if (!isEncrypted(value)) return value // legacy plaintext
  const body = value.slice(PREFIX.length)
  const [ivHex, tagHex, dataHex] = body.split(":")
  if (!ivHex || !tagHex || !dataHex) {
    throw new Error("Invalid encrypted secret format")
  }
  const key = keyFromEnv()
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivHex, "hex"))
  decipher.setAuthTag(Buffer.from(tagHex, "hex"))
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataHex, "hex")),
    decipher.final(),
  ])
  return decrypted.toString("utf8")
}

// Self-check — opt-in only.
if (process.env.NODE_ENV !== "production" && process.env.RUN_CRYPTO_SELFCHECK === "1") {
  const sample = "tok_test_123"
  const enc = encryptSecret(sample)!
  const dec = decryptSecret(enc)
  if (dec !== sample) throw new Error("crypto self-check failed")
  if (decryptSecret("legacy-plain") !== "legacy-plain") throw new Error("plaintext fallback failed")
}
