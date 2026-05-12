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
    const { data: members, error: membersErr } = await db
      .from("org_members")
      .select("user_id")
      .eq("org_id", orgId)

    if (membersErr) {
      console.error("[notify-org] failed to fetch org members:", membersErr)
      return
    }
    if (!members || members.length === 0) {
      console.warn("[notify-org] no members found for org:", orgId)
      return
    }

    const { error: insertErr } = await db.from("notifications").insert(
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

    if (insertErr) {
      console.error("[notify-org] failed to insert notifications:", insertErr)
    } else {
      console.log(`[notify-org] inserted ${members.length} notification(s) for org ${orgId}`)
    }
  } catch (err) {
    console.error("[notify-org] unexpected error:", err)
  }
}
