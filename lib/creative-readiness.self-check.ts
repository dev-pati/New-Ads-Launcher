// ponytail: runnable self-check for creative-readiness invariant logic.
// Run: npx tsx lib/creative-readiness.self-check.ts
import assert from "node:assert"
import {
  isLaunchable,
  assertLaunchable,
  CreativeNotReadyError,
  assertCanMarkUploaded,
  CREATIVE_STATUS,
} from "./creative-readiness"
import type { LaunchableCreative } from "./creative-readiness"

let pass = 0
const ok = (name: string, fn: () => void) => {
  fn()
  pass++
  console.log("  ✓", name)
}

const mk = (over: Partial<LaunchableCreative> = {}): LaunchableCreative => ({
  id: "c1",
  file_name: "x.jpg",
  status: "ready",
  fb_image_hash: null,
  fb_video_id: null,
  ...over,
})

console.log("creative-readiness self-check")

ok("launchable iff image hash present", () => {
  assert.equal(isLaunchable(mk({ fb_image_hash: "h1" })), true)
  assert.equal(isLaunchable(mk({ fb_image_hash: null })), false)
})

ok("launchable iff video id present", () => {
  assert.equal(isLaunchable(mk({ fb_video_id: "v1" })), true)
  assert.equal(isLaunchable(mk({ fb_video_id: null })), false)
})

ok("status alone does not make launchable (TD-30 guard)", () => {
  assert.equal(isLaunchable(mk({ status: "ready", fb_image_hash: null, fb_video_id: null })), false)
})

ok("assertLaunchable throws CreativeNotReadyError when no asset", () => {
  assert.throws(
    () => assertLaunchable(mk({ fb_image_hash: null, fb_video_id: null })),
    (e: unknown) => e instanceof CreativeNotReadyError,
  )
})

ok("assertCanMarkUploaded rejects ready/error", () => {
  assert.throws(() => assertCanMarkUploaded(CREATIVE_STATUS.READY), Error)
  assert.throws(() => assertCanMarkUploaded(CREATIVE_STATUS.ERROR), Error)
  assert.doesNotThrow(() => assertCanMarkUploaded(CREATIVE_STATUS.PENDING))
  assert.doesNotThrow(() => assertCanMarkUploaded(CREATIVE_STATUS.PROCESSING))
})

console.log(`\n${pass} checks passed`)
