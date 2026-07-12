"use client"

import { useCallback, useMemo } from "react"
import {
  ReactFlow, Background, Controls, BackgroundVariant,
  useNodesState, useEdgesState, addEdge,
  type Node, type Edge, type Connection, type NodeTypes,
  BaseEdge, EdgeLabelRenderer, getStraightPath, type EdgeProps,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import { IconPlus, IconBolt } from "@tabler/icons-react"
import { WorkflowNodeComponent, type WorkflowNodeData } from "./WorkflowNode"
import type { WorkflowStep } from "@/lib/workflow-types"
import { APP_REGISTRY, TRIGGER_EVENT_REGISTRY, ACTION_EVENT_REGISTRY } from "@/lib/workflow-types"

// ─── Constants ────────────────────────────────────────────────────────────────

const NODE_WIDTH  = 360
const NODE_HEIGHT = 130
const NODE_GAP    = 100
const CENTER_X    = 400

// ─── Position type ────────────────────────────────────────────────────────────

export interface ClickPos { x: number; y: number }

// ─── Custom "Add" edge ────────────────────────────────────────────────────────

function AddEdge({
  id, sourceX, sourceY, targetX, targetY, data,
}: EdgeProps & { data?: { onAdd?: (pos: ClickPos) => void } }) {
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
            onClick={(e) => {
              e.stopPropagation()
              const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect()
              data?.onAdd?.({ x: rect.left + rect.width / 2, y: rect.bottom + 8 })
            }}
            className="size-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg hover:scale-110 transition-transform"
          >
            <IconPlus className="size-4" />
          </button>
        </div>
      </EdgeLabelRenderer>
    </>
  )
}

// ─── Custom "Add step" bottom node ────────────────────────────────────────────

type AddNodeData = { onAdd: (pos: ClickPos) => void }

function AddNodeComponent({ data }: { data: AddNodeData }) {
  return (
    <div className="flex flex-col items-center gap-0 nodrag">
      {/* connector line from last node */}
      <div className="w-px h-8 bg-border" />
      <button
        onClick={(e) => {
          e.stopPropagation()
          const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect()
          data.onAdd({ x: rect.left + rect.width / 2, y: rect.bottom + 8 })
        }}
        className="size-7 rounded-full border-2 border-dashed border-muted-foreground/30 text-muted-foreground/40 flex items-center justify-center hover:border-primary/50 hover:text-primary/50 transition-colors"
      >
        <IconPlus className="size-3.5" />
      </button>
    </div>
  )
}

const edgeTypes = { add: AddEdge }

// ─── Steps → nodes+edges converter ───────────────────────────────────────────

