import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { createSession } from "@/lib/custom-auth"

const LARK_BASE = "https://open.larksuite.com"

async function getAppAccessToken(): Promise<string> {
  const res = await fetch(`${LARK_BASE}/open-apis/auth/v3/app_access_token/internal`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ app_id: process.env.LARK_APP_ID, app_secret: process.env.LARK_APP_SECRET }),
  })
  const data = await res.json()
  if (data.code !== 0) throw new Error(`Lark app token failed: ${data.msg}`)
  return data.app_access_token
}

interface LarkUserInfo {
  access_token: string
  name: string
  en_name?: string
  avatar_url?: string
  email?: string
  enterprise_email?: string
  open_id: string
  union_id: string
}

async function exchangeCode(code: string, appToken: string): Promise<LarkUserInfo> {
  const res = await fetch(`${LARK_BASE}/open-apis/authen/v1/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${appToken}` },
    body: JSON.stringify({ grant_type: "authorization_code", code }),
  })
  const data = await res.json()
  if (data.code !== 0) throw new Error(`Lark code exchange failed: ${data.msg}`)
  return data.data as LarkUserInfo
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const code = searchParams.get("code")
  const state = searchParams.get("state")
  const storedState = request.cookies.get("lark_oauth_state")?.value
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!

  if (!state || !storedState || state !== storedState) {
    return NextResponse.redirect(`${appUrl}/auth/login?error=invalid_state`)
  }
  if (!code) {
    return NextResponse.redirect(`${appUrl}/auth/login?error=no_code`)
  }

  try {
    const appToken = await getAppAccessToken()
    const larkUser = await exchangeCode(code, appToken)

    const email = (larkUser.enterprise_email || larkUser.email || "").trim().toLowerCase()
    if (!email) {
      return NextResponse.redirect(`${appUrl}/auth/login?error=lark_no_email`)
    }

    const fullName = larkUser.name || larkUser.en_name || email.split("@")[0]
    const db = createAdminClient()

    const { data: existing } = await db
      .from("accounts")
      .select("id, email, full_name, avatar_url, raw_user_meta_data")
      .ilike("email", email)
      .maybeSingle()

    let accountId: string
    let accountEmail: string
    let accountName: string | null
    let accountAvatar: string | null

    if (existing) {
      accountId = existing.id
      accountEmail = existing.email
      accountName = fullName || existing.full_name
      accountAvatar = larkUser.avatar_url || existing.avatar_url
      const rawMetadata = (
        existing.raw_user_meta_data &&
        typeof existing.raw_user_meta_data === "object" &&
        !Array.isArray(existing.raw_user_meta_data)
      ) ? existing.raw_user_meta_data : {}
      await db.from("accounts").update({
        full_name: accountName,
        avatar_url: accountAvatar,
        last_sign_in_at: new Date().toISOString(),
        raw_user_meta_data: {
          ...rawMetadata,
          full_name: accountName,
          provider: "lark",
        },
      }).eq("id", accountId)
    } else {
      const { data: created, error } = await db
        .from("accounts")
        .insert({
          email,
          full_name: fullName,
          avatar_url: larkUser.avatar_url || null,
          email_confirmed_at: new Date().toISOString(),
          last_sign_in_at: new Date().toISOString(),
          raw_user_meta_data: { full_name: fullName, provider: "lark" },
        })
        .select("id, email, full_name, avatar_url")
        .single()

      if (error || !created) throw new Error(error?.message || "Failed to create account")

      accountId = created.id
      accountEmail = created.email
      accountName = created.full_name
      accountAvatar = created.avatar_url
    }

    // Note: skip profiles upsert — profiles uses auth.users FK (Supabase Auth)
    // but app uses custom accounts table

    await createSession({ id: accountId, email: accountEmail, full_name: accountName, avatar_url: accountAvatar })

    const response = NextResponse.redirect(`${appUrl}/projects`)
    response.cookies.delete("lark_oauth_state")
    return response
  } catch (err) {
    console.error("[lark-callback]", err)
    return NextResponse.redirect(`${appUrl}/auth/login?error=lark_failed`)
  }
}
