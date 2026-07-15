import { createCipheriv, createDecipheriv, randomBytes, createHash } from "crypto"

/**
 * App-layer AES-256-GCM for secret-at-rest columns.
 * Format: enc:v1:<ivHex>:<tagHex>:<cipherHex>
 * decrypt() is backward-compatible with plaintext values.
 */
const PREFIX = "enc:v1:"

function keyFromEnv(): Buffer {
  const raw =
    process.env.DB_ENCRYPTION_KEY ||
    process.env.CUSTOM_AUTH_SECRET ||
    process.env.JWT_SECRET
  if (!raw) {
    throw new Error("DB_ENCRYPTION_KEY (or CUSTOM_AUTH_SECRET) is required for secret encryption")
  }
  // Accept 64-hex (32 bytes) or arbitrary passphrase → SHA-256
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

// Self-check (node -e "require('./lib/crypto')") — skipped in edge; only for node runtime.
if (process.env.NODE_ENV !== "production" && process.env.RUN_CRYPTO_SELFCHECK === "1") {
  const sample = "tok_test_123"
  const enc = encryptSecret(sample)!
  const dec = decryptSecret(enc)
  if (dec !== sample) throw new Error("crypto self-check failed")
  if (decryptSecret("legacy-plain") !== "legacy-plain") throw new Error("plaintext fallback failed")
}
