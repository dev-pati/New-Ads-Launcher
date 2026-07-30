import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { readFileSync, existsSync } from "node:fs"
import { join } from "node:path"

/**
 * The Media Detail sidebar is shared by three surfaces: All Assets, Portal Media (both on
 * app/(dashboard)/assets/page.tsx) and Portal Vault (components/shared/load-media-modal.tsx).
 * Portal Vault's markup was the source of truth and now lives in one component.
 *
 * These are contract assertions on the source, not render tests — this repo has no DOM test
 * runner (only Playwright for e2e), and the thing worth protecting here is structural: that
 * a second copy does not reappear, and that the pieces the copies used to disagree about
 * (byte/duration formatting, the resolver URL, the Portal row type) have exactly one home.
 *
 *   node --test tests/media-detail-sheet-contract.test.mjs
 */

const root = process.cwd()
const read = path => readFileSync(join(root, path), "utf8")

const SHEET = "components/shared/media-detail-sheet.tsx"
const ASSETS = "app/(dashboard)/assets/page.tsx"
const MODAL = "components/shared/load-media-modal.tsx"

describe("shared Media Detail sheet", () => {
  it("exists and exports the component, its type and the shared formatters", () => {
    assert.equal(existsSync(join(root, SHEET)), true)
    const source = read(SHEET)
    for (const symbol of [
      "export function MediaDetailSheet",
      "export type MediaDetailFile",
      "export function formatMediaBytes",
      "export function formatMediaDuration",
      "export function formatMediaDate",
      "export function portalMediaHref",
    ]) {
      assert.ok(source.includes(symbol), `${SHEET} must export ${symbol}`)
    }
  })

  it("takes the Portal row type from lib/portal-media/tree, type-only", () => {
    const source = read(SHEET)
    assert.match(source, /import type \{ MediaNode \} from "@\/lib\/portal-media\/tree"/,
      "a value import would pull server-only Supabase code into the client bundle")
  })

  it("all three surfaces render it and none keeps its own Sheet", () => {
    for (const path of [ASSETS, MODAL]) {
      const source = read(path)
      assert.match(source, /<MediaDetailSheet/, `${path} must render the shared sheet`)
      assert.doesNotMatch(source, /<SheetContent/, `${path} must not carry a second sidebar`)
      assert.doesNotMatch(source, /from "@\/components\/ui\/sheet"/, `${path} must not import Sheet`)
    }
  })

  it("View media sits above File Information, not in a footer", () => {
    const source = read(SHEET)
    const view = source.indexOf("View media")
    const fileInfo = source.indexOf('title="File Information"')
    assert.ok(view > 0 && fileInfo > 0)
    assert.ok(view < fileInfo, "the primary action must precede the first metadata section")
  })

  it("View media falls back to a disabled control when there is no URL", () => {
    const source = read(SHEET)
    assert.match(source, /disabled/, "an asset with no assetId and no file_url must not render a dead link")
    assert.match(source, /cursor-not-allowed/)
    assert.match(source, /No metadata for this media yet/, "the sheet can open before metadata resolves")
  })

  it("no <img>/<video> is mounted — the Portal resolver is rate limited per IP", () => {
    // A real element is followed by an attribute or a self-close, never by ">" — that form
    // only occurs in prose, which is where this file explains the rate limit.
    const source = read(SHEET)
    assert.doesNotMatch(source, /<img[\s/]/)
    assert.doesNotMatch(source, /<video[\s/]/)
    assert.match(source, /120 GET\/HEAD per IP per minute/, "and it says why")
  })

  it("formatters and the resolver URL have exactly one definition", () => {
    // Every other copy is what let "1.5 MB" here and "2 MB" there happen.
    for (const path of [ASSETS, MODAL]) {
      const source = read(path)
      assert.doesNotMatch(source, /const PORTAL_MEDIA_RESOLVER =/, `${path} must not redefine the resolver`)
      assert.doesNotMatch(source, /const formatBytes = \(bytes/, `${path} must not redefine formatBytes`)
      assert.doesNotMatch(source, /const fmtDuration = \(sec/, `${path} must not redefine fmtDuration`)
    }
  })

  it("the Portal row type is not structurally re-declared anywhere", () => {
    for (const path of [ASSETS, MODAL]) {
      const source = read(path)
      assert.doesNotMatch(source, /interface PortalMediaFile/, `${path} must alias MediaDetailFile, not clone it`)
      assert.doesNotMatch(source, /interface PortalFolder/, `${path} must alias FolderNode, not clone it`)
    }
  })

  it("Assigned To is opt-in, so Portal Vault can omit it", () => {
    const sheet = read(SHEET)
    assert.match(sheet, /assignedTo\?: string\[\]/)
    assert.match(sheet, /assignedTo !== undefined &&/, "undefined hides the section; [] shows the empty state")

    const modal = read(MODAL)
    const call = modal.slice(modal.indexOf("<MediaDetailSheet"), modal.indexOf("</Dialog>"))
    assert.doesNotMatch(call, /assignedTo/, "Portal Vault rows are already scoped to one ad account")
  })
})

describe("dark-mode readability of the sheet", () => {
  it("links use the text-safe --link token, not the fill colour --primary", () => {
    const source = read(SHEET)
    assert.match(source, /text-link/, "text-primary measures 2.98:1 on --card in dark mode")
    assert.doesNotMatch(source, /className="text-primary/)
    assert.doesNotMatch(source, /text-primary hover:text-primary/)
  })

  it("the token is defined for both themes", () => {
    const css = read("app/globals.css")
    assert.match(css, /--color-link: var\(--link\);/, "must be exposed to Tailwind via @theme inline")
    const dark = css.slice(css.indexOf(".dark {"))
    assert.match(dark, /--link: #93b0ff;/, "dark needs a lighter blue than --brand-accent")
  })

  it("plain information is not blue", () => {
    const source = read(SHEET)
    // The language badge used to be bg-primary/10 text-primary — a metadata value in blue.
    assert.doesNotMatch(source, /bg-primary\/10 text-primary/)
  })
})
