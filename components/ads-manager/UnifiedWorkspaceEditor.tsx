"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  IconCheck,
  IconExternalLink,
  IconPhoto,
  IconPlayerPlay,
  IconSparkles,
} from "@tabler/icons-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import type { Level } from "./InsightDrawers"
import { LoadMediaModal } from "@/components/shared/load-media-modal"
import type { Creative } from "@/types/creative"

export type WorkspaceNode = {
  id: string
  name: string
  campaign_id?: string
  adset_id?: string
  status?: string
  daily_budget?: string
  lifetime_budget?: string
  start_time?: string
  stop_time?: string
  end_time?: string
  objective?: string
  buying_type?: string
  special_ad_categories?: string[]
  optimization_goal?: string
  bid_strategy?: string
  bid_amount?: string
  conversion_location?: string
  promoted_object?: {
    pixel_id?: string
    custom_event_type?: string
  }
  targeting?: {
    geo_locations?: { countries?: string[] }
    age_min?: number
    age_max?: number
    genders?: number[]
    custom_audiences?: { id: string; name: string }[]
    excluded_custom_audiences?: { id: string; name: string }[]
    targeting_optimization?: string
    publisher_platforms?: string[]
    device_platforms?: string[]
  }
  attribution_spec?: { event_type: string; window_days: number }[]
  advertiser?: { type: string; id: string; name: string } | null
  payer?: { type: string; id: string; name: string } | null
  creative?: {
    thumbnail_url?: string
    image_url?: string
    title?: string
    name?: string
    body?: string
    video_id?: string
  }
  page_id?: string
  image_hash?: string
  video_id?: string
  thumb_url?: string
  primaryText?: string
  headline?: string
  description?: string
  link?: string
  cta?: string
  portal_creative_id?: string
  creative_edit?: boolean
  primary_text_variations?: string[]
  headline_variations?: string[]
  description_variations?: string[]
}

type Props = {
  node: WorkspaceNode | null
  level: Level
  onSave?: (node: WorkspaceNode) => Promise<void> | void
  onReview?: () => void
  readOnly?: boolean
  loading?: boolean
  error?: string
  onRefresh?: () => void
  onDraftChange?: (node: WorkspaceNode, level: Level) => void
  accountId?: string
}

const OBJECTIVE_LABEL: Record<string, string> = {
  OUTCOME_SALES: "Sales",
  OUTCOME_LEADS: "Leads",
  OUTCOME_TRAFFIC: "Traffic",
  OUTCOME_AWARENESS: "Awareness",
  OUTCOME_ENGAGEMENT: "Engagement",
  OUTCOME_APP_PROMOTION: "App promotion",
  OUTCOME_REACH: "Reach",
  LINK_CLICKS: "Link clicks",
  CONVERSIONS: "Conversions",
}

const BID_LABEL: Record<string, string> = {
  LOWEST_COST_WITHOUT_CAP: "Highest volume or value",
  LOWEST_COST_WITH_BID_CAP: "Bid cap",
  COST_CAP: "Cost per result goal",
  MINIMUM_ROAS: "Minimum ROAS",
}

const OPT_LABEL: Record<string, string> = {
  LINK_CLICKS: "Link clicks",
  IMPRESSIONS: "Impressions",
  REACH: "Reach",
  LANDING_PAGE_VIEWS: "Landing page views",
  CONVERSIONS: "Conversions",
  OFFSITE_CONVERSIONS: "Offsite conversions",
  VIDEO_VIEWS: "Video views",
  LEAD_GENERATION: "Lead generation",
  APP_INSTALLS: "App installs",
}

function formatDateTime(value?: string) {
  return value ? value.slice(0, 16) : ""
}

function Section({
  title,
  children,
  optional = false,
}: {
  title: string
  children: React.ReactNode
  optional?: boolean
}) {
  return (
    <section className="space-y-4 rounded-lg border border-[#e4e6eb] bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-card">
      <div className="mb-3 flex items-center gap-2">
        <span className="grid size-4 place-items-center rounded-full border border-emerald-600 text-emerald-600">
          <IconCheck className="size-2.5" />
        </span>
        <h3 className="text-sm font-semibold">{title}</h3>
        {optional && <span className="text-xs text-muted-foreground">Optional</span>}
      </div>
      {children}
    </section>
  )
}

