// Append-only proof of real Page Manage module usage (Content/Comment/Inbox Ops).
// Best-effort: never let a logging failure fail the user action.
export type PageManageModule = "content" | "comment" | "inbox"

export async function logPageManageActivity(
  supabase: any,
  params: {
    actorId?: string | null
    orgId: string
    pageId: string
    module: PageManageModule
    action: string
    targetRef?: string | null
  }
): Promise<void> {
  try {
    await supabase.from("page_manage_activity").insert({
      org_id: params.orgId,
      actor_id: params.actorId ?? null,
      page_id: params.pageId,
      module: params.module,
      action: params.action,
      target_ref: params.targetRef ?? null,
    })
  } catch (err) {
    console.warn("[page-manage-activity] failed to log", err)
  }
}
