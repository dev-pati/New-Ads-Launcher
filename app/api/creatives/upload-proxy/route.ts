import { NextRequest, NextResponse } from "next/server"
import { getAuthContext } from "@/lib/auth"

// Same-origin proxy for Supabase Storage uploads — eliminates CORS errors
// when uploading directly from the browser to supabase.patiagency.com.
// The browser XHRs to this route (same origin), which streams the body to
// Supabase using the signed URL. No body buffering; progress tracking works.
export const runtime = "nodejs"
export const maxDuration = 300
export const dynamic = "force-dynamic"

export async function PUT(request: NextRequest) {
  const ctx = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const signedUrl = request.nextUrl.searchParams.get("url")
  if (!signedUrl) return NextResponse.json({ error: "url required" }, { status: 400 })

  // SEC-006: restrict to the project's own Supabase Storage host to prevent SSRF
  const allowedHost = (() => { try { return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).host } catch { return null } })()
  if (!allowedHost) return NextResponse.json({ error: "storage host not configured" }, { status: 500 })
  let target: URL
  try { target = new URL(signedUrl) } catch { return NextResponse.json({ error: "invalid url" }, { status: 400 }) }
  if (target.protocol !== "https:" || target.host !== allowedHost) {
    return NextResponse.json({ error: "url not allowed" }, { status: 403 })
  }

  const contentType = request.headers.get("content-type") || "application/octet-stream"

  try {
    const response = await fetch(signedUrl, {
      method: "PUT",
      // @ts-expect-error — duplex is required when body is a ReadableStream
      duplex: "half",
      body: request.body,
      headers: { "Content-Type": contentType },
    })

    const text = await response.text().catch(() => "")
    return new NextResponse(text || null, { status: response.status })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Proxy upload failed" }, { status: 500 })
  }
}
