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
  // Prevent closing during active launch
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen && (phase === "validating" || phase === "preparing" || phase === "launching")) {
      return
    }
    onOpenChange(newOpen)
  }

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

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
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
