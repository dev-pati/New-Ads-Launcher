export interface OpportunityScoreResult {
  available: boolean
  score: number | null
  weight: number | null
  reason?: "no_read_connection" | "unsupported"
}

/** Meta has returned this field on both 0–1 and 0–100 scales. */
export function normalizeOpportunityScore(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null

  const numeric = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(numeric) || numeric < 0 || numeric > 100) return null

  // Preserve the exact value 1 as one point. Treating it as a ratio would turn
  // a legitimate 1/100 score into 100/100; only strict fractions are scaled.
  const normalized = numeric > 0 && numeric < 1 ? numeric * 100 : numeric
  return Math.min(100, Math.round(normalized))
}

export function normalizeOpportunityScoreWeight(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null

  const numeric = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(numeric) || numeric < 0) return null
  return Math.round(numeric)
}
