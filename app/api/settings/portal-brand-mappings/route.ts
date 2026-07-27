import { NextRequest, NextResponse } from "next/server"
import { getAuthContext, requireRole } from "@/lib/auth"
import { createAdminClient } from "@/lib/supabase/admin"

const ADMIN = new Set(["admin"])

function normalizeSlug(slug: string): string | null {
  const s = slug?.trim().toLowerCase()
  if (!s) return null
  // brand folder-safe: lowercase letters, digits, dash, underscore only
  return /^[a-z0-9_-]+$/.test(s) ? s : null
}

// GET: pending (org_id null) + this org's mapped rows
export async function GET() {
  const ctx = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const denied = requireRole(ctx, ADMIN)
  if (denied) return denied

  const supabase = createAdminClient()
  const { data: pending, error: pErr } = await supabase
    .from("portal_brand_mappings")
    .select("*")
    .eq("status", "pending")
    .is("org_id", null)
    .order("last_seen_at", { ascending: false })

  const { data: mapped, error: mErr } = await supabase
    .from("portal_brand_mappings")
    .select("*")
    .eq("org_id", ctx.orgId)
    .eq("status", "mapped")
    .order("updated_at", { ascending: false })

  if (pErr || mErr) {
    return NextResponse.json({ error: pErr?.message || mErr?.message }, { status: 500 })
  }

  return NextResponse.json({ pending: pending || [], mapped: mapped || [] })
}

// PUT: human decision — map a brand slug to an ad account in current org
export async function PUT(request: NextRequest) {
  const ctx = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const denied = requireRole(ctx, ADMIN)
  if (denied) return denied

  const body = await request.json()
  const brandSlug = normalizeSlug(body.brand_slug)
  const adAccountId = typeof body.ad_account_id === "string" ? body.ad_account_id.trim() : ""

  if (!brandSlug) {
    return NextResponse.json({ error: "Invalid brand slug" }, { status: 400 })
  }
  if (!adAccountId) {
    return NextResponse.json({ error: "Ad account is required" }, { status: 400 })
  }

  const supabase = createAdminClient()

  // Verify ad account belongs to current org
  const { data: account } = await supabase
    .from("ad_accounts")
    .select("fb_ad_account_id")
    .eq("org_id", ctx.orgId)
    .eq("fb_ad_account_id", adAccountId)
    .maybeSingle()

  if (!account) {
    return NextResponse.json({ error: "Ad account not found in this workspace" }, { status: 400 })
  }

  const { error } = await supabase
    .from("portal_brand_mappings")
    .upsert(
      {
        brand_slug: brandSlug,
        org_id: ctx.orgId,
        ad_account_id: adAccountId,
        mapped_by: ctx.user.id,
        status: "mapped",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "brand_slug" }
    )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// DELETE: unmap a brand (only this org's mapping; pending rows with null org_id untouched)
export async function DELETE(request: NextRequest) {
  const ctx = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const denied = requireRole(ctx, ADMIN)
  if (denied) return denied

  const { searchParams } = new URL(request.url)
  const brandSlug = normalizeSlug(searchParams.get("brand_slug") || "")
  if (!brandSlug) return NextResponse.json({ error: "Invalid brand slug" }, { status: 400 })

  const supabase = createAdminClient()
  const { error } = await supabase
    .from("portal_brand_mappings")
    .delete()
    .eq("brand_slug", brandSlug)
    .eq("org_id", ctx.orgId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
