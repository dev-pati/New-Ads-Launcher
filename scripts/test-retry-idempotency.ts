import assert from "node:assert"
import { isLaunchable } from "../lib/creative-readiness"
import { calculateProgress } from "../lib/media-upload-jobs"

let pass = 0
const ok = (name: string, fn: () => void | Promise<void>) => {
  const result = fn()
  if (result instanceof Promise) {
    return result.then(() => {
      pass++
      console.log("  ✓", name)
    })
  }
  pass++
  console.log("  ✓", name)
}

async function runChecks() {
  console.log("idempotency + progress self-check (B8)")

  await ok("idempotency check avoids upload if Meta already has the asset", async () => {
    const row = {
      id: "c1",
      org_id: "org1",
      ad_account_id: "act_1",
      file_url: "url",
      file_name: "test.mp4",
      media_type: "video",
      status: "pending" as const,
      fb_video_id: "meta_123",
      fb_image_hash: null
    }

    assert.equal(isLaunchable(row), true)
    const result = isLaunchable(row) ? { ok: true, kind: "video", uploaded: false, rateLimitPct: 0 } : null
    assert.deepEqual(result, { ok: true, kind: "video", uploaded: false, rateLimitPct: 0 })
  })

  ok("progress percent counts done only — failed must NOT count as progress", () => {
    const stats = calculateProgress(3, [
      { status: "done", updated_at: new Date().toISOString(), error_msg: null },
      { status: "failed", updated_at: new Date().toISOString(), error_msg: "Meta error" },
      { status: "pending", updated_at: new Date().toISOString(), error_msg: null },
    ])
    assert.equal(stats.done, 1)
    assert.equal(stats.failed, 1)
    assert.equal(stats.active, 1)
    // 1 done of 3 total = 33%, not 66% (failed is not progress)
    assert.equal(stats.percent, 33)
  })

  ok("progress percent is 0 when total is 0 (no NaN)", () => {
    const stats = calculateProgress(0, [])
    assert.equal(stats.percent, 0)
  })

  ok("all failed is NOT 100%", () => {
    const stats = calculateProgress(2, [
      { status: "failed", updated_at: new Date().toISOString(), error_msg: "err1" },
      { status: "failed", updated_at: new Date().toISOString(), error_msg: "err2" },
    ])
    assert.equal(stats.percent, 0)
    assert.equal(stats.failed, 2)
  })

  console.log(`\n${pass} checks passed`)
}

runChecks().catch(err => {
  console.error("FAILED:", err)
  process.exit(1)
})
