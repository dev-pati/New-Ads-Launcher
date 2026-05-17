// Shared server-side utilities for creative upload routes.

export const CREATIVE_SELECT =
  "id, file_name, file_url, media_type, headline, primary_text, cta, link_url, fb_image_url, fb_thumbnail_url, fb_image_hash, fb_video_id, status, ad_account_id"

// Check if an identical file (same name + size) already exists in the org.
// Returns the existing row or null.
export async function checkCreativeDup(
  db: any,
  orgId: string,
  filename: string,
  fileSize: number,
  type: "video" | "image"
): Promise<any | null> {
  const col = type === "video" ? "fb_video_id" : "fb_image_hash"
  const { data } = await db
    .from("creatives")
    .select(CREATIVE_SELECT)
    .eq("org_id", orgId)
    .eq("file_name", filename)
    .eq("file_size", fileSize)
    .not(col, "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  return data ?? null
}

export function getActorName(user: any): string {
  return user.user_metadata?.full_name || user.email?.split("@")[0] || "Someone"
}
