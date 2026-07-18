import { NextRequest, NextResponse } from "next/server"
import { getPmViewer } from "@/lib/pm-feedback-auth"
import { createAdminClient } from "@/lib/supabase/admin"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Cross-org feedback list for the PM-only dashboard. Not scoped to a single org.
export async function GET(request: NextRequest) {
  try {
    const viewer = await getPmViewer()
    if (!viewer) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const sp = request.nextUrl.searchParams
    const status = sp.get("status")
    const severity = sp.get("severity")
    const featureArea = sp.get("feature_area")
    const feedbackType = sp.get("feedback_type")
    const q = sp.get("q")?.trim()
    const limit = Math.min(Math.max(parseInt(sp.get("limit") || "200", 10) || 200, 1), 500)

    const db = createAdminClient()
    let query = db
      .from("feedback_events")
      .select("*, org:organizations(id, name, slug)")
      .order("created_at", { ascending: false })
      .limit(limit)

    if (status) query = query.eq("status", status)
    if (severity) query = query.eq("severity", severity)
    if (featureArea) query = query.eq("feature_area", featureArea)
    if (feedbackType) query = query.eq("feedback_type", feedbackType)
    if (q) {
      const like = `%${q}%`
      query = query.or(
        `observed_evidence.ilike.${like},expected_result.ilike.${like},extra_note.ilike.${like},user_email.ilike.${like}`
      )
    }

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const rows = (data || []).map((r: Record<string, unknown>) => {
      const org = Array.isArray(r.org) ? r.org[0] : r.org
      return { ...r, org_name: (org as { name?: string } | null)?.name ?? null }
    })

    return NextResponse.json({ feedback: rows })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to load feedback"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
