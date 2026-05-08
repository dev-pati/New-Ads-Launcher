import { NextRequest, NextResponse } from "next/server"
import { getAuthContext, getFacebookConnection } from "@/lib/auth"

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

function mapCountryRow(d: any) {
  const spend        = parseFloat(d.spend || "0")
  const impressions  = parseInt(d.impressions || "0")
  const linkClicks   = parseInt(d.inline_link_clicks || "0")
  const purchases    = sumAction(d.actions, PURCHASE_TYPES)
  const purchaseValue = sumActionValue(d.action_values, PURCHASE_TYPES)
  const cpm          = impressions > 0 ? (spend / impressions) * 1000 : 0
  const ctr          = impressions > 0 ? (linkClicks / impressions) * 100 : 0
  const cpc          = linkClicks > 0 ? spend / linkClicks : 0
  const cpa          = purchases > 0 ? spend / purchases : 0
  const roas         = spend > 0 ? purchaseValue / spend : 0
  return { spend, impressions, linkClicks, purchases, purchaseValue, cpm, ctr, cpc, cpa, roas }
}

// ISO 3166-1 alpha-2 country name map (common countries)
const COUNTRY_NAMES: Record<string, string> = {
  US:"United States",GB:"United Kingdom",CA:"Canada",AU:"Australia",DE:"Germany",FR:"France",
  JP:"Japan",KR:"Korea",SG:"Singapore",TH:"Thailand",VN:"Vietnam",PH:"Philippines",
  ID:"Indonesia",MY:"Malaysia",IN:"India",CN:"China",HK:"Hong Kong",TW:"Taiwan",
  NL:"Netherlands",SE:"Sweden",NO:"Norway",DK:"Denmark",FI:"Finland",ES:"Spain",
  IT:"Italy",PT:"Portugal",BR:"Brazil",MX:"Mexico",AR:"Argentina",CL:"Chile",
  AE:"UAE",SA:"Saudi Arabia",TR:"Turkey",PL:"Poland",RU:"Russia",UA:"Ukraine",
  ZA:"South Africa",NG:"Nigeria",KE:"Kenya",EG:"Egypt",NZ:"New Zealand",
  BE:"Belgium",CH:"Switzerland",AT:"Austria",CZ:"Czech Republic",HU:"Hungary",
  RO:"Romania",SK:"Slovakia",HR:"Croatia",BG:"Bulgaria",GR:"Greece",
}

function countryName(code: string) {
  return COUNTRY_NAMES[code?.toUpperCase()] || code
}

async function fetchAllPages(url: string): Promise<any[]> {
  const rows: any[] = []
  let nextUrl: string | null = url
  while (nextUrl) {
    const res  = await fetch(nextUrl)
    const data: any = await res.json()
    if (data.error) throw new Error(data.error.message)
    rows.push(...(data.data || []))
    nextUrl = data.paging?.next || null
  }
  return rows
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
    const campaignId  = sp.get("campaignId") || ""
    if (!adAccountId) return NextResponse.json({ error: "adAccountId required" }, { status: 400 })

    const accountPath  = adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`
    const insightsPath = campaignId || accountPath
    const token        = connection.access_token

    const fields = "spend,impressions,inline_link_clicks,actions,action_values"

    const [countryRows, campaignRows] = await Promise.all([
      fetchAllPages(`${GRAPH}/${insightsPath}/insights?breakdowns=country&fields=${fields}&date_preset=${datePreset}&sort=spend_descending&limit=200&access_token=${token}`),
      // Always fetch campaign list from account level
      fetchAllPages(`${GRAPH}/${accountPath}/insights?level=campaign&fields=campaign_id,campaign_name,spend&date_preset=${datePreset}&sort=spend_descending&limit=100&access_token=${token}`),
    ])

    // Build country list
    const countries = countryRows.map((d: any) => ({
      code:  (d.country || "").toUpperCase(),
      label: countryName(d.country),
      ...mapCountryRow(d),
    })).sort((a, b) => b.spend - a.spend)

    // Campaign picker list (deduplicated by id)
    const campMap: Record<string, { id: string; name: string; spend: number }> = {}
    campaignRows.forEach((r: any) => {
      const k = r.campaign_id
      if (!campMap[k]) campMap[k] = { id: r.campaign_id, name: r.campaign_name, spend: 0 }
      campMap[k].spend += parseFloat(r.spend || "0")
    })
    const campaignList = Object.values(campMap).sort((a, b) => b.spend - a.spend)

    // Summary
    const totalSpend     = countries.reduce((s, c) => s + c.spend, 0)
    const totalClicks    = countries.reduce((s, c) => s + c.linkClicks, 0)
    const totalPurchases = countries.reduce((s, c) => s + c.purchases, 0)
    const avgCpa         = totalPurchases > 0 ? totalSpend / totalPurchases : 0
    const topCountry     = countries[0] || null

    const bestCpaCountry = countries
      .filter(c => c.purchases > 0 && c.spend > 5)
      .reduce((best, c) => (!best || c.cpa < best.cpa ? c : best), null as typeof countries[0] | null)

    return NextResponse.json({
      countries,
      campaignList,
      summary: {
        topCountry:      topCountry ? { label: topCountry.label, code: topCountry.code, spend: topCountry.spend, pct: totalSpend > 0 ? (topCountry.spend / totalSpend) * 100 : 0 } : null,
        countriesCount:  countries.length,
        totalSpend,
        totalClicks,
        totalPurchases,
        avgCpa,
        bestCpaCountry:  bestCpaCountry ? { label: bestCpaCountry.label, cpa: bestCpaCountry.cpa } : null,
      },
      datePreset,
      filteredCampaignId: campaignId || null,
    })
  } catch (err: any) {
    console.error("[statistics/country]", err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
