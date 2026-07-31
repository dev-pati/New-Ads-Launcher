import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"

const read = path => readFileSync(join(process.cwd(), path), "utf8")

describe("Launch history realtime contract", () => {
  it("publishes launch_batches and lets org members select rows", () => {
    const migration = read("supabase/migrations/20260731_enable_launch_batches_realtime.sql")

    assert.match(migration, /supabase_realtime/)
    assert.match(migration, /launch_batches/)
    assert.match(migration, /for select/i)
    assert.match(migration, /is_org_member\(org_id\)/)
  })

  it("authenticates and filters the shared subscription by org", () => {
    const hook = read("hooks/use-launch-batches-realtime.ts")
    const client = read("lib/supabase/client.ts")

    assert.match(client, /getClientToken/)
    assert.match(hook, /realtime\.setAuth/)
    assert.match(hook, /postgres_changes/)
    assert.match(hook, /schema: "ads_launcher"/)
    assert.match(hook, /table: "launch_batches"/)
    assert.match(hook, /filter: `org_id=eq\.\$\{activeOrgId\}`/)
    assert.match(hook, /removeChannel/)
  })

  it("refreshes both Launch and Ads Manager consumers", () => {
    const launch = read("app/(dashboard)/launch/page.tsx")
    const adsManager = read("app/(dashboard)/ads-manager/page.tsx")

    assert.match(launch, /useLaunchBatchesRealtime\(load\)/)
    assert.match(adsManager, /useLaunchBatchesRealtime/)
    assert.match(adsManager, /fetchHistory/)
    assert.match(adsManager, /fetchMainData\(true\)/)
  })
})
