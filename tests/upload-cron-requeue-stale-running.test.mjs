import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, it } from "node:test"

const read = path => readFileSync(join(process.cwd(), path), "utf8")

describe("upload cron requeues stale running job items", () => {
  it("resets orphaned running items back to pending so they are retried", () => {
    const route = read("app/api/cron/upload-to-facebook/route.ts")

    assert.match(route, /STALE_RUNNING_ITEM_MS/)
    assert.match(
      route,
      /\.from\("media_upload_job_items"\)\s*\n\s*\.update\(\{\s*status:\s*"pending"/,
    )
    assert.match(route, /\.eq\("status", "running"\)/)
    assert.match(route, /\.lt\("updated_at", staleBefore\)/)
    assert.match(route, /maxDuration\s*=\s*60/)
    assert.match(route, /5\s*\*\s*60\s*\*\s*1000/)
  })
})
