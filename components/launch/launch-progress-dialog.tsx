"use client"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { IconCheck, IconLoader2, IconX } from "@tabler/icons-react"
import { Button } from "@/components/ui/button"

export type LaunchPhase = 
  | "idle"
  | "validating"
  | "preparing"
  | "launching"
  | "success"
  | "error"

interface LaunchProgressDialogProps {
  phase: LaunchPhase
  open: boolean
  onOpenChange: (open: boolean) => void
  error?: string | null
  result?: { success: number; errors: number; total: number } | null
}

export function LaunchProgressDialog({
  phase,
  open,
  onOpenChange,
  error,
  result
}: LaunchProgressDialogProps) {
  const getStatusContent = () => {
    switch (phase) {
      case "idle":
        return null
      case "validating":
        return (
          <div className="flex flex-col items-center justify-center py-6 gap-4">
            <IconLoader2 className="h-8 w-8 animate-spin text-blue-500" />
            <p className="text-sm text-muted-foreground">Validating creatives and ad sets...</p>
          </div>
        )
      case "preparing":
        return (
          <div className="flex flex-col items-center justify-center py-6 gap-4">
            <IconLoader2 className="h-8 w-8 animate-spin text-blue-500" />
            <p className="text-sm text-muted-foreground">Preparing launch payload...</p>
          </div>
        )
      case "launching":
        return (
          <div className="flex flex-col items-center justify-center py-6 gap-4">
            <IconLoader2 className="h-8 w-8 animate-spin text-blue-500" />
            <p className="text-sm text-muted-foreground">Launching ads to Meta...</p>
          </div>
        )
      case "success":
        return (
          <div className="flex flex-col items-center justify-center py-6 gap-4">
            <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <IconCheck className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <div className="text-center">
              <p className="font-medium">Launch Complete!</p>
              {result && (
                <p className="text-sm text-muted-foreground mt-1">
                  Successfully created {result.success} out of {result.total} ads.
                  {result.errors > 0 && ` (${result.errors} failed)`}
                </p>
              )}
            </div>
            <Button onClick={() => onOpenChange(false)} className="mt-2">
              Close
            </Button>
          </div>
        )
      case "error":
        return (
          <div className="flex flex-col items-center justify-center py-6 gap-4">
            <div className="h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
              <IconX className="h-6 w-6 text-red-600 dark:text-red-400" />
            </div>
            <div className="text-center">
              <p className="font-medium">Launch Failed</p>
              <p className="text-sm text-red-600 dark:text-red-400 mt-1 max-w-[300px]">
                {error || "An unknown error occurred during launch."}
              </p>
            </div>
            <Button onClick={() => onOpenChange(false)} variant="secondary" className="mt-2">
              Close
            </Button>
          </div>
        )
    }
  }

  if (!open && phase !== "idle") {
    const active = phase === "validating" || phase === "preparing" || phase === "launching"
    return (
      <button
        type="button"
        role="status"
        aria-live="polite"
        onClick={() => onOpenChange(true)}
        className="fixed bottom-4 left-4 z-40 flex min-w-56 items-center gap-3 rounded-xl border bg-background px-4 py-3 text-left shadow-lg hover:bg-muted/40"
      >
        {active && <IconLoader2 className="size-5 shrink-0 animate-spin text-blue-500" />}
        {phase === "success" && <IconCheck className="size-5 shrink-0 text-green-600" />}
        {phase === "error" && <IconX className="size-5 shrink-0 text-red-600" />}
        <span className="min-w-0">
          <span className="block text-sm font-medium">
            {active ? "Launching ads..." : phase === "success" ? "Launch complete" : "Launch failed"}
          </span>
          <span className="block text-xs text-muted-foreground">
            {result ? `${result.success}/${result.total} succeeded` : "Click to view progress"}
          </span>
        </span>
      </button>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {phase === "success" ? "Success" : phase === "error" ? "Error" : "Launching Ads"}
          </DialogTitle>
          <DialogDescription className="hidden">
            Status of your current ad launch operation.
          </DialogDescription>
        </DialogHeader>
        {getStatusContent()}
      </DialogContent>
    </Dialog>
  )
}
