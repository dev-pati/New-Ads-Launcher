import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"

const GRAPH = "https://graph.facebook.com/v25.0"
const SERVER_VERSION = "1.0.0"
const SERVER_NAME = "AdLauncher MCP Server"

// ─── Tool definitions ────────────────────────────────────────────────────────

const TOOLS = [
  {
    name: "get_ad_accounts",
    description: "List all Facebook ad accounts connected to this workspace.",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "get_campaigns",
    description: "List campaigns for a Facebook ad account with performance metrics.",
    inputSchema: {
      type: "object",
      properties: {
        ad_account_id: { type: "string", description: "Ad account ID (e.g. act_123456)" },
        date_preset: {
          type: "string",
          enum: ["today", "yesterday", "last_7d", "last_14d", "last_30d", "last_90d", "this_month", "last_month"],
          description: "Date range for insights. Defaults to last_7d.",
        },
        status_filter: {
          type: "string",
          enum: ["ACTIVE", "PAUSED", "ALL"],
          description: "Filter by campaign status. Defaults to ALL.",
        },
      },
      required: ["ad_account_id"],
    },
  },
  {
    name: "get_adsets",
    description: "List ad sets for a campaign or ad account with budget and performance data.",
    inputSchema: {
      type: "object",
      properties: {
        ad_account_id: { type: "string", description: "Ad account ID (e.g. act_123456)" },
        campaign_id: { type: "string", description: "Optional: filter by campaign ID" },
        date_preset: { type: "string", description: "Date range. Defaults to last_7d." },
      },
      required: ["ad_account_id"],
    },
  },
  {
    name: "get_ad_insights",
    description: "Get detailed performance metrics (ROAS, spend, CPC, CTR, impressions) for an ad account, campaign, or ad set.",
    inputSchema: {
      type: "object",
      properties: {
        ad_account_id: { type: "string", description: "Ad account ID (e.g. act_123456)" },
        level: {
          type: "string",
          enum: ["account", "campaign", "adset", "ad"],
          description: "Aggregation level for insights.",
        },
        date_preset: {
          type: "string",
          enum: ["today", "yesterday", "last_7d", "last_14d", "last_30d", "this_month"],
          description: "Date range. Defaults to last_7d.",
        },
        entity_id: { type: "string", description: "Optional: specific campaign/adset/ad ID to filter by" },
      },
      required: ["ad_account_id"],
    },
  },
  {
    name: "toggle_status",
    description: "Pause or resume a campaign, ad set, or ad.",
    inputSchema: {
      type: "object",
      properties: {
        entity_id: { type: "string", description: "ID of the campaign, ad set, or ad" },
        entity_type: {
          type: "string",
          enum: ["campaign", "adset", "ad"],
          description: "Type of entity to toggle",
        },
        action: {
          type: "string",
          enum: ["pause", "resume"],
          description: "Action to perform",
        },
      },
      required: ["entity_id", "entity_type", "action"],
    },
  },
  {
    name: "adjust_budget",
    description: "Change the daily or lifetime budget of a campaign or ad set.",
    inputSchema: {
      type: "object",
      properties: {
        entity_id: { type: "string", description: "ID of the campaign or ad set" },
        entity_type: {
          type: "string",
          enum: ["campaign", "adset"],
          description: "Type of entity",
        },
        budget_type: {
          type: "string",
          enum: ["daily_budget", "lifetime_budget"],
          description: "Which budget to change",
        },
        amount: {
          type: "number",
          description: "New budget amount in your account currency (e.g. 100 for $100)",
        },
      },
      required: ["entity_id", "entity_type", "budget_type", "amount"],
    },
  },
  {
    name: "get_media_library",
    description: "List ad creatives and media (images and videos) from the Facebook ad account media library.",
    inputSchema: {
      type: "object",
      properties: {
        ad_account_id: { type: "string", description: "Ad account ID (e.g. act_123456)" },
        media_type: {
          type: "string",
          enum: ["image", "video", "all"],
          description: "Type of media to fetch. Defaults to all.",
        },
        limit: { type: "number", description: "Max results (1-50). Defaults to 20." },
      },
      required: ["ad_account_id"],
    },
  },
  {
    name: "get_automation_rules",
    description: "List Facebook Automated Rules for an ad account.",
    inputSchema: {
      type: "object",
      properties: {
        ad_account_id: { type: "string", description: "Ad account ID (e.g. act_123456)" },
      },
      required: ["ad_account_id"],
    },
  },
]

