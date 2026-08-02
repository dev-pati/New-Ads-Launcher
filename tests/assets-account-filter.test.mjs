import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"

/**
 * All Assets → account filter.
 *
 * Repro that started this: ticking both "Hooray 37" and "Hooray 52" returned no media,
 * even though some assets are assigned to both. The filter used to be a client-side
 * ALL-match intersection (deliberately: "[A,B] chỉ show media được assign cho cả A và B").
 * The requested semantics are now ANY-match — an asset shows when it is on at least one
 * selected account — and the intersection was broken even for its own stated intent.
 *
 * The two models below are the *semantics*, not a copy of the component: `serverPage`
 * stands in for `GET /api/creatives`, which is the only thing that filters by account now.
 * `legacyIntersect` is kept because it is what reproduces the bug, and a test that only
 * checks the fix cannot tell you the fix was needed.
 *
 * House style for this directory: plain `node --test`, no runner, no JSX. Run with
 *   node --test tests/assets-account-filter.test.mjs
 */

const ACCT_37 = "act_37" // "Hooray 37"
const ACCT_52 = "act_52" // "Hooray 52"
const ACCT_99 = "act_99" // a third account with nothing on it

const PORTAL = key => `r2://pati-videos/creative-portal/approved/hooray/${key}`

/**
 * One `creatives` row per (asset × ad account) — that is what `claimPortalAsset` produces:
 * it dedups on (org_id, ad_account_id, storage_path), so the same object claimed by two
 * accounts is two rows sharing one storage_path.
 *
 * `created_at` descending is the server's order, so index order here is page order.
 */
const ROWS = [
  { id: "c1", file_name: "shared.mp4",  ad_account_id: ACCT_37, storage_path: PORTAL("shared.mp4"),  created_at: "2026-07-20T10:00:00Z" },
  { id: "c2", file_name: "only37.mp4",  ad_account_id: ACCT_37, storage_path: PORTAL("only37.mp4"),  created_at: "2026-07-19T10:00:00Z" },
  { id: "c3", file_name: "only52.mp4",  ad_account_id: ACCT_52, storage_path: PORTAL("only52.mp4"),  created_at: "2026-07-18T10:00:00Z" },
  // Manual upload / Drive import: no Portal lineage, so storage_path is null.
  { id: "c4", file_name: "manual.png",  ad_account_id: ACCT_37, storage_path: null,                  created_at: "2026-07-17T10:00:00Z" },
  // Same asset as c1, claimed by the second account. Last in created_at order on purpose:
  // with a small page it lands on page 2 while c1 sits on page 1.
  { id: "c5", file_name: "shared.mp4",  ad_account_id: ACCT_52, storage_path: PORTAL("shared.mp4"),  created_at: "2026-07-16T10:00:00Z" },
]

/** `GET /api/creatives`: `.eq` for one account, `.in` for several, unfiltered for none. */
function serverPage(rows, selectedAccounts, { limit = 20, cursor = null } = {}) {
  let out = rows
  if (selectedAccounts.length === 1) out = out.filter(r => r.ad_account_id === selectedAccounts[0])
  else if (selectedAccounts.length > 1) out = out.filter(r => selectedAccounts.includes(r.ad_account_id))
  if (cursor) out = out.filter(r => r.created_at < cursor)
  const page = out.slice(0, limit)
  const hasMore = out.length > limit
  return { creatives: page, hasMore, nextCursor: hasMore ? page[page.length - 1].created_at : null }
}

/** What the page shows today: the server's rows, with no client-side account predicate. */
function currentFilter(loadedRows) {
  return loadedRows.map(r => r.file_name)
}

