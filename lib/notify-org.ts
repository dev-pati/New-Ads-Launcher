import { createAdminClient } from "./supabase/admin"

export async function notifyOrgMembers({
  orgId,
  actorId,
  actorName,
  type,
  title,
  body,
  link,
}: {
  orgId: string
  actorId: string
  actorName: string
  type: string
  title: string
  body?: string
  link?: string
}) {
  try {
    const db = createAdminClient()
    const { data: members } = await db
      .from("org_members")
      .select("user_id")
      .eq("org_id", orgId)

    if (!members || members.length === 0) return

    await db.from("notifications").insert(
      members.map((m: any) => ({
        org_id: orgId,
        user_id: m.user_id,
        actor_id: actorId,
        actor_name: actorName,
        type,
        title,
        body: body || null,
        link: link || null,
      }))
    )
  } catch (err) {
    console.error("[notify-org] failed:", err)
  }
}
