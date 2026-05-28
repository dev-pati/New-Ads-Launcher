"use client"

import { useCallback, useMemo } from "react"
import {
  ReactFlow, Background, Controls, BackgroundVariant,
  useNodesState, useEdgesState, addEdge,
  type Node, type Edge, type Connection, type NodeTypes,
  BaseEdge, EdgeLabelRenderer, getStraightPath, type EdgeProps,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import { IconPlus } from "@tabler/icons-react"
import { WorkflowNodeComponent, type WorkflowNodeData } from "./WorkflowNode"
import type { WorkflowStep } from "@/lib/workflow-types"

// ─── Constants ────────────────────────────────────────────────────────────────

const NODE_WIDTH  = 360
const NODE_HEIGHT = 130  // approximate
const NODE_GAP    = 100  // vertical gap between nodes
const CENTER_X    = 400

// ─── Custom "Add" edge ────────────────────────────────────────────────────────

function AddEdge({
  id, sourceX, sourceY, targetX, targetY, data,
}: EdgeProps & { data?: { onAdd?: () => void } }) {
  const [edgePath, labelX, labelY] = getStraightPath({ sourceX, sourceY, targetX, targetY })

  return (
    <>
      <BaseEdge id={id} path={edgePath} style={{ stroke: "hsl(var(--border))", strokeWidth: 2 }} />
      <EdgeLabelRenderer>
        <div
          style={{ position: "absolute", transform: `translate(-50%,-50%) translate(${labelX}px,${labelY}px)`, pointerEvents: "all" }}
          className="nodrag nopan"
        >
          <button
            onClick={data?.onAdd}
            className="size-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg hover:scale-110 transition-transform"
          >
            <IconPlus className="size-4" />
          </button>
        </div>
      </EdgeLabelRenderer>
    </>
  )
}

const edgeTypes = { add: AddEdge }

// ─── Node picker overlay ──────────────────────────────────────────────────────

const ACTION_CHOICES = [
  { id: "send_notification", label: "Send Notification", appId: "notification" as const, icon: "🔔" },
  { id: "duplicate_ad",      label: "Duplicate Ad",      appId: "meta"         as const, icon: "📋" },
  { id: "increase_budget",   label: "Increase Budget",   appId: "meta"         as const, icon: "📈" },
  { id: "pause_adset",       label: "Pause Ad Set",      appId: "meta"         as const, icon: "⏸️" },
  { id: "launch_tiktok",     label: "Launch on TikTok",  appId: "tiktok"       as const, icon: "🎵" },
  { id: "send_slack",        label: "Send Slack",        appId: "slack"        as const, icon: "💬" },
  { id: "add_sheet_row",     label: "Log to Sheets",     appId: "sheets"       as const, icon: "📊" },
]

// ─── Steps → nodes+edges converter ───────────────────────────────────────────

export function stepsToFlow(
  steps: WorkflowStep[],
  selectedId: string | null,
  onSelect: (id: string) => void,
  onAddBetween: (afterIndex: number) => void,
): { nodes: Node<WorkflowNodeData>[]; edges: Edge[] } {
  const nodes: Node<WorkflowNodeData>[] = steps.map((step, i) => {
    const isT = step.kind === "trigger"
    const tc  = step.triggerConfig
    const ac  = step.actionConfig

    // Empty (unconfigured) step
    const hasConfig = isT ? !!tc : !!ac
    const appId = hasConfig
      ? (isT ? tc!.appId : ac!.appId) ?? undefined
      : undefined

    let subtitle = ""
    let tags: string[] = []

    if (isT && tc) {
      const freqLabel = tc.checkFrequency === "daily" ? "Daily 9am"
        : tc.checkFrequency === "hourly" ? "Hourly"
        : "Every 6h"
      const levelLabel = tc.monitoringLevel === "campaign" ? "Campaign level"
        : tc.monitoringLevel === "adset" ? "Ad set level" : "Ad level"
      subtitle = levelLabel
      tags = (tc.metricConditions ?? []).map(c => {
        const op = c.operator === "decreases_by" ? "drops >" : c.operator === "increases_by" ? "spikes >" : c.operator === "is_above" ? ">" : "<"
        return `${c.metric === "spend" ? "Spend" : c.metric.toUpperCase()} ${op}${c.value}${c.unit}`
      })
      if (tc.campaignFilter === "all") tags.push("All campaigns")
      const wLabel = tc.comparisonWindow === "day_over_day" ? "Day over Day"
        : tc.comparisonWindow === "week_over_week" ? "Week over Week" : "Month over Month"
      tags.push(wLabel)
    }

    if (!isT && ac) {
      const n = ac.notification
      if (n) {
        subtitle = `${n.via === "email" ? "Email" : n.via === "slack" ? "Slack" : "Email + Slack"} · ${n.emailRecipients.length === 0 ? "no recipients" : n.emailRecipients.length + " recipient(s)"}`
        tags = [subtitle]
      }
    }

    const eventLabel = isT
      ? (tc?.event?.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()) ?? "")
      : (ac?.event?.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()) ?? "")

    return {
      id: step.id,
      type: "workflowNode",
      position: { x: CENTER_X - NODE_WIDTH / 2, y: i * (NODE_HEIGHT + NODE_GAP) },
      data: {
        stepIndex: i + 1,
        kind: step.kind,
        status: step.status,
        appId,
        appName: appId ? appId.charAt(0).toUpperCase() + appId.slice(1).replace(/_/g, " ") : undefined,
        eventLabel: eventLabel || undefined,
        subtitle,
        tags,
        isSelected: selectedId === step.id,
        onSelect,
      },
      selected: selectedId === step.id,
    }
  })

  const edges: Edge[] = steps.slice(0, -1).map((step, i) => ({
    id:     `e-${step.id}-${steps[i + 1].id}`,
    source: step.id,
    target: steps[i + 1].id,
    type:   "add",
    data:   { onAdd: () => onAddBetween(i + 1) },
  }))

  return { nodes, edges }
}