/** The removed client-side ALL-match intersection, reproduced faithfully. */
function legacyIntersect(loadedRows, selectedAccounts) {
  let andObjectKeys = null
  if (selectedAccounts.length > 1) {
    const keysByAccount = new Map()
    for (const c of loadedRows) {
      if (!c.storage_path) continue
      let set = keysByAccount.get(c.ad_account_id || "")
      if (!set) { set = new Set(); keysByAccount.set(c.ad_account_id || "", set) }
      set.add(c.storage_path)
    }
    const present = selectedAccounts.filter(a => keysByAccount.has(a))
    if (present.length < selectedAccounts.length) {
      andObjectKeys = new Set()
    } else {
      andObjectKeys = new Set(keysByAccount.get(present[0]))
      for (let i = 1; i < present.length; i++) {
        const s = keysByAccount.get(present[i])
        andObjectKeys = new Set([...andObjectKeys].filter(k => s.has(k)))
      }
    }
  }
  return loadedRows
    .filter(c => !(andObjectKeys && (!c.storage_path || !andObjectKeys.has(c.storage_path))))
    .map(r => r.file_name)
}

const sorted = names => [...names].sort()

describe("All Assets account filter — ANY-match semantics", () => {
  // Case 1
  it("one selected account returns only that account's media", () => {
    const { creatives } = serverPage(ROWS, [ACCT_37])
    assert.deepEqual(sorted(currentFilter(creatives)), sorted(["shared.mp4", "only37.mp4", "manual.png"]))
  })

  // Case 2 + the original repro
  it("two selected accounts return the union, not the intersection", () => {
    const { creatives } = serverPage(ROWS, [ACCT_37, ACCT_52])
    const names = currentFilter(creatives)
    assert.equal(names.length, 5, "every row on either account is shown")
    assert.ok(names.includes("only37.mp4"), "single-account media on A must survive selecting A+B")
    assert.ok(names.includes("only52.mp4"), "single-account media on B must survive selecting A+B")
    assert.ok(names.includes("manual.png"), "a row with storage_path = null must survive")
    assert.notEqual(names.length, 0, "the reported bug: Hooray 37 + Hooray 52 showed nothing")
  })

  // Case 3
  it("media assigned to exactly one account appears whenever that account is selected", () => {
    for (const selection of [[ACCT_52], [ACCT_37, ACCT_52], [ACCT_52, ACCT_99]]) {
      const names = currentFilter(serverPage(ROWS, selection).creatives)
      assert.ok(names.includes("only52.mp4"), `only52.mp4 missing for selection ${selection.join("+")}`)
    }
  })

  // Case 4
  it("media assigned to several accounts appears once per assignment, as in the All view", () => {
    const both = currentFilter(serverPage(ROWS, [ACCT_37, ACCT_52]).creatives).filter(n => n === "shared.mp4")
    assert.equal(both.length, 2, "two claims = two creatives rows; the unfiltered view shows both too")
    assert.equal(currentFilter(serverPage(ROWS, []).creatives).filter(n => n === "shared.mp4").length, 2)
  })

  // Case 5
  it("no account selected means every account in the org", () => {
    assert.equal(currentFilter(serverPage(ROWS, []).creatives).length, ROWS.length)
  })

  // Case 6
  it("clearing the filter restores the full org list", () => {
    const narrowed = currentFilter(serverPage(ROWS, [ACCT_52]).creatives)
    const cleared = currentFilter(serverPage(ROWS, []).creatives)
    assert.ok(narrowed.length < cleared.length)
    assert.equal(cleared.length, ROWS.length)
  })

  it("an account with no media does not empty the result", () => {
    const names = currentFilter(serverPage(ROWS, [ACCT_37, ACCT_99]).creatives)
    assert.deepEqual(sorted(names), sorted(["shared.mp4", "only37.mp4", "manual.png"]),
      "act_99 contributes nothing and removes nothing")
  })
})

