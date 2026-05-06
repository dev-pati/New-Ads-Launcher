"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  IconChartBar,
  IconTrendingUp,
  IconPhoto,
  IconMessageCircle,
  IconChevronDown,
  IconLayoutDashboard,
} from "@tabler/icons-react"

type SubTab = "top-ads" | "dashboard" | "statistics" | "comments"

export default function InsightsPage() {
  const [subTab, setSubTab] = useState<SubTab>("top-ads")

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-6 py-5 border-b shrink-0">
        <h1 className="font-heading text-xl font-bold">Insights</h1>
        <p className="text-sm text-muted-foreground mt-1">Analyze your ad performance and creative effectiveness.</p>
      </div>

      <div className="flex items-center gap-0 px-6 border-b shrink-0">
        {[
          { id: "top-ads", label: "Top Ads", icon: IconTrendingUp },
          { id: "dashboard", label: "Custom Dashboard", icon: IconLayoutDashboard },
          { id: "statistics", label: "Statistics", icon: IconChartBar },
          { id: "comments", label: "Comments", icon: IconMessageCircle },
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
          <IconChartBar className="size-12 text-muted-foreground/30 mx-auto mb-4" />
          <h2 className="text-lg font-semibold">Insights Coming Soon</h2>
          <p className="text-sm text-muted-foreground mt-2 max-w-sm">
            Performance analytics, top ads, and reporting dashboards will be available here.
          </p>
        </div>
      </div>
    </div>
  )
}
