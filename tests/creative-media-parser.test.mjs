import assert from "assert"

// Copy from lib/creative-media.ts manually for isolated test execution
export function parseStoragePath(storagePath) {
  if (storagePath.startsWith("r2://")) {
    const parts = storagePath.slice(5).split("/")
    return {
      provider: "creative_media_r2",
      bucket: parts[0],
      key: parts.slice(1).join("/")
    }
  }
  return {
    provider: "legacy_supabase_ad_media",
    key: storagePath
  }
}

function runTests() {
  console.log("Running provider matrix tests...")
  let passed = 0

  // 1. Valid R2 locator
  const r2 = parseStoragePath("r2://pati-videos/ads-launcher/org-123/video.mp4")
  assert.strictEqual(r2.provider, "creative_media_r2")
  assert.strictEqual(r2.bucket, "pati-videos")
  assert.strictEqual(r2.key, "ads-launcher/org-123/video.mp4")
  passed++

  // 2. Portal approved R2 locator
  const r2app = parseStoragePath("r2://pati-videos/creative-portal/approved/file.mp4")
  assert.strictEqual(r2app.provider, "creative_media_r2")
  assert.strictEqual(r2app.bucket, "pati-videos")
  assert.strictEqual(r2app.key, "creative-portal/approved/file.mp4")
  passed++

  // 3. Legacy relative path
  const legacy = parseStoragePath("creatives/org-123/old-video.mp4")
  assert.strictEqual(legacy.provider, "legacy_supabase_ad_media")
  assert.strictEqual(legacy.key, "creatives/org-123/old-video.mp4")
  passed++

  console.log(`PASS: ${passed}/3 provider tests. Parser handles r2:// vs relative paths correctly.`)
}

runTests()
