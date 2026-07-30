/**
 * Table spacing — the single source of truth.
 *
 * Before this file there were 19 distinct th/td padding combinations across 39 tables in 22
 * files, and no table anywhere declared a row height, so row pitch was whatever the tallest
 * cell content happened to be. Two tables side by side in the same page could differ by 8px of
 * horizontal padding and 4px of vertical, which is the "text is not visually balanced" report.
 *
 * The scale is not invented. It is `insights/_statistics.tsx` table #1, which was already the
 * most carefully spaced table in the app, promoted to the standard — same approach the media
 * detail sidebar took with Portal Vault. Everything else converges on it.
 *
 * ── The rule ────────────────────────────────────────────────────────────────────────────────
 *
 * ONE horizontal scale, TWO vertical densities.
 *
 * Horizontal is identical everywhere, so columns line up across tables on the same screen:
 *   · inner cells      px-3   (12px)
 *   · first/last cell  px-5   (20px) — the edge inset, so text is not flush to the card edge
 *   · control cells    px-2   (8px)  — checkbox / row-number columns, which are icon-width
 *
 * Vertical differs, because a 30-column spreadsheet and a 6-column record list are not the
 * same object:
 *   · comfortable  header py-2.5, body py-3, row floor 44px — record listings, the default
 *   · compact      header py-2,   body py-2, row floor 36px — spreadsheets and pickers
 *
 * ── Why the row floor lives in CSS, not here ────────────────────────────────────────────────
 *
 * Padding is set per cell, so it has to be a class. Row height is not set anywhere in the app,
 * so it can be a base rule keyed off `data-table` on the <table> — see app/globals.css. That
 * means a table opts into the whole vertical rhythm with one attribute instead of a class on
 * every <tr>, and a table that forgets the attribute is visibly the odd one out rather than
 * silently different.
 *
 * Grid-based pseudo-tables (the launch history list) use `data-table` too: the CSS keys off the
 * attribute, not the element.
 *
 * ── Using it ────────────────────────────────────────────────────────────────────────────────
 *
 *   <table data-table="comfortable">
 *     <thead><tr>
 *       <th className={cn(TH, TH_EDGE_L)}>Account</th>
 *       <th className={TH}>Spend</th>
 *       <th className={cn(TH, TH_EDGE_R, "text-right")}>CPM</th>
 *     </tr></thead>
 *
 * The `components/ui/table.tsx` primitives already carry these values, so anything built on
 * <Table>/<TableHead>/<TableCell> is standard by construction and needs none of the constants
 * below. They exist for the 39 hand-rolled tables that predate the primitives.
 */

/** Horizontal padding, identical in both densities. */
export const CELL_X = "px-3"
/** First and last cell in a row: the edge inset. */
export const CELL_X_EDGE = "px-5"
/** Checkbox / row-number columns. */
export const CELL_X_CONTROL = "px-2"

/** Header cell. Density comes from the table's `data-table` attribute; this is the shared part. */
export const TH = "px-3 text-left align-middle text-xs font-semibold text-muted-foreground whitespace-nowrap"
export const TH_EDGE_L = "px-5"
export const TH_EDGE_R = "px-5"

/** Body cell. */
export const TD = "px-3 align-middle"
export const TD_EDGE_L = "px-5"
export const TD_EDGE_R = "px-5"

/** The header row. */
export const THEAD_ROW = "border-b bg-muted/20"
/** A body row. `cursor-pointer` is deliberately not here — only add it where the row is clickable. */
export const TBODY_ROW = "border-b transition-colors hover:bg-muted/20"

/** Densities, for the `data-table` attribute. */
export type TableDensity = "comfortable" | "compact"

/**
 * Row heights, exported so tests and virtualised lists can agree with the CSS instead of
 * hard-coding a second copy of the number.
 */
export const ROW_HEIGHT = {
  comfortable: 44,
  compact: 36,
} as const satisfies Record<TableDensity, number>

export const HEADER_HEIGHT = {
  comfortable: 40,
  compact: 34,
} as const satisfies Record<TableDensity, number>
