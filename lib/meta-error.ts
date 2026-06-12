export type MetaErrorPayload = {
  error: string
  code?: number
  subcode?: number
  type?: "permission" | "token" | "object_unavailable" | "rate_limit" | "unknown"
  needsReconnect?: boolean
  needsPermission?: string
  pageId?: string
  rawMessage?: string
}

export function normalizeMetaError(input: any, fallback = "Meta API request failed.", context?: { pageId?: string; permission?: string }): MetaErrorPayload {
  const meta = input?.error || input || {}
  const rawMessage = String(meta.message || input?.message || fallback)
  const lower = rawMessage.toLowerCase()
  const code = Number(meta.code || input?.code || 0) || undefined
  const subcode = Number(meta.error_subcode || meta.subcode || input?.subcode || 0) || undefined

  if (lower.includes("request limit") || lower.includes("rate limit") || lower.includes("too many calls") || [4, 17, 32, 613].includes(code || 0)) {
    return {
      error: "Facebook API rate limit reached. Wait a few minutes and try again.",
      code,
      subcode,
      type: "rate_limit",
      pageId: context?.pageId,
      rawMessage,
    }
  }

  if (lower.includes("expired") || lower.includes("invalid oauth") || lower.includes("session") || lower.includes("revoked") || code === 190) {
    return {
      error: "Facebook token expired or was revoked. Reconnect Facebook and select the Page again.",
      code,
      subcode,
      type: "token",
      needsReconnect: true,
      pageId: context?.pageId,
      rawMessage,
    }
  }

  if (lower.includes("unsupported get request") || lower.includes("does not exist") || lower.includes("cannot be loaded")) {
    return {
      error: "Selected Facebook Page is not accessible with the current Page token. Reconnect Facebook, refresh the Page list, then select this Page again.",
      code,
      subcode,
      type: "object_unavailable",
      needsReconnect: true,
      pageId: context?.pageId,
      rawMessage,
    }
  }

  if (lower.includes("permission") || lower.includes("scope") || lower.includes("pages_") || code === 10 || code === 200) {
    return {
      error: context?.permission
        ? `Facebook permission required: ${context.permission}. Reconnect Facebook with this permission, or complete App Review for live users.`
        : "Facebook permission is missing for this operation.",
      code,
      subcode,
      type: "permission",
      needsPermission: context?.permission,
      pageId: context?.pageId,
      rawMessage,
    }
  }

  return {
    error: rawMessage,
    code,
    subcode,
    type: "unknown",
    pageId: context?.pageId,
    rawMessage,
  }
}
