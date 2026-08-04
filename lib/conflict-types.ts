import type { FieldChange } from "@/lib/notifications/types"

/**
 * Client-safe half of the optimistic-concurrency contract — no `next/server` import,
 * so client components can read the 409 shape without pulling server code into the
 * browser bundle. `lib/optimistic-update.ts` is the server-side producer.
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