describe("the three ways the removed intersection produced an empty table", () => {
  it("1. it intersected only the rows loaded so far, so a small page hid the match", () => {
    // Page size 2: c1 (shared on 37) is on page 1, c5 (shared on 52) is on page 3.
    const firstPage = serverPage(ROWS, [ACCT_37, ACCT_52], { limit: 2 }).creatives
    assert.deepEqual(legacyIntersect(firstPage, [ACCT_37, ACCT_52]), [],
      "both accounts have loaded rows, but no shared storage_path yet → empty")
    assert.equal(currentFilter(firstPage).length, 2, "ANY-match shows the page it has")
  })

  it("2. it dropped every row with storage_path = null the moment a second account was ticked", () => {
    const all = serverPage(ROWS, [ACCT_37, ACCT_52]).creatives
    assert.ok(legacyIntersect(all, [ACCT_37]).includes("manual.png"), "single selection kept manual uploads")
    assert.ok(!legacyIntersect(all, [ACCT_37, ACCT_52]).includes("manual.png"),
      "multi selection silently discarded every manual and Drive upload")
    assert.ok(currentFilter(all).includes("manual.png"))
  })

  it("3. it returned the empty set outright when one selected account had no loaded row", () => {
    const all = serverPage(ROWS, [ACCT_37, ACCT_99]).creatives
    assert.deepEqual(legacyIntersect(all, [ACCT_37, ACCT_99]), [],
      "present.length < selected.length → andObjectKeys = new Set()")
    assert.equal(currentFilter(all).length, 3)
  })

  it("even fully loaded, the intersection contradicted the requested behaviour", () => {
    const all = serverPage(ROWS, [ACCT_37, ACCT_52]).creatives
    assert.deepEqual(legacyIntersect(all, [ACCT_37, ACCT_52]), ["shared.mp4", "shared.mp4"],
      "ALL-match keeps only the doubly-claimed asset")
  })
})

// ─── Source contract: the filtering stays on the server ───────────────────────

const root = process.cwd()
const read = path => readFileSync(join(root, path), "utf8")

describe("account filter plumbing", () => {
  it("All Assets opens on all accounts and lists the newest assigned assets first", () => {
    const source = read("app/(dashboard)/assets/page.tsx")
    assert.match(source, /useState<"" \| "ready" \| "pending">\(""\)/)
    assert.match(source, /section === "all" \? sortCreativesByLatestAssignment\(filtered\) : filtered/)
  })

  it("uses the newest Portal assignment when an asset belongs to more than one account", () => {
    const source = read("lib/creative-media.ts")
    assert.match(source, /arr\.reduce<string \| undefined>/)
    assert.match(source, /Date\.parse\(assignment\.created_at\) > Date\.parse\(latest\)/)
  })

  it("refreshes All accounts after assigning Portal media to any account", () => {
    const source = read("app/(dashboard)/assets/page.tsx")
    assert.match(source, /assetFilterAccounts\.length === 0 \|\| assetFilterAccounts\.includes\(importConfirm\.adAccountId\)/)
    assert.doesNotMatch(source, /importConfirm\.adAccountId === selectedAccountId/)
  })

  it("asks the API to sort by latest assignment before pagination", () => {
    const page = read("app/(dashboard)/assets/page.tsx")
    const route = read("app/api/creatives/route.ts")
    assert.match(page, /sort: "assigned_desc"/)
    assert.match(route, /sortMode === "assigned_desc"/)
    assert.match(route, /sortCreativesByLatestAssignment/)
    assert.match(route, /collectAllCreativePages/)
    assert.match(route, /\.range\(from, to\)/)
    assert.match(route, /String\(assignedSortOffset \+ limit\)/, "assigned-date pagination uses an offset after sorting")
  })

  it("the API accepts a repeated ad_account_id and uses IN for several values", () => {
    const source = read("app/api/creatives/route.ts")
    assert.match(source, /getAll\("ad_account_id"\)/)
    assert.match(source, /\.eq\("ad_account_id", adAccountIds\[0\]\)/)
    assert.match(source, /\.in\("ad_account_id", adAccountIds\)/)
    assert.match(source, /\.eq\("org_id", ctx\.orgId\)/, "still org-scoped")
  })

  it("the page sends one ad_account_id param per selected account", () => {
    const source = read("app/(dashboard)/assets/page.tsx")
    assert.match(source, /params\.append\("ad_account_id", id\)/)
    assert.match(source, /\[assetFilterAccounts, loadCreatives\]/, "changing the selection refetches")
  })

  it("no client-side account predicate has come back", () => {
    const source = read("app/(dashboard)/assets/page.tsx")
    assert.doesNotMatch(source, /andObjectKeys/, "the ALL-match intersection is gone")
    const body = source.slice(source.indexOf("const filterCreatives"), source.indexOf("const displayList"))
    assert.doesNotMatch(body, /assetFilterAccounts/,
      "filterCreatives must not filter by account — the server already did")
  })
})