export function stepsToFlow(
  steps: WorkflowStep[],
  selectedId: string | null,
  onSelect: (id: string) => void,
  onAddBetween: (afterIndex: number, pos: ClickPos) => void,
  onDelete: (id: string) => void,
): { nodes: Node[]; edges: Edge[] } {
  const stepNodes: Node<WorkflowNodeData>[] = steps.map((step, i) => {
    const isT = step.kind === "trigger"
    const tc  = step.triggerConfig
    const ac  = step.actionConfig

    const hasConfig = step.kind === "trigger" ? !!tc
      : step.kind === "delay"    ? !!step.delayConfig
      : step.kind === "approval" ? !!step.approvalConfig
      : !!ac
    const appId = (step.kind === "trigger" && tc) ? tc.appId ?? undefined
      : (step.kind === "action"  && ac) ? ac.appId  ?? undefined
      : undefined

    let subtitle = ""
    let tags: string[] = []

    if (step.kind === "delay") {
      const dc = step.delayConfig
      subtitle = dc ? `${dc.value} ${dc.unit}` : ""
      tags = []
    } else if (step.kind === "approval") {
      const apc = step.approvalConfig
      subtitle = apc && apc.approvers.length > 0
        ? `${apc.approvers.length} approver${apc.approvers.length > 1 ? "s" : ""}`
        : "No approvers set"
      tags = []
    } else if (isT && tc) {
      if (tc.appId === "meta") {
        const freqLabel = tc.checkFrequency === "daily" ? "Daily 9am"
          : tc.checkFrequency === "hourly" ? "Hourly"
          : "Every 6h"
        const levelLabel = tc.monitoringLevel === "campaign" ? "Campaign level"
          : tc.monitoringLevel === "adset" ? "Ad set level" : "Ad level"
        subtitle = `${freqLabel} · ${levelLabel}`
        tags = (tc.metricConditions ?? []).map(c => {
          const op = c.operator === "decreases_by" ? "drops >"
            : c.operator === "increases_by" ? "spikes >"
            : c.operator === "is_above" ? ">" : "<"
          return `${c.metric === "spend" ? "Spend" : c.metric.toUpperCase()} ${op}${c.value}${c.unit}`
        })
        if (tc.campaignFilter === "all") tags.push("All campaigns")
        const wLabel = tc.comparisonWindow === "day_over_day" ? "Day over Day"
          : tc.comparisonWindow === "week_over_week" ? "Week over Week" : "Month over Month"
        tags.push(wLabel)
        tags.push(freqLabel)
      } else if (tc.appId === "schedule") {
        const freqLabel = tc.checkFrequency === "daily" ? "Daily" : tc.checkFrequency === "hourly" ? "Hourly" : "Every 6h"
        subtitle = tc.scheduleTime ? `${freqLabel} · ${tc.scheduleTime}` : freqLabel
        tags = tc.scheduleDays && tc.scheduleDays.length > 0 ? [tc.scheduleDays.join(", ")] : []
      } else if (tc.appId === "manual") {
        subtitle = "Run on demand"
      }
    }

    if (!isT && ac && ac.appId === "notification") {
      const n = ac.notification
      if (n) {
        subtitle = `${n.via === "email" ? "Email" : n.via === "slack" ? "Slack" : "Email + Slack"} · ${n.emailRecipients.length === 0 ? "no recipients" : n.emailRecipients.length + " recipient(s)"}`
        tags = [subtitle]
      }
    }

    const eventLabel = step.kind === "delay"
      ? `Wait for Duration`
      : step.kind === "approval"
      ? "Approval Required"
      : isT
        ? (tc?.event ? (TRIGGER_EVENT_REGISTRY[tc.event]?.label ?? tc.event.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())) : "")
        : (ac?.event ? (ACTION_EVENT_REGISTRY[ac.event]?.label  ?? ac.event.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()))  : "")

    const appName = step.kind === "delay"    ? "Delay"
      : step.kind === "approval" ? "Approval"
      : appId ? (APP_REGISTRY[appId]?.name ?? appId.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())) : undefined

    return {
      id: step.id,
      type: "workflowNode",
      position: { x: CENTER_X - NODE_WIDTH / 2, y: i * (NODE_HEIGHT + NODE_GAP) },
      data: {
        stepIndex: i + 1,
        kind: step.kind,
        status: step.status,
        appId,
        appName,
        eventLabel: eventLabel || undefined,
        subtitle,
        tags,
        isSelected: selectedId === step.id,
        onSelect,
        onDelete,
      },
      selected: selectedId === step.id,
    }
  })

  // "Add step" button node below the last real node
  const addButtonNode: Node<AddNodeData> = {
    id: "__add_step__",
    type: "addNode",
    position: { x: CENTER_X - 14, y: steps.length * (NODE_HEIGHT + NODE_GAP) },
    data: { onAdd: (pos: ClickPos) => onAddBetween(steps.length, pos) },
    selectable: false,
    draggable: false,
  }

  const edges: Edge[] = steps.slice(0, -1).map((step, i) => ({
    id:     `e-${step.id}-${steps[i + 1].id}`,
    source: step.id,
    target: steps[i + 1].id,
    type:   "add",
    data:   { onAdd: (pos: ClickPos) => onAddBetween(i + 1, pos) },
  }))

  return { nodes: [...stepNodes, addButtonNode], edges }
}

// ─── Canvas component ─────────────────────────────────────────────────────────

const nodeTypes: NodeTypes = {
  workflowNode: WorkflowNodeComponent as any,
  addNode: AddNodeComponent as any,
}

interface Props {
  steps: WorkflowStep[]
  selectedStepId: string | null
  onSelectStep: (id: string) => void
  onAddStep: (afterIndex: number, pos: ClickPos) => void
  onAddFirst: () => void
  onDeleteStep: (id: string) => void
}

export function WorkflowCanvas({ steps, selectedStepId, onSelectStep, onAddStep, onAddFirst, onDeleteStep }: Props) {
  const { nodes: initNodes, edges: initEdges } = useMemo(
    () => stepsToFlow(steps, selectedStepId, onSelectStep, onAddStep, onDeleteStep),
    [steps, selectedStepId, onSelectStep, onAddStep, onDeleteStep],
  )

  const [nodes, setNodes, onNodesChange] = useNodesState(initNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initEdges)

  useMemo(() => {
    const { nodes: n, edges: e } = stepsToFlow(steps, selectedStepId, onSelectStep, onAddStep, onDeleteStep)
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
        fitViewOptions={{ padding: 0.35, maxZoom: 1 }}
        minZoom={0.3}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={true}
        onNodeClick={(_e, node) => {
          if (node.id !== "__add_step__") onSelectStep(node.id)
        }}
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

      {/* "Build your automation" empty state */}
      {steps.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="flex flex-col items-center gap-5 text-center max-w-[340px] pointer-events-auto">
            <div className="relative">
              <div className="size-24 rounded-3xl bg-[#2563EB]/10 flex items-center justify-center">
                <div className="size-16 rounded-2xl bg-[#2563EB] flex items-center justify-center shadow-lg">
                  <IconBolt className="size-8 text-white" />
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-foreground">Build your automation</h2>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Start by adding a trigger — the event that kicks off your automation workflow.
              </p>
            </div>
            <button
              onClick={onAddFirst}
              className="flex items-center gap-2 h-10 px-6 rounded-2xl bg-[#2563EB] text-white font-semibold text-sm hover:bg-[#1D4ED8] transition-colors shadow-md"
            >
              <IconPlus className="size-4" />
              Add Trigger
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
