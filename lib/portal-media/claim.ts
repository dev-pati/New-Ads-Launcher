import { createAdminClient } from "@/lib/supabase/admin"
import { CREATIVE_STATUS } from "@/lib/creative-readiness"

const PORTAL_MEDIA_ORIGIN = process.env.CREATIVE_MEDIA_API_ORIGIN || "https://creative.patigroup.com"

type PortalMediaItem = {
  id: string
  object_key: string
  portal_asset_id: string
  file_name: string | null
  media_type: "image" | "video" | null
  file_size: number | null
  org_id: string | null
  status: "pending" | "mapped" | "imported"
  creative_id: string | null
  portal_created_at: string | null
}

type ClaimPortalItemParams = {
  itemId: string
  orgId: string
  adAccountId: string
  userId: string
}

function mediaUrl(assetId: string) {
  return `${PORTAL_MEDIA_ORIGIN}/api/media/${assetId}`
}

export async function claimPortalItem(params: ClaimPortalItemParams) {
  const supabase = createAdminClient()

  const { data: existingCreative, error: existingErr } = await supabase
    .from("portal_media_items")
    .select("creative_id")
    .eq("id", params.itemId)
    .eq("org_id", params.orgId)
    .eq("status", "imported")
    .maybeSingle()
  if (existingErr) throw existingErr
  if (existingCreative?.creative_id) return { creativeId: existingCreative.creative_id, reused: true }

  const { data: item, error: itemErr } = await supabase
    .from("portal_media_items")
    .select("id, object_key, portal_asset_id, file_name, media_type, file_size, org_id, status, creative_id, portal_created_at")
    .eq("id", params.itemId)
    .or(`org_id.is.null,org_id.eq.${params.orgId}`)
    .in("status", ["pending", "mapped"])
    .maybeSingle()

  if (itemErr) throw itemErr
  if (!item) return null

  const portalItem = item as PortalMediaItem
  const storagePath = `r2://pati-videos/${portalItem.object_key}`

  const { data: duplicate, error: dupErr } = await supabase
    .from("creatives")
    .select("id")
    .eq("org_id", params.orgId)
    .eq("ad_account_id", params.adAccountId)
    .eq("storage_path", storagePath)
    .maybeSingle()
  if (dupErr) throw dupErr

  const creativeId = duplicate?.id || (await insertCreative({
    orgId: params.orgId,
    userId: params.userId,
    adAccountId: params.adAccountId,
    item: portalItem,
    storagePath,
  }))

  const { error: updateErr } = await supabase
    .from("portal_media_items")
    .update({
      org_id: params.orgId,
      ad_account_id: params.adAccountId,
      mapped_by: params.userId,
      status: "imported",
      creative_id: creativeId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.itemId)
    .neq("status", "imported")

  if (updateErr) throw updateErr
  return { creativeId, reused: Boolean(duplicate) }
}

async function insertCreative(params: {
  orgId: string
  userId: string
  adAccountId: string
  item: PortalMediaItem
  storagePath: string
}) {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from("creatives")
    .insert({
      org_id: params.orgId,
      user_id: params.userId,
      file_name: params.item.file_name || params.item.object_key.split("/").pop() || params.item.portal_asset_id,
      file_url: mediaUrl(params.item.portal_asset_id),
      storage_path: params.storagePath,
      media_type: params.item.media_type || "video",
      file_size: params.item.file_size,
      ad_account_id: params.adAccountId,
      status: CREATIVE_STATUS.PENDING, // Meta upload lifecycle starts here — cron/upload-to-facebook picks it up
      created_at: params.item.portal_created_at || new Date().toISOString(),
    })
    .select("id")
    .single()

  if (error) throw error
  return data.id as string
}
