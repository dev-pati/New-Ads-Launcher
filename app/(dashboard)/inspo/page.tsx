"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  IconBulb,
  IconScan,
  IconSparkles,
  IconPencil,
  IconBinoculars,
  IconBookmark,
} from "@tabler/icons-react"

type SubTab = "adscan" | "ai" | "create" | "brand-spy" | "saved"

export default function InspoPage() {
  const [subTab, setSubTab] = useState<SubTab>("adscan")

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-6 py-5 border-b shrink-0">
        <h1 className="font-heading text-xl font-bold">Inspo</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Research competitors, scan winning ads, and generate creative inspiration.
        </p>
      </div>

      <div className="flex items-center gap-0 px-6 border-b shrink-0">
        {[
          { id: "adscan", label: "Ad Scan", icon: IconScan },
          { id: "ai", label: "AI", icon: IconSparkles },
          { id: "create", label: "Create", icon: IconPencil },
          { id: "brand-spy", label: "Brand Spy", icon: IconBinoculars },
          { id: "saved", label: "Saved Ads", icon: IconBookmark },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setSubTab(t.id as SubTab)}
            className={cn(
              "flex items-center gap-1.5 px-0 py-3 mr-7 text-sm border-b-2 transition-colors",
              subTab === t.id
                ? "border-foreground font-medium text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <t.icon className="size-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <IconBulb className="size-12 text-muted-foreground/30 mx-auto mb-4" />
          <h2 className="text-lg font-semibold">Creative Inspiration</h2>
          <p className="text-sm text-muted-foreground mt-2 max-w-sm">
            Ad scanning, AI generation, brand spy tools, and saved ads will be available here.
          </p>
        </div>
      </div>
    </div>
  )
}
