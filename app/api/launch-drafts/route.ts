import { NextRequest, NextResponse } from "next/server"
import { getAuthContext } from "@/lib/auth"
import { createAdminClient } from "@/lib/supabase/admin"

// ── GET /api/launch-drafts            → list all drafts (no data JSONB)
// ── GET /api/launch-drafts?id=xxx     → load one draft + enrich creatives
// ── POST /api/launch-drafts           → save draft (lean data)
// ── DELETE /api/launch-drafts?id=xxx  → delete draft

export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const db = createAdminClient()
    const id = new URL(request.url).searchParams.get("id")

    if (id) {
      // Load one draft → fetch creative objects fresh from DB
      const { data: draft, error } = await db
        .from("launch_drafts")
        .select("*")
        .eq("id", id)
        .eq("org_id", ctx.orgId)
        .single()

      if (error || !draft) return NextResponse.json({ error: "Draft not found" }, { status: 404 })

      const draftData = draft.data as { rows?: any[]; globalSettings?: any }
      const rows = draftData.rows || []

      // Collect unique creative IDs from lean rows
      const creativeIds = [...new Set(rows.map((r: any) => r.creativeId).filter(Boolean))]

      // Fetch creatives fresh from DB
      let creativeMap: Record<string, any> = {}
      if (creativeIds.length > 0) {
        const { data: creatives } = await db
          .from("creatives")
          .select("id, file_name, file_url, media_type, headline, primary_text, cta, link_url, fb_image_url, fb_thumbnail_url, fb_image_hash, fb_video_id, status")
          .in("id", creativeIds)
        for (const c of creatives || []) creativeMap[c.id] = c
      }

      // Rebuild full TableRow[] by merging creative objects back in
      const fullRows = rows.map((r: any) => ({
        ...r,
        creative: r.creativeId ? (creativeMap[r.creativeId] || null) : null,
      }))

      return NextResponse.json({ draft: { ...draft, data: { ...draftData, rows: fullRows } } })
    }

    // List drafts — no data JSONB for performance
    const { data, error } = await db
      .from("launch_drafts")
      .select("id, name, ad_account_id, ad_account_name, row_count, creative_thumbs, user_name, created_at")
      .eq("org_id", ctx.orgId)
      .order("created_at", { ascending: false })
      .limit(100)

    if (error) {
      if (error.code === "42P01") return NextResponse.json({ drafts: [], _migrationNeeded: true })
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ drafts: data || [] })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const db = createAdminClient()
    const body = await request.json()
    const { name, adAccountId, adAccountName, rows, globalSettings, creativeThumbs } = body

    if (!rows?.length) return NextResponse.json({ error: "No rows to save" }, { status: 400 })

    // Collect creative IDs and thumbnails for list preview
    const creativeIds = [...new Set(rows.map((r: any) => r.creativeId).filter(Boolean))]
    const thumbs = creativeThumbs || []

    const { data, error } = await db
      .from("launch_drafts")
      .insert({
        org_id: ctx.orgId,
        user_id: ctx.user.id,
        user_name: ctx.user.full_name || ctx.user.email?.split("@")[0] || "Unknown",
        name: name || `${rows.length} Ads — ${new Date().toLocaleString("vi-VN")}`,
        ad_account_id: adAccountId || null,
        ad_account_name: adAccountName || null,
        row_count: rows.length,
        creative_ids: creativeIds,
        creative_thumbs: thumbs,
        data: { rows, globalSettings: globalSettings || {} },
      })
      .select("id, name, created_at")
      .single()

    if (error) {
      if (error.code === "42P01") return NextResponse.json({ error: "Run migration: 20260515_launch_drafts.sql" }, { status: 503 })
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ draft: data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const id = new URL(request.url).searchParams.get("id")
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 })

    const db = createAdminClient()
    const { error } = await db
      .from("launch_drafts")
      .delete()
      .eq("id", id)
      .eq("org_id", ctx.orgId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 })
  }
}
