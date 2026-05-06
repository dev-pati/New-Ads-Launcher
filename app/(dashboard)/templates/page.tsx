"use client"

import { Button } from "@/components/ui/button"
import { IconTemplate, IconPlus, IconTag, IconTrendingUp, IconSparkles } from "@tabler/icons-react"

export default function TemplatesPage() {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-6 py-5 border-b shrink-0">
        <h1 className="font-heading text-xl font-bold">Templates</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Save and reuse your best-performing ad setups.
        </p>
      </div>

      <div className="flex-1 flex items-center justify-center">
        <div className="text-center max-w-sm">
          <div className="size-16 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-4">
            <IconTemplate className="size-8 text-muted-foreground/40" />
          </div>
          <h2 className="text-lg font-semibold">Ad Templates</h2>
          <p className="text-sm text-muted-foreground mt-2">
            Save your ad copy, CTA settings, and naming conventions as templates for quick reuse.
          </p>
          <div className="flex items-center justify-center gap-2 mt-6">
            <Button size="sm" className="gap-1.5" disabled>
              <IconPlus className="size-3.5" />
              New Template
            </Button>
          </div>
          <div className="flex items-center justify-center gap-6 mt-8 text-sm text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <IconTag className="size-4" />
              Tags
            </div>
            <div className="flex items-center gap-1.5">
              <IconTrendingUp className="size-4" />
              Top Performing
            </div>
            <div className="flex items-center gap-1.5">
              <IconSparkles className="size-4" />
              AI Naming
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