// ─── Auth helper ────────────────────────────────────────────────────────────

async function getFbToken(orgId: string) {
  const admin = createAdminClient()
  const { data: conn } = await admin
    .from("facebook_connections")
    .select("access_token")
    .eq("org_id", orgId)
    .eq("is_active", true)
    .order("updated_at", { ascending: false })
    .limit(1)
    .single()
  return conn?.access_token || null
}

async function resolveApiKey(bearer: string) {
  const admin = createAdminClient()

  // OAuth token (mcp_xxx)
  if (bearer.startsWith("mcp_")) {
    const { data, error } = await admin
      .from("mcp_oauth_tokens")
      .select("id, org_id, user_id, expires_at")
      .eq("access_token", bearer)
      .single()

    if (error || !data) return null
    if (new Date(data.expires_at) < new Date()) return null

    await admin.from("mcp_oauth_tokens").update({ last_used_at: new Date().toISOString() }).eq("id", data.id)

    const fbToken = await getFbToken(data.org_id)
    if (!fbToken) return null
    return { orgId: data.org_id, userId: data.user_id, token: fbToken }
  }

  // API key (al_xxx)
  if (bearer.startsWith("al_")) {
    const { hashMcpApiKey } = await import("@/lib/mcp-keys")
    const hash = hashMcpApiKey(bearer)

    // Prefer hash lookup (post-migration). Fall back to legacy plaintext column.
    const { data: hashed, error: hashErr } = await admin
      .from("mcp_api_keys")
      .select("id, org_id, user_id")
      .eq("api_key_hash", hash)
      .maybeSingle()

    let row = hashed
    if (!row) {
      const { data: legacy } = await admin
        .from("mcp_api_keys")
        .select("id, org_id, user_id")
        .eq("api_key", bearer)
        .maybeSingle()
      row = legacy
    }

    if (!row) return null
    if (hashErr && hashErr.code !== "PGRST116" && hashErr.code !== "42703") return null

    await admin.from("mcp_api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", row.id)

    const fbToken = await getFbToken(row.org_id)
    if (!fbToken) return null
    return { orgId: row.org_id, userId: row.user_id, token: fbToken }
  }

  return null
}

// ─── Tool executors ──────────────────────────────────────────────────────────

async function execGetAdAccounts(token: string) {
  const res = await fetch(`${GRAPH}/me/adaccounts?fields=id,name,account_id,account_status,currency,timezone_name&limit=50&access_token=${token}`)
  const d = await res.json()
  if (d.error) throw new Error(d.error.message)
  const accounts = (d.data || []).map((a: any) => ({
    id: a.account_id,
    name: a.name,
    status: a.account_status === 1 ? "ACTIVE" : "INACTIVE",
    currency: a.currency,
    timezone: a.timezone_name,
  }))
  return formatTable(accounts, ["id", "name", "status", "currency", "timezone"])
}

async function execGetCampaigns(token: string, args: any) {
  const { ad_account_id, date_preset = "last_7d", status_filter = "ALL" } = args
  const account = ad_account_id.startsWith("act_") ? ad_account_id : `act_${ad_account_id}`
  const fields = `id,name,status,objective,daily_budget,lifetime_budget,insights.date_preset(${date_preset}){spend,impressions,clicks,actions,action_values,purchase_roas}`
  const url = `${GRAPH}/${account}/campaigns?fields=${encodeURIComponent(fields)}&limit=50&access_token=${token}`
  const res = await fetch(url)
  const d = await res.json()
  if (d.error) throw new Error(d.error.message)

  let campaigns = d.data || []
  if (status_filter !== "ALL") {
    campaigns = campaigns.filter((c: any) => c.status === status_filter)
  }

  const rows = campaigns.map((c: any) => {
    const ins = c.insights?.data?.[0]
    const roas = ins?.purchase_roas?.[0]?.value
    const purchases = ins?.actions?.find((a: any) => a.action_type === "offsite_conversion.fb_pixel_purchase")?.value
    return {
      id: c.id,
      name: c.name,
      status: c.status,
      objective: c.objective,
      daily_budget: c.daily_budget ? `$${(c.daily_budget / 100).toFixed(2)}` : "-",
      spend: ins?.spend ? `$${parseFloat(ins.spend).toFixed(2)}` : "$0",
      roas: roas ? parseFloat(roas).toFixed(2) : "-",
      purchases: purchases || "0",
    }
  })
  return formatTable(rows, ["id", "name", "status", "daily_budget", "spend", "roas", "purchases"])
}

