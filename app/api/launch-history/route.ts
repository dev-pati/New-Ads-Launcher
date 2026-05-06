import { NextRequest, NextResponse } from "next/server"
import { getAuthContext } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const url = new URL(request.url)
    const accountId = url.searchParams.get("account_id")
    const userId = url.searchParams.get("user_id")
    const status = url.searchParams.get("status")
    const limit = parseInt(url.searchParams.get("limit") || "50")

    const supabase = await createClient()
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

    return NextResponse.json({ batches: data || [] })
  } catch (err: any) {
    console.error("launch-history error:", err)
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 })
  }
}
