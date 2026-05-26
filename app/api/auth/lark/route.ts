import { NextResponse } from "next/server"
import crypto from "crypto"

export async function GET() {
  const state = crypto.randomBytes(16).toString("hex")
  const appId = process.env.LARK_APP_ID
  if (!appId) return NextResponse.json({ error: "Lark not configured" }, { status: 500 })

  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/lark/callback`
  const loginUrl = `https://open.larksuite.com/open-apis/authen/v1/index?app_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`

  const response = NextResponse.redirect(loginUrl)
  response.cookies.set("lark_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  })
  return response
}
