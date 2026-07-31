/**
 * `[APP]_` provenance marker on every ad name the app sends to Meta.
 *
 * Why this exists: an ad in Ads Manager carries no record of which tool created
 * it. Without a marker there is no way to tell an ad launched through AdLauncher
 * from one built by hand — which makes "did the app replace Ads Manager?"
 * unanswerable, and makes app numbers unverifiable against Meta.
 *
 * Applied at the single chokepoint `createAd()` in lib/facebook.ts, so it covers
 * all three launch routes and the automation engine. An automation-created ad is
 * still an app-created ad and is marked as such.
 *
 * Set AD_NAME_PREFIX="" to turn the marker off without a code change.
 */

const DEFAULT_AD_NAME_PREFIX = "[APP]_"

/** The configured marker. Empty string disables prefixing entirely. */
export function getAdNamePrefix(): string {
  const raw = process.env.AD_NAME_PREFIX
  return raw === undefined ? DEFAULT_AD_NAME_PREFIX : raw
}

/**
 * Prefix an ad name with the provenance marker.
 *
 * Idempotent — a name that already carries the marker is returned unchanged, so
 * retries, duplicated ads and re-launches can never produce `[APP]_[APP]_`.
 * Blank names are left alone; Meta rejects them and that error should surface as
 * itself, not as a name that is only a prefix.
 */
export function withAppPrefix(name: string): string {
  const prefix = getAdNamePrefix()
  if (!prefix) return name
  if (!name || !name.trim()) return name
  if (name.startsWith(prefix)) return name
  return `${prefix}${name}`
}

/** True when an ad name carries the marker — i.e. the app created it. */
export function hasAppPrefix(name: string | null | undefined): boolean {
  const prefix = getAdNamePrefix()
  if (!prefix) return false
  return !!name && name.startsWith(prefix)
}