async function execGetAdsets(token: string, args: any) {
  const { ad_account_id, campaign_id, date_preset = "last_7d" } = args
  const account = ad_account_id.startsWith("act_") ? ad_account_id : `act_${ad_account_id}`
  const fields = `id,name,status,daily_budget,lifetime_budget,optimization_goal,insights.date_preset(${date_preset}){spend,impressions,clicks,purchase_roas,actions}`
  const base = campaign_id ? `${GRAPH}/${campaign_id}/adsets` : `${GRAPH}/${account}/adsets`
  const url = `${base}?fields=${encodeURIComponent(fields)}&limit=100&access_token=${token}`
  const res = await fetch(url)
  const d = await res.json()
  if (d.error) throw new Error(d.error.message)

  const rows = (d.data || []).map((a: any) => {
    const ins = a.insights?.data?.[0]
    const roas = ins?.purchase_roas?.[0]?.value
    return {
      id: a.id,
      name: a.name,
      status: a.status,
      daily_budget: a.daily_budget ? `$${(a.daily_budget / 100).toFixed(2)}` : "-",
      spend: ins?.spend ? `$${parseFloat(ins.spend).toFixed(2)}` : "$0",
      roas: roas ? parseFloat(roas).toFixed(2) : "-",
      goal: a.optimization_goal,
    }
  })
  return formatTable(rows, ["id", "name", "status", "daily_budget", "spend", "roas", "goal"])
}

async function execGetAdInsights(token: string, args: any) {
  const { ad_account_id, level = "campaign", date_preset = "last_7d", entity_id } = args
  const account = ad_account_id.startsWith("act_") ? ad_account_id : `act_${ad_account_id}`
  const fields = "campaign_id,campaign_name,adset_id,adset_name,ad_id,ad_name,spend,impressions,clicks,ctr,cpc,cpm,frequency,purchase_roas,actions,action_values"
  const base = entity_id ? `${GRAPH}/${entity_id}/insights` : `${GRAPH}/${account}/insights`
  const url = `${base}?fields=${encodeURIComponent(fields)}&level=${level}&date_preset=${date_preset}&limit=50&access_token=${token}`
  const res = await fetch(url)
  const d = await res.json()
  if (d.error) throw new Error(d.error.message)

  const rows = (d.data || []).map((r: any) => {
    const roas = r.purchase_roas?.[0]?.value
    const purchases = r.actions?.find((a: any) => a.action_type === "offsite_conversion.fb_pixel_purchase")?.value
    const name = r.ad_name || r.adset_name || r.campaign_name || "-"
    return {
      name,
      spend: `$${parseFloat(r.spend || "0").toFixed(2)}`,
      impressions: parseInt(r.impressions || "0").toLocaleString(),
      clicks: r.clicks || "0",
      ctr: r.ctr ? `${parseFloat(r.ctr).toFixed(2)}%` : "-",
      cpc: r.cpc ? `$${parseFloat(r.cpc).toFixed(2)}` : "-",
      cpm: r.cpm ? `$${parseFloat(r.cpm).toFixed(2)}` : "-",
      roas: roas ? parseFloat(roas).toFixed(2) : "-",
      purchases: purchases || "0",
    }
  })
  return formatTable(rows, ["name", "spend", "impressions", "clicks", "ctr", "cpc", "roas", "purchases"])
}

