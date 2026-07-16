import { createHmac, timingSafeEqual } from "crypto"

const VERSION = "v1"
const DEFAULT_TTL_SECONDS = 60 * 60 * 24 // 24h

type ApprovalAction = "approve" | "reject"

type ApprovalTokenPayload = {
  approvalId: string
  executionId: string
  action: ApprovalAction
  exp: number
}

function secret() {
  const raw = process.env.APPROVAL_TOKEN_SECRET || process.env.CUSTOM_AUTH_SECRET || process.env.JWT_SECRET
  if (!raw) throw new Error("APPROVAL_TOKEN_SECRET (or CUSTOM_AUTH_SECRET) is required")
  return raw
}

function b64url(input: string) {
  return Buffer.from(input, "utf8").toString("base64url")
}

function unb64url(input: string) {
  return Buffer.from(input, "base64url").toString("utf8")
}

function sign(body: string) {
  return createHmac("sha256", secret()).update(body).digest("base64url")
}

export function createApprovalToken(params: {
  approvalId: string
  executionId: string
  action: ApprovalAction
  ttlSeconds?: number
}) {
  const payload: ApprovalTokenPayload = {
    approvalId: params.approvalId,
    executionId: params.executionId,
    action: params.action,
    exp: Math.floor(Date.now() / 1000) + (params.ttlSeconds ?? DEFAULT_TTL_SECONDS),
  }
  const body = b64url(JSON.stringify(payload))
  return `${VERSION}.${body}.${sign(`${VERSION}.${body}`)}`
}

export function verifyApprovalToken(
  token: string | null | undefined,
  expected: { executionId: string; action: ApprovalAction }
): ApprovalTokenPayload | null {
  if (!token) return null
  const [version, body, mac] = token.split(".")
  if (version !== VERSION || !body || !mac) return null
  const expectedMac = sign(`${version}.${body}`)
  const a = Buffer.from(mac)
  const b = Buffer.from(expectedMac)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  try {
    const payload = JSON.parse(unb64url(body)) as ApprovalTokenPayload
    if (payload.executionId !== expected.executionId) return null
    if (payload.action !== expected.action) return null
    if (payload.exp < Math.floor(Date.now() / 1000)) return null
    return payload
  } catch {
    return null
  }
}
