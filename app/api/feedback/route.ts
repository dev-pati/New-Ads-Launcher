import { NextRequest, NextResponse } from "next/server"
import { getAuthContext, requireRole } from "@/lib/auth"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  isValidFeaturePair,
  isValidFeedbackType,
  isValidSeverity,
} from "@/lib/feedback-taxonomy"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const ALLOWED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"])
const MAX_SCREENSHOT_BYTES = 10 * 1024 * 1024 // 10MB

function sanitizeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-")
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const form = await request.formData()

    const featureArea = String(form.get("feature_area") || "").trim()
    const featureFunction = String(form.get("feature_function") || "").trim()
    const feedbackType = String(form.get("feedback_type") || "").trim()
    const severity = String(form.get("severity") || "").trim()
    const observedEvidence = String(form.get("observed_evidence") || "").trim()
    const expectedResult = String(form.get("expected_result") || "").trim()
    const referenceUrl = String(form.get("reference_url") || "").trim() || null
    const extraNote = String(form.get("extra_note") || "").trim() || null
    const expectedDoneAt = String(form.get("expected_done_at") || "").trim() || null
    const artifactUrl = String(form.get("artifact_url") || "").trim() || null
    const screenshot = form.get("screenshot")

    if (!isValidFeaturePair(featureArea, featureFunction)) {
      return NextResponse.json({ error: "Invalid feature_area / feature_function pair" }, { status: 400 })
    }
    if (!isValidFeedbackType(feedbackType)) {
      return NextResponse.json({ error: "Invalid feedback_type" }, { status: 400 })
    }
    if (!isValidSeverity(severity)) {
      return NextResponse.json({ error: "Invalid severity" }, { status: 400 })
    }
    if (!observedEvidence || !expectedResult) {
      return NextResponse.json({ error: "observed_evidence and expected_result are required" }, { status: 400 })
    }

    let screenshotPath: string | null = null
    let screenshotUrl: string | null = null

    if (screenshot && screenshot instanceof File && screenshot.size > 0) {
      if (!ALLOWED_IMAGE_TYPES.has(screenshot.type)) {
        return NextResponse.json({ error: `Unsupported screenshot type: ${screenshot.type}` }, { status: 400 })
      }
      if (screenshot.size > MAX_SCREENSHOT_BYTES) {
        return NextResponse.json({ error: "Screenshot exceeds 10MB limit" }, { status: 400 })
      }

      const buffer = Buffer.from(await screenshot.arrayBuffer())
      const cleanName = sanitizeFileName(screenshot.name || "screenshot.png")
      screenshotPath = `feedback/${ctx.orgId}/${crypto.randomUUID()}-${cleanName}`
      const admin = createAdminClient()
      const { error: upErr } = await admin.storage.from("ad-media").upload(screenshotPath, buffer, {
        contentType: screenshot.type,
        upsert: false,
        cacheControl: "31536000",
      })
      if (upErr) {
        return NextResponse.json({ error: upErr.message }, { status: 500 })
      }
      screenshotUrl = admin.storage.from("ad-media").getPublicUrl(screenshotPath).data.publicUrl
    }

    const db = createAdminClient()
    const { data, error } = await db
      .from("feedback_events")
      .insert({
        org_id: ctx.orgId,
        user_id: ctx.user.id,
        user_email: ctx.user.email ?? null,
        feature_area: featureArea,
        feature_function: featureFunction,
        feedback_type: feedbackType,
        severity,
        observed_evidence: observedEvidence,
        expected_result: expectedResult,
        reference_url: referenceUrl,
        extra_note: extraNote,
        expected_done_at: expectedDoneAt,
        artifact_url: artifactUrl,
        screenshot_path: screenshotPath,
        screenshot_url: screenshotUrl,
        status: "open",
      })
      .select("id, status, created_at, screenshot_url")
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ feedback: data }, { status: 201 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to submit feedback"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const denied = requireRole(ctx, new Set(["admin"]))
    if (denied) return denied

    const sp = request.nextUrl.searchParams
    const status = sp.get("status")
    const severity = sp.get("severity")
    const featureArea = sp.get("feature_area")
    const featureFunction = sp.get("feature_function")
    const q = sp.get("q")?.trim()
    const limit = Math.min(Math.max(parseInt(sp.get("limit") || "50", 10) || 50, 1), 100)

    let query = createAdminClient()
      .from("feedback_events")
      .select("*")
      .eq("org_id", ctx.orgId)
      .order("created_at", { ascending: false })
      .limit(limit)

    if (status) query = query.eq("status", status)
    if (severity) query = query.eq("severity", severity)
    if (featureArea) query = query.eq("feature_area", featureArea)
    if (featureFunction) query = query.eq("feature_function", featureFunction)
    if (q) {
      const like = `%${q}%`
      query = query.or(`observed_evidence.ilike.${like},expected_result.ilike.${like},user_email.ilike.${like}`)
    }

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ feedback: data || [] })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to load feedback"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
