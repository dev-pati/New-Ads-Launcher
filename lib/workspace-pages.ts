import { getFacebookConnection } from "@/lib/auth"
import { getFacebookPages, type FacebookPage } from "@/lib/facebook"
import { encryptSecret } from "@/lib/crypto"

type DbClient = any

export type WorkspacePageDto = {
  id: string
  workspace_page_id?: string
  page_id: string
  name: string
  category: string
  picture?: string | null
  status: "connected" | "permission_required" | "disconnected"
  is_active: boolean
  added_at?: string | null
  removed_at?: string | null
}

export type AvailableMetaPageDto = {
  id: string
  meta_page_id: string
  page_id: string
  name: string
  category: string
  picture?: string | null
  status: "connected" | "permission_required" | "disconnected"
}

function normalizeStatus(status?: string | null): WorkspacePageDto["status"] {
  if (status === "permission_required" || status === "disconnected") return status
  return "connected"
}

function mapWorkspacePage(row: any): WorkspacePageDto {
  const metaPage = row.meta_pages || row.meta_page || {}
  return {
    id: metaPage.page_id || row.page_id,
    workspace_page_id: row.id,
    page_id: metaPage.page_id || row.page_id,
    name: metaPage.page_name || row.page_name || row.page_id,
    category: metaPage.category || "Facebook Page",
    picture: metaPage.page_picture_url || null,
    status: normalizeStatus(metaPage.connection_status),
    is_active: Boolean(row.is_active) && !row.removed_at,
    added_at: row.added_at || null,
    removed_at: row.removed_at || null,
  }
}

function mapAvailableMetaPage(row: any): AvailableMetaPageDto {
  return {
    id: row.page_id,
    meta_page_id: row.id,
    page_id: row.page_id,
    name: row.page_name || row.page_id,
    category: row.category || "Facebook Page",
    picture: row.page_picture_url || null,
    status: normalizeStatus(row.connection_status),
  }
}

export async function syncMetaPagesForWorkspace(supabase: DbClient, orgId: string, userId: string) {
  const connection = await getFacebookConnection(orgId)
  if (!connection?.access_token) {
    return { pages: [] as AvailableMetaPageDto[], connected: false, needsReconnect: true }
  }

  const { data: metaAccount, error: accountError } = await supabase
    .from("meta_accounts")
    .upsert(
      {
        org_id: orgId,
        user_id: userId,
        provider: "facebook",
        meta_user_id: connection.fb_user_id,
        access_token_encrypted: encryptSecret(connection.access_token),
        connection_status: "connected",
        raw_data: {
          facebook_connection_id: connection.id,
          name: connection.fb_user_name,
          picture_url: connection.fb_picture_url,
          token_expires_at: connection.token_expires_at,
        },
      },
      { onConflict: "org_id,provider,meta_user_id" }
    )
    .select("id")
    .single()

  if (accountError || !metaAccount?.id) {
    throw new Error(accountError?.message || "Unable to save Meta account")
  }

  const pages = await getFacebookPages(connection.access_token)
  const rows = pages.map((page: FacebookPage) => ({
    org_id: orgId,
    meta_account_id: metaAccount.id,
    page_id: page.id,
    page_name: page.name,
    page_picture_url: page.picture?.data?.url || null,
    category: page.category || "Facebook Page",
    access_token_encrypted: page.access_token ? encryptSecret(page.access_token) : null,
    connection_status: page.access_token ? "connected" : "permission_required",
    raw_data: page,
  }))

  if (rows.length > 0) {
    const { error } = await supabase
      .from("meta_pages")
      .upsert(rows, { onConflict: "org_id,page_id" })
    if (error) throw new Error(error.message)

    await Promise.all(rows.map((row, i) =>
      supabase.from("pages").upsert(
        {
          org_id: orgId,
          user_id: userId,
          fb_page_id: row.page_id,
          name: row.page_name,
          category: row.category,
          picture_url: row.page_picture_url,
          // encrypt again is idempotent only if already enc:v1; pages list has plaintext
          page_access_token: pages[i]?.access_token ? encryptSecret(pages[i].access_token) : null,
          is_active: true,
        },
        { onConflict: "org_id,fb_page_id" }
      )
    ))
  }

  return {
    pages: rows.map(row => mapAvailableMetaPage({ ...row, id: row.page_id })),
    connected: true,
    needsReconnect: false,
  }
}

export async function listWorkspacePages(supabase: DbClient, orgId: string, activeOnly = true) {
  let query = supabase
    .from("workspace_pages")
    .select(`
      id,
      page_id,
      is_active,
      added_at,
      removed_at,
      meta_pages (
        id,
        page_id,
        page_name,
        page_picture_url,
        category,
        connection_status
      )
    `)
    .eq("workspace_id", orgId)
    .is("removed_at", null)
    .order("added_at", { ascending: true })

  if (activeOnly) {
    query = query.eq("is_active", true)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data || []).map(mapWorkspacePage)
}

export async function listAvailableMetaPages(supabase: DbClient, orgId: string) {
  const [{ data: metaPages, error: metaError }, { data: workspacePages, error: workspaceError }] = await Promise.all([
    supabase
      .from("meta_pages")
      .select("id, page_id, page_name, page_picture_url, category, connection_status")
      .eq("org_id", orgId)
      .order("page_name"),
    supabase
      .from("workspace_pages")
      .select("meta_page_id")
      .eq("workspace_id", orgId)
      .is("removed_at", null),
  ])

  if (metaError) throw new Error(metaError.message)
  if (workspaceError) throw new Error(workspaceError.message)

  const added = new Set((workspacePages || []).map((row: any) => row.meta_page_id))
  return (metaPages || [])
    .filter((row: any) => !added.has(row.id))
    .map(mapAvailableMetaPage)
}

export async function addWorkspacePages(supabase: DbClient, orgId: string, userId: string, metaPageIds: string[]) {
  const uniqueIds = Array.from(new Set(metaPageIds.filter(Boolean)))
  if (!uniqueIds.length) return []

  const { data: metaPages, error: metaError } = await supabase
    .from("meta_pages")
    .select("id, page_id")
    .eq("org_id", orgId)
    .in("id", uniqueIds)

  if (metaError) throw new Error(metaError.message)
  if ((metaPages || []).length !== uniqueIds.length) {
    throw new Error("One or more selected Pages are not available in this workspace")
  }

  const rows = (metaPages || []).map((page: any) => ({
    workspace_id: orgId,
    meta_page_id: page.id,
    page_id: page.page_id,
    is_active: true,
    added_by: userId,
    removed_at: null,
  }))

  const { error } = await supabase
    .from("workspace_pages")
    .upsert(rows, { onConflict: "workspace_id,meta_page_id" })
  if (error) throw new Error(error.message)

  return listWorkspacePages(supabase, orgId, true)
}
