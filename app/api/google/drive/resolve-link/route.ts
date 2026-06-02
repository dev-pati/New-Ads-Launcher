import { NextRequest, NextResponse } from "next/server"
import { getAuthContext } from "@/lib/auth"
import { getGoogleTokenForOrg } from "@/lib/google-token"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type DriveLinkItem = { id: string; type: "file" | "folder"; label?: string }
type DriveFile = { id: string; name: string; mimeType: string }

function escapeDriveQueryValue(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'")
}

async function driveFetchJson(orgId: string, path: string) {
  let token = await getGoogleTokenForOrg(orgId)
  if (!token) return { connected: false as const, status: 401, data: null as any }

  let res = await fetch(`https://www.googleapis.com/drive/v3/${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  })

  if (res.status === 401) {
    token = await getGoogleTokenForOrg(orgId, { forceRefresh: true })
    if (!token) return { connected: false as const, status: 401, data: null as any }
    res = await fetch(`https://www.googleapis.com/drive/v3/${path}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    })
  }

  const data = await res.json().catch(() => null)
  if (!res.ok) {
    const message = data?.error?.message || `Google Drive API failed (${res.status})`
    throw new Error(message)
  }

  return { connected: true as const, status: res.status, data }
}

async function getFileMetadata(orgId: string, fileId: string): Promise<DriveFile> {
  const params = new URLSearchParams({
    fields: "id,name,mimeType",
    supportsAllDrives: "true",
  })
  const result = await driveFetchJson(orgId, `files/${encodeURIComponent(fileId)}?${params}`)
  if (!result.connected) throw new Error("Google Drive is not connected")
  return result.data as DriveFile
}

async function listFilesInFolder(orgId: string, folderId: string, recursive: boolean): Promise<DriveFile[]> {
  const all: DriveFile[] = []
  let pageToken: string | undefined

  do {
    const params = new URLSearchParams({
      q: `'${escapeDriveQueryValue(folderId)}' in parents and (mimeType contains 'image/' or mimeType contains 'video/') and trashed = false`,
      fields: "nextPageToken,files(id,name,mimeType)",
      pageSize: "1000",
      supportsAllDrives: "true",
      includeItemsFromAllDrives: "true",
    })
    if (pageToken) params.set("pageToken", pageToken)
    const result = await driveFetchJson(orgId, `files?${params}`)
    if (!result.connected) throw new Error("Google Drive is not connected")
    all.push(...((result.data.files || []) as DriveFile[]))
    pageToken = result.data.nextPageToken
  } while (pageToken)

  if (!recursive) return all

  const subfolders: { id: string }[] = []
  let subPageToken: string | undefined
  do {
    const params = new URLSearchParams({
      q: `'${escapeDriveQueryValue(folderId)}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
      fields: "nextPageToken,files(id,name,mimeType)",
      pageSize: "1000",
      supportsAllDrives: "true",
      includeItemsFromAllDrives: "true",
    })
    if (subPageToken) params.set("pageToken", subPageToken)
    const result = await driveFetchJson(orgId, `files?${params}`)
    if (!result.connected) throw new Error("Google Drive is not connected")
    subfolders.push(...((result.data.files || []) as { id: string }[]))
    subPageToken = result.data.nextPageToken
  } while (subPageToken)

  for (const folder of subfolders) {
    all.push(...await listFilesInFolder(orgId, folder.id, true))
  }

  return all
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await request.json().catch(() => ({}))
    const items = Array.isArray(body.items) ? body.items as DriveLinkItem[] : []
    const includeSubfolders = !!body.includeSubfolders

    if (items.length === 0) {
      return NextResponse.json({ files: [], errors: [] })
    }

    const token = await getGoogleTokenForOrg(ctx.orgId)
    if (!token) return NextResponse.json({ connected: false, files: [], errors: [] }, { status: 401 })

    const files: DriveFile[] = []
    const errors: { name: string; error: string }[] = []

    for (const item of items) {
      try {
        if (item.type === "file") {
          const file = await getFileMetadata(ctx.orgId, item.id)
          if (!file.mimeType.startsWith("image/") && !file.mimeType.startsWith("video/")) {
            throw new Error("Link is not an image or video file")
          }
          files.push(file)
        } else {
          const folderFiles = await listFilesInFolder(ctx.orgId, item.id, includeSubfolders)
          files.push(...folderFiles)
          if (folderFiles.length === 0) {
            errors.push({ name: item.label || item.id, error: "No image or video files found in folder" })
          }
        }
      } catch (err: any) {
        errors.push({ name: item.label || item.id, error: err.message || "Failed to resolve Drive link" })
      }
    }

    const seen = new Set<string>()
    const deduped = files.filter(file => {
      if (seen.has(file.id)) return false
      seen.add(file.id)
      return true
    })

    return NextResponse.json({ connected: true, files: deduped, errors })
  } catch (err: any) {
    console.error("[google/drive/resolve-link] error:", err)
    return NextResponse.json({ error: err.message || "Failed to resolve Google Drive links" }, { status: 500 })
  }
}
