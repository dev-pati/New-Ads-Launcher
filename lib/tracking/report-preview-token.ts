import { createHash, createHmac, timingSafeEqual } from "node:crypto"
import type { WeeklyReportSnapshot } from "./weekly-report"

type PreviewClaims = {
  orgId: string
  userId: string
  digest: string
  expiresAt: number
}

function secret(): string {
  const value = process.env.CUSTOM_AUTH_SECRET || process.env.JWT_SECRET
  if (!value || value.length < 32) throw new Error("CUSTOM_AUTH_SECRET must be configured for report preview tokens.")
  return value
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
      .join(",")}}`
  }
  return JSON.stringify(value)
}

function digest(snapshot: WeeklyReportSnapshot, to: readonly string[], cc: string): string {
  return createHash("sha256").update(stableStringify({ snapshot, to, cc })).digest("base64url")
}

export function createPreviewToken(input: {
  snapshot: WeeklyReportSnapshot
  orgId: string
  userId: string
  to: readonly string[]
  cc: string
  now?: Date
}): string {
  const claims: PreviewClaims = {
    orgId: input.orgId,
    userId: input.userId,
    digest: digest(input.snapshot, input.to, input.cc),
    expiresAt: (input.now ?? new Date()).getTime() + 15 * 60_000,
  }
  const body = Buffer.from(JSON.stringify(claims)).toString("base64url")
  const signature = createHmac("sha256", secret()).update(body).digest("base64url")
  return `${body}.${signature}`
}

export function verifyPreviewToken(input: {
  token: string
  snapshot: WeeklyReportSnapshot
  orgId: string
  userId: string
  to: readonly string[]
  cc: string
  now?: Date
}): boolean {
  const [body, signature] = input.token.split(".")
  if (!body || !signature) return false
  const expected = createHmac("sha256", secret()).update(body).digest()
  const actual = Buffer.from(signature, "base64url")
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return false

  try {
    const claims = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as PreviewClaims
    return claims.orgId === input.orgId
      && claims.userId === input.userId
      && claims.expiresAt >= (input.now ?? new Date()).getTime()
      && claims.digest === digest(input.snapshot, input.to, input.cc)
  } catch {
    return false
  }
}