// ─── Canvas component ─────────────────────────────────────────────────────────

const nodeTypes: NodeTypes = { workflowNode: WorkflowNodeComponent as any }

interface Props {
  steps: WorkflowStep[]
  selectedStepId: string | null
  onSelectStep: (id: string) => void
  onAddStep: (afterIndex: number) => void
  onAddFirst: () => void
}

export function WorkflowCanvas({ steps, selectedStepId, onSelectStep, onAddStep, onAddFirst }: Props) {
  const { nodes: initNodes, edges: initEdges } = useMemo(
    () => stepsToFlow(steps, selectedStepId, onSelectStep, onAddStep),
    [steps, selectedStepId, onSelectStep, onAddStep],
  )

  const [nodes, setNodes, onNodesChange] = useNodesState(initNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initEdges)

  // Keep nodes in sync when steps change
  useMemo(() => {
    const { nodes: n, edges: e } = stepsToFlow(steps, selectedStepId, onSelectStep, onAddStep)
    setNodes(n)
    setEdges(e)
  }, [steps, selectedStepId])

  const onConnect = useCallback((c: Connection) => setEdges(es => addEdge(c, es)), [setEdges])

  return (
    <div className="w-full h-full relative">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={{ padding: 0.3, maxZoom: 1 }}
        minZoom={0.3}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={true}
        onNodeClick={(_e, node) => onSelectStep(node.id)}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1.5}
          color="hsl(var(--border))"
        />
        <Controls
          showInteractive={false}
          className="!bg-card !border-border/60 !shadow-md !rounded-xl overflow-hidden"
        />
      </ReactFlow>

      {/* "Add first step" CTA when canvas is empty */}
      {steps.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <button
            onClick={onAddFirst}
            className="pointer-events-auto flex items-center gap-2 h-10 px-5 rounded-2xl bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors shadow-lg"
          >
            <IconPlus className="size-4" />
            Add Trigger
          </button>
        </div>
      )}

      {/* "Add step" button below last node */}
      {steps.length > 0 && (
        <div
          className="absolute flex justify-center"
          style={{
            left: 0, right: 0,
            top: `calc(50% + ${steps.length * (NODE_HEIGHT + NODE_GAP) / 2}px + 30px)`,
          }}
        >
          <button
            onClick={() => onAddStep(steps.length)}
            className="size-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg hover:scale-110 transition-transform"
          >
            <IconPlus className="size-4" />
          </button>
        </div>
      )}
    </div>
  )
}
