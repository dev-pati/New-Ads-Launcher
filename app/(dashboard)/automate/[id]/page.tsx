import { Suspense } from "react"
import { IconLoader2 } from "@tabler/icons-react"
import type { WorkflowStep } from "@/lib/workflow-types"
import { BuilderClient } from "./BuilderClient"

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


export default async function AutomationBuilderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ template?: string }>
}) {
  const { id }       = await params
  const { template } = await searchParams
  const isNew        = id === "new"

  const templateWorkflow = template ? TEMPLATE_WORKFLOWS[template] : undefined

  let initialWorkflow: { id?: string; name?: string; steps?: WorkflowStep[] } | undefined

  if (isNew) {
    initialWorkflow = templateWorkflow ?? { name: "Untitled Zap" }
  } else {
    // Load existing automation from API (server-side, has session via cookies)
    try {
      const { cookies } = await import("next/headers")
      const cookieStore = await cookies()
      const cookieHeader = cookieStore.getAll().map(c => `${c.name}=${c.value}`).join("; ")

      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
      const res = await fetch(`${baseUrl}/api/automations/${id}`, {
        headers: { Cookie: cookieHeader },
        cache: "no-store",
      })
      if (res.ok) {
        const data = await res.json()
        const automation = data.automation
        if (automation) {
          // Rebuild steps from DB format
          const steps: WorkflowStep[] = []
          if (automation.trigger_config?.appId) {
            steps.push({
              id: "step-trigger",
              kind: "trigger",
              status: "configured",
              triggerConfig: automation.trigger_config,
            })
          }
          const actionSteps: WorkflowStep[] = (automation.actions ?? []).map((a: any, i: number) => ({
            id: `step-${i + 2}`,
            kind: a.kind ?? "action",
            status: "configured",
            actionConfig:   a.actionConfig   ?? (a.kind === "action" ? a : undefined),
            delayConfig:    a.delayConfig    ?? undefined,
            approvalConfig: a.approvalConfig ?? undefined,
          }))
          steps.push(...actionSteps)
          initialWorkflow = { id: automation.id, name: automation.name, steps }
        }
      }
    } catch (e) {
      console.error("[AutomationBuilder] Failed to load automation:", e)
    }
  }

  return (
    <Suspense fallback={
      <div className="flex h-full items-center justify-center">
        <IconLoader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    }>
      <BuilderClient initialWorkflow={initialWorkflow} />
    </Suspense>
  )
}
