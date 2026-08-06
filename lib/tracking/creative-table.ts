/**
 * The Creative performance table's units and ordering.
 *
 * Split out of the page for one reason: these are the parts that can be *wrong* rather
 * than merely ugly. A spend column with no currency was read as dollars on a VND account
 * — a 25,000× misreading of the same digits — and a sort that quietly drops rows would be
 * invisible in a screenshot. Both are testable here; JSX is not.
 */

export type CreativeSortKey = "spend" | "roas" | "results" | "ctr" | "costPerResult"

export const CREATIVE_SORTS: Record<CreativeSortKey, { label: string }> = {
  spend:         { label: "Spend" },
  roas:          { label: "ROAS" },
  results:       { label: "Results" },
  ctr:           { label: "CTR" },
  costPerResult: { label: "Cost/Result" },
}

export const CREATIVE_SORT_KEYS = Object.keys(CREATIVE_SORTS) as CreativeSortKey[]

/**
 * Whether an ad row could be traced back to a Portal asset, and if not, where the chain
 * stopped. Defined here rather than in the route so the note map below cannot fall out of
 * sync with the statuses the API actually answers.
 */
export type CreativeMediaStatus =
  | "linked"
  | "no_media_key"
  | "not_in_adlauncher"
  | "not_from_portal"
  | "portal_missing"

/**
 * Four different facts, four different sentences. Collapsing them into "no metadata"
 * would hide that three of them are about where the ad came from and only one is about
 * Portal — and the reader's next action is different in each case.
 */
export const MEDIA_STATUS_NOTE: Record<Exclude<CreativeMediaStatus, "linked">, string> = {
  no_media_key: "This ad exposes no video id or image hash (carousel or catalog ad), so it cannot be matched to a stored asset.",
  not_in_adlauncher: "No creative in this org matches the asset Meta is running — this ad was most likely built outside AdLauncher.",
  not_from_portal: "This creative was uploaded directly, not assigned from Creative Portal, so there is no Portal metadata to show.",
  portal_missing: "Creative Portal no longer lists the asset this creative was assigned from.",
}

/**
 * Money with its unit, or a number that admits it has none.
 *
 * Meta reports spend in the ad account's own currency and nothing else on this screen
 * carries that fact. When the currency is unknown the number is still shown — hiding it
 * would be worse than showing it unlabelled, provided the table says so once.
 */
export function formatMoney(value: number, currency: string | null): string {
  if (!Number.isFinite(value)) return "—"
  if (!currency) return value.toLocaleString(undefined, { maximumFractionDigits: 0 })
  // Small amounts keep their cents; large ones do not need them. Zero-decimal currencies
  // (VND, JPY) are Intl's business, not this function's.
  return value.toLocaleString(undefined, { style: "currency", currency, maximumFractionDigits: value < 100 ? 2 : 0 })
}

/** Reorders the rows already fetched. Never filters: 20 in, 20 out. */
export function sortCreatives<T extends Record<CreativeSortKey, number>>(
  rows: T[],
  key: CreativeSortKey,
  direction: "asc" | "desc",
): T[] {
  const factor = direction === "asc" ? 1 : -1
  return [...rows].sort((left, right) => ((left[key] || 0) - (right[key] || 0)) * factor)
}
