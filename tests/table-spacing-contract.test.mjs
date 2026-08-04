// refactor-fragile: the assertions below read source files as text, so they fail on
// renames, moves and reformatting as readily as on real behaviour changes. Before
// adding one, read tests/README.md — assert the contract, not the characters.
/**
 * Table spacing and the Ads Manager frozen columns.
 *
 * Two classes of regression are defended here, both of which had already happened once.
 *
 * 1. Spacing drift. There were 19 distinct th/td padding combinations across 39 tables and no
 *    table declared a row height, so row pitch was whatever the tallest cell happened to be.
 *    The fix split ownership: vertical rhythm lives in app/globals.css keyed off `data-table`
 *    (nothing in the app sets a height utility on a tr/td, so there is no specificity fight),
 *    horizontal padding stays in per-cell classes (it is inherently per-cell). That split only
 *    holds while cells carry no `py-*` — a utility beats @layer base, so one stray py-1.5 makes
 *    the CSS inert for that cell and nothing visibly breaks until two tables sit side by side.
 *
 * 2. Frozen-column arithmetic. The Ads Manager pins three columns. The offsets are derived from
 *    the column widths (40px + 64px = 104px), the header must pin at the same offsets as the
 *    body or the labels slide off the columns they name, and every pinned cell must be opaque or
 *    the scrolling columns show through it. Each of those three was wrong in the shipped code.
 */

import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"

const root = process.cwd()
const read = path => readFileSync(join(root, path), "utf8")

const ADS_MANAGER = "app/(dashboard)/ads-manager/page.tsx"

/**
 * Vertical padding values that describe a row. Larger ones (py-8, py-16) are empty-state cells
 * and are allowed — those cells escape the row floor via `td[colspan] { height: auto }`.
 *
 * `pt-`/`pb-` are included because the first normalization pass only looked for `py-`, and eight
 * cells in launch/page.tsx wrote the same thing as `pt-3 pb-2` and survived it.
 */
const ROW_PY = /\b(py|pt|pb)-(1|1\.5|2|2\.5|3|3\.5|4)\b/