function StatusControl({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <div className="grid grid-cols-2 gap-1 rounded-lg border bg-muted/40 p-1">
      {(["ACTIVE", "PAUSED"] as const).map(status => (
        <button
          key={status}
          type="button"
          onClick={() => onChange(status)}
          className={cn(
            "h-8 rounded-md text-xs font-semibold transition-colors",
            value === status
              ? status === "ACTIVE"
                ? "bg-emerald-600 text-white shadow-sm"
                : "border bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {status === "ACTIVE" ? "Active" : "Paused"}
        </button>
      ))}
    </div>
  )
}

function AdPreview({ node }: { node: WorkspaceNode }) {
  const thumbnail = node.thumb_url || node?.creative?.thumbnail_url || node?.creative?.image_url
  const videoId = node.video_id || node?.creative?.video_id
  const videoSrc = videoId
    ? `/api/insights/video-proxy?videoId=${encodeURIComponent(videoId)}${node.page_id ? `&pageId=${encodeURIComponent(node.page_id)}` : ""}`
    : ""
  const title = node.headline || node?.creative?.title || node?.creative?.name || node?.name
  const body = node.primaryText || node?.creative?.body || "Primary text will appear here."
  return (
    <div className="mx-auto w-full max-w-[330px] overflow-hidden rounded-lg border bg-background shadow-sm">
      <div className="flex items-center gap-2 px-3 py-2">
        <span className="grid size-8 place-items-center rounded-full bg-neutral-900 text-xs font-bold text-white">P</span>
        <div>
          <p className="text-xs font-semibold">Facebook Page</p>
          <p className="text-[10px] text-muted-foreground">Sponsored · Public</p>
        </div>
      </div>
      <p className="px-3 pb-2 text-xs leading-relaxed">{body}</p>
      <div className="relative flex aspect-square items-center justify-center bg-neutral-100 dark:bg-neutral-900">
        {videoSrc ? (
          <video
            src={videoSrc}
            poster={thumbnail || undefined}
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            className="size-full object-contain"
            aria-label="Ad video preview"
          />
        ) : thumbnail ? (
          <img src={thumbnail} alt="" className="size-full object-contain" />
        ) : (
          <IconPhoto className="size-12 text-muted-foreground" />
        )}
        {videoSrc && (
          <span className="absolute grid size-11 place-items-center rounded-full bg-black/70 text-white">
            <IconPlayerPlay className="size-5" />
          </span>
        )}
      </div>
      <div className="flex items-center justify-between gap-3 bg-muted/30 px-3 py-2">
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold">{title}</p>
          <p className="truncate text-[10px] text-muted-foreground">Website destination</p>
        </div>
        <Button variant="outline" size="sm" className="h-7 shrink-0 text-xs">Learn more</Button>
      </div>
    </div>
  )
}

export function UnifiedWorkspaceEditor({
  node,
  level,
  onSave,
  onReview,
  readOnly = false,
  loading = false,
  error,
  onRefresh,
  onDraftChange,
  accountId = "",
}: Props) {
  const [draft, setDraft] = useState<WorkspaceNode | null>(node)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false)
  const syncingNodeRef = useRef(false)
  const nodeSignature = useMemo(() => JSON.stringify(node), [node])
  const draftSignature = useMemo(() => JSON.stringify(draft), [draft])

  useEffect(() => {
    setDraft(current =>
      {
        if (JSON.stringify(current) === nodeSignature) {
          syncingNodeRef.current = false
          return current
        }
        syncingNodeRef.current = true
        return JSON.parse(nodeSignature) as WorkspaceNode | null
      }
    )
    setSaved(false)
  }, [level, nodeSignature])

  useEffect(() => {
    if (!draft || nodeSignature === "null" || !onDraftChange) return
    if (syncingNodeRef.current) {
      if (draftSignature === nodeSignature) syncingNodeRef.current = false
      return
    }
    if (draftSignature !== nodeSignature) onDraftChange(draft, level)
  }, [draft, draftSignature, level, nodeSignature, onDraftChange])

  const typeLabel = level === "campaign" ? "Campaign" : level === "adset" ? "Ad set" : "Ad"
  const hasDailyBudget = draft?.daily_budget != null && draft?.daily_budget !== ""
  const hasLifetimeBudget = draft?.lifetime_budget != null && draft?.lifetime_budget !== ""
  const budgetCents = Number.parseInt(draft?.daily_budget || draft?.lifetime_budget || "0")
  const strategy = useMemo(() => {
    if (!draft) return []
    const values: string[] = []
    if (level === "campaign" && draft.objective) values.push(OBJECTIVE_LABEL[draft.objective] || draft.objective)
    if (level === "adset" && draft.optimization_goal) values.push(OPT_LABEL[draft.optimization_goal] || draft.optimization_goal)
    if (draft.bid_strategy) values.push(BID_LABEL[draft.bid_strategy] || draft.bid_strategy)
    return values
  }, [draft, level])

  if (loading && !draft) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="text-center">
          <p className="font-semibold">Loading fresh Meta details…</p>
          <p className="mt-1 text-sm text-muted-foreground">This node will be cached for the current workspace session.</p>
        </div>
      </div>
    )
  }

  if (!draft) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="max-w-sm text-center">
          <p className="font-semibold">Select a campaign, ad set or ad</p>
          <p className="mt-1 text-sm text-muted-foreground">The editor will stay in this workspace while you move through the hierarchy.</p>
        </div>
      </div>
    )
  }

  const updateCreative = (updates: Partial<WorkspaceNode>) => {
    setDraft(current => current ? { ...current, ...updates, creative_edit: true } : current)
    setSaved(false)
  }

  const selectPortalMedia = (_ids: string[], creatives: Creative[]) => {
    const creative = creatives[0]
    if (!creative) return
    updateCreative({
      portal_creative_id: creative.id,
      image_hash: creative.fb_image_hash,
      video_id: creative.fb_video_id,
      thumb_url: creative.fb_thumbnail_url || creative.fb_image_url || creative.file_url,
    })
    setMediaPickerOpen(false)
  }

  const save = async () => {
    if (!onSave || saving) return
    setSaving(true)
    setSaved(false)
    try {
      await onSave(draft)
      setSaved(true)
      window.setTimeout(() => setSaved(false), 2200)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="grid min-h-full grid-cols-1 bg-[#f5f6f7] xl:grid-cols-[minmax(420px,680px)_minmax(330px,520px)] dark:bg-background">
      <div className="min-w-0 overflow-y-auto bg-white xl:border-r dark:bg-card">
        <div className="mx-auto max-w-4xl space-y-6 px-6 py-8 pb-24">
        {error && (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
            <span>{error} The editor is read-only until fresh detail loads.</span>
            <Button type="button" variant="outline" size="sm" onClick={onRefresh}>Retry</Button>
          </div>
        )}
        <fieldset disabled={readOnly} className="space-y-6 border-0 p-0">
        {readOnly && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Your role has read-only access. Charts, Preview, Review and History remain available.
          </div>
        )}
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold text-[#1c2b33] dark:text-gray-100">{typeLabel}</h1>
          <span className="text-xs font-medium text-[#65676b]">Edit</span>
        </div>

        <Section title={`${typeLabel} name`}>
          <div className="flex gap-2">
            <Input value={draft.name || ""} onChange={event => setDraft({ ...draft, name: event.target.value })} />
            <Button variant="outline" className="shrink-0">Create template</Button>
          </div>
        </Section>

        <Section title="Delivery">
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Status</Label>
            <StatusControl value={draft.status || "PAUSED"} onChange={status => setDraft({ ...draft, status })} />
          </div>
        </Section>

        {level === "campaign" && (
          <Section title="Campaign details">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Buying type</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={draft.buying_type || "AUCTION"}
                  onChange={event => setDraft({ ...draft, buying_type: event.target.value })}
                >
                  <option value="AUCTION">Auction</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Objective</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={draft.objective || ""}
                  onChange={event => setDraft({ ...draft, objective: event.target.value })}
                >
                  <option value="">Select objective</option>
                  {Object.entries(OBJECTIVE_LABEL).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-3 space-y-2">
              <Label className="text-xs text-muted-foreground">Special Ad Categories</Label>
              {[
                ["CREDIT", "Credit"],
                ["EMPLOYMENT", "Employment"],
                ["HOUSING", "Housing"],
                ["ISSUES_ELECTIONS_POLITICS", "Social issues, elections or politics"],
              ].map(([value, label]) => {
                const selected = draft.special_ad_categories?.includes(value) === true
                return (
                  <label key={value} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => setDraft({
                        ...draft,
                        special_ad_categories: selected
                          ? (draft.special_ad_categories || []).filter(item => item !== value)
                          : [...(draft.special_ad_categories || []), value],
                      })}
                    />
                    <span>{label}</span>
                  </label>
                )
              })}
            </div>
            <p className="mt-3 text-xs text-amber-700">
              Changing structural fields creates a replacement hierarchy; the existing campaign stays unchanged.
            </p>
          </Section>
        )}

        {(level === "campaign" || level === "adset") && (
          <Section title="Budget & schedule">
            {(hasDailyBudget || hasLifetimeBudget) ? (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">{hasDailyBudget ? "Daily budget" : "Lifetime budget"}</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                  <Input
                    type="number"
                    min="0"
                    step=".01"
                    className="pl-7"
                    value={budgetCents / 100}
                    onChange={event => {
                      const cents = String(Math.round((Number.parseFloat(event.target.value) || 0) * 100))
                      setDraft(hasDailyBudget ? { ...draft, daily_budget: cents } : { ...draft, lifetime_budget: cents })
                    }}
                  />
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700">
                Budget is controlled at the {level === "adset" ? "campaign" : "ad set"} level.
              </div>
            )}
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Start</Label>
                <Input
                  type="datetime-local"
                  className="text-xs"
                  value={formatDateTime(draft.start_time)}
                  onChange={event => setDraft({ ...draft, start_time: event.target.value ? new Date(event.target.value).toISOString() : "" })}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">End</Label>
                <Input
                  type="datetime-local"
                  className="text-xs"
                  value={formatDateTime(level === "campaign" ? draft.stop_time : draft.end_time)}
                  onChange={event => {
                    const value = event.target.value ? new Date(event.target.value).toISOString() : ""
                    setDraft(level === "campaign" ? { ...draft, stop_time: value } : { ...draft, end_time: value })
                  }}
                />
              </div>
            </div>
          </Section>
        )}

        {level === "adset" && (
          <>
            <Section title="Conversion">
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Conversion location</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={draft.conversion_location || "website"}
                    onChange={e => setDraft({ ...draft, conversion_location: e.target.value })}
                  >
                    <option value="website">Website</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Performance goal</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={draft.optimization_goal || ""}
                    onChange={e => setDraft({ ...draft, optimization_goal: e.target.value })}
                  >
                    <option value="">Select goal</option>
                    {Object.entries(OPT_LABEL).map(([val, label]) => (
                      <option key={val} value={val}>{label}</option>
                    ))}
                  </select>
                </div>
                {draft.optimization_goal === "OFFSITE_CONVERSIONS" && (
                  <>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Pixel</Label>
                      <select
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={draft.promoted_object?.pixel_id || ""}
                        onChange={e => setDraft({ ...draft, promoted_object: { ...draft.promoted_object, pixel_id: e.target.value } })}
                      >
                        <option value="">Select Pixel</option>
                        {draft.promoted_object?.pixel_id && <option value={draft.promoted_object.pixel_id}>{draft.promoted_object.pixel_id}</option>}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Conversion event</Label>
                      <select
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={draft.promoted_object?.custom_event_type || ""}
                        onChange={e => setDraft({ ...draft, promoted_object: { ...draft.promoted_object, custom_event_type: e.target.value } })}
                      >
                        <option value="PURCHASE">Purchase</option>
                        <option value="ADD_TO_CART">Add to cart</option>
                        <option value="INITIATED_CHECKOUT">Initiate checkout</option>
                        <option value="LEAD">Lead</option>
                        <option value="COMPLETE_REGISTRATION">Complete registration</option>
                        <option value="VIEW_CONTENT">View content</option>
                      </select>
                    </div>
                  </>
                )}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-muted-foreground">Cost per result goal</Label>
                    <span className="text-xs text-muted-foreground">Optional</span>
                  </div>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                    <Input
                      type="number"
                      min="0"
                      step=".01"
                      className="pl-7"
                      value={draft.bid_amount ? (parseInt(draft.bid_amount) / 100) : ""}
                      onChange={e => setDraft({ ...draft, bid_amount: e.target.value ? String(Math.round(parseFloat(e.target.value) * 100)) : "" })}
                      placeholder="0.00"
                    />
                  </div>
                </div>
              </div>
            </Section>

            <Section title="Attribution setting">
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Click</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={draft.attribution_spec?.find(a => a.event_type === "CLICK")?.window_days || "7"}
                    onChange={e => {
                      const days = parseInt(e.target.value)
                      const spec = [...(draft.attribution_spec || [])]
                      const idx = spec.findIndex(a => a.event_type === "CLICK")
                      if (idx >= 0) spec[idx].window_days = days
                      else spec.push({ event_type: "CLICK", window_days: days })
                      setDraft({ ...draft, attribution_spec: spec })
                    }}
                  >
                    <option value="1">1 day</option>
                    <option value="7">7 days</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">View</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={draft.attribution_spec?.find(a => a.event_type === "VIEW")?.window_days || "1"}
                    onChange={e => {
                      const days = parseInt(e.target.value)
                      const spec = [...(draft.attribution_spec || [])].filter(a => a.event_type !== "VIEW")
                      if (days > 0) spec.push({ event_type: "VIEW", window_days: days })
                      setDraft({ ...draft, attribution_spec: spec })
                    }}
                  >
                    <option value="0">None</option>
                    <option value="1">1 day</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Engaged-view</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={draft.attribution_spec?.find(a => a.event_type === "ENGAGED_VIEW")?.window_days || "0"}
                    onChange={e => {
                      const days = parseInt(e.target.value)
                      const spec = [...(draft.attribution_spec || [])].filter(a => a.event_type !== "ENGAGED_VIEW")
                      if (days > 0) spec.push({ event_type: "ENGAGED_VIEW", window_days: days })
                      setDraft({ ...draft, attribution_spec: spec })
                    }}
                  >
                    <option value="0">None</option>
                    <option value="1">1 day</option>
                  </select>
                </div>
              </div>
            </Section>

            <Section title="Audience">
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Locations</Label>
                  <div className="min-h-10 rounded-md border border-input bg-background p-2">
                    <div className="flex flex-wrap gap-2">
                      {(draft.targeting?.geo_locations?.countries || []).map(code => (
                        <span key={code} className="inline-flex items-center gap-1.5 rounded-sm bg-blue-100 px-2 py-0.5 text-xs text-blue-700">
                          {code}
                          <button
                            type="button"
                            onClick={() => {
                              const newCountries = (draft.targeting?.geo_locations?.countries || []).filter(c => c !== code)
                              setDraft({ ...draft, targeting: { ...draft.targeting, geo_locations: { ...draft.targeting?.geo_locations, countries: newCountries } } })
                            }}
                          >×</button>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Age</Label>
                    <div className="flex items-center gap-2">
                      <select
                        className="flex h-10 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={draft.targeting?.age_min || 18}
                        onChange={e => setDraft({ ...draft, targeting: { ...draft.targeting, age_min: parseInt(e.target.value) } })}
                      >
                        {Array.from({ length: 48 }, (_, i) => i + 18).map(age => <option key={age} value={age}>{age}</option>)}
                      </select>
                      <span className="text-xs text-muted-foreground">to</span>
                      <select
                        className="flex h-10 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={draft.targeting?.age_max || 65}
                        onChange={e => setDraft({ ...draft, targeting: { ...draft.targeting, age_max: parseInt(e.target.value) } })}
                      >
                        {Array.from({ length: 48 }, (_, i) => i + 18).map(age => <option key={age} value={age}>{age === 65 ? "65+" : age}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Gender</Label>
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={draft.targeting?.genders?.[0] || 0}
                      onChange={e => {
                        const val = parseInt(e.target.value)
                        setDraft({ ...draft, targeting: { ...draft.targeting, genders: val ? [val] : [] } })
                      }}
                    >
                      <option value={0}>All genders</option>
                      <option value={1}>Men</option>
                      <option value={2}>Women</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Detailed Targeting</Label>
                  <Input readOnly placeholder="Search demographics, interests..." />
                  <div className="mt-3 flex items-start gap-2 rounded border bg-muted/30 p-3">
                    <input
                      type="checkbox"
                      checked={draft.targeting?.targeting_optimization === "expansion_all"}
                      onChange={e => setDraft({ ...draft, targeting: { ...draft.targeting, targeting_optimization: e.target.checked ? "expansion_all" : "none" } })}
                      className="mt-0.5"
                    />
                    <div className="text-xs">
                      <span className="block font-medium">Advantage detailed targeting</span>
                      <span className="text-muted-foreground">Reach people beyond your selections when likely to improve performance.</span>
                    </div>
                  </div>
                </div>
              </div>
            </Section>

            <Section title="Placements">
              <div className="space-y-3">
                <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-3">
                  <input
                    type="radio"
                    name="placementMode"
                    checked={!draft.targeting?.publisher_platforms?.length || draft.targeting.publisher_platforms.length === 4}
                    onChange={() => setDraft({ ...draft, targeting: { ...draft.targeting, publisher_platforms: ["facebook", "instagram", "audience_network", "messenger"] } })}
                    className="mt-1"
                  />
                  <div>
                    <span className="block text-sm font-medium">Advantage+ placements</span>
                    <span className="block text-xs text-muted-foreground">Recommended. Meta allocates budget across best performing placements.</span>
                  </div>
                </label>
                <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-3">
                  <input
                    type="radio"
                    name="placementMode"
                    checked={(draft.targeting?.publisher_platforms?.length || 0) > 0 && (draft.targeting?.publisher_platforms?.length || 0) < 4}
                    onChange={() => setDraft({ ...draft, targeting: { ...draft.targeting, publisher_platforms: ["facebook", "instagram"] } })}
                    className="mt-1"
                  />
                  <div className="w-full">
                    <span className="block text-sm font-medium">Manual placements</span>
                    <span className="block mb-2 text-xs text-muted-foreground">Choose where your ads appear.</span>
                    <div className={cn("grid grid-cols-2 gap-2 transition-opacity", (!draft.targeting?.publisher_platforms?.length || draft.targeting.publisher_platforms.length === 4) && "pointer-events-none opacity-50")}>
                      {["facebook", "instagram", "audience_network", "messenger"].map(plat => (
                        <label key={plat} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={draft.targeting?.publisher_platforms?.includes(plat)}
                            onChange={e => {
                              const curr = draft.targeting?.publisher_platforms || []
                              const next = e.target.checked ? [...curr, plat] : curr.filter(p => p !== plat)
                              setDraft({ ...draft, targeting: { ...draft.targeting, publisher_platforms: next } })
                            }}
                          />
                          <span className="text-xs capitalize">{plat.replace("_", " ")}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </label>
              </div>
            </Section>

            <Section title="Ad transparency">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Advertiser</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={draft.advertiser ? `${draft.advertiser.type}:${draft.advertiser.id}` : ""}
                    onChange={e => {
                      const [type, id] = e.target.value.split(":")
                      setDraft({ ...draft, advertiser: id ? { type, id, name: "Selected Advertiser" } : null })
                    }}
                  >
                    <option value="">Select Advertiser...</option>
                    {draft.advertiser && <option value={`${draft.advertiser.type}:${draft.advertiser.id}`}>{draft.advertiser.name}</option>}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Payer</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={draft.payer ? `${draft.payer.type}:${draft.payer.id}` : ""}
                    onChange={e => {
                      const [type, id] = e.target.value.split(":")
                      setDraft({ ...draft, payer: id ? { type, id, name: "Selected Payer" } : null })
                    }}
                  >
                    <option value="">Select Payer...</option>
                    {draft.payer && <option value={`${draft.payer.type}:${draft.payer.id}`}>{draft.payer.name}</option>}
                  </select>
                </div>
              </div>
            </Section>
          </>
        )}

        {level === "campaign" && strategy.length > 0 && (
          <Section title="Strategy">
            <div className="flex flex-wrap gap-2">
              {strategy.map(value => <span key={value} className="rounded-md border bg-muted/40 px-2.5 py-1 text-xs font-medium">{value}</span>)}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              This tracer keeps strategy fields read-only. Advanced Meta settings remain in the existing create flow.
            </p>
          </Section>
        )}

        {level === "ad" && (
          <>
            {mediaPickerOpen && (
              <LoadMediaModal
                open={mediaPickerOpen}
                onClose={() => setMediaPickerOpen(false)}
                adAccountId={accountId}
                alreadySelected={new Set(draft.portal_creative_id ? [draft.portal_creative_id] : [])}
                onConfirm={selectPortalMedia}
                tabs={["vault"]}
              />
            )}
            <Section title="Identity">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5"><Label className="text-xs">Facebook Page ID</Label><Input value={draft.page_id || ""} onChange={event => updateCreative({ page_id: event.target.value })} /></div>
                <div className="space-y-1.5"><Label className="text-xs">Instagram profile</Label><Input value="Use Facebook Page" readOnly /></div>
              </div>
            </Section>
            <Section title="Ad creative">
              <div className="mt-4 space-y-3">
                <Button type="button" variant="outline" size="sm" onClick={() => setMediaPickerOpen(true)}>
                  Replace media from Creative Portal
                </Button>
                <div className="space-y-1.5">
                  <Label className="text-xs">Primary text</Label>
                  <textarea className="min-h-24 w-full rounded-md border bg-background px-3 py-2 text-sm" value={draft.primaryText || ""} onChange={event => updateCreative({ primaryText: event.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5"><Label className="text-xs">Headline</Label><Input value={draft.headline || ""} onChange={event => updateCreative({ headline: event.target.value })} /></div>
                  <div className="space-y-1.5"><Label className="text-xs">Description</Label><Input value={draft.description || ""} onChange={event => updateCreative({ description: event.target.value })} /></div>
                  <div className="space-y-1.5"><Label className="text-xs">Destination URL</Label><Input value={draft.link || ""} onChange={event => updateCreative({ link: event.target.value })} /></div>
                  <div className="space-y-1.5"><Label className="text-xs">Call to action</Label><Input value={draft.cta || "LEARN_MORE"} onChange={event => updateCreative({ cta: event.target.value })} /></div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Copy or media edits create a new Meta creative and reassign this ad. The previous creative is retained.
                </p>
              </div>
            </Section>
          </>
        )}

        <div className="sticky bottom-0 -mx-6 flex items-center justify-end gap-2 border-t border-[#e4e6eb] bg-white/95 px-6 py-3 backdrop-blur dark:border-gray-800 dark:bg-card/95">
          {saved && <span className="mr-auto text-xs font-medium text-emerald-600">Changes saved</span>}
          <Button variant="outline" onClick={onReview}>Review</Button>
          <Button onClick={save} disabled={saving || !draft.name?.trim()}>{saving ? "Saving…" : "Save changes"}</Button>
        </div>
        </fieldset>
        </div>
      </div>

      <aside className="space-y-4 overflow-y-auto bg-[#f5f6f7] p-5 dark:bg-background">
        <section className="rounded-lg border border-[#e4e6eb] bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-card">
          <div className="flex items-start gap-2">
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-teal-50 text-teal-700"><IconSparkles className="size-4" /></span>
            <div>
              <p className="text-sm font-semibold">Campaign recommendations</p>
              <p className="text-xs text-muted-foreground">No settings are applied automatically.</p>
            </div>
          </div>
        </section>
        {level === "ad" && <section className="rounded-lg border border-[#e4e6eb] bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-card">
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-sm font-semibold">Preview</p>
            <Button variant="outline" size="sm" className="h-8">
              <IconExternalLink className="mr-1 size-3.5" /> Advanced preview
            </Button>
          </div>
          <AdPreview node={draft} />
        </section>}
      </aside>
    </div>
  )
}
