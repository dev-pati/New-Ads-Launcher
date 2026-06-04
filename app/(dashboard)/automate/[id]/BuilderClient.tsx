"use client"

import dynamic from "next/dynamic"
import { IconLoader2 } from "@tabler/icons-react"
import type { WorkflowStep } from "@/lib/workflow-types"

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

export function BuilderClient({
  initialWorkflow,
}: {
  initialWorkflow?: { name?: string; steps?: WorkflowStep[] }
}) {
  return (
    <div className="h-full overflow-hidden">
      <WorkflowBuilder initialWorkflow={initialWorkflow} />
    </div>
  )
}
