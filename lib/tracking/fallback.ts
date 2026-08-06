/**
 * The moments AdLauncher sends someone back to Meta Ads Manager.
 *
 * Kept in one place because the reason list is a contract in three directions: the
 * CHECK constraint in the migration, the API validator, and the labels on the card.
 * When those drift, the counts stay plausible and stop being true.
 *
 * The events themselves are NOT stored here anymore — no `meta_fallback_events` table,
 * no route. `lib/tracking/fallback-local.ts` counts them from the reporting person's own
 * browser (localStorage) instead. This file only owns the reason vocabulary both sides share.
 */

export const FALLBACK_REASONS = ["launch", "review_status", "performance", "creative_aggregate", "data_accuracy", "other"] as const

export type FallbackReason = (typeof FALLBACK_REASONS)[number]

/** `launch` scores against KR1; the middle four are KR2's four lines, in the plan's order. */
export const FALLBACK_LABEL: Record<FallbackReason, string> = {
  launch: "Launch",
  review_status: "Review status",
  performance: "Performance ads",
  creative_aggregate: "Creative aggregate",
  data_accuracy: "Data accuracy",
  other: "Something else",
}

export const FALLBACK_HINT: Record<FallbackReason, string> = {
  launch: "Could not launch the ad here, so it was launched in Ads Manager.",
  review_status: "Had to check ad review / rejection state in Ads Manager.",
  performance: "Had to read performance numbers in Ads Manager.",
  creative_aggregate: "Needed creative results grouped across ads or campaigns.",
  data_accuracy: "The number here did not match Ads Manager, so Ads Manager decided.",
  other: "Anything else that could not be finished in this app.",
}
