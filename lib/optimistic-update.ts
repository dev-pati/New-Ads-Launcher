import { NextResponse } from "next/server"
import type { SupabaseClient } from "@supabase/supabase-js"
import { diffFields } from "@/lib/notifications/message"
import type { FieldChange } from "@/lib/notifications/types"

/**
 * Optimistic concurrency control for AdLauncher-owned rows.
 *
 * The failure this exists to stop:
 *
 *   t0  A and B both open Ad Set "Retargeting - US"
 *   t1  A changes the budget and saves
 *   t2  B — still holding the t0 copy — changes the age range and saves
 *   t3  A's budget change is gone. Nobody is told. Money is spent wrong.
 *
 * The fix is not "merge better", it is "refuse to guess": the write carries the
 * version the editor was looking at, and a version that has moved on is a 409 with
 * enough detail for a human to decide.
 *
 * Nothing here is last-write-wins by default. It only degrades to that in two named
 * situations, and both are reported rather than hidden:
 *   - `expectedVersion` is absent (a client that has not been updated yet)
 *   - the `row_version` column is absent (20260803_row_version.sql not applied)
 */

export type ConflictInfo = {
  code: "STALE_WRITE"
  message: string
  /** The row as it is now, so the client can offer "reload latest". */
  current: Record<string, unknown>
  currentVersion: number | null
  changedBy: string | null
  changedAt: string | null
  /** What moved under the editor since they loaded — only meaningful with `baseline`. */
  conflictFields: FieldChange[]
  /** Fields the editor was about to write that somebody else already changed. */
  overlappingFields: string[]
}

export type UpdateOutcome<T> =
  | { ok: true; row: T; before: Record<string, unknown>; changes: FieldChange[]; degraded: boolean }
  | { ok: false; kind: "not_found" }
  | { ok: false; kind: "conflict"; conflict: ConflictInfo }
  | { ok: false; kind: "error"; message: string }

type Db = SupabaseClient<any, any, any>

function isSchemaGap(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false
  if (err.code === "42703" || err.code === "PGRST204") return true
  return /column .* does not exist|could not find the .* column/i.test(err.message || "")
}

/** Parse the version an editor claims to have loaded. Absent is allowed; garbage is not. */
export function readExpectedVersion(body: Record<string, unknown>): number | null | "invalid" {
  const raw = body.expected_version ?? body.expectedVersion
  if (raw === undefined || raw === null) return null
  const n = typeof raw === "string" ? Number(raw) : raw
  if (typeof n !== "number" || !Number.isInteger(n) || n < 1) return "invalid"
  return n
}

export function conflictResponse(conflict: ConflictInfo) {
  return NextResponse.json(conflict, { status: 409 })
}

