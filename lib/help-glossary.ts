export type GlossaryEntry = {
  key: string
  term: string
  tooltip: string
  explanation: string
  where: string
  gotchas?: string[]
  related?: string[]
}

export const HELP_GLOSSARY: GlossaryEntry[] = [
  {
    key: "mto",
    term: "MTO (Multi-Text Optimization)",
    tooltip: "Meta tests multiple text variations across standard ads, not Dynamic Creative.",
    explanation:
      "MTO lets you submit several text variations for a standard ad set (N distinct ads). Meta rotates and optimizes delivery across them automatically. It is different from Dynamic Creative, which recombines multiple assets into ad permutations and requires a separate opt-in.",
    where: "Launch flow, ad set creation, template editor",
    gotchas: [
      "Sending degrees_of_freedom_spec converts the ad set to Dynamic Creative, a different product. Omit it to stay on MTO.",
    ],
    related: ["via-launch"],
  },
  {
    key: "via-launch",
    term: "Via LAUNCH",
    tooltip: "The one write-capable connection Meta allows per ad account for creating ads.",
    explanation:
      "Via LAUNCH covers every write action to Meta: creating campaigns, ad sets, and ads. Only one Via LAUNCH connection is allowed per ad account at a time.",
    where: "Connections page, Launch flow",
    related: ["via-non-launch"],
  },
  {
    key: "via-non-launch",
    term: "Via NON-LAUNCH",
    tooltip: "The read-only connection Meta allows per ad account for insights and reporting.",
    explanation:
      "Via NON-LAUNCH covers every read action from Meta: pulling insights, account status, and reporting data. Max one per ad account, separate from Via LAUNCH.",
    where: "Connections page, Insights",
    related: ["via-launch"],
  },
  {
    key: "creative-readiness",
    term: "Creative readiness",
    tooltip: "A creative is launch-ready once Meta has the asset (image hash or video ID).",
    explanation:
      "Creative readiness is the test for whether a creative can be launched: an image needs fb_image_hash, a video needs fb_video_id populated by Meta. Launch routes check this directly rather than relying on status alone.",
    where: "Launch flow, Assets, Upload Queue",
    related: ["upload-queue"],
  },
  {
    key: "upload-queue",
    term: "Upload Queue",
    tooltip: "The background scheduler that uploads creatives to Meta after a Media Assign batch.",
    explanation:
      "The Upload Queue leases and retries creative uploads to Meta in batches. Its progress counter reflects operational batch state, not per-item upload percentage.",
    where: "Assets, Media Assign",
    related: ["creative-readiness"],
  },
  {
    key: "portal-media-item",
    term: "Portal media item",
    tooltip: "AdLauncher's tracking record for one Creative Portal-approved asset.",
    explanation:
      "A Portal media item tracks a Portal-approved asset through pending, mapped, and imported states. It is not the asset itself and not the eventual creative.",
    where: "Assets, Creative Portal sync",
  },
]

export function getGlossaryEntry(key: string) {
  return HELP_GLOSSARY.find((e) => e.key === key)
}
