import { NextRequest, NextResponse } from "next/server"
import { getAuthContext, requireRole } from "@/lib/auth"
import { createAdminClient } from "@/lib/supabase/admin"

const PORTAL_MEDIA_ORIGIN = process.env.CREATIVE_MEDIA_API_ORIGIN || "https://creative.patigroup.com"

function mediaUrl(assetId: string) {
  return `${PORTAL_MEDIA_ORIGIN}/api/media/${assetId}`
}

async function requireLaunchRole() {
  const ctx = await getAuthContext()
  if (!ctx) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  const denied = requireRole(ctx)
  if (denied) return { error: denied }
  return { ctx }
}

export async function GET() {
  const auth = await requireLaunchRole()
  if (auth.error) return auth.error
  const ctx = auth.ctx!

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from("portal_media_items")
    .select("*")
    .or(`org_id.is.null,org_id.eq.${ctx.orgId}`)
    .order("first_seen_at", { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const items = (data || []).map(item => ({
    ...item,
    file_url: mediaUrl(item.portal_asset_id),
  }))

  return NextResponse.json({ items })
}

export async function PUT(request: NextRequest) {
  const auth = await requireLaunchRole()
  if (auth.error) return auth.error
  const ctx = auth.ctx!

  const body = await request.json()
  const ids = Array.isArray(body.ids) ? body.ids.filter((id: unknown) => typeof id === "string") : []
  const adAccountId = typeof body.ad_account_id === "string" ? body.ad_account_id.trim() : ""

  if (!ids.length) return NextResponse.json({ error: "ids are required" }, { status: 400 })
  if (!adAccountId) return NextResponse.json({ error: "ad_account_id is required" }, { status: 400 })

  const supabase = createAdminClient()
  const { data: account } = await supabase
    .from("ad_accounts")
    .select("fb_ad_account_id")
    .eq("org_id", ctx.orgId)
    .eq("fb_ad_account_id", adAccountId)
    .maybeSingle()

  if (!account) {
    return NextResponse.json({ error: "Ad account not found in this workspace" }, { status: 400 })
  }

  const { data: ownedRows, error: fetchErr } = await supabase
    .from("portal_media_items")
    .select("id")
    .in("id", ids)
    .or(`org_id.is.null,org_id.eq.${ctx.orgId}`)
    .neq("status", "imported")

  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 })
  const allowedIds = (ownedRows || []).map(row => row.id)
  if (!allowedIds.length) return NextResponse.json({ error: "No mappable media found" }, { status: 400 })

  const { error } = await supabase
    .from("portal_media_items")
    .update({
      org_id: ctx.orgId,
      ad_account_id: adAccountId,
      mapped_by: ctx.user.id,
      status: "mapped",
      updated_at: new Date().toISOString(),
    })
    .in("id", allowedIds)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, mapped: allowedIds.length })
}

export async function DELETE(request: NextRequest) {
  const auth = await requireLaunchRole()
  if (auth.error) return auth.error
  const ctx = auth.ctx!

  const { searchParams } = new URL(request.url)
  const id = searchParams.get("id")
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 })

  const supabase = createAdminClient()
  const { error } = await supabase
    .from("portal_media_items")
    .update({
      org_id: null,
      ad_account_id: null,
      mapped_by: null,
      status: "pending",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("org_id", ctx.orgId)
    .neq("status", "imported")

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
