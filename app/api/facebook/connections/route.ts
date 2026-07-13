import { NextRequest, NextResponse } from "next/server"
import { getAuthContext } from "@/lib/auth"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  fetchViaProfile,
  fetchViaAdAccounts,
  slotColumnForRole,
  ViaTokenError,
  type ViaRole,
} from "@/lib/via-connections"

// List connections của org (OAuth + via). KHÔNG bao giờ trả access_token về client.
export async function GET() {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const supabase = createAdminClient()
    const [{ data: connections, error }, { data: accounts }] = await Promise.all([
      supabase
        .from("facebook_connections")
        .select(
          "id, fb_user_id, fb_user_name, fb_picture_url, connection_type, via_role, label, token_status, last_checked_at, token_expires_at, created_at"
        )
        .eq("org_id", ctx.orgId)
        .eq("is_active", true)
        .order("created_at", { ascending: false }),
      supabase
        .from("ad_accounts")
        .select("launch_connection_id, read_connection_id")
        .eq("org_id", ctx.orgId),
    ])

    if (error) throw error

    const slotCounts = new Map<string, number>()
    for (const acc of accounts ?? []) {
      for (const id of [acc.launch_connection_id, acc.read_connection_id]) {
        if (id) slotCounts.set(id, (slotCounts.get(id) ?? 0) + 1)
      }
    }

    return NextResponse.json({
      connections: (connections ?? []).map(c => ({
        ...c,
        adAccountsCount: slotCounts.get(c.id) ?? 0,
      })),
    })
  } catch (err) {
    console.error("[connections] list failed:", err)
    return NextResponse.json({ error: "Failed to list connections" }, { status: 500 })
  }
}

// Add via: viaRole bắt buộc (không default) — ép người thêm chọn có ý thức.
export async function POST(request: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await request.json().catch(() => null)
    const token: string | undefined = body?.token?.trim()
    const label: string | null = body?.label?.trim() || null
    const viaRole: ViaRole | undefined = body?.viaRole

    if (!token) {
      return NextResponse.json({ error: "Missing token" }, { status: 400 })
    }
    if (viaRole !== "launch" && viaRole !== "non_launch") {
      return NextResponse.json(
        { error: "viaRole is required: 'launch' or 'non_launch'" },
        { status: 400 }
      )
    }

    // Validate token với Meta (skipProof — token do app khác phát hành)
    let profile
    let viaAccounts
    try {
      profile = await fetchViaProfile(token)
      viaAccounts = await fetchViaAdAccounts(token)
    } catch (err) {
      if (err instanceof ViaTokenError) {
        return NextResponse.json({ error: `Invalid token: ${err.meta.error}` }, { status: 400 })
      }
      throw err
    }

    const supabase = createAdminClient()

    // Không upsert mù theo (org_id, fb_user_id) — tránh biến row OAuth thành via
    const { data: existing } = await supabase
      .from("facebook_connections")
      .select("id, connection_type, via_role, is_active")
      .eq("org_id", ctx.orgId)
      .eq("fb_user_id", profile.id)
      .maybeSingle()

    if (existing && existing.connection_type === "oauth") {
      return NextResponse.json(
        { error: "This Facebook account is the org's OAuth connection — use a different account as via." },
        { status: 409 }
      )
    }
    if (
      existing &&
      existing.connection_type === "manual_token" &&
      existing.is_active &&
      existing.via_role !== viaRole
    ) {
      return NextResponse.json(
        { error: `Via này đang có role '${existing.via_role}'. Gỡ hết account khỏi slot cũ rồi đổi role qua PATCH, hoặc dùng via khác.` },
        { status: 409 }
      )
    }

    const connectionRow = {
      org_id: ctx.orgId,
      user_id: ctx.user.id,
      fb_user_id: profile.id,
      fb_user_name: profile.name,
      fb_picture_url: profile.picture_url,
      access_token: token,
      token_expires_at: null, // via session token — không biết trước hạn, theo dõi qua check
      is_active: true,
      connection_type: "manual_token",
      via_role: viaRole,
      label,
      token_status: "valid",
      last_checked_at: new Date().toISOString(),
    }

    const { data: connection, error: saveError } = existing
      ? await supabase
          .from("facebook_connections")
          .update(connectionRow)
          .eq("id", existing.id)
          .select("id")
          .single()
      : await supabase
          .from("facebook_connections")
          .insert(connectionRow)
          .select("id")
          .single()

    if (saveError || !connection) {
      console.error("[connections] save failed:", saveError)
      return NextResponse.json({ error: "Failed to save connection" }, { status: 500 })
    }

    // Upsert ad accounts + gán slot theo role — CHỈ khi slot đang trống
    const slotColumn = slotColumnForRole(viaRole)
    let assigned = 0
    const conflicts: { fbAdAccountId: string; name: string | null; currentConnectionId: string }[] = []

    for (const acc of viaAccounts) {
      const { data: existingAccount } = await supabase
        .from("ad_accounts")
        .select(`id, ${slotColumn}`)
        .eq("org_id", ctx.orgId)
        .eq("fb_ad_account_id", acc.id)
        .maybeSingle()

      let accountRowId = (existingAccount as { id: string } | null)?.id

      if (!accountRowId) {
        const { data: inserted, error: insertError } = await supabase
          .from("ad_accounts")
          .insert({
            org_id: ctx.orgId,
            user_id: ctx.user.id,
            business_manager_id: null, // via account có thể không thuộc BM đã sync
            fb_ad_account_id: acc.id,
            fb_account_id: acc.account_id,
            name: acc.name,
            currency: acc.currency ?? "USD",
            account_status: acc.account_status ?? 1,
          })
          .select("id")
          .single()
        if (insertError) {
          console.warn(`[connections] upsert ad account ${acc.id} failed:`, insertError.message)
          continue
        }
        accountRowId = inserted.id
      }

      const currentSlot = (existingAccount as Record<string, string | null> | null)?.[slotColumn]
      if (!currentSlot) {
        const { error: assignError } = await supabase
          .from("ad_accounts")
          .update({ [slotColumn]: connection.id })
          .eq("id", accountRowId)
        if (!assignError) assigned++
      } else if (currentSlot !== connection.id) {
        conflicts.push({ fbAdAccountId: acc.id, name: acc.name, currentConnectionId: currentSlot })
      } else {
        assigned++
      }
    }

    return NextResponse.json({
      connection: {
        id: connection.id,
        fb_user_id: profile.id,
        fb_user_name: profile.name,
        fb_picture_url: profile.picture_url,
        via_role: viaRole,
        label,
      },
      adAccountsFound: viaAccounts.length,
      assigned,
      conflicts, // UI hỏi user reassign qua /connections/assign
    })
  } catch (err) {
    console.error("[connections] add via failed:", err)
    return NextResponse.json({ error: "Failed to add via connection" }, { status: 500 })
  }
}
