import { NextRequest, NextResponse } from "next/server"
import { getAuthUser } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"

// Add media to an ad
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id: adId } = await params
    const supabase = await createClient()

    // Verify ad belongs to user
    const { data: ad } = await supabase
      .from("ads")
      .select("id")
      .eq("id", adId)
      .eq("user_id", user.id)
      .single()

    if (!ad) {
      return NextResponse.json({ error: "Ad not found" }, { status: 404 })
    }

    const formData = await request.formData()
    const file = formData.get("file") as File
    const mediaType = formData.get("media_type") as string
    const sortOrder = parseInt(formData.get("sort_order") as string) || 0

    if (!file || !mediaType) {
      return NextResponse.json(
        { error: "file and media_type are required" },
        { status: 400 }
      )
    }

    // Upload to Supabase Storage
    const fileExt = file.name.split(".").pop()
    const storagePath = `${user.id}/${adId}/${Date.now()}.${fileExt}`

    const { error: uploadError } = await supabase.storage
      .from("ad-media")
      .upload(storagePath, file)

    if (uploadError) {
      console.error("Failed to upload file:", uploadError)
      return NextResponse.json(
        { error: "Failed to upload file" },
        { status: 500 }
      )
    }

    const { data: urlData } = supabase.storage
      .from("ad-media")
      .getPublicUrl(storagePath)

    // Save media record
    const { data, error } = await supabase
      .from("ad_media")
      .insert({
        ad_id: adId,
        user_id: user.id,
        media_type: mediaType,
        storage_path: storagePath,
        url: urlData.publicUrl,
        file_name: file.name,
        file_size: file.size,
        sort_order: sortOrder,
      })
      .select()
      .single()

    if (error) {
      console.error("Failed to save media record:", error)
      return NextResponse.json(
        { error: "Failed to save media" },
        { status: 500 }
      )
    }

    return NextResponse.json({ media: data }, { status: 201 })
  } catch (err) {
    console.error("Failed to upload media:", err)
    return NextResponse.json(
      { error: "Failed to upload media" },
      { status: 500 }
    )
  }
}

// Delete media from an ad
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id: adId } = await params
    const mediaId = request.nextUrl.searchParams.get("media_id")

    if (!mediaId) {
      return NextResponse.json(
        { error: "media_id is required" },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Get media to find storage path
    const { data: media } = await supabase
      .from("ad_media")
      .select("storage_path")
      .eq("id", mediaId)
      .eq("ad_id", adId)
      .eq("user_id", user.id)
      .single()

    if (!media) {
      return NextResponse.json({ error: "Media not found" }, { status: 404 })
    }

    // Delete from storage
    await supabase.storage.from("ad-media").remove([media.storage_path])

    // Delete record
    await supabase
      .from("ad_media")
      .delete()
      .eq("id", mediaId)
      .eq("user_id", user.id)

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("Failed to delete media:", err)
    return NextResponse.json(
      { error: "Failed to delete media" },
      { status: 500 }
    )
  }
}
