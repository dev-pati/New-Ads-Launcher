// refactor-fragile: the assertions below read source files as text, so they fail on
// renames, moves and reformatting as readily as on real behaviour changes. Before
// adding one, read tests/README.md — assert the contract, not the characters.
import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { readFileSync, existsSync } from "node:fs"
import { join } from "node:path"

/**
 * The Ad Account selector existed eight times with four different looks. It is now
 * components/shared/ad-account-pill.tsx and every surface that had its own copy consumes it —
 * with one deliberate exception, Ad Launcher, whose account switch drives Via LAUNCH resolution
 * and page/adset reloads and which the user excluded by name.
 *
 * Contract assertions on source, not render tests: this repo has no DOM runner (Playwright only,
 * for e2e), and what is worth protecting is structural — that a ninth copy does not appear, that
 * the search box the insights picker used to own did not get dropped in the merge, and that the
 * exclusion stays an exclusion.
 *
 *   node --test tests/ad-account-pill-contract.test.mjs
 */

const root = process.cwd()
const read = path => readFileSync(join(root, path), "utf8")

const PILL = "components/shared/ad-account-pill.tsx"

/** Every surface that renders the pill. Ad Launcher is deliberately absent. */
const CONSUMERS = [
  "app/(dashboard)/templates/page.tsx",
  "app/(dashboard)/insights/page.tsx",
  "app/(dashboard)/insights/_reports.tsx",
  "app/(dashboard)/insights/_statistics.tsx",
  "app/(dashboard)/campaigns/page.tsx",
  "app/(dashboard)/ads-manager/page.tsx",
  "components/ad-accounts/AdAccountsManager.tsx",
]

const LAUNCHER = "app/(dashboard)/launch/page.tsx"

describe("shared Ad Account pill", () => {
  it("exists and exports the component and its props type", () => {
    assert.equal(existsSync(join(root, PILL)), true)
    const source = read(PILL)
    for (const symbol of [
      "export function AdAccountPill",
      "export interface AdAccountPillProps",
      "export interface AdAccountOption",
    ]) {
      assert.ok(source.includes(symbol), `${PILL} must export ${symbol}`)
    }
  })

  it("reads the shared provider by default and accepts a controlled list", () => {
    const source = read(PILL)
    assert.ok(source.includes("useAdAccount()"), "uncontrolled mode must read the provider")
    // The controlled path is what lets AdAccountsManager keep its own list and its account_id key.
    assert.ok(source.includes("accounts ?? ctx.adAccounts"), "must fall back to the provider list")
    assert.ok(source.includes("value ?? ctx.selectedAccountId"), "must fall back to the provider value")
    assert.ok(source.includes("onChange ?? ctx.setSelectedAccountId"), "must fall back to the provider setter")
  })

  it("keeps the search field that the insights picker used to own", () => {
    const source = read(PILL)
    assert.ok(source.includes("Search accounts..."), "the search input must survive the merge")
    assert.ok(source.includes("searchThreshold"), "search must be a threshold, not always-on")
    // account_id has to be searchable too — AdAccountsManager's old picker matched on it.
    assert.ok(
      source.includes('(a.account_id || "").toLowerCase().includes(q)'),
      "search must match account_id, not only name"
    )
  })

  it("uses --link for the selected row, never --primary as text", () => {
    const source = read(PILL)
    assert.ok(source.includes("text-link"), "selected row must use the AA-passing blue")
    // Only code lines — the comment above that class names `text-primary` to explain the choice.
    const code = source.split("\n").filter(l => {
      const t = l.trim()
      return !t.startsWith("//") && !t.startsWith("*") && !t.startsWith("/*")
    })
    assert.ok(
      !code.some(l => /\btext-primary\b/.test(l)),
      "--primary measures 2.99:1 as text on --popover in dark mode"
    )
  })

  it("is built on Popover, not a menu — a menu's typeahead eats the search box", () => {
    const source = read(PILL)
    assert.ok(source.includes('from "@/components/ui/popover"'))
    assert.ok(!source.includes("dropdown-menu"), "must not reintroduce the menu primitive")
  })

  it("exposes the states the brief asks for: loading, empty, disabled", () => {
    const source = read(PILL)
    assert.ok(source.includes("Loading accounts"), "loading state")
    assert.ok(source.includes("No ad accounts connected."), "empty state")
    assert.ok(source.includes("No accounts match that search."), "empty-after-filter state")
    assert.ok(source.includes("disabled={disabled || isLoading || list.length === 0}"), "disabled state")
  })

  it("marks options as a single-select listbox", () => {
    const source = read(PILL)
    assert.ok(source.includes('role="listbox"'))
    assert.ok(source.includes('role="option"'))
    assert.ok(source.includes("aria-selected={isSelected}"))
  })
})

describe("adoption", () => {
  for (const file of CONSUMERS) {
    it(`${file} renders the shared pill`, () => {
      const source = read(file)
      assert.ok(
        source.includes('from "@/components/shared/ad-account-pill"'),
        `${file} must import the shared pill`
      )
      assert.ok(source.includes("<AdAccountPill"), `${file} must render the shared pill`)
    })

    it(`${file} keeps no local account dropdown`, () => {
      const source = read(file)
      // The shapes the copies took. Any reappearing means the pill was forked again.
      assert.ok(
        !source.includes('<span className="size-2 rounded-full bg-blue-500 shrink-0" />'),
        `${file} still has the blue-dot picker trigger`
      )
      // The tell of a hand-rolled option list: highlighting the row that matches the selection.
      // Deliberately not `adAccounts.map(` — _statistics legitimately maps the ids into a query
      // string for AllAccountsView, which is a different feature.
      assert.ok(
        !/acc\.id === selectedAccountId &&/.test(source),
        `${file} still renders its own highlighted option rows`
      )
      assert.ok(
        !/<option key=\{a\.id\}/.test(source),
        `${file} still has the native <select> variant`
      )
    })
  }

  it("insights/page.tsx only passes adAccounts through, it does not render options", () => {
    const source = read("app/(dashboard)/insights/page.tsx")
    // The one remaining reference is <AllAccountsView adAccounts={…} />, a different feature.
    assert.ok(source.includes("<AllAccountsView adAccounts="))
    assert.ok(!source.includes("accountPickerOpen"), "the old picker state must be gone")
  })

  it("Ad Launcher is excluded on purpose", () => {
    const source = read(LAUNCHER)
    assert.ok(
      !source.includes('from "@/components/shared/ad-account-pill"'),
      "launch/page.tsx must keep its own account switch — Via LAUNCH resolution hangs off it"
    )
  })
})
