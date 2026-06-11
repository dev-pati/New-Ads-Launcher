import { NextRequest, NextResponse } from "next/server"
import { getAuthContext } from "@/lib/auth"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  DEFAULT_PAGE_MANAGER_SETTINGS,
  PageManagerSettings,
  diffSettings,
  normalizePageManagerSettings,
} from "@/lib/page-manager-settings"

export const dynamic = "force-dynamic"

async function getWorkspacePage(supabase: ReturnType<typeof createAdminClient>, orgId: string, pageId: string) {
  const { data, error } = await supabase
    .from("pages")
    .select("fb_page_id, name")
    .eq("org_id", orgId)
    .eq("fb_page_id", pageId)
    .maybeSingle()
  if (error) throw error
  return data
}

async function getStoredSettings(supabase: ReturnType<typeof createAdminClient>, orgId: string, pageId: string) {
  const { data, error } = await supabase
    .from("page_manager_settings")
    .select("settings, updated_at, updated_by")
    .eq("org_id", orgId)
    .eq("page_id", pageId)
    .maybeSingle()
  if (error) throw error
  return data
}

function isMissingSettingsTable(error: unknown) {
  const err = error as { code?: string; message?: string }
  return (
    err?.code === "42P01" ||
    err?.code === "PGRST205" ||
    /page_manager_settings|page_manager_settings_audit_logs|schema cache|does not exist/i.test(err?.message || "")
  )
}

function fallbackCacheKey(pageId: string) {
  return `page-manager:settings:${pageId}`
}

async function readFallbackSettings(supabase: ReturnType<typeof createAdminClient>, orgId: string, pageId: string) {
  const { data, error } = await supabase
    .from("meta_api_cache")
    .select("payload, updated_at")
    .eq("org_id", orgId)
    .eq("cache_key", fallbackCacheKey(pageId))
    .maybeSingle()

  if (error) throw error

  const payload = (data?.payload || {}) as {
    settings?: PageManagerSettings
    auditLogs?: unknown[]
    updatedAt?: string | null
  }

  return {
    settings: normalizePageManagerSettings(payload.settings || DEFAULT_PAGE_MANAGER_SETTINGS),
    updatedAt: payload.updatedAt || data?.updated_at || null,
    auditLogs: Array.isArray(payload.auditLogs) ? payload.auditLogs.slice(0, 20) : [],
  }
}

async function writeFallbackSettings(
  supabase: ReturnType<typeof createAdminClient>,
  params: {
    orgId: string
    pageId: string
    settings: PageManagerSettings
    actorId: string
    action: "update" | "copy"
    section?: string | null
    before: PageManagerSettings
    changes: unknown
  }
) {
  const current = await readFallbackSettings(supabase, params.orgId, params.pageId).catch(() => ({
    settings: normalizePageManagerSettings(DEFAULT_PAGE_MANAGER_SETTINGS),
    updatedAt: null,
    auditLogs: [],
  }))
  const now = new Date().toISOString()
  const nextAuditLogs = [
    {
      id: crypto.randomUUID(),
      action: params.action,
      section: params.section || null,
      changes: params.changes,
      actor_id: params.actorId,
      created_at: now,
    },
    ...current.auditLogs,
  ].slice(0, 20)

  const { error } = await supabase
    .from("meta_api_cache")
    .upsert(
      {
        org_id: params.orgId,
        cache_key: fallbackCacheKey(params.pageId),
        payload: {
          settings: params.settings,
          auditLogs: nextAuditLogs,
          updatedAt: now,
          fallback: true,
        },
        expires_at: "2099-01-01T00:00:00.000Z",
        retry_after: null,
        updated_at: now,
      },
      { onConflict: "org_id,cache_key" }
    )

  if (error) throw error

  return { settings: params.settings, updatedAt: now, auditLogs: nextAuditLogs }
}

