"use client"

import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import type { ConflictInfo } from "@/lib/conflict-types"

/**
 * The one place a stale write surfaces to a human. Never auto-resolved: the editor
 * chooses to discard their draft and reload, or to keep editing and re-save deliberately.
 */
export function ConflictDialog({
  conflict,
  onClose,
  onReloadLatest,
  reloading,
}: {
  conflict: ConflictInfo | null
  onClose: () => void
  /** Discard the local draft and adopt `conflict.current`. */
  onReloadLatest: () => void
  reloading?: boolean
}) {
  return (
    <Dialog open={!!conflict} onOpenChange={open => { if (!open) onClose() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Someone else changed this first</DialogTitle>
          <DialogDescription>
            {conflict?.message ?? "This item was updated by someone else while you were editing. Review the latest changes before saving."}
          </DialogDescription>
        </DialogHeader>

        {conflict && conflict.conflictFields.length > 0 && (
          <div className="rounded-lg border border-border divide-y divide-border text-sm">
            {conflict.conflictFields.map(c => (
              <div key={c.field} className="flex items-center justify-between gap-3 px-3 py-2">
                <span className="text-muted-foreground">{c.label}</span>
                <span className="font-medium truncate">
                  {c.from !== null && <span className="line-through text-muted-foreground mr-1">{c.from}</span>}
                  {c.to ?? "—"}
                  {conflict.overlappingFields.includes(c.field) && (
                    <span className="ml-2 text-xs text-destructive">you also changed this</span>
                  )}
                </span>
              </div>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Keep editing</Button>
          <Button onClick={onReloadLatest} disabled={!!reloading}>
            {reloading ? "Reloading…" : "Reload latest"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
