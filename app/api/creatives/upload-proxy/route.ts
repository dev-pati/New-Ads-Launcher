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

  const contentType = request.headers.get("content-type") || "application/octet-stream"

  try {
    const response = await fetch(signedUrl, {
      method: "PUT",
      // @ts-ignore — duplex is required when body is a ReadableStream
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