async function execToggleStatus(token: string, args: any) {
  const { entity_id, entity_type, action } = args
  const status = action === "pause" ? "PAUSED" : "ACTIVE"
  const params = new URLSearchParams({ access_token: token, status })
  const res = await fetch(`${GRAPH}/${entity_id}`, { method: "POST", body: params })
  const d = await res.json()
  if (d.error) throw new Error(d.error.message)
  return `✅ Successfully ${action === "pause" ? "paused" : "resumed"} ${entity_type} ${entity_id}. New status: ${status}.`
}

async function execAdjustBudget(token: string, args: any) {
  const { entity_id, budget_type, amount } = args
  const budgetInCents = Math.round(amount * 100)
  const params = new URLSearchParams({ access_token: token, [budget_type]: String(budgetInCents) })
  const res = await fetch(`${GRAPH}/${entity_id}`, { method: "POST", body: params })
  const d = await res.json()
  if (d.error) throw new Error(d.error.message)
  return `✅ Budget updated for ${entity_id}. New ${budget_type.replace("_", " ")}: $${amount.toFixed(2)}.`
}

async function execGetMediaLibrary(token: string, args: any) {
  const { ad_account_id, media_type = "all", limit = 20 } = args
  const account = ad_account_id.startsWith("act_") ? ad_account_id : `act_${ad_account_id}`
  const lim = Math.min(Math.max(1, limit), 50)
  const results: any[] = []

  if (media_type === "all" || media_type === "image") {
    const res = await fetch(`${GRAPH}/${account}/adimages?fields=hash,name,status,width,height,created_time&limit=${lim}&access_token=${token}`)
    const d = await res.json()
    if (!d.error) {
      ;(d.data || []).forEach((img: any) => {
        results.push({ type: "image", name: img.name || img.hash, status: img.status, dimensions: `${img.width}x${img.height}`, created: img.created_time?.split("T")[0] })
      })
    }
  }

  if (media_type === "all" || media_type === "video") {
    const res = await fetch(`${GRAPH}/${account}/advideos?fields=id,title,status,length,created_time&limit=${lim}&access_token=${token}`)
    const d = await res.json()
    if (!d.error) {
      ;(d.data || []).forEach((v: any) => {
        const st = typeof v.status === "object" ? v.status?.value : v.status
        results.push({ type: "video", name: v.title || v.id, status: st, dimensions: `${v.length?.toFixed(0) || "?"}s`, created: v.created_time?.split("T")[0] })
      })
    }
  }

  return formatTable(results.slice(0, lim), ["type", "name", "status", "dimensions", "created"])
}

async function execGetAutomationRules(token: string, args: any) {
  const { ad_account_id } = args
  const account = ad_account_id.startsWith("act_") ? ad_account_id : `act_${ad_account_id}`
  const fields = "id,name,status,schedule_spec,actions,evaluation_spec,created_time"
  const res = await fetch(`${GRAPH}/${account}/adrules_library?fields=${fields}&limit=50&access_token=${token}`)
  const d = await res.json()
  if (d.error) throw new Error(d.error.message)

  const rows = (d.data || []).map((r: any) => ({
    id: r.id,
    name: r.name,
    status: r.status,
    schedule: r.evaluation_spec?.schedule_spec?.schedule_type || r.schedule_spec?.schedule_type || "-",
    action: r.actions?.[0]?.type || "-",
    created: r.created_time?.split("T")[0] || "-",
  }))
  return formatTable(rows, ["id", "name", "status", "schedule", "action", "created"])
}

// ─── Format helper ───────────────────────────────────────────────────────────

function formatTable(rows: any[], cols: string[]): string {
  if (!rows.length) return "No results found."
  const header = cols.join(" | ")
  const sep = cols.map(c => "-".repeat(c.length)).join("-|-")
  const body = rows.map(r => cols.map(c => String(r[c] ?? "-")).join(" | ")).join("\n")
  return `${header}\n${sep}\n${body}\n\n(${rows.length} result${rows.length !== 1 ? "s" : ""})`
}

function jsonRpcError(id: any, code: number, message: string) {
  return NextResponse.json({ jsonrpc: "2.0", id, error: { code, message } })
}

