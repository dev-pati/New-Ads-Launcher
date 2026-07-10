/**
 * Via connection helpers (mô hình via MECE — project-docs/05-permission-system/VIA-MASTER.md).
 * Via tokens are issued by another Meta app → every Graph call here must skipProof.
 */
import { secureMetaFetch } from "@/lib/meta-secure-fetch"
import { normalizeMetaError, type MetaErrorPayload } from "@/lib/meta-error"

const GRAPH = "https://graph.facebook.com/v25.0"

export type ViaRole = "launch" | "non_launch"

export interface ViaProfile {
  id: string
  name: string
  picture_url: string | null
}

export interface ViaAdAccount {
  id: string // "act_<n>"
  account_id: string // "<n>"
  name: string | null
  account_status: number | null
  currency: string | null
  timezone_name: string | null
}

export class ViaTokenError extends Error {
  meta: MetaErrorPayload
  constructor(meta: MetaErrorPayload) {
    super(meta.error)
    this.name = "ViaTokenError"
    this.meta = meta
  }
}

interface GraphErrorShape {
  error?: { message?: string; code?: number }
}

async function viaGraphGet<T>(token: string, path: string): Promise<T> {
  const res = await secureMetaFetch(
    `${GRAPH}/${path}${path.includes("?") ? "&" : "?"}access_token=${encodeURIComponent(token)}`,
    undefined,
    { skipProof: true }
  )
  const data = (await res.json()) as T & GraphErrorShape
  if (data?.error) throw new ViaTokenError(normalizeMetaError(data))
  return data
}

/** Validate a via token and return the FB profile behind it. */
export async function fetchViaProfile(token: string): Promise<ViaProfile> {
  const me = await viaGraphGet<{
    id: string | number
    name?: string
    picture?: { data?: { url?: string } }
  }>(token, "me?fields=id,name,picture{url}")
  return {
    id: String(me.id),
    name: me.name ?? "",
    picture_url: me.picture?.data?.url ?? null,
  }
}

interface RawViaAdAccount {
  id: string | number
  account_id?: string | number
  name?: string
  account_status?: number
  currency?: string
  timezone_name?: string
}

/** List ad accounts the via can see (follows paging, capped to avoid runaway). */
export async function fetchViaAdAccounts(token: string): Promise<ViaAdAccount[]> {
  const accounts: ViaAdAccount[] = []
  let path: string | null =
    "me/adaccounts?fields=id,account_id,name,account_status,currency,timezone_name&limit=100"

  for (let page = 0; path && page < 5; page++) {
    const data: { data?: RawViaAdAccount[]; paging?: { next?: string } } = await viaGraphGet(token, path)
    for (const acc of data.data ?? []) {
      accounts.push({
        id: String(acc.id),
        account_id: String(acc.account_id ?? String(acc.id).replace(/^act_/, "")),
        name: acc.name ?? null,
        account_status: acc.account_status ?? null,
        currency: acc.currency ?? null,
        timezone_name: acc.timezone_name ?? null,
      })
    }
    const next: string | undefined = data.paging?.next
    path = next ? next.replace(`${GRAPH}/`, "") : null
  }

  return accounts
}

export function slotColumnForRole(role: ViaRole): "launch_connection_id" | "read_connection_id" {
  return role === "launch" ? "launch_connection_id" : "read_connection_id"
}

/** token_status value for a failed via check, derived from the Meta error. */
export function tokenStatusFromError(err: unknown): "expired" | "invalid" {
  if (err instanceof ViaTokenError && err.meta.type === "token") return "expired"
  return "invalid"
}
