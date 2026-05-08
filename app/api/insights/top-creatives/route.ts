import { NextRequest, NextResponse } from "next/server"
import { getAuthContext, getFacebookConnection } from "@/lib/auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

const GRAPH = "https://graph.facebook.com/v25.0"

function pickResult(actions?: { action_type: string; value: string }[]) {
  if (!actions?.length) return 0
  const priority = [
    "offsite_conversion.fb_pixel_purchase",
    "purchase",
    "lead",
    "complete_registration",
    "landing_page_view",
    "link_click",
    "post_engagement",
  ]
  for (const type of priority) {
    const found = actions.find(a => a.action_type === type)
    if (found) return parseInt(found.value || "0")
  }
  return 0
}

async function batchFetch(token: string, requests: { method: string; relative_url: string }[]) {
  const form = new URLSearchParams()
  form.append("access_token", token)
  form.append("batch", JSON.stringify(requests))
  const res = await fetch(GRAPH, { method: "POST", body: form })
  return res.json() as Promise<Array<{ code: number; body: string }>>
}

export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const connection = await getFacebookConnection(ctx.orgId)
    if (!connection) return NextResponse.json({ error: "Facebook not connected" }, { status: 400 })

    const sp          = request.nextUrl.searchParams
    const adAccountId = sp.get("adAccountId") || sp.get("ad_account_id") || ""
    const datePreset  = sp.get("datePreset") || "last_90d"
    const limit       = Math.min(parseInt(sp.get("limit") || "25"), 50)

    if (!adAccountId) return NextResponse.json({ error: "adAccountId required" }, { status: 400 })
    const token       = connection.access_token
    const accountPath = adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`

    // ── Step 1: ad-level insights sorted by spend ────────────────────────
    const insightParams = new URLSearchParams({
      level: "ad",
      fields: "ad_id,ad_name,adset_name,campaign_name,spend,impressions,inline_link_clicks,inline_link_click_ctr,actions,action_values,cost_per_action_type,date_start,date_stop",
      date_preset: datePreset,
      sort: "spend_descending",
      limit: String(limit),
      access_token: token,
    })

    const insightRes  = await fetch(`${GRAPH}/${accountPath}/insights?${insightParams}`)
    const insightData = await insightRes.json()

    if (insightData.error) {
      return NextResponse.json({ error: insightData.error.message, code: insightData.error.code }, { status: 400 })
    }

    const rows: any[] = insightData.data || []
    if (rows.length === 0) return NextResponse.json({ ads: [] })

    const adIds = rows.map(r => r.ad_id)

    // ── Step 2: get creative IDs + basic info per ad ─────────────────────
    // Use ONLY simple non-nested fields to avoid batch URL parsing issues.
    const step2 = await batchFetch(token, adIds.map(id => ({
      method: "GET",
      relative_url: `${id}?fields=id,name,created_time,creative{id,object_type,image_url,thumbnail_url}`,
    })))

    // Collect creative IDs for video ads (needs sized thumbnail in step 3)
    type AdInfo = { creativeId: string; objectType: string; imageUrl: string | null; thumbUrl: string | null; createdTime: string | null }
    const adInfo: Record<string, AdInfo> = {}

    for (let i = 0; i < step2.length; i++) {
      const item = step2[i]
      if (item.code !== 200) continue
      const parsed   = JSON.parse(item.body)
      const creative = parsed.creative || {}
      adInfo[adIds[i]] = {
        creativeId:  creative.id || "",
        objectType:  (creative.object_type || "IMAGE").toUpperCase(),
        imageUrl:    creative.image_url   || null,  // high-res for image ads
        thumbUrl:    creative.thumbnail_url || null, // small fallback
        createdTime: parsed.created_time  || null,
      }
    }

    // ── Step 3: fetch sized thumbnails (width=600,height=750) ───────────
    // Works for both image and video creatives.
    // Parameterized thumbnail fields: thumbnail_width and thumbnail_height
    // are separate query params on the creative endpoint.
    const creativeIds = Object.values(adInfo).map(a => a.creativeId).filter(Boolean)
    const sizedThumbs: Record<string, string> = {}

    if (creativeIds.length > 0) {
      const step3 = await batchFetch(token, creativeIds.map(cid => ({
        method: "GET",
        relative_url: `${cid}?thumbnail_width=600&thumbnail_height=750&fields=thumbnail_url,image_url`,
      })))

      for (let i = 0; i < step3.length; i++) {
        const item = step3[i]
        if (item.code !== 200) continue
        const parsed = JSON.parse(item.body)
        // Prefer image_url (full-res image ads), fall back to sized thumbnail_url
        const url = parsed.image_url || parsed.thumbnail_url || null
        if (url) sizedThumbs[creativeIds[i]] = url
      }
    }

    const PURCHASE_TYPES = ["offsite_conversion.fb_pixel_purchase", "purchase"]

    // ── Step 4: combine & return ─────────────────────────────────────────
    const ads = rows.map((r, idx) => {
      const info  = adInfo[r.ad_id]
      const spend   = parseFloat(r.spend || "0")
      const results = pickResult(r.actions)
      const cpr     = results > 0 ? spend / results : 0

      // Per-ad revenue from action_values
      const purchaseValue = ((r.action_values || []) as { action_type: string; value: string }[])
        .filter(a => PURCHASE_TYPES.includes(a.action_type))
        .reduce((s, a) => s + parseFloat(a.value || "0"), 0)
      const roas = spend > 0 ? purchaseValue / spend : 0

      // Best available thumbnail: sized (step3) > image_url (step2) > thumb fallback
      const thumbnail = (info?.creativeId && sizedThumbs[info.creativeId])
        || info?.imageUrl
        || info?.thumbUrl
        || null

      return {
        rank:          idx + 1,
        adId:          r.ad_id,
        adName:        r.ad_name,
        adsetName:     r.adset_name,
        campaignName:  r.campaign_name,
        spend,
        results,
        costPerResult: cpr,
        purchaseValue,
        roas,
        impressions:   parseInt(r.impressions || "0"),
        linkClicks:    parseInt(r.inline_link_clicks || "0"),
        ctr:           parseFloat(r.inline_link_click_ctr || "0"),
        dateStart:     r.date_start,
        createdTime:   info?.createdTime || null,
        thumbnail,
        isVideo:       info?.objectType === "VIDEO",
      }
    })

    return NextResponse.json({ ads, datePreset })
  } catch (err: any) {
    console.error("[insights/top-creatives]", err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
