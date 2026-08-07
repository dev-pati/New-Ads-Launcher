/** The only two KR defects a user needs to record manually. */
export const FALLBACK_KINDS = ["launch", "control"] as const

export type FallbackKind = (typeof FALLBACK_KINDS)[number]

export function isFallbackKind(value: unknown): value is FallbackKind {
  return typeof value === "string" && FALLBACK_KINDS.includes(value as FallbackKind)
}

// Legacy localStorage shape. Kept only to read old browser data during this release.
export const FALLBACK_REASONS = ["launch", "review_status", "performance", "creative_aggregate", "data_accuracy", "other"] as const
export type FallbackReason = (typeof FALLBACK_REASONS)[number]
export const FALLBACK_LABEL = Object.fromEntries(FALLBACK_REASONS.map(reason => [reason, reason])) as Record<FallbackReason, string>
export const FALLBACK_HINT = Object.fromEntries(FALLBACK_REASONS.map(reason => [reason, ""])) as Record<FallbackReason, string>