describe("table spacing tokens", () => {
  it("keeps the row floor in CSS and the scale in the token file in agreement", () => {
    const tokens = read("components/shared/table-tokens.ts")
    const css = read("app/globals.css")

    // The numbers exist in two places by necessity — CSS cannot import TS. If they diverge, a
    // virtualised list computing offsets from ROW_HEIGHT drifts from what the DOM renders.
    assert.match(tokens, /comfortable: 44/)
    assert.match(tokens, /compact: 36/)
    assert.match(css, /\[data-table="comfortable"\] tbody tr td \{[\s\S]{0,80}height: 44px/)
    assert.match(css, /\[data-table="compact"\] tbody tr td \{[\s\S]{0,80}height: 36px/)
    assert.match(css, /\[data-table="comfortable"\] thead tr th \{[\s\S]{0,80}height: 40px/)
    assert.match(css, /\[data-table="compact"\] thead tr th \{[\s\S]{0,80}height: 34px/)
  })

  it("lets an empty-state cell and a taller row escape the floor", () => {
    const css = read("app/globals.css")
    // height on a table cell is a minimum, so a genuinely taller row still grows — but a
    // colspan'd empty state would otherwise be held to the row height and look cramped.
    assert.match(css, /\[data-table\] td\[colspan\] \{\s*height: auto/)
  })

  it("restates middle alignment, which a block-level cell child silently loses", () => {
    const css = read("app/globals.css")
    assert.match(css, /\[data-table\] th,\s*\n\s*\[data-table\] td \{\s*\n\s*vertical-align: middle/)
  })

  it("gives grid pseudo-tables the same floor via the same attribute", () => {
    const css = read("app/globals.css")
    assert.match(css, /\[data-table="comfortable"\] \[data-table-row\] \{\s*\n\s*min-height: 44px/)
    assert.match(css, /\[data-table="compact"\] \[data-table-row\] \{\s*\n\s*min-height: 36px/)
  })
})

describe("no table cell keeps row-level vertical padding", () => {
  // Walk every file that renders a <table>: a cell with py-* overrides the base layer and
  // reintroduces exactly the drift the CSS was written to remove.
  const dirs = ["app", "components"]
  const files = []
  const walk = dir => {
    for (const entry of readdirSync(join(root, dir), { withFileTypes: true })) {
      const rel = `${dir}/${entry.name}`
      if (entry.isDirectory()) walk(rel)
      else if (entry.name.endsWith(".tsx")) files.push(rel)
    }
  }
  dirs.forEach(walk)

  const tableFiles = files.filter(f => /<table[\s>]/.test(read(f)))

  it("finds the table files at all (guards against the walk silently matching nothing)", () => {
    assert.ok(tableFiles.length >= 20, `expected 20+ files with tables, found ${tableFiles.length}`)
  })

  for (const file of tableFiles) {
    it(`${file} has no py-* on a th/td`, () => {
      const offenders = read(file)
        .split("\n")
        .map((line, i) => ({ line, n: i + 1 }))
        .filter(({ line }) => /<(th|td)\b/.test(line) && ROW_PY.test(line))
        .map(({ line, n }) => `${n}: ${line.trim().slice(0, 120)}`)
      assert.deepEqual(offenders, [], `\n${offenders.join("\n")}`)
    })
  }

  for (const file of tableFiles) {
    it(`${file} declares a density on every table`, () => {
      const src = read(file)
      const tables = src.match(/<table[\s>]/g) || []
      // Literal on the 39 hand-rolled tables; `data-table={density}` on the ui/table.tsx
      // primitive, which takes it as a prop defaulting to comfortable.
      const tagged = src.match(/<table\s+(?:data-slot="table"\s+)?data-table=(?:"(?:comfortable|compact)"|\{density\})/g) || []
      assert.equal(tagged.length, tables.length, `${tables.length} tables, ${tagged.length} tagged`)
    })
  }
})

describe("Ads Manager frozen columns", () => {
  const src = () => read(ADS_MANAGER)

  it("derives the third offset from the first two widths", () => {
    const page = src()
    // w-10 = 40px, w-16 = 64px, so column 3 pins at 104px. It pinned at 100px and overlapped
    // Off/On by 4px. If a width changes here, the offset below it has to change with it.
    assert.match(page, /const FROZEN_W = \{ check: "w-10", toggle: "w-16" \}/)
    assert.match(page, /check: "left-0"/)
    assert.match(page, /toggle: "left-10"/)
    assert.match(page, /name: "left-\[104px\]"/)
    assert.doesNotMatch(page, /left-\[100px\]/, "the 4px-off offset must not come back")
  })

  it("pins the header at the same three offsets as the body", () => {
    const page = src()
    // The whole defect: thead was sticky top-0 only, so horizontal scroll slid the labels out
    // from over the columns they name. Every offset must be referenced from both.
    for (const key of ["check", "toggle", "name"]) {
      const uses = page.match(new RegExp(`FROZEN_LEFT\\.${key}`, "g")) || []
      assert.ok(uses.length >= 2, `FROZEN_LEFT.${key} used ${uses.length}× — header and body both need it`)
    }
    const thead = page.slice(page.indexOf("<thead"), page.indexOf("</thead>"))
    assert.match(thead, /sticky z-20/, "the frozen header cells must be sticky, not just the thead")
  })

  it("keeps every pinned background opaque", () => {
    const page = src()
    // A pinned cell with an alpha channel lets the scrolling columns show through it. These are
    // the flattened equivalents, not new colours — see the comment on the constants.
    assert.match(page, /const FROZEN_HEAD_BG = "bg-\[#f5f6f7\] dark:bg-muted"/)
    assert.match(page, /const FROZEN_BODY_BG = "bg-white dark:bg-background"/)
    assert.match(page, /const FROZEN_BODY_SEL = "bg-\[#e3f0fe\] dark:bg-\[#1d2235\]"/)
    assert.match(page, /const FROZEN_BAND_BG = "bg-\[#f5f6f7\] dark:bg-background"/)

    // No pinned cell may carry a slash-alpha dark background.
    const pinned = page.split("\n").filter(l => /<td|<th/.test(l) && /FROZEN_LEFT/.test(l))
    assert.ok(pinned.length >= 9, `expected 9+ pinned cells, found ${pinned.length}`)
    for (const line of pinned) {
      assert.doesNotMatch(line, /dark:bg-[a-z-]+\/\d+/, `translucent pinned cell: ${line.trim().slice(0, 120)}`)
    }
  })

  it("gives the checkbox and Off/On columns matching padding in header and body", () => {
    const page = src()
    // These disagreed: header checkbox px-2 / body px-3, header Off/On px-3 / body px-2 — a 4px
    // horizontal offset inside a column that is pinned and therefore always visible.
    const check = page.match(/FROZEN_LEFT\.check/g) || []
    const checkLines = page.split("\n").filter(l => l.includes("FROZEN_LEFT.check"))
    assert.ok(check.length >= 3)
    for (const line of checkLines) assert.match(line, /px-2/, `checkbox cell not px-2: ${line.trim().slice(0, 100)}`)

    const toggleLines = page.split("\n").filter(l => l.includes("FROZEN_LEFT.toggle"))
    for (const line of toggleLines) assert.match(line, /px-3/, `Off/On cell not px-3: ${line.trim().slice(0, 100)}`)
  })
})

describe("Ads Manager sorting", () => {
  const src = () => read(ADS_MANAGER)

  it("cycles a column through ascending, descending, then default", () => {
    const page = src()
    const handler = page.slice(page.indexOf("const handleSort ="), page.indexOf("const handleSort =") + 400)

    // First click on a new column: ascending.
    assert.match(handler, /if \(sortField !== field\) \{ setSortField\(field\); setSortDir\("asc"\); return \}/)
    // Second: descending.
    assert.match(handler, /if \(sortDir === "asc"\) \{ setSortDir\("desc"\); return \}/)
    // Third: clear the field, which is what "default" means downstream.
    assert.match(handler, /setSortField\(null\)/)
    // The old two-state toggle had no way back to the default order.
    assert.doesNotMatch(handler, /d === "asc" \? "desc" : "asc"/)
  })

  it("treats a null sort field as newest-created-first, not as unsorted Meta order", () => {
    const page = src()
    assert.match(page, /const byNewestFirst = \(/)
    assert.match(page, /\} else \{[\s\S]{0,700}list = \[\.\.\.list\]\.sort\(byNewestFirst\)/)
  })

  it("does not sort by name by default at any level", () => {
    const page = src()
    // One comparator serves campaigns, ad sets and ads because all three render through the
    // same currentData memo — that is what makes the behaviour consistent across levels.
    const memo = page.slice(page.indexOf("if (sortField) {"), page.indexOf("const totalPages"))
    const nameSorts = memo.match(/localeCompare/g) || []
    assert.equal(nameSorts.length, 2, "localeCompare belongs only to the explicit name sort")
    assert.match(memo, /sortField === "name"/)
  })

  it("sorts a row with no created_time last instead of first", () => {
    const page = src()
    // lib/snapshot-fallback.ts reads a metrics snapshot that has no creation timestamp, so on
    // the Meta-unavailable path every row arrives without created_time. Sorting NaN naively
    // would scatter the list; this pushes them last and falls back to the id.
    const fn = page.slice(page.indexOf("const byNewestFirst = ("), page.indexOf("const byNewestFirst = (") + 700)
    assert.match(fn, /Number\.isNaN/)
    assert.match(fn, /if \(aOk !== bOk\) return aOk \? -1 : 1/)
    assert.match(fn, /b\.id\.localeCompare\(a\.id, undefined, \{ numeric: true \}\)/)
  })

  it("still requests created_time for all three levels", () => {
    const facebook = read("lib/facebook.ts")
    // The default sort needs no API change only because this is already true. If it stops being
    // true, the default order silently degrades to the id tie-break everywhere.
    const occurrences = facebook.match(/"created_time"/g) || []
    assert.ok(occurrences.length >= 3, `created_time requested ${occurrences.length}×, need 3 (campaigns, adsets, ads)`)
  })
})
