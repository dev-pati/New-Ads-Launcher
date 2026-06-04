import { NextRequest, NextResponse } from "next/server"
import { getAuthContext, getFacebookConnection } from "@/lib/auth"
import { breakdownSnapshotFallback, datePresetToRange } from "@/lib/snapshot-fallback"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

const GRAPH = "https://graph.facebook.com/v25.0"
const PURCHASE_TYPES = ["offsite_conversion.fb_pixel_purchase", "purchase"]

function sumAction(actions: any[], types: string[]) {
  return (actions || []).filter(a => types.includes(a.action_type))
    .reduce((s, a) => s + parseFloat(a.value || "0"), 0)
}
function sumActionValue(values: any[], types: string[]) {
  return (values || []).filter(a => types.includes(a.action_type))
    .reduce((s, a) => s + parseFloat(a.value || "0"), 0)
}

function mapRow(d: any) {
  const spend        = parseFloat(d.spend || "0")
  const impressions  = parseInt(d.impressions || "0")
  const linkClicks   = parseInt(d.inline_link_clicks || "0")
  const purchases    = sumAction(d.actions, PURCHASE_TYPES)
  const purchaseValue = sumActionValue(d.action_values, PURCHASE_TYPES)
  const cpm          = impressions > 0 ? (spend / impressions) * 1000 : 0
  const ctr          = impressions > 0 ? (linkClicks / impressions) * 100 : 0
  const cpc          = linkClicks > 0 ? spend / linkClicks : 0
  const roas         = spend > 0 ? purchaseValue / spend : 0
  return { spend, impressions, linkClicks, purchases, purchaseValue, cpm, ctr, cpc, roas }
}

