import { NextRequest, NextResponse } from "next/server"
import { getAuthContext } from "@/lib/auth"
import { createAdminClient } from "@/lib/supabase/admin"

// Gán / reassign / gỡ (connectionId=null) 1 ad account vào slot.
// Validate role của via khớp slot: launch ↔ launch_connection_id, non_launch ↔ read_connection_id.
export async function POST(request: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await request.json().catch(() => null)
    const fbAdAccountId: string | undefined = body?.fbAdAccountId
    const connectionId: string | null = body?.connectionId ?? null
    const slot: "launch" | "read" | undefined = body?.slot

    if (!fbAdAccountId || (slot !== "launch" && slot !== "read")) {
      return NextResponse.json(
        { error: "Cần fbAdAccountId và slot ('launch' | 'read')" },
        { status: 400 }
      )
    }

    const supabase = createAdminClient()
    const normalized = fbAdAccountId.replace(/^act_/, "")
    const { data: account } = await supabase
      .from("ad_accounts")
      .select("id")
      .eq("org_id", ctx.orgId)
      .or(`fb_ad_account_id.eq.act_${normalized},fb_account_id.eq.${normalized}`)
      .maybeSingle()

    if (!account) return NextResponse.json({ error: "Ad account not found" }, { status: 404 })

    if (connectionId) {
      const { data: connection } = await supabase
        .from("facebook_connections")
        .select("id, connection_type, via_role")
        .eq("id", connectionId)
        .eq("org_id", ctx.orgId)
        .eq("is_active", true)
        .maybeSingle()

      if (!connection) return NextResponse.json({ error: "Connection not found" }, { status: 404 })
      if (connection.connection_type !== "manual_token") {
        return NextResponse.json({ error: "Chỉ gán via (manual token) vào slot" }, { status: 400 })
      }
      const expectedRole = slot === "launch" ? "launch" : "non_launch"
      if (connection.via_role !== expectedRole) {
        return NextResponse.json(
          { error: `Slot '${slot}' cần via role '${expectedRole}', via này là '${connection.via_role}'` },
          { status: 400 }
        )
      }
    }

    const slotColumn = slot === "launch" ? "launch_connection_id" : "read_connection_id"
    const { error } = await supabase
      .from("ad_accounts")
      .update({ [slotColumn]: connectionId })
      .eq("id", account.id)
    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[connections] assign failed:", err)
    return NextResponse.json({ error: "Failed to assign slot" }, { status: 500 })
  }
}
