import { createAdminClient } from "@/lib/supabase/admin"
import { getSessionAccount } from "@/lib/custom-auth"
import { decryptSecret } from "@/lib/crypto"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"

/**
 * Get the authenticated Supabase user.
 */
export async function getAuthUser() {
  return getSessionAccount()
}

/**
 * Get auth context: user + active org_id.
 * Reads org_id from cookie and verifies membership.
 */
export async function getAuthContext() {
  const user = await getAuthUser()
  if (!user) return null

  const cookieStore = await cookies()
  const orgIdFromCookie = cookieStore.get("active_org_id")?.value

  const supabase = createAdminClient()

  if (orgIdFromCookie) {
    // Verify user is member of this org
    const { data: membership } = await supabase
      .from("org_members")
      .select("org_id, role")
      .eq("org_id", orgIdFromCookie)
      .eq("user_id", user.id)
      .single()

    if (membership) {
      return { user, orgId: membership.org_id, role: membership.role as string }
    }
  }

  // Fallback: get first org
  const { data: firstMembership } = await supabase
    .from("org_members")
    .select("org_id, role")
    .eq("user_id", user.id)
    .limit(1)
    .single()

  if (firstMembership) {
    return { user, orgId: firstMembership.org_id, role: firstMembership.role as string }
  }

  return null
}

const LAUNCH_ROLES = new Set(["admin", "editor", "launcher"])

export function requireRole(
  ctx: NonNullable<Awaited<ReturnType<typeof getAuthContext>>>,
  allowed: ReadonlySet<string> = LAUNCH_ROLES
) {
  if (!allowed.has(ctx.role)) {
    return NextResponse.json(
      { error: `Role "${ctx.role}" does not have permission to perform this action.` },
      { status: 403 }
    )
  }
  return null
}

/**
 * Get the Facebook access token for the org.
 * OAuth connections only — via (manual_token) rows are resolved per ad account
 * through getConnectionForAdAccount() and must never be returned here.
 */
export async function getFacebookConnection(orgId: string) {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from("facebook_connections")
    .select("id, fb_user_id, fb_user_name, fb_picture_url, access_token, token_expires_at")
    .eq("org_id", orgId)
    .eq("is_active", true)
    .eq("connection_type", "oauth")
    .order("updated_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!data) return data
  return {
    ...data,
    access_token: decryptSecret(data.access_token) || data.access_token,
  }
}

/**
 * Via MECE resolver (decision 09/07/2026 — see project-docs/05-permission-system/VIA-MASTER.md).
 * WRITE: via launch của account → OAuth của org → throw MissingViaError
 * READ : via non-launch của account → OAuth của org → null (route rơi vào snapshot fallback)
 */
export type MetaPurpose = "write" | "read"

export interface ResolvedConnection {
  id: string
  access_token: string
  connection_type: "oauth" | "manual_token"
  via_role: "launch" | "non_launch" | null
  token_status: string
  label: string | null
  fb_user_id: string
}

export class MissingViaError extends Error {
  purpose: MetaPurpose
  constructor(purpose: MetaPurpose) {
    super("This ad account has no launch via. Add a launch via in Connect.")
    this.name = "MissingViaError"
    this.purpose = purpose
  }
}

/** True when the connection carries a manual via token → Meta calls must skipProof. */
export function isManual(conn: Pick<ResolvedConnection, "connection_type">): boolean {
  return conn.connection_type === "manual_token"
}

const CONNECTION_FIELDS =
  "id, fb_user_id, access_token, connection_type, via_role, token_status, label"

async function getSlotConnection(
  orgId: string,
  fbAdAccountId: string,
  slot: "launch_connection_id" | "read_connection_id"
): Promise<ResolvedConnection | null> {
  const supabase = createAdminClient()
  // DB stores fb_ad_account_id as "act_<n>" (Meta id) and fb_account_id as "<n>"
  const { data: account } = await supabase
    .from("ad_accounts")
    .select(slot)
    .eq("org_id", orgId)
    .or(`fb_ad_account_id.eq.act_${fbAdAccountId},fb_account_id.eq.${fbAdAccountId}`)
    .maybeSingle()

  const connectionId = (account as Record<string, string | null> | null)?.[slot]
  if (!connectionId) return null

  const { data: conn } = await supabase
    .from("facebook_connections")
    .select(CONNECTION_FIELDS)
    .eq("id", connectionId)
    .eq("is_active", true)
    .eq("connection_type", "manual_token")
    .maybeSingle()

  if (!conn) return null
  return {
    ...(conn as ResolvedConnection),
    access_token: decryptSecret((conn as ResolvedConnection).access_token) || (conn as ResolvedConnection).access_token,
  }
}

export async function getConnectionForAdAccount(
  orgId: string,
  adAccountId: string | null | undefined,
  purpose: MetaPurpose
): Promise<ResolvedConnection | null> {
  // Ad account IDs arrive as "act_123..." or "123..." depending on the route
  const fbAdAccountId = adAccountId?.replace(/^act_/, "")

  if (fbAdAccountId) {
    const slot = purpose === "write" ? "launch_connection_id" : "read_connection_id"
    const via = await getSlotConnection(orgId, fbAdAccountId, slot)
    if (via) return via
  }

  // Org-level routes (no adAccountId) and slot misses fall back to OAuth
  const oauth = await getFacebookConnection(orgId)
  if (oauth) {
    return {
      id: oauth.id,
      access_token: oauth.access_token,
      connection_type: "oauth",
      via_role: null,
      token_status: "valid",
      label: null,
      fb_user_id: oauth.fb_user_id,
    }
  }

  if (purpose === "write") throw new MissingViaError(purpose)
  return null // read degrades softly: caller falls through to snapshot fallback
}
