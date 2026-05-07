import { NextRequest, NextResponse } from "next/server"
import { getAuthContext, getFacebookConnection } from "@/lib/auth"

// GET /api/facebook/ad-media?ad_account_id=act_xxx&type=all|image|video&after=cursor&limit=50
export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const sp = request.nextUrl.searchParams
    const adAccountId = sp.get("ad_account_id")
    const type = sp.get("type") || "all"
    const after = sp.get("after") || ""
    const limit = Math.min(parseInt(sp.get("limit") || "100", 10), 200)

    if (!adAccountId) return NextResponse.json({ error: "ad_account_id required" }, { status: 400 })

    const connection = await getFacebookConnection(ctx.orgId)
    if (!connection) return NextResponse.json({ error: "No Facebook connection" }, { status: 401 })

    const token = connection.access_token
    const normId = adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`
    const cursorParam = after ? `&after=${encodeURIComponent(after)}` : ""

    const results: any[] = []
    let nextCursor: string | null = null

    if (type === "all" || type === "video") {
      const videoFields = "id,title,description,created_time,length,thumbnails{uri},picture,status,embeddable"
      const vRes = await fetch(
        `https://graph.facebook.com/v21.0/${normId}/advideos?fields=${videoFields}&limit=${limit}${cursorParam}&access_token=${token}`
      )
      const vData = await vRes.json()
      if (vData.data) {
        for (const v of vData.data) {
          const thumb = v.thumbnails?.data?.[0]?.uri || v.picture || ""
          results.push({
            id: `vid_${v.id}`,
            fb_id: v.id,
            name: v.title || v.description || `video_${v.id}`,
            media_type: "video",
            duration: v.length ? Math.round(v.length) : null,
            date_added: v.created_time,
            status: v.status || null,
            thumbnail_url: thumb,
            fb_video_id: v.id,
          })
        }
        if (vData.paging?.cursors?.after) nextCursor = vData.paging.cursors.after
      }
    }

    if (type === "all" || type === "image") {
      const imgFields = "hash,url,url_128,name,created_time,status,width,height,creatives"
      const iRes = await fetch(
        `https://graph.facebook.com/v21.0/${normId}/adimages?fields=${imgFields}&limit=${limit}${cursorParam}&access_token=${token}`
      )
      const iData = await iRes.json()
      if (iData.data) {
        for (const img of iData.data) {
          const w = img.width || 0
          const h = img.height || 0
          results.push({
            id: `img_${img.hash}`,
            fb_id: img.hash,
            name: img.name || `image_${img.hash?.slice(0, 8)}`,
            media_type: "image",
            width: w,
            height: h,
            dimensions: w && h ? `${w}x${h}` : null,
            date_added: img.created_time,
            status: img.status || null,
            thumbnail_url: img.url_128 || img.url || "",
            fb_image_hash: img.hash,
            fb_image_url: img.url,
          })
        }
      }
    }

    // Sort by date descending
    results.sort((a, b) => new Date(b.date_added || 0).getTime() - new Date(a.date_added || 0).getTime())

    return NextResponse.json({ media: results, nextCursor })
  } catch (err: any) {
    console.error("[ad-media]", err)
    return NextResponse.json({ error: err.message || "Failed to fetch media" }, { status: 500 })
  }
}
