import { NextRequest, NextResponse } from "next/server"
import {
  exchangeCodeForToken,
  getLongLivedToken,
  getFacebookUser,
  getBusinessManagers,
  getBusinessPages,
  getAdAccounts,
} from "@/lib/facebook"
import { createAdminClient } from "@/lib/supabase/admin"
import { getAuthContext } from "@/lib/auth"

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get("code")
  const state = searchParams.get("state")
  const error = searchParams.get("error")
  const storedState = request.cookies.get("fb_oauth_state")?.value

  if (error) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/?fb_error=${encodeURIComponent(error)}`
    )
  }

  if (!state || !storedState || state !== storedState) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/?fb_error=invalid_state`
    )
  }

  if (!code) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/?fb_error=no_code`
    )
  }

  try {
    const ctx = await getAuthContext()
    if (!ctx) {
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/auth/login`)
    }
    const { orgId, user } = ctx

    if (!orgId) {
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/?fb_error=no_org`)
    }

    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/facebook/callback`
    const tokenData = await exchangeCodeForToken(code, redirectUri)
    const longLivedToken = await getLongLivedToken(tokenData.access_token)
    const fbUser = await getFacebookUser(longLivedToken.access_token)

    const supabase = createAdminClient()

    // Keep one active OAuth connection per org. Without this, reconnecting
    // with another Meta account can leave stale active tokens around.
    // Via rows (connection_type='manual_token') live independently — never touch them here.
    await supabase
      .from("facebook_connections")
      .update({ is_active: false })
      .eq("org_id", orgId)
      .eq("connection_type", "oauth")

    // Save Facebook connection with org_id
    const { data: connection, error: upsertError } = await supabase
      .from("facebook_connections")
      .upsert(
        {
          org_id: orgId,
          user_id: user.id,
          fb_user_id: fbUser.id,
          fb_user_name: fbUser.name,
          fb_email: fbUser.email,
          fb_picture_url: fbUser.picture?.data?.url,
          access_token: longLivedToken.access_token,
          token_expires_at: longLivedToken.expires_in
            ? new Date(Date.now() + longLivedToken.expires_in * 1000).toISOString()
            : new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
          is_active: true,
        },
        { onConflict: "org_id,fb_user_id" }
      )
      .select("id")
      .single()

    if (upsertError) {
      console.error("Failed to save FB connection:", upsertError)
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/?fb_error=save_failed`)
    }

    // Sync BMs, Pages, Ad Accounts
    try {
      const bms = await getBusinessManagers(longLivedToken.access_token)
      for (const bm of bms) {
        const { data: bmRow } = await supabase
          .from("business_managers")
          .upsert(
            {
              org_id: orgId,
              user_id: user.id,
              facebook_connection_id: connection.id,
              fb_business_id: bm.id,
              name: bm.name,
            },
            { onConflict: "org_id,fb_business_id" }
          )
          .select("id")
          .single()

        if (!bmRow) continue

        try {
          const pages = await getBusinessPages(bm.id, longLivedToken.access_token)
          for (const page of pages) {
            await supabase.from("pages").upsert(
              {
                org_id: orgId,
                user_id: user.id,
                business_manager_id: bmRow.id,
                fb_page_id: page.id,
                name: page.name,
                category: page.category,
                picture_url: page.picture?.data?.url,
                page_access_token: page.access_token,
              },
              { onConflict: "org_id,fb_page_id" }
            )
          }
        } catch (e) {
          console.error(`Failed to sync pages for BM ${bm.id}:`, e)
        }
      }
    } catch (e) {
      console.error("Failed to sync business managers:", e)
    }

    // Pull every ad account the token can access via /me/adaccounts — this catches
    // accounts not owned by any synced BM (personal accounts, or accounts under a BM
    // we didn't enumerate). BM mapping is best-effort; business_manager_id is nullable
    // so unmapped accounts are still assignable.
    try {
      const [allAccounts, { data: orgBms }] = await Promise.all([
        getAdAccounts(longLivedToken.access_token),
        supabase.from("business_managers").select("id, fb_business_id").eq("org_id", orgId),
      ])
      const bmDbByFb = new Map((orgBms || []).map((b: { id: string; fb_business_id: string }) => [b.fb_business_id, b.id]))

      for (const acc of allAccounts) {
        const bmDbId = acc.business?.id ? bmDbByFb.get(acc.business.id) ?? null : null
        await supabase.from("ad_accounts").upsert(
          {
            org_id: orgId,
            user_id: user.id,
            business_manager_id: bmDbId,
            fb_ad_account_id: acc.id,
            fb_account_id: acc.account_id,
            name: acc.name,
            currency: acc.currency || "USD",
            timezone_name: acc.timezone_name || null,
            account_status: acc.account_status ?? 1,
            amount_spent_minor: acc.amount_spent != null ? Number(acc.amount_spent) : null,
            balance_minor: acc.balance != null ? Number(acc.balance) : null,
            spend_cap_minor: acc.spend_cap != null ? Number(acc.spend_cap) : null,
            owner_business_id: acc.business?.id || null,
            owner_business_name: acc.business?.name || null,
            raw_meta: acc,
            is_active: true,
          },
          { onConflict: "org_id,fb_ad_account_id" }
        )
      }
    } catch (e) {
      console.error("Failed to sync all ad accounts:", e)
    }

    const response = NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/?fb_connected=true`)
    response.cookies.delete("fb_oauth_state")
    return response
  } catch (err: any) {
    console.error("Facebook OAuth error:", err)
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/?fb_error=exchange_failed`)
  }
}
