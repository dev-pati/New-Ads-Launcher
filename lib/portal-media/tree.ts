import type { PortalRegistryAsset } from "@/lib/supabase/portal-registry"

/**
 * Turns Portal object keys into a browsable folder tree.
 *
 * The keys are the real R2 paths, so the tree is the bucket's own structure — nothing
 * is invented. The problem is that only one level is named by a human:
 *
 *   creative-portal/approved/shilasource/2026/07/imports/<uuid>/broll_23-job14-vid03-var1.mp4
 *   └── constant ──┘└──brand──┘└─date─┘└─const─┘└─1 file─┘
 *
 * Rendered literally that is seven clicks to reach one file, five of them with a single
 * option and the last a fan-out of uuid folders holding exactly one file each. So two
 * symmetrical collapses run, both of which remove a click that had no choice in it:
 *
 *   - a folder with no files and exactly one subfolder merges into it (labels join with "/")
 *   - a folder with exactly one file and no subfolders hands that file to its parent
 *
 * `label` is the collapsed display string; `path` is always the real, uncollapsed key
 * prefix, so callers never have to undo any of this.
 */

export type MediaNode = {
  kind: "file"
  assetId: string
  objectKey: string
  name: string
  mimeType: string | null
  sizeBytes: number | null
  createdAt: string | null
  fileUrl: string | null

  brandId: string | null
  brandName: string | null
  brandSlug: string | null
  productId: string | null
  productName: string | null
  pdpUrl: string | null
  salesPageUrl: string | null
  landingUrl: string | null
  checkoutFunnelUrl: string | null

  language: string | null
  briefType: string | null
  voiceVariant: string | null

  mediaType: string | null
  width: number | null
  height: number | null
  durationSeconds: number | null
}

export type FolderNode = {
  kind: "folder"
  /** Real, uncollapsed object-key prefix. The unit an assign acts on. */
  path: string
  /** Display string; may span several collapsed levels, e.g. "shilasource/2026/07/imports". */
  label: string
  fileCount: number
  folders: FolderNode[]
  files: MediaNode[]
}

type Draft = {
  segment: string
  path: string
  label: string
  folders: Map<string, Draft>
  files: MediaNode[]
}

function draft(segment: string, path: string): Draft {
  return { segment, path, label: segment, folders: new Map(), files: [] }
}

function toMediaNode(asset: PortalRegistryAsset, fileName: string): MediaNode {
  return {
    kind: "file",
    assetId: asset.id,
    objectKey: asset.object_key,
    name: asset.original_file_name || fileName,
    mimeType: asset.mime_type,
    sizeBytes: asset.actual_size_bytes,
    createdAt: asset.created_at,
    fileUrl: asset.file_url,
    brandId: asset.brand_id,
    brandName: asset.brand_name,
    brandSlug: asset.brand_slug,
    productId: asset.product_id,
    productName: asset.product_name,
    pdpUrl: asset.product_catalog_pdp_url,
    salesPageUrl: asset.product_catalog_sales_page_url,
    landingUrl: asset.product_catalog_landing_url,
    checkoutFunnelUrl: asset.product_catalog_checkoutchamp_funnel_url,
    language: asset.language,
    briefType: asset.brief_type,
    voiceVariant: asset.voice_variant,
    mediaType: asset.media_type,
    width: asset.width,
    height: asset.height,
    durationSeconds: asset.duration_seconds,
  }
}

/** Post-order: collapse the subtree, then absorb single-file children, then merge a lone child. */
function compact(node: Draft): Draft {
  for (const child of node.folders.values()) compact(child)

  for (const [key, child] of [...node.folders]) {
    if (child.folders.size === 0 && child.files.length === 1) {
      node.files.push(child.files[0])
      node.folders.delete(key)
    }
  }

  while (node.files.length === 0 && node.folders.size === 1) {
    const only = [...node.folders.values()][0]
    node.label = `${node.label}/${only.label}`
    node.path = only.path
    node.folders = only.folders
    node.files = only.files
  }

  return node
}

function finalize(node: Draft): FolderNode {
  const folders = [...node.folders.values()].map(finalize).sort((a, b) => a.label.localeCompare(b.label))
  const files = [...node.files].sort((a, b) => a.name.localeCompare(b.name))
  return {
    kind: "folder",
    path: node.path,
    label: node.label,
    folders,
    files,
    fileCount: files.length + folders.reduce((sum, f) => sum + f.fileCount, 0),
  }
}

export function buildTree(assets: PortalRegistryAsset[]): FolderNode[] {
  const roots = new Map<string, Draft>()

  for (const asset of assets) {
    const segments = asset.object_key.split("/").filter(Boolean)
    if (segments.length < 2) continue // a bare object at the bucket root has no folder to browse
    const fileName = segments.pop()!

    let level = roots
    let node: Draft | undefined
    let prefix = ""
    for (const segment of segments) {
      prefix = prefix ? `${prefix}/${segment}` : segment
      let next = level.get(segment)
      if (!next) {
        next = draft(segment, prefix)
        level.set(segment, next)
      }
      node = next
      level = next.folders
    }
    node!.files.push(toMediaNode(asset, fileName))
  }

  let top = [...roots.values()].map(compact).map(finalize)

  // A single root is a constant prefix, not a choice. Lift its children so the first
  // thing on screen is the brand — the only level a person named.
  while (top.length === 1 && top[0].files.length === 0 && top[0].folders.length > 0) {
    top = top[0].folders
  }

  return top.sort((a, b) => a.label.localeCompare(b.label))
}

/** Every object key at or below a folder path. Used to expand a recursive assign. */
export function collectKeysUnder(folders: FolderNode[], path: string): string[] {
  const prefix = `${path}/`
  const keys: string[] = []
  const walk = (node: FolderNode) => {
    for (const file of node.files) keys.push(file.objectKey)
    for (const child of node.folders) walk(child)
  }
  const find = (nodes: FolderNode[]): boolean => {
    for (const node of nodes) {
      if (node.path === path) {
        walk(node)
        return true
      }
      if (path.startsWith(`${node.path}/`) && find(node.folders)) return true
    }
    return false
  }
  if (!find(folders)) {
    // The path may name a collapsed level that no node carries verbatim; fall back to
    // a prefix sweep so a folder assign never silently selects nothing.
    const sweep = (node: FolderNode) => {
      for (const file of node.files) if (file.objectKey.startsWith(prefix)) keys.push(file.objectKey)
      for (const child of node.folders) sweep(child)
    }
    folders.forEach(sweep)
  }
  return keys
}