async function writeAuditLog(
  supabase: ReturnType<typeof createAdminClient>,
  params: {
    orgId: string
    pageId: string
    actorId: string
    action: string
    section?: string | null
    before: unknown
    after: unknown
    changes: unknown
  }
) {
  const { error } = await supabase.from("page_manager_settings_audit_logs").insert({
    org_id: params.orgId,
    page_id: params.pageId,
    actor_id: params.actorId,
    action: params.action,
    section: params.section || null,
    before_value: params.before,
    after_value: params.after,
    changes: params.changes,
  })
  if (error) console.warn("[page-manager/settings] audit log failed:", error.message)
}

export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const pageId = request.nextUrl.searchParams.get("page_id") || ""
    if (!pageId) return NextResponse.json({ error: "page_id required" }, { status: 400 })

    const supabase = createAdminClient()
    const page = await getWorkspacePage(supabase, ctx.orgId, pageId)

    let stored: Awaited<ReturnType<typeof getStoredSettings>> | null = null
    let setupRequired = false
    try {
      stored = await getStoredSettings(supabase, ctx.orgId, pageId)
    } catch (err) {
      if (!isMissingSettingsTable(err)) throw err
      setupRequired = true
      const fallback = await readFallbackSettings(supabase, ctx.orgId, pageId)
      return NextResponse.json({
        page: { id: page?.fb_page_id || pageId, name: page?.name || null },
        settings: fallback.settings,
        updatedAt: fallback.updatedAt,
        auditLogs: fallback.auditLogs,
        setupRequired,
        storage: "meta_api_cache_fallback",
      })
    }
    const settings = normalizePageManagerSettings(stored?.settings || DEFAULT_PAGE_MANAGER_SETTINGS)

    let auditLogs: unknown[] = []
    try {
      const { data, error: auditError } = await supabase
        .from("page_manager_settings_audit_logs")
        .select("id, action, section, changes, created_at, actor_id")
        .eq("org_id", ctx.orgId)
        .eq("page_id", pageId)
        .order("created_at", { ascending: false })
        .limit(20)
      if (auditError) throw auditError
      auditLogs = data || []
    } catch (err) {
      if (!isMissingSettingsTable(err)) throw err
      setupRequired = true
    }

    return NextResponse.json({
      page: { id: page?.fb_page_id || pageId, name: page?.name || null },
      settings,
      updatedAt: stored?.updated_at || null,
      auditLogs,
      setupRequired,
      storage: "page_manager_settings",
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to load Page Manager settings" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await request.json()
    const pageId = typeof body.page_id === "string" ? body.page_id : ""
    const section = typeof body.section === "string" ? body.section : null
    if (!pageId) return NextResponse.json({ error: "page_id required" }, { status: 400 })

    const supabase = createAdminClient()
    await getWorkspacePage(supabase, ctx.orgId, pageId)

    let stored: Awaited<ReturnType<typeof getStoredSettings>> | null = null
    let setupRequired = false
    try {
      stored = await getStoredSettings(supabase, ctx.orgId, pageId)
    } catch (err) {
      if (!isMissingSettingsTable(err)) throw err
      setupRequired = true
      const fallback = await readFallbackSettings(supabase, ctx.orgId, pageId)
      const before = fallback.settings
      const after = normalizePageManagerSettings(body.settings)
      const changes = diffSettings(before, after)
      const written = await writeFallbackSettings(supabase, {
        orgId: ctx.orgId,
        pageId,
        settings: after,
        actorId: ctx.user.id,
        action: "update",
        section,
        before,
        changes,
      })
      return NextResponse.json({
        settings: written.settings,
        updatedAt: written.updatedAt,
        auditLogs: written.auditLogs,
        changes,
        setupRequired,
        storage: "meta_api_cache_fallback",
      })
    }
    const before = normalizePageManagerSettings(stored?.settings || DEFAULT_PAGE_MANAGER_SETTINGS)
    const after = normalizePageManagerSettings(body.settings)
    const changes = diffSettings(before, after)

    const { data, error } = await supabase
      .from("page_manager_settings")
      .upsert({
        org_id: ctx.orgId,
        page_id: pageId,
        settings: after,
        updated_by: ctx.user.id,
        updated_at: new Date().toISOString(),
      }, { onConflict: "org_id,page_id" })
      .select("settings, updated_at")
      .single()
    if (error) throw error

    if (changes.length > 0) {
      await writeAuditLog(supabase, {
        orgId: ctx.orgId,
        pageId,
        actorId: ctx.user.id,
        action: "update",
        section,
        before,
        after,
        changes,
      })
    }

    return NextResponse.json({
      settings: normalizePageManagerSettings(data.settings),
      updatedAt: data.updated_at,
      changes,
      setupRequired,
      storage: "page_manager_settings",
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to save Page Manager settings" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await request.json()
    const action = body.action
    if (action !== "copy") return NextResponse.json({ error: "Unsupported action" }, { status: 400 })

    const sourcePageId = typeof body.source_page_id === "string" ? body.source_page_id : ""
    const targetPageId = typeof body.target_page_id === "string" ? body.target_page_id : ""
    if (!sourcePageId || !targetPageId) {
      return NextResponse.json({ error: "source_page_id and target_page_id are required" }, { status: 400 })
    }
    if (sourcePageId === targetPageId) {
      return NextResponse.json({ error: "Choose a different target Page" }, { status: 400 })
    }

    const supabase = createAdminClient()
    const [sourcePage, targetPage] = await Promise.all([
      getWorkspacePage(supabase, ctx.orgId, sourcePageId),
      getWorkspacePage(supabase, ctx.orgId, targetPageId),
    ])

    let sourceStored: Awaited<ReturnType<typeof getStoredSettings>> | null = null
    let targetStored: Awaited<ReturnType<typeof getStoredSettings>> | null = null
    let setupRequired = false
    try {
      sourceStored = await getStoredSettings(supabase, ctx.orgId, sourcePageId)
      targetStored = await getStoredSettings(supabase, ctx.orgId, targetPageId)
    } catch (err) {
      if (!isMissingSettingsTable(err)) throw err
      setupRequired = true
      const sourceFallback = await readFallbackSettings(supabase, ctx.orgId, sourcePageId)
      const targetFallback = await readFallbackSettings(supabase, ctx.orgId, targetPageId)
      const changes = diffSettings(targetFallback.settings, sourceFallback.settings)
      const written = await writeFallbackSettings(supabase, {
        orgId: ctx.orgId,
        pageId: targetPageId,
        settings: sourceFallback.settings,
        actorId: ctx.user.id,
        action: "copy",
        section: null,
        before: targetFallback.settings,
        changes: { sourcePageId, sourcePageName: sourcePage?.name || null, changes },
      })
      return NextResponse.json({
        settings: written.settings,
        updatedAt: written.updatedAt,
        copiedFrom: { id: sourcePage?.fb_page_id || sourcePageId, name: sourcePage?.name || null },
        changes,
        setupRequired,
        storage: "meta_api_cache_fallback",
      })
    }
    const sourceSettings = normalizePageManagerSettings(sourceStored?.settings || DEFAULT_PAGE_MANAGER_SETTINGS)
    const targetBefore = normalizePageManagerSettings(targetStored?.settings || DEFAULT_PAGE_MANAGER_SETTINGS)
    const changes = diffSettings(targetBefore, sourceSettings)

    const { data, error } = await supabase
      .from("page_manager_settings")
      .upsert({
        org_id: ctx.orgId,
        page_id: targetPageId,
        settings: sourceSettings,
        updated_by: ctx.user.id,
        updated_at: new Date().toISOString(),
      }, { onConflict: "org_id,page_id" })
      .select("settings, updated_at")
      .single()
    if (error) throw error

    await writeAuditLog(supabase, {
      orgId: ctx.orgId,
      pageId: targetPageId,
      actorId: ctx.user.id,
      action: "copy",
      section: null,
      before: targetBefore,
      after: sourceSettings,
      changes: { sourcePageId, sourcePageName: sourcePage?.name || null, changes },
    })

    return NextResponse.json({
      settings: normalizePageManagerSettings(data.settings),
      updatedAt: data.updated_at,
      copiedFrom: { id: sourcePage?.fb_page_id || sourcePageId, name: sourcePage?.name || null },
      changes,
      setupRequired,
      storage: "page_manager_settings",
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to copy Page Manager settings" }, { status: 500 })
  }
}
