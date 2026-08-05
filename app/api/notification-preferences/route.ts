import { NextRequest, NextResponse } from "next/server"
import { getAuthContext } from "@/lib/auth"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  NOTIFICATION_CATEGORIES,
  type NotificationCategory,
} from "@/lib/notifications/category"

const defaults = Object.fromEntries(
  NOTIFICATION_CATEGORIES.map(category => [category, true])
) as Record<NotificationCategory, boolean>

function isCategory(value: unknown): value is NotificationCategory {
  return typeof value === "string" && NOTIFICATION_CATEGORIES.includes(value as NotificationCategory)
}

export async function GET() {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const db = createAdminClient()
    const { data, error } = await db
      .from("notification_preferences")
      .select("category, in_app_enabled")
      .eq("org_id", ctx.orgId)
      .eq("user_id", ctx.user.id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const preferences = { ...defaults }
    for (const row of data ?? []) {
      if (isCategory(row.category)) preferences[row.category] = row.in_app_enabled
    }

    return NextResponse.json({ preferences })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error"
    console.error("[notification-preferences]", err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { category, inAppEnabled } = await request.json()
    if (!isCategory(category) || typeof inAppEnabled !== "boolean") {
      return NextResponse.json({ error: "Invalid notification preference" }, { status: 400 })
    }

    const db = createAdminClient()
    const { error } = await db
      .from("notification_preferences")
      .upsert(
        {
          org_id: ctx.orgId,
          user_id: ctx.user.id,
          category,
          in_app_enabled: inAppEnabled,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "org_id,user_id,category" }
      )

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error"
    console.error("[notification-preferences]", err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
