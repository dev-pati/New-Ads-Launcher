import assert from "node:assert/strict"
import { describe, it, beforeEach, afterEach } from "node:test"
import { deleteMediaObject } from "../lib/media-delete.ts"

const ORG = "org-123"
const ACTOR = "user-456"
const VALID_ASSET_ID = "48d7e0e2-597f-4ffe-91d0-72882260dabb"

type FetchCall = { url: string; method: string }

function makeSupabaseStub() {
  const removed: { bucket: string; paths: string[] }[] = []
  return {
    supabase: {
      storage: {
        from(bucket: string) {
          return {
            async remove(paths: string[]) {
              removed.push({ bucket, paths })
            },
          }
        },
      },
    },
    removed,
  }
}

describe("deleteMediaObject R2 dual-contract", () => {
  let originalFetch: typeof globalThis.fetch
  let fetchCalls: FetchCall[]
  let fetchMock: (url: string, init?: RequestInit) => Promise<Response>

  beforeEach(() => {
    originalFetch = globalThis.fetch
    fetchCalls = []
    fetchMock = async (url: string, init?: RequestInit): Promise<Response> => {
      fetchCalls.push({ url, method: init?.method ?? "GET" })
      return new Response(JSON.stringify({ ok: true }), { status: 200 })
    }
    globalThis.fetch = fetchMock as typeof globalThis.fetch
    process.env.ADS_MEDIA_API_TOKEN = "test-token"
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    delete process.env.ADS_MEDIA_API_TOKEN
  })

  it("legacy non-R2 path calls Supabase ad-media remove and does not fetch", async () => {
    const { supabase, removed } = makeSupabaseStub()
    const outcome = await deleteMediaObject("creatives/org-123/old.mp4", ORG, ACTOR, supabase)

    assert.equal(outcome.ok, true)
    assert.equal(fetchCalls.length, 0, "no brokered fetch for legacy path")
    assert.equal(removed.length, 1)
    assert.equal(removed[0].bucket, "ad-media")
    assert.deepEqual(removed[0].paths, ["creatives/org-123/old.mp4"])
  })

  it("Portal-owned approved asset unlinks only: no fetch, no Supabase remove", async () => {
    const { supabase, removed } = makeSupabaseStub()
    const outcome = await deleteMediaObject(
      "r2://pati-videos/creative-portal/approved/southedc/2026/08/august.mp4",
      ORG,
      ACTOR,
      supabase,
    )

    assert.equal(outcome.ok, true)
    assert.equal(fetchCalls.length, 0, "must NOT call brokered DELETE on Portal-owned bytes")
    assert.equal(removed.length, 0, "must NOT call Supabase remove on Portal-owned bytes")
  })

  it("AdLauncher-owned asset brokers DELETE to Portal and only removes the row on success", async () => {
    const { supabase, removed } = makeSupabaseStub()
    const storagePath = `r2://pati-videos/ads-launcher/${ORG}/creatives/${VALID_ASSET_ID}/video.mp4`
    const outcome = await deleteMediaObject(storagePath, ORG, ACTOR, supabase)

    assert.equal(outcome.ok, true)
    assert.equal(fetchCalls.length, 1)
    assert.equal(fetchCalls[0].method, "DELETE")
    assert.match(fetchCalls[0].url, new RegExp(`/media/assets/${VALID_ASSET_ID}$`))
    assert.equal(removed.length, 0, "AdLauncher-owned R2 bytes are broker-deleted via Portal, not via Supabase remove")
  })

  it("foreign R2 prefix is rejected fail-closed: no fetch, no remove", async () => {
    const { supabase, removed } = makeSupabaseStub()
    const outcome = await deleteMediaObject(
      `r2://pati-videos/ads-launcher/other-org/creatives/${VALID_ASSET_ID}/video.mp4`,
      ORG,
      ACTOR,
      supabase,
    )

    assert.equal(outcome.ok, false)
    assert.equal(fetchCalls.length, 0)
    assert.equal(removed.length, 0)
  })

  it("AdLauncher-owned key without a UUID asset id is rejected fail-closed", async () => {
    const { supabase, removed } = makeSupabaseStub()
    const outcome = await deleteMediaObject(
      `r2://pati-videos/ads-launcher/${ORG}/creatives/not-a-uuid/video.mp4`,
      ORG,
      ACTOR,
      supabase,
    )

    assert.equal(outcome.ok, false)
    assert.equal(fetchCalls.length, 0)
    assert.equal(removed.length, 0)
  })

  it("missing ADS_MEDIA_API_TOKEN rejects fail-closed instead of calling Portal", async () => {
    delete process.env.ADS_MEDIA_API_TOKEN
    const { supabase, removed } = makeSupabaseStub()
    const outcome = await deleteMediaObject(
      `r2://pati-videos/ads-launcher/${ORG}/creatives/${VALID_ASSET_ID}/video.mp4`,
      ORG,
      ACTOR,
      supabase,
    )

    assert.equal(outcome.ok, false)
    assert.equal(fetchCalls.length, 0)
    assert.equal(removed.length, 0)
  })

  it("Portal broker DELETE returning non-ok rejects fail-closed", async () => {
    globalThis.fetch = (async (url: string, init?: RequestInit): Promise<Response> => {
      fetchCalls.push({ url, method: init?.method ?? "GET" })
      return new Response(" Portal error", { status: 500 })
    }) as typeof globalThis.fetch
    const { supabase, removed } = makeSupabaseStub()
    const outcome = await deleteMediaObject(
      `r2://pati-videos/ads-launcher/${ORG}/creatives/${VALID_ASSET_ID}/video.mp4`,
      ORG,
      ACTOR,
      supabase,
    )

    assert.equal(outcome.ok, false)
    assert.equal(removed.length, 0, "DB row must NOT be removed when Portal delete failed")
  })
})
