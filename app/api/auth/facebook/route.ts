import { NextResponse } from "next/server"
import { getFacebookLoginUrl } from "@/lib/facebook"
import crypto from "crypto"

export async function GET() {
  const state = crypto.randomBytes(16).toString("hex")
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/facebook/callback`
  const loginUrl = getFacebookLoginUrl(redirectUri, state)

  const response = NextResponse.redirect(loginUrl)
  response.cookies.set("fb_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600, // 10 minutes
    path: "/",
  })

  return response
}