export async function updateWithVersion<T extends Record<string, any>>(args: {
  db: Db
  table: string
  id: string
  orgId: string
  /** Column carrying the org id. `creatives`, `automations`… use `org_id`. */
  orgColumn?: string
  /** The version the editor loaded. `null` = client did not send one. */
  expectedVersion: number | null
  updates: Record<string, unknown>
  actorId: string | null
  /**
   * The values the editor had on screen for the fields it is writing. Used to tell
   * the user *what* moved under them, not just *that* something did.
   */
  baseline?: Record<string, unknown> | null
  /** Human name for the last editor, resolved by the caller if it wants one. */
  resolveActorName?: (userId: string | null) => Promise<string | null>
}): Promise<UpdateOutcome<T>> {
  const {
    db,
    table,
    id,
    orgId,
    orgColumn = "org_id",
    expectedVersion,
    updates,
    actorId,
    baseline,
    resolveActorName,
  } = args

  const { data: before, error: readErr } = await db
    .from(table)
    .select("*")
    .eq("id", id)
    .eq(orgColumn, orgId)
    .maybeSingle()

  if (readErr) return { ok: false, kind: "error", message: readErr.message }
  if (!before) return { ok: false, kind: "not_found" }

  const hasVersionColumn = Object.prototype.hasOwnProperty.call(before, "row_version")
  const currentVersion: number | null = hasVersionColumn ? Number(before.row_version) : null

  const buildConflict = async (row: Record<string, unknown>): Promise<ConflictInfo> => {
    const conflictFields = baseline
      ? diffFields(baseline, row, Object.keys(baseline))
      : []
    const overlappingFields = conflictFields
      .map(c => c.field)
      .filter(f => Object.prototype.hasOwnProperty.call(updates, f))
    const changedById = (row.updated_by as string | null) ?? null
    const changedBy = resolveActorName ? await resolveActorName(changedById) : null
    return {
      code: "STALE_WRITE",
      message: changedBy
        ? `This item was updated by ${changedBy} while you were editing. Review the latest changes before saving.`
        : "This item was updated by someone else while you were editing. Review the latest changes before saving.",
      current: row,
      currentVersion: hasVersionColumn ? Number(row.row_version) : null,
      changedBy,
      changedAt: (row.updated_at as string | null) ?? null,
      conflictFields,
      overlappingFields,
    }
  }

  // Editor is behind. Do not write anything.
  if (hasVersionColumn && expectedVersion !== null && currentVersion !== expectedVersion) {
    return { ok: false, kind: "conflict", conflict: await buildConflict(before) }
  }

  const stamped: Record<string, unknown> = { ...updates }
  if (hasVersionColumn) stamped.row_version = (currentVersion ?? 1) + 1
  if (Object.prototype.hasOwnProperty.call(before, "updated_at")) {
    stamped.updated_at = new Date().toISOString()
  }
  if (Object.prototype.hasOwnProperty.call(before, "updated_by")) {
    stamped.updated_by = actorId
  }

  let query = db.from(table).update(stamped).eq("id", id).eq(orgColumn, orgId)
  // The guard that closes the read→write window: even with a matching version above,
  // another request may have committed in between. The WHERE clause is the real lock.
  if (hasVersionColumn && expectedVersion !== null) {
    query = query.eq("row_version", expectedVersion)
  }

  const { data: rows, error: writeErr } = await query.select()

  if (writeErr) {
    if (isSchemaGap(writeErr)) {
      // row_version / updated_by not applied yet — write without them and say so.
      const fallback: Record<string, unknown> = { ...updates }
      const plain = await db
        .from(table)
        .update(fallback)
        .eq("id", id)
        .eq(orgColumn, orgId)
        .select()
      if (plain.error) return { ok: false, kind: "error", message: plain.error.message }
      const row = (plain.data?.[0] ?? null) as T | null
      if (!row) return { ok: false, kind: "not_found" }
      return { ok: true, row, before, changes: diffFields(before, updates), degraded: true }
    }
    return { ok: false, kind: "error", message: writeErr.message }
  }

  if (!rows || rows.length === 0) {
    // Version matched on read and not on write: somebody committed in the gap.
    const { data: fresh } = await db
      .from(table)
      .select("*")
      .eq("id", id)
      .eq(orgColumn, orgId)
      .maybeSingle()
    if (!fresh) return { ok: false, kind: "not_found" }
    return { ok: false, kind: "conflict", conflict: await buildConflict(fresh) }
  }

  return {
    ok: true,
    row: rows[0] as T,
    before,
    changes: diffFields(before, updates),
    degraded: !hasVersionColumn || expectedVersion === null,
  }
}

/**
 * The Meta variant.
 *
 * Campaigns, ad sets and ads live in Meta's database, so there is no column to bump.
 * Meta does expose `updated_time` on every node, which moves on every write — that is
 * the version token. The client sends the `updated_time` it loaded; the route reads
 * the node, compares, and refuses a write whose base has moved.
 *
 * Known limit (TD): the read→write window here is a real network round trip, roughly
 * a second, and Meta offers no compare-and-set. This closes the minutes-wide window
 * that actually loses work; it does not close the second-wide one.
 */
export async function assertMetaNodeUnchanged(args: {
  nodeId: string
  accessToken: string
  expectedUpdatedTime: string | null
  fields?: readonly string[]
  fetchImpl?: typeof fetch
}): Promise<
  | { ok: true; node: Record<string, unknown>; checked: boolean }
  | { ok: false; kind: "conflict"; node: Record<string, unknown>; updatedTime: string | null }
  | { ok: false; kind: "error"; message: string }
> {
  const { nodeId, accessToken, expectedUpdatedTime, fields, fetchImpl = fetch } = args
  const fieldList = ["id", "name", "updated_time", ...(fields ?? [])].join(",")

  const res = await fetchImpl(
    `https://graph.facebook.com/v25.0/${nodeId}?fields=${fieldList}&access_token=${accessToken}`
  )
  const node = await res.json()
  if (!res.ok || node?.error) {
    return { ok: false, kind: "error", message: node?.error?.message || "Failed to read node" }
  }

  // No expectation sent → nothing to compare. Reported so the caller can log that it
  // took the last-write-wins path rather than pretending it checked.
  if (!expectedUpdatedTime) return { ok: true, node, checked: false }

  const current = typeof node.updated_time === "string" ? node.updated_time : null
  if (current && current !== expectedUpdatedTime) {
    return { ok: false, kind: "conflict", node, updatedTime: current }
  }
  return { ok: true, node, checked: true }
}
