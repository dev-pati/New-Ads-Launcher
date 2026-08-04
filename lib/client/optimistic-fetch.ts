import type { ConflictInfo } from "@/lib/conflict-types"

/**
 * Client-side half of the lost-update guard: PATCH with the version the editor
 * loaded, and turn a 409 into data the caller can hand to <ConflictDialog> instead
 * of a generic error toast.
 */
export type OptimisticPatchResult<T> =
  | { ok: true; data: T }
  | { ok: false; conflict: ConflictInfo }
  | { ok: false; error: string }

export async function patchWithVersion<T = any>(
  url: string,
  body: Record<string, unknown>,
  opts?: {
    /** `row_version` off the record the editor loaded. Omit if the row has none yet. */
    expectedVersion?: number | null
    /** The fields-as-loaded, so a conflict can say which of *this* edit's fields collided. */
    baseline?: Record<string, unknown> | null
  }
): Promise<OptimisticPatchResult<T>> {
  const payload: Record<string, unknown> = { ...body }
  if (opts?.expectedVersion != null) payload.expected_version = opts.expectedVersion
  if (opts?.baseline) payload.baseline = opts.baseline

  const res = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
  const json = await res.json().catch(() => ({}))

  if (res.status === 409 && json?.code === "STALE_WRITE") {
    return { ok: false, conflict: json as ConflictInfo }
  }
  if (!res.ok) {
    return { ok: false, error: json?.error || `Request failed (${res.status})` }
  }
  return { ok: true, data: json as T }
}