export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const connection = await getFacebookConnection(ctx.orgId)
    if (!connection) return NextResponse.json({ error: "Facebook not connected" }, { status: 400 })

    const sp          = request.nextUrl.searchParams
    const adAccountId = sp.get("adAccountId") || ""
    const datePreset  = sp.get("datePreset") || "last_30d"
    const campaignId  = sp.get("campaignId") || ""   // optional campaign filter
    if (!adAccountId) return NextResponse.json({ error: "adAccountId required" }, { status: 400 })

    const accountPath    = adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`
    const insightsPath   = campaignId || accountPath   // campaign-level when filtered
    const token          = connection.access_token

    const fields = "spend,impressions,inline_link_clicks,actions,action_values,cpm"

    // Fetch demographic breakdowns + account-level campaign list (always account-level for picker)
    const [genderRes, ageRes, ageGenderRes, campaignRes] = await Promise.all([
      fetch(`${GRAPH}/${insightsPath}/insights?breakdowns=gender&fields=${fields}&date_preset=${datePreset}&limit=10&access_token=${token}`),
      fetch(`${GRAPH}/${insightsPath}/insights?breakdowns=age&fields=${fields}&date_preset=${datePreset}&limit=10&access_token=${token}`),
      fetch(`${GRAPH}/${insightsPath}/insights?breakdowns=age,gender&fields=spend,impressions,inline_link_clicks,cpm&date_preset=${datePreset}&limit=50&access_token=${token}`),
      // Always fetch campaign list from account level (for the picker + performance table)
      fetch(`${GRAPH}/${accountPath}/insights?level=campaign&breakdowns=age,gender&fields=campaign_id,campaign_name,spend,impressions&date_preset=${datePreset}&sort=spend_descending&limit=100&access_token=${token}`),
    ])
    const [genderData, ageData, ageGenderData, campaignData]: any[] = await Promise.all([
      genderRes.json(), ageRes.json(), ageGenderRes.json(), campaignRes.json(),
    ])

    if (genderData.error) return NextResponse.json({ error: genderData.error.message }, { status: 400 })

    const gender = (genderData.data || []).map((d: any) => ({
      label: d.gender === "male" ? "Male" : d.gender === "female" ? "Female" : "Unknown",
      ...mapRow(d),
    })).sort((a: any, b: any) => b.spend - a.spend)

    const age = (ageData.data || []).map((d: any) => ({ label: d.age, ...mapRow(d) }))
      .sort((a: any, b: any) => {
        const order = ["13-17","18-24","25-34","35-44","45-54","55-64","65+","Unknown"]
        return order.indexOf(a.label) - order.indexOf(b.label)
      })

    const ageGender = (ageGenderData.data || []).map((d: any) => ({
      label: `${d.age} ${d.gender}`,
      age: d.age, gender: d.gender,
      spend: parseFloat(d.spend || "0"),
      impressions: parseInt(d.impressions || "0"),
      linkClicks: parseInt(d.inline_link_clicks || "0"),
      cpm: parseFloat(d.cpm || "0"),
    })).sort((a: any, b: any) => b.spend - a.spend)

    // Build campaign list (with IDs for the picker) + performance table
    type CampMap = Record<string, { id: string; name: string; spend: number; impressions: number; demogs: { label: string; spend: number }[] }>
    const campMap: CampMap = {}
    ;(campaignData.data || []).forEach((d: any) => {
      const key = d.campaign_id
      if (!campMap[key]) {
        campMap[key] = { id: d.campaign_id, name: d.campaign_name, spend: 0, impressions: 0, demogs: [] }
      }
      const s = parseFloat(d.spend || "0")
      campMap[key].spend       += s
      campMap[key].impressions += parseInt(d.impressions || "0")
      campMap[key].demogs.push({ label: `${d.age} ${d.gender}`, spend: s })
    })

    const allCampaigns = Object.values(campMap).sort((a, b) => b.spend - a.spend)

    // Campaign picker list (id + name + spend — no demog breakdown needed)
    const campaignList = allCampaigns.map(c => ({ id: c.id, name: c.name, spend: c.spend }))

    // Campaign performance table (top 10, with top demographics)
    const campaigns = allCampaigns.slice(0, 10).map(c => ({
      id: c.id,
      name: c.name,
      spend: c.spend,
      impressions: c.impressions,
      topDemographics: c.demogs
        .sort((a, b) => b.spend - a.spend)
        .slice(0, 3)
        .map(d => `${d.label}: ${c.spend > 0 ? ((d.spend / c.spend) * 100).toFixed(1) : 0}%`),
    }))

    // Summary stats
    const topGender      = gender[0]
    const topAge         = age.reduce((best: any, a: any) => (a.spend > (best?.spend || 0) ? a : best), null)
    const topAgeGender   = ageGender[0]
    const totalPurchases = gender.reduce((s: number, g: any) => s + g.purchases, 0)
    const totalSpend     = gender.reduce((s: number, g: any) => s + g.spend, 0)
    const avgCpa         = totalPurchases > 0 ? totalSpend / totalPurchases : 0
    const bestCpaSegment = ageGender
      .filter((a: any) => a.spend > 5)
      .reduce((best: any, a: any) => {
        const cpa = a.spend > 0 && (a as any).purchases > 0 ? a.spend / (a as any).purchases : Infinity
        const bestCpa = best ? (best.spend > 0 && best.purchases > 0 ? best.spend / best.purchases : Infinity) : Infinity
        return cpa < bestCpa ? a : best
      }, null as any)

    return NextResponse.json({
      gender, age, ageGender, campaigns, campaignList,
      summary: {
        topGender:     topGender ? { label: topGender.label, spend: topGender.spend, pct: totalSpend > 0 ? (topGender.spend / totalSpend) * 100 : 0 } : null,
        topAge:        topAge    ? { label: topAge.label,    spend: topAge.spend,    pct: totalSpend > 0 ? (topAge.spend    / totalSpend) * 100 : 0 } : null,
        topAgeGender:  topAgeGender ? { label: topAgeGender.label, spend: topAgeGender.spend, pct: totalSpend > 0 ? (topAgeGender.spend / totalSpend) * 100 : 0 } : null,
        totalPurchases, avgCpa,
        bestCpaSegment: bestCpaSegment?.label || null,
      },
      datePreset,
      filteredCampaignId: campaignId || null,
    })
  } catch (err: any) {
    console.error("[statistics/demographic]", err)
    try {
      const sp2 = request.nextUrl.searchParams
      const ctx2 = await getAuthContext()
      const adAccountId = sp2.get("adAccountId") || ""
      if (ctx2 && adAccountId) {
        const { since, until } = datePresetToRange(sp2.get("datePreset") || "last_30d")
        const snapshot = await breakdownSnapshotFallback(ctx2.orgId, adAccountId, since, until, ["age", "gender"])
        if (snapshot) return NextResponse.json(snapshot)
      }
    } catch {}
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
