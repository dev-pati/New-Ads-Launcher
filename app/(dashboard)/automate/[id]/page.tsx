"use client"

import dynamic from "next/dynamic"
import { use } from "react"
import { useSearchParams } from "next/navigation"
import { IconLoader2 } from "@tabler/icons-react"

// React Flow requires browser APIs — load client-side only
const WorkflowBuilder = dynamic(
  () => import("@/components/automate/WorkflowBuilder").then(m => m.WorkflowBuilder),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center">
        <IconLoader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    ),
  }
)

// ─── Template seed data ───────────────────────────────────────────────────────

const TEMPLATE_NAMES: Record<string, string> = {
  performance_monitoring: "Performance Monitoring",
  scale_top_performers:   "Scale Top Performers",
  budget_boost_winners:   "Budget Boost for Winners",
  pause_underperformers:  "Pause Underperformers",
  log_ad_launches_sheets: "Log Ad Launches to Sheets",
}

export default function AutomationBuilderPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id }    = use(params)
  const search    = useSearchParams()
  const template  = search.get("template")
  const isNew     = id === "new"

  const initialWorkflow = isNew ? {
    name: template ? (TEMPLATE_NAMES[template] ?? "New Automation") : "New Automation",
  } : undefined

  return (
    <div className="h-full overflow-hidden">
      <WorkflowBuilder initialWorkflow={initialWorkflow} />
    </div>
  )
}
