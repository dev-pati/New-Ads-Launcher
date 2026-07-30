import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"

/**
 * Save Draft used to persist five copy fields plus Table rows. Gallery mode's Save button was
 * inert — no onClick, no disabled — and the API rejected any draft with no rows, so a Gallery
 * draft could not be saved at all. A draft now carries a full `snapshot` of the setup and
 * `handleLoadDraft` restores it.
 *
 * Two constraints shape the implementation and are what these tests defend:
 *
 * 1. Supabase migrations are LOCKED on the shared project. `launch_drafts.data` is JSONB, so
 *    `snapshot` goes inside it — additively, alongside the `rows`/`globalSettings` an older build
 *    still reads.
 * 2. Restoring a draft changes `selectedAccountId`, and two effects keyed to that id write into
 *    the same state the restore is writing (the saved creative selection in localStorage, and the
 *    account's Default Ad Settings). Without the `restoringDraft` guard the draft loses the race.
 *
 * Source-contract assertions — this repo has no DOM runner, and launch/page.tsx is 14.5k lines
 * (TD-07), so what is checkable and worth checking is that these seams stay wired.
 *
 *   node --test tests/launch-draft-snapshot.test.mjs
 */

const root = process.cwd()
const read = path => readFileSync(join(root, path), "utf8")

const LAUNCH = "app/(dashboard)/launch/page.tsx"
const API = "app/api/launch-drafts/route.ts"

describe("Save Draft is disabled until an ad is configured", () => {
  const source = read(LAUNCH)

  it("uses one predicate for both modes", () => {
    assert.ok(source.includes("const nothingConfigured ="), "the predicate must exist")
    // Gallery's test is exactly Preview's, which is the parity the brief asked for.
    assert.ok(
      source.includes("? tableRows.length === 0") &&
      source.includes(": selectedCreatives.length === 0"),
      "Table keeps its existing condition; Gallery matches Preview's"
    )
  })

  it("both Save Draft buttons are wired to it", () => {
    const disabled = source.match(/disabled=\{savingDraft \|\| nothingConfigured\}/g) || []
    assert.equal(disabled.length, 2, "Gallery and Table Save Draft must both be guarded")
  })

  it("the Gallery button actually saves", () => {
    // It previously rendered with no handler at all — the whole defect behind brief item 4.
    const handlers = source.match(/onClick=\{saveDraft\}/g) || []
    assert.equal(handlers.length, 2, "both Save Draft buttons must call saveDraft")
  })

  it("explains the disabled state instead of just greying out", () => {
    assert.ok(
      source.includes('nothingConfigured ? "Select media first'),
      "Gallery's tooltip must say why"
    )
    assert.ok(
      source.includes('nothingConfigured ? "Add a row first'),
      "Table's tooltip must say why"
    )
  })

  it("saveDraft refuses to run when nothing is configured", () => {
    assert.ok(
      /saveDraft[\s\S]{0,400}if \(nothingConfigured\) return/.test(source),
      "saveDraft must bail out, not rely on the disabled attribute alone"
    )
  })
})

describe("the snapshot", () => {
  const source = read(LAUNCH)

  it("is a versioned interface", () => {
    assert.ok(source.includes("interface DraftSnapshot"), "the shape must be declared")
    assert.ok(source.includes("version: 1"), "a version field must exist for future migration")
  })

  it("covers the state a user would expect to come back", () => {
    // One assertion per field the user loses if it is dropped from buildDraftSnapshot.
    for (const field of [
      "adAccountId", "pageId", "igPageId", "adSets",
      "primaryTexts", "headlines", "descriptions", "cta", "webLink", "utmParams", "displayLink",
      "launchAsActive", "adSourceMode", "adSourceIds",
      "selectedCreativeIds", "adNameOverrides", "tableViewMode", "adFormat",
      "partnership", "multilanguage", "collectionAds", "catalogAds", "carouselAds",
      "flexibleAds", "multiPlacementAds",
    ]) {
      assert.ok(
        new RegExp(`\\b${field}\\??:`).test(source),
        `DraftSnapshot must carry ${field}`
      )
    }
  })

  it("is built from live state and sent on save", () => {
    assert.ok(
      source.includes("const buildDraftSnapshot = (): DraftSnapshot =>"),
      "builder must be typed"
    )
    assert.ok(source.includes("snapshot: buildDraftSnapshot()"), "POST body must include it")
    // Old readers must keep working; this is why globalSettings is still written.
    assert.ok(source.includes("globalSettings"), "the legacy payload must still be written")
  })

  it("stores adSets whole rather than a narrowed shape", () => {
    // A narrowed literal type here was a lie: it left status/effective_status/campaign_id
    // undefined at runtime after a restore.
    assert.ok(source.includes("adSets?: AdSet[]"), "adSets must keep its real type")
  })
})

