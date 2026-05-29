/**
 * Google Drive Trigger Checker
 * Polls Google Drive for new files or folders using OAuth token.
 */

const DRIVE_API = "https://www.googleapis.com/drive/v3"

export interface DriveTriggerState {
  processedFileIds?:   string[]   // drive_new_file_in_folder
  processedFolderIds?: string[]   // drive_new_folder_in_folder
}

export interface DriveTriggerResult {
  fired: boolean
  reason: string
  newState: DriveTriggerState
  items?: { id: string; name: string; mimeType: string; webViewLink?: string; thumbnailLink?: string }[]
}

// ─── Drive API helper ─────────────────────────────────────────────────────────

async function driveList(q: string, token: string, fields = "files(id,name,mimeType,createdTime,webViewLink,thumbnailLink,parents,size)") {
  const params = new URLSearchParams({ q, fields, orderBy: "createdTime desc", pageSize: "100" })
  const res = await fetch(`${DRIVE_API}/files?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error?.message ?? "Drive API error")
  return (data.files ?? []) as any[]
}

function buildMimeFilter(fileType?: string): string {
  if (fileType === "images") return "(mimeType contains 'image/')"
  if (fileType === "videos") return "(mimeType contains 'video/')"
  return "(mimeType contains 'image/' or mimeType contains 'video/')"
}

function matchesNameFilter(name: string, filter?: string, value?: string): boolean {
  if (!filter || filter === "all") return true
  if (!value) return true
  const n = name.toLowerCase(), v = value.toLowerCase()
  if (filter === "name_contains")           return n.includes(v)
  if (filter === "name_equals")             return n === v
  if (filter === "name_does_not_contain")   return !n.includes(v)
  if (filter === "name_starts_with")        return n.startsWith(v)
  if (filter === "name_ends_with")          return n.endsWith(v)
  return true
}

// ─── 1. New File in Folder ────────────────────────────────────────────────────

export async function checkDriveNewFile(
  triggerConfig: any,
  state: DriveTriggerState,
  token: string
): Promise<DriveTriggerResult> {
  const folderId  = triggerConfig.driveFolderId
  const fileType  = triggerConfig.driveFileType  // "all" | "images" | "videos"
  const nameFilter= triggerConfig.driveFileNameFilter
  const nameValue = triggerConfig.driveFileNameFilterValue

  if (!folderId) return { fired: false, reason: "No folder configured", newState: state }

  const mimeFilter = buildMimeFilter(fileType)
  const q = `'${folderId}' in parents and trashed = false and ${mimeFilter}`
  const files = await driveList(q, token)

  const processedIds = new Set(state.processedFileIds ?? [])

  // First run: record all existing files but don't fire (unless uploadAllOnFirstRun)
  if (processedIds.size === 0 && !triggerConfig.driveUploadAllOnFirstRun) {
    const newState: DriveTriggerState = {
      ...state,
      processedFileIds: files.map((f: any) => f.id),
    }
    return {
      fired: false,
      reason: `First run — recorded ${files.length} existing file(s), will trigger on new files only`,
      newState,
    }
  }

  // Find new (unprocessed) files
  let newFiles = files.filter((f: any) => !processedIds.has(f.id))

  // Apply name filter
  if (nameFilter && nameFilter !== "all") {
    newFiles = newFiles.filter((f: any) => matchesNameFilter(f.name, nameFilter, nameValue))
  }

  const allProcessed = [...processedIds, ...files.map((f: any) => f.id)]
  // Keep last 1000 to prevent unbounded growth
  const newState: DriveTriggerState = {
    ...state,
    processedFileIds: allProcessed.slice(-1000),
  }

  if (newFiles.length === 0) {
    return { fired: false, reason: "No new files in folder", newState }
  }

  return {
    fired: true,
    reason: `${newFiles.length} new file(s) found in folder`,
    newState,
    items: newFiles.map((f: any) => ({
      id: f.id, name: f.name, mimeType: f.mimeType,
      webViewLink: f.webViewLink, thumbnailLink: f.thumbnailLink,
    })),
  }
}

// ─── 2. New Folder in Folder ──────────────────────────────────────────────────

async function listFoldersInFolder(parentId: string, token: string, recursive: boolean): Promise<any[]> {
  const q = `'${parentId}' in parents and trashed = false and mimeType = 'application/vnd.google-apps.folder'`
  const folders = await driveList(q, token, "files(id,name,mimeType,createdTime,webViewLink,parents)")
  if (!recursive) return folders

  // Recursive: also check subfolders
  const nested = await Promise.all(folders.map(f => listFoldersInFolder(f.id, token, true)))
  return [...folders, ...nested.flat()]
}

async function countFilesInFolder(folderId: string, token: string): Promise<number> {
  const q = `'${folderId}' in parents and trashed = false and (mimeType contains 'image/' or mimeType contains 'video/')`
  const files = await driveList(q, token, "files(id)")
  return files.length
}

export async function checkDriveNewFolder(
  triggerConfig: any,
  state: DriveTriggerState,
  token: string
): Promise<DriveTriggerResult> {
  const parentFolderId = triggerConfig.driveFolderId
  const recursive      = triggerConfig.driveRecursiveSearch    ?? false
  const minFiles       = triggerConfig.driveMinFilesRequired   ?? 0
  const nameFilter     = triggerConfig.driveFolderNameFilter
  const nameValue      = triggerConfig.driveFolderNameFilterValue

  if (!parentFolderId) return { fired: false, reason: "No parent folder configured", newState: state }

  const folders = await listFoldersInFolder(parentFolderId, token, recursive)
  const processedIds = new Set(state.processedFolderIds ?? [])

  // First run: record existing folders
  if (processedIds.size === 0) {
    const newState: DriveTriggerState = {
      ...state,
      processedFolderIds: folders.map(f => f.id),
    }
    return {
      fired: false,
      reason: `First run — recorded ${folders.length} existing folder(s)`,
      newState,
    }
  }

  // Find new folders
  let newFolders = folders.filter(f => !processedIds.has(f.id))

  // Apply name filter
  if (nameFilter && nameFilter !== "all") {
    newFolders = newFolders.filter(f => matchesNameFilter(f.name, nameFilter, nameValue))
  }

  // Apply minimum files requirement
  if (minFiles > 0) {
    const withCounts = await Promise.all(
      newFolders.map(async f => ({
        folder: f,
        count: await countFilesInFolder(f.id, token),
      }))
    )
    newFolders = withCounts.filter(x => x.count >= minFiles).map(x => x.folder)
  }

  const allProcessed = [...processedIds, ...folders.map(f => f.id)]
  const newState: DriveTriggerState = {
    ...state,
    processedFolderIds: allProcessed.slice(-1000),
  }

  if (newFolders.length === 0) {
    return { fired: false, reason: "No new qualifying folders found", newState }
  }

  return {
    fired: true,
    reason: `${newFolders.length} new folder(s) found`,
    newState,
    items: newFolders.map(f => ({ id: f.id, name: f.name, mimeType: f.mimeType, webViewLink: f.webViewLink })),
  }
}