function jsonRpcResult(id: any, result: any) {
  return NextResponse.json({ jsonrpc: "2.0", id, result })
}

// ─── Main handler ────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  // Extract API key
  const authHeader = request.headers.get("authorization") || ""
  const apiKey = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : ""

  if (!apiKey || (!apiKey.startsWith("al_") && !apiKey.startsWith("mcp_"))) {
    return NextResponse.json({ jsonrpc: "2.0", id: null, error: { code: -32000, message: "Missing or invalid token. Use Authorization: Bearer <api_key_or_oauth_token>" } }, { status: 401 })
  }

  let body: any
  try { body = await request.json() } catch {
    return jsonRpcError(null, -32700, "Parse error: invalid JSON")
  }

  const { jsonrpc, id, method, params = {} } = body
  if (jsonrpc !== "2.0") return jsonRpcError(id, -32600, "Invalid Request: jsonrpc must be '2.0'")

  // Handle initialize without auth (handshake)
  if (method === "initialize") {
    return jsonRpcResult(id, {
      protocolVersion: "2024-11-05",
      capabilities: { tools: {} },
      serverInfo: { name: SERVER_NAME, version: SERVER_VERSION },
    })
  }

  if (method === "notifications/initialized") {
    return new NextResponse(null, { status: 204 })
  }

  // All other methods require valid API key
  const ctx = await resolveApiKey(apiKey)
  if (!ctx) {
    return NextResponse.json({ jsonrpc: "2.0", id, error: { code: -32001, message: "Invalid API key or Facebook not connected" } }, { status: 401 })
  }

  const { token } = ctx

  if (method === "tools/list") {
    return jsonRpcResult(id, { tools: TOOLS })
  }

  if (method === "tools/call") {
    const { name, arguments: args = {} } = params
    try {
      let text = ""

      switch (name) {
        case "get_ad_accounts":     text = await execGetAdAccounts(token); break
        case "get_campaigns":       text = await execGetCampaigns(token, args); break
        case "get_adsets":          text = await execGetAdsets(token, args); break
        case "get_ad_insights":     text = await execGetAdInsights(token, args); break
        case "toggle_status":       text = await execToggleStatus(token, args); break
        case "adjust_budget":       text = await execAdjustBudget(token, args); break
        case "get_media_library":   text = await execGetMediaLibrary(token, args); break
        case "get_automation_rules": text = await execGetAutomationRules(token, args); break
        default:
          return jsonRpcError(id, -32601, `Tool not found: ${name}`)
      }

      return jsonRpcResult(id, { content: [{ type: "text", text }] })
    } catch (err: any) {
      return jsonRpcResult(id, {
        content: [{ type: "text", text: `Error: ${err.message}` }],
        isError: true,
      })
    }
  }

  return jsonRpcError(id, -32601, `Method not found: ${method}`)
}

// SSE transport for mcp-remote + regular info for browsers
export async function GET(request: NextRequest) {
  const accept = request.headers.get("accept") || ""

  if (accept.includes("text/event-stream")) {
    const url = new URL(request.url)
    const postEndpoint = `${url.protocol}//${url.host}/api/mcp`
    const encoder = new TextEncoder()

    const stream = new ReadableStream({
      start(controller) {
        // Send endpoint event — mcp-remote reads this to know where to POST
        controller.enqueue(encoder.encode(`event: endpoint\ndata: ${postEndpoint}\n\n`))

        // Keepalive pings so the connection stays alive
        const ping = setInterval(() => {
          try {
            controller.enqueue(encoder.encode(`: ping\n\n`))
          } catch {
            clearInterval(ping)
          }
        }, 20000)

        request.signal.addEventListener("abort", () => {
          clearInterval(ping)
          try { controller.close() } catch {}
        })
      },
    })

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive",
        "Access-Control-Allow-Origin": "*",
        "X-Accel-Buffering": "no",
      },
    })
  }

  return NextResponse.json({
    name: SERVER_NAME,
    version: SERVER_VERSION,
    protocol: "MCP/2024-11-05",
    tools: TOOLS.map(t => t.name),
  })
}
