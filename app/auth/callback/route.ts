import { NextResponse } from "next/server"

// OAuth callback — không dùng Supabase Auth, redirect về home
export async function GET(request: Request) {
  const { origin } = new URL(request.url)
  return NextResponse.redirect(`${origin}/`)
}
