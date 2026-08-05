import { NextRequest, NextResponse } from "next/server"
import { getAuthContext, getConnectionForAdAccount, isManual } from "@/lib/auth"
import { secureMetaFetch } from "@/lib/meta-secure-fetch"
import { datePresetToRange } from "@/lib/snapshot-fallback"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 30

const GRAPH = "https://graph.facebook.com/v25.0"

type Level = "ad" | "adset" | "campaign"
type ActivityExtra = {
  current_value?: unknown
  previous_value?: unknown
}
type MetaActivity = {
  event_time?: string | null
  event_type?: string | null
  object_id?: string | number | null
  object_name?: string | null
  actor_name?: string | null
  extra_data?: ActivityExtra | ActivityExtra[] | null
}

const DELIVERY_EVENTS: Record<string, string> = {
  budget_id_daily_budget: "Daily budget change",
  budget_id_lifetime_budget: "Lifetime budget change",
  status_pause: "Paused",
  status_resume: "Resumed",
  status_activate: "Activated",
  campaign_status_paused: "Paused",
  campaign_status_activated: "Activated",
  adset_status_paused: "Paused",
  adset_status_activated: "Activated",
  ad_status_paused: "Paused",
  ad_status_activated: "Activated",
  schedule_start_date: "Start date change",
  schedule_end_date: "End date change",
  bid_amount: "Bid change",
  bid_strategy: "Bid strategy change",
}

function summarize(raw: MetaActivity): string {
  const label = DELIVERY_EVENTS[raw.event_type] || raw.event_type || "Edit"
  const extra = raw.extra_data
  if (!extra) return label
  const values = Array.isArray(extra) ? extra[0] : extra
  const cur = values?.current_value
  const prev = values?.previous_value
  if (cur != null && prev != null) return `${label}: ${prev} → ${cur}`
  if (cur != null) return `${label}: ${cur}`
  return label
}

export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const sp = request.nextUrl.searchParams
    const adAccountId = sp.get("adAccountId") || ""
    const id = sp.get("id") || ""
    const level = (["ad", "adset", "campaign"].includes(sp.get("level") || "") ? sp.get("level") : "ad") as Level
    const since = sp.get("since") || ""
    const until = sp.get("until") || ""
    const datePreset = sp.get("datePreset") || "last_30d"

    if (!adAccountId) return NextResponse.json({ error: "adAccountId required" }, { status: 400 })

    const connection = await getConnectionForAdAccount(ctx.orgId, adAccountId, "read")
    if (!connection) {
      return NextResponse.json({ events: [], available: false, message: "No read connection is assigned to this ad account." })
    }

    const token = connection.access_token
    const accountPath = adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`

    const { since: rs, until: ru } = since && until ? { since, until } : datePresetToRange(datePreset, "", "")

    const params = new URLSearchParams({
      fields: "event_time,event_type,object_id,object_name,actor_id,actor_name,extra_data",
      limit: "200",
      access_token: token,
    })
    if (rs && ru) { params.set("since", rs); params.set("until", ru) }

    // Object-level activities endpoint exists for campaigns/adsets/ads; account-level
    // returns a noisier feed. Prefer object-level when an id is given.
    const url = id
      ? `${GRAPH}/${id}/activities?${params}`
      : `${GRAPH}/${accountPath}/activities?${params}`

    const res = await secureMetaFetch(url, undefined, { skipProof: isManual(connection) })
    const data = await res.json()
    if (data.error) {
      // Activities may be unavailable for some accounts/permissions — degrade gracefully.
      return NextResponse.json({ events: [], available: false, message: data.error.message })
    }

    const rawEvents: MetaActivity[] = data.data || []
    const events = rawEvents
      .filter(e => id ? String(e.object_id) === id : true)
      .map(e => ({
        time: e.event_time || null,
        type: e.event_type || "edit",
        actor: e.actor_name || null,
        objectId: String(e.object_id || id),
        objectName: e.object_name || null,
        summary: summarize(e),
      }))
      .filter(e => e.time)
      .sort((a, b) => (a.time < b.time ? 1 : -1))

    return NextResponse.json({ events, available: true, level, id })
  } catch (err: unknown) {
    console.error("[insights/activities]", err)
    return NextResponse.json({
      events: [],
      available: false,
      message: err instanceof Error ? err.message : "Failed",
    }, { status: 200 })
  }
}