describe("restoring a draft", () => {
  const source = read(LAUNCH)

  it("guards against the two effects that race it", () => {
    assert.ok(source.includes("const restoringDraft = useRef(false)"), "the guard must exist")
    assert.ok(source.includes("restoringDraft.current = true"), "the restore must raise it")
    assert.ok(
      source.includes("hasUrlPrefill || restoringDraft.current"),
      "the localStorage creative-selection effect must respect it"
    )
    assert.ok(
      source.includes("if (restoringDraft.current) return"),
      "the Default Ad Settings effect must respect it"
    )
  })

  it("applies the account before anything keyed to it", () => {
    const restore = source.slice(source.indexOf("const handleLoadDraft"))
    const account = restore.indexOf("if (accountId) setSelectedAccountId(accountId)")
    const creatives = restore.indexOf("setSelectedCreatives(restored)")
    assert.ok(account > -1 && creatives > -1, "both steps must be present")
    assert.ok(account < creatives, "the account must be set first")
    // The account also has to come from the snapshot in preference to the legacy field.
    assert.ok(
      restore.includes("snap?.adAccountId ?? data.globalSettings?.adAccountId"),
      "the snapshot's account must win over the legacy globalSettings copy"
    )
  })

  it("falls back to the legacy shape for drafts saved by the previous build", () => {
    assert.ok(
      source.includes("data.snapshot"),
      "the restore must branch on whether a snapshot is present"
    )
  })

  it("tells the user when a creative in the draft no longer resolves", () => {
    // Creatives can be deleted between save and reopen. Silently restoring fewer ads than were
    // saved is the kind of quiet wrong that this codebase has no observability to catch.
    assert.ok(
      source.includes("const missing = (snap.selectedCreativeIds?.length || 0) - restored.length"),
      "the restore must compare what it asked for against what came back"
    )
    assert.ok(
      /if \(missing > 0\)[\s\S]{0,200}setRelaunchBanner\(/.test(source),
      "a short restore must be reported, not swallowed"
    )
  })
})

describe("the API stores the snapshot without a migration", () => {
  const source = read(API)

  it("nests snapshot inside the existing data JSONB", () => {
    assert.ok(source.includes("...(snapshot ? { snapshot } : {})"), "must be additive")
    assert.ok(
      !/alter table|ALTER TABLE/.test(source),
      "migrations are LOCKED on the shared project"
    )
  })

  it("accepts a Gallery draft that has no Table rows", () => {
    assert.ok(
      source.includes("if (!rowList.length && !snapshotIds.length)"),
      "requiring rows is what made Gallery drafts unsavable"
    )
    assert.ok(!source.includes('if (!rows?.length)'), "the rows-only guard must be gone")
  })

  it("resolves snapshot creatives fresh, scoped to the org", () => {
    assert.ok(source.includes("snapshot?.selectedCreativeIds"), "must read the snapshot ids")
    assert.ok(source.includes('.eq("org_id", ctx.orgId)'), "creatives must be tenancy-scoped")
    assert.ok(
      source.includes("snapshotIds.map(id => creativeMap[id]).filter(Boolean)"),
      "order must follow the user's selection, not the query"
    )
  })

  it("counts Gallery units so the drafts list is not blank", () => {
    assert.ok(source.includes("rowList.length || snapshotIds.length"))
    assert.ok(source.includes("row_count: unitCount"))
  })
})

describe("record tabs are named after the record's state", () => {
  const source = read(LAUNCH)

  it("reads Launched / Draft / Scheduled / Trash", () => {
    for (const label of ['label: "Launched"', 'label: "Draft"', 'label: "Scheduled"', 'label: "Trash"']) {
      assert.ok(source.includes(label), `missing ${label}`)
    }
  })

  it("kept the keys, which are behaviour not copy", () => {
    // `key` is the tabOverride discriminant and drives the trash=1 query param.
    for (const key of ['"launches" as const', '"drafts" as const', '"scheduled" as const', '"deleted" as const']) {
      assert.ok(source.includes(key), `tab key ${key} must not be renamed`)
    }
  })
})
