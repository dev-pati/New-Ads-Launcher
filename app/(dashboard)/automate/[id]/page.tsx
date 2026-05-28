"use client"

import dynamic from "next/dynamic"
import { use } from "react"
import { useSearchParams } from "next/navigation"
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

// ─── Template seed workflows ───────────────────────────────────────────────────

const TEMPLATE_WORKFLOWS: Record<string, { name: string; steps: WorkflowStep[] }> = {
  performance_monitoring: {
    name: "Performance Monitoring",
    steps: [
      {
        id: "step-1",
        kind: "trigger",
        status: "configured",
        triggerConfig: {
          appId: "meta",
          event: "performance_monitoring",
          monitoringLevel: "campaign",
          campaignFilter: "all",
          metricConditions: [{ metric: "spend", operator: "decreases_by", value: 20, unit: "%" }],
          comparisonWindow: "day_over_day",
          checkFrequency: "daily",
        },
      },
      {
        id: "step-2",
        kind: "action",
        status: "configured",
        actionConfig: {
          appId: "notification",
          event: "send_notification",
          notification: {
            via: "both",
            emailRecipients: [],
            customMessage: "{{trigger.summary}}\n{{trigger.entityName}}: {{trigger.previousValue}} → {{trigger.currentValue}} ({{trigger.actualChange}}% change)",
          },
        },
      },
    ],
  },
  scale_top_performers: {
    name: "Scale Top Performers",
    steps: [
      {
        id: "step-1",
        kind: "trigger",
        status: "configured",
        triggerConfig: {
          appId: "meta",
          event: "roas_threshold",
          monitoringLevel: "adset",
          campaignFilter: "all",
          metricConditions: [{ metric: "roas", operator: "is_above", value: 2, unit: "x" }],
          comparisonWindow: "day_over_day",
          checkFrequency: "daily",
        },
      },
      {
        id: "step-2",
        kind: "action",
        status: "configured",
        actionConfig: { appId: "meta", event: "duplicate_ad" },
      },
    ],
  },
  budget_boost_winners: {
    name: "Budget Boost for Winners",
    steps: [
      {
        id: "step-1",
        kind: "trigger",
        status: "configured",
        triggerConfig: {
          appId: "meta",
          event: "roas_threshold",
          monitoringLevel: "adset",
          campaignFilter: "all",
          metricConditions: [{ metric: "roas", operator: "is_above", value: 2, unit: "x" }],
          comparisonWindow: "day_over_day",
          checkFrequency: "daily",
        },
      },
      {
        id: "step-2",
        kind: "action",
        status: "configured",
        actionConfig: {
          appId: "meta",
          event: "increase_budget",
          budgetChange: { type: "increase", amount: 20, unit: "%" },
        },
      },
    ],
  },
  post_approval_scaling: {
    name: "Post-Approval Scaling",
    steps: [
      {
        id: "step-1",
        kind: "trigger",
        status: "configured",
        triggerConfig: {
          appId: "meta",
          event: "ad_approved",
          monitoringLevel: "ad",
          campaignFilter: "all",
          comparisonWindow: "day_over_day",
          checkFrequency: "daily",
        },
      },
      {
        id: "step-2",
        kind: "action",
        status: "configured",
        actionConfig: { appId: "meta", event: "duplicate_ad" },
      },
    ],
  },
  launch_winners_tiktok: {
    name: "Launch Winners on TikTok",
    steps: [
      {
        id: "step-1",
        kind: "trigger",
        status: "configured",
        triggerConfig: {
          appId: "meta",
          event: "roas_threshold",
          monitoringLevel: "ad",
          campaignFilter: "all",
          metricConditions: [{ metric: "roas", operator: "is_above", value: 2, unit: "x" }],
          comparisonWindow: "day_over_day",
          checkFrequency: "daily",
        },
      },
      {
        id: "step-2",
        kind: "action",
        status: "configured",
        actionConfig: { appId: "tiktok", event: "launch_tiktok" },
      },
    ],
  },
  launch_winners_snapchat: {
    name: "Launch Winners on Snapchat",
    steps: [
      {
        id: "step-1",
        kind: "trigger",
        status: "configured",
        triggerConfig: {
          appId: "meta",
          event: "roas_threshold",
          monitoringLevel: "ad",
          campaignFilter: "all",
          metricConditions: [{ metric: "roas", operator: "is_above", value: 2, unit: "x" }],
          comparisonWindow: "day_over_day",
          checkFrequency: "daily",
        },
      },
      {
        id: "step-2",
        kind: "action",
        status: "configured",
        actionConfig: { appId: "snapchat", event: "launch_snapchat" },
      },
    ],
  },
  launch_winners_pinterest: {
    name: "Launch Winners on Pinterest",
    steps: [
      {
        id: "step-1",
        kind: "trigger",
        status: "configured",
        triggerConfig: {
          appId: "meta",
          event: "roas_threshold",
          monitoringLevel: "ad",
          campaignFilter: "all",
          metricConditions: [{ metric: "roas", operator: "is_above", value: 2, unit: "x" }],
          comparisonWindow: "day_over_day",
          checkFrequency: "daily",
        },
      },
      {
        id: "step-2",
        kind: "action",
        status: "configured",
        actionConfig: { appId: "pinterest", event: "launch_pinterest" },
      },
    ],
  },
  pause_underperformers: {
    name: "Pause Underperformers",
    steps: [
      {
        id: "step-1",
        kind: "trigger",
        status: "configured",
        triggerConfig: {
          appId: "meta",
          event: "roas_threshold",
          monitoringLevel: "adset",
          campaignFilter: "all",
          metricConditions: [{ metric: "roas", operator: "is_below", value: 1, unit: "x" }],
          comparisonWindow: "day_over_day",
          checkFrequency: "daily",
        },
      },
      {
        id: "step-2",
        kind: "action",
        status: "configured",
        actionConfig: { appId: "meta", event: "pause_adset" },
      },
    ],
  },
  daily_budget_toggle: {
    name: "Daily Budget Rule Toggle",
    steps: [
      {
        id: "step-1",
        kind: "trigger",
        status: "configured",
        triggerConfig: {
          appId: "schedule",
          event: "schedule",
          checkFrequency: "daily",
          scheduleTime: "09:00",
        },
      },
      {
        id: "step-2",
        kind: "action",
        status: "incomplete",
        actionConfig: { appId: "meta", event: "increase_budget" },
      },
    ],
  },
  log_ad_launches_sheets: {
    name: "Log Ad Launches to Sheets",
    steps: [
      {
        id: "step-1",
        kind: "trigger",
        status: "configured",
        triggerConfig: {
          appId: "meta",
          event: "ad_approved",
          monitoringLevel: "ad",
          campaignFilter: "all",
          checkFrequency: "daily",
        },
      },
      {
        id: "step-2",
        kind: "action",
        status: "configured",
        actionConfig: { appId: "sheets", event: "add_sheet_row" },
      },
    ],
  },
}

export default function AutomationBuilderPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id }   = use(params)
  const search   = useSearchParams()
  const template = search.get("template")
  const isNew    = id === "new"

  const templateWorkflow = template ? TEMPLATE_WORKFLOWS[template] : undefined

  const initialWorkflow = isNew
    ? (templateWorkflow ?? { name: "Untitled Zap" })
    : undefined

  return (
    <div className="h-full overflow-hidden">
      <WorkflowBuilder initialWorkflow={initialWorkflow} />
    </div>
  )
}
