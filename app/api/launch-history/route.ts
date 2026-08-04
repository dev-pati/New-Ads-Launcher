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
    const tab = url.searchParams.get("tab")
    const batchId = url.searchParams.get("id")
    const limit = parseInt(url.searchParams.get("limit") || "50")
    const trash = url.searchParams.get("trash") === "1"

    const supabase = createAdminClient()
    let query = supabase
      .from("launch_batches")
      .select("*")
      .eq("org_id", ctx.orgId)
      .order("created_at", { ascending: false })
      .limit(limit)

    if (batchId) query = query.eq("id", batchId)
    if (accountId) query = query.eq("ad_account_id", accountId)
    if (userId) query = query.eq("user_id", userId)
    // The Scheduled tab shows batches queued for a future activation via scheduled_activations.
    // Those batches are stamped `status = 'scheduled'` by create-campaign / launch-direct /
    // launch-table-batch when a schedule is set, so filter on it instead of the lifecycle status.
    if (tab === "scheduled") {
      query = query.eq("status", "scheduled")
    } else if (status && status !== "all") {
      query = query.eq("status", status)
    } else if (!batchId && !trash) {
      // The Launched tab lists past launches; keep scheduled-queued batches out so they
      // live only in the Scheduled tab until cron activates them.
      query = query.neq("status", "scheduled")
    }
    if (trash) {
      query = query.not("deleted_at", "is", null)
    } else {
      query = query.is("deleted_at", null)
    }

    const { data, error } = await query

    let finalData = data
    
    if (error) {
      if (error.code === "42703") {
        // column "deleted_at" does not exist yet
        if (trash) {
          // If asking for trash but no trash column, return empty array
          return NextResponse.json({ batches: [] })
        } else {
          // If asking for normal list but no deleted_at column, run query WITHOUT deleted_at filter
          let fbQuery = supabase
            .from("launch_batches")
            .select("*")
            .eq("org_id", ctx.orgId)
            .order("created_at", { ascending: false })
            .limit(limit)
          if (accountId) fbQuery = fbQuery.eq("ad_account_id", accountId)
          if (userId) fbQuery = fbQuery.eq("user_id", userId)
          if (status && status !== "all") fbQuery = fbQuery.eq("status", status)
          
          const fallback = await fbQuery
          if (fallback.error) {
            return NextResponse.json({ error: fallback.error.message }, { status: 500 })
          }
          finalData = fallback.data
        }
      } else if (error.code === "42P01" || /relation .* does not exist/i.test(error.message)) {
        console.warn("[launch-history] launch_batches table missing")
        return NextResponse.json({ batches: [], _migrationNeeded: true })
      } else {
        console.error("Failed to fetch launch history:", error)
        return NextResponse.json({ error: error.message || "Failed to fetch history" }, { status: 500 })
      }
    }

    const batches = finalData || []
    let scheduledByAdId = new Map<string, any>()

    if (tab === "scheduled" && batches.length > 0) {
      const { data: scheduledRows, error: scheduledError } = await supabase
        .from("scheduled_activations")
        .select("id, ad_account_id, ad_ids, scheduled_at, end_time, status, error, created_at")
        .eq("org_id", ctx.orgId)
        .order("scheduled_at", { ascending: true })

      if (scheduledError) {
        console.warn("[launch-history] Failed to enrich scheduled activations:", scheduledError.message)
      } else {
        for (const row of scheduledRows || []) {
          for (const adId of row.ad_ids || []) scheduledByAdId.set(adId, row)
        }
      }
    }

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
        const enriched: any = {
          ...batch,
          launcher: launcher || null,
          user_name: batch.user_name || launcher?.full_name || launcher?.email || "Unknown",
        }

        // Scheduled tab: attach the matching scheduled_activations row so the UI can show
        // countdown, end time and activation status. Match by any overlapping ad id —
        // a scheduled batch and its scheduled_activations row share the same created ad ids.
        if (tab === "scheduled") {
          const batchAdIds = (batch.created_ads || []).map((c: any) => c.adId).filter(Boolean)
          const match = batchAdIds
            .map((id: string) => scheduledByAdId.get(id))
            .find(Boolean)
          enriched.scheduled_at = match?.scheduled_at ?? null
          enriched.end_time = match?.end_time ?? null
          enriched.scheduled_status = match?.status ?? null
          enriched.scheduled_error = match?.error ?? null
        }

        return enriched
      }),
    })
  } catch (err: any) {
    console.error("launch-history error:", err)
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 })
  }
}


export async function PATCH(request: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { ids, action } = await request.json()
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "Missing ids" }, { status: 400 })
    }

    const supabase = createAdminClient()
    const updateData = action === "restore" 
      ? { deleted_at: null, expires_at: null }
      : { deleted_at: new Date().toISOString(), expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() }
      
    const { error } = await supabase
      .from("launch_batches")
      .update(updateData)
      .in("id", ids)
      .eq("org_id", ctx.orgId)

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { ids } = await request.json()
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "Missing ids" }, { status: 400 })
    }

    const supabase = createAdminClient()
    const { error } = await supabase
      .from("launch_batches")
      .delete()
      .in("id", ids)
      .eq("org_id", ctx.orgId)

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 })
  }
}
