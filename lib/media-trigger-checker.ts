/**
 * Media Library trigger checker.
 * Called from /api/creatives/finalize after a file is saved to DB.
 * Finds all active media_uploaded automations for the org and fires
 * those whose conditions match the uploaded file.
 */
import { createAdminClient } from "@/lib/supabase/admin"
import { executeAutomation }  from "@/lib/automation-engine"

interface UploadedFile {
  id:          string
  fileName:    string
  fileUrl:     string
  mimeType:    string   // "image/jpeg", "video/mp4", etc.
  thumbnailUrl?: string
  status:      string   // "pending" | "ready"
  tags?:       string[]
}

function matchesNameFilter(
  name: string,
  filter?: string,
  value?: string
): boolean {
  if (!filter || filter === "all") return true
  if (!value) return true
  const n = name.toLowerCase()
  const v = value.toLowerCase()
  if (filter === "name_contains")           return n.includes(v)
  if (filter === "name_equals")             return n === v
  if (filter === "name_does_not_contain")   return !n.includes(v)
  if (filter === "name_starts_with")        return n.startsWith(v)
  if (filter === "name_ends_with")          return n.endsWith(v)
  return true
}

export async function fireMediaUploadedTriggers(
  orgId: string,
  file:  UploadedFile,
  timing: "immediately" | "on_approved" = "immediately"
) {
  const db = createAdminClient()

  // Fetch all active media_uploaded automations for this org
  const { data: automations } = await db
    .from("automations")
    .select("id, name, trigger_config, actions")
    .eq("org_id", orgId)
    .eq("status", "active")

  if (!automations?.length) return

  const mediaAutomations = automations.filter(a => {
    const cfg = a.trigger_config as any
    return cfg?.appId === "media_library" && cfg?.event === "media_uploaded"
  })

  if (!mediaAutomations.length) return

  const isVideo = file.mimeType.startsWith("video/")
  const isImage = file.mimeType.startsWith("image/")

  for (const automation of mediaAutomations) {
    const cfg = automation.trigger_config as any

    // ── Trigger Timing filter ───────────────────────────────────────────────
    const configTiming = cfg.triggerTiming ?? "immediately"
    if (configTiming !== timing) continue

    // ── Media Type filter ───────────────────────────────────────────────────
    const mediaType = cfg.mediaType ?? "all"
    if (mediaType === "images" && !isImage) continue
    if (mediaType === "videos" && !isVideo) continue

    // ── Asset Name filter ───────────────────────────────────────────────────
    const nameFilter = cfg.mediaAssetName ?? "all"
    const nameValue  = cfg.mediaNameFilter ?? ""
    if (!matchesNameFilter(file.fileName, nameFilter, nameValue)) continue

    // ── Asset Status filter ─────────────────────────────────────────────────
    const statusFilter = cfg.assetStatus ?? "all"
    if (statusFilter !== "all" && file.status !== statusFilter) continue

    // ── Asset Grouping (future: batch multiple files) ───────────────────────
    // For now: always fire per-file

    // ── Fire! ───────────────────────────────────────────────────────────────
    try {
      await executeAutomation(automation.id, orgId, {
        isTest:       false,
        fileId:       file.id,
        fileName:     file.fileName,
        fileUrl:      file.fileUrl,
        mimeType:     file.mimeType,
        thumbnailUrl: file.thumbnailUrl,
      })
    } catch (err: any) {
      console.error(`[media-trigger] Failed to execute automation "${automation.name}":`, err.message)
    }
  }
}
