import { NextRequest, NextResponse } from "next/server"
import { getAuthContext } from "@/lib/auth"
import { createAdminClient } from "@/lib/supabase/admin"

export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const url = new URL(request.url)
    const accountId = url.searchParams.get("account_id")
    const userId = url.searchParams.get("user_id")
    const status = url.searchParams.get("status")
    const limit = parseInt(url.searchParams.get("limit") || "50")

    const supabase = createAdminClient()
    let query = supabase
      .from("launch_batches")
      .select("*")
      .eq("org_id", ctx.orgId)
      .order("created_at", { ascending: false })
      .limit(limit)

    if (accountId) query = query.eq("ad_account_id", accountId)
    if (userId) query = query.eq("user_id", userId)
    if (status && status !== "all") query = query.eq("status", status)

    const { data, error } = await query

    if (error) {
      // Gracefully handle missing table (migration not applied yet)
      if (error.code === "42P01" || /relation .* does not exist/i.test(error.message)) {
        console.warn("[launch-history] launch_batches table missing — run migration supabase/migrations/20260505_launch_batches.sql")
        return NextResponse.json({ batches: [], _migrationNeeded: true })
      }
      console.error("Failed to fetch launch history:", error)
      return NextResponse.json({ error: error.message || "Failed to fetch history" }, { status: 500 })
    }

    const batches = data || []
    const userIds = [...new Set(batches.map((b: any) => b.user_id).filter(Boolean))]
    let accountById = new Map<string, any>()

    if (userIds.length > 0) {
      const { data: accounts, error: accountsError } = await supabase
        .from("accounts")
        .select("id,email,full_name,avatar_url")
        .in("id", userIds)

      if (accountsError) {
        console.warn("[launch-history] Failed to enrich launcher accounts:", accountsError.message)
      } else {
        accountById = new Map((accounts || []).map((account: any) => [account.id, account]))
      }
    }

    return NextResponse.json({
      batches: batches.map((batch: any) => {
        const launcher = accountById.get(batch.user_id)
        return {
          ...batch,
          launcher: launcher || null,
          user_name: batch.user_name || launcher?.full_name || launcher?.email || "Unknown",
        }
      }),
    })
  } catch (err: any) {
    console.error("launch-history error:", err)
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 })
  }
}
