"use client"

/**
 * The one Media Detail sidebar.
 *
 * Portal Vault's sheet is the source of truth — this file is that markup, lifted
 * verbatim and then given the two things it was missing (an `Assigned To` block, and a
 * `View media` action promoted out of the footer to sit directly above File Information).
 * Assets and Portal Media previously carried a second, hand-maintained copy with
 * different type sizes and a different set of sections; both now render this.
 *
 * Do not fork it. A field that only one surface can populate is an optional prop, not a
 * second component.
 */

import type { MediaNode } from "@/lib/portal-media/tree"
import { cn } from "@/lib/utils"
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet"
import { IconExternalLink, IconCopy, IconCheck } from "@tabler/icons-react"
import { useState } from "react"

/** The Portal registry row as the tree API hands it to the client. */
export type MediaDetailFile = MediaNode

/** Public media resolver. Mirrors CREATIVE_MEDIA_API_ORIGIN on the server side. */
export const PORTAL_MEDIA_RESOLVER =
  `${process.env.NEXT_PUBLIC_CREATIVE_MEDIA_API_ORIGIN || "https://creative.patigroup.com"}/api/media`

export function portalMediaHref(file: Pick<MediaDetailFile, "assetId">) {
  return `${PORTAL_MEDIA_RESOLVER}/${file.assetId}`
}

// ─── Shared formatters ────────────────────────────────────────────────────────
// Previously three near-identical copies across two files. Kept here so the sheet and
// the tables that feed it can never disagree about what "1.5 MB" or "0:07.50" means.

export function formatMediaBytes(bytes?: number | null) {
  if (bytes === null || bytes === undefined) return "—"
  if (bytes < 1024) return `${bytes} B`
  const units = ["KB", "MB", "GB"]
  let value = bytes / 1024
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) { value /= 1024; unit++ }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unit]}`
}

export function formatMediaDuration(seconds?: number | null) {
  if (seconds === null || seconds === undefined) return "—"
  const total = Math.round(seconds * 100) / 100
  const m = Math.floor(total / 60)
  const s = total - m * 60
  return `${m}:${s.toFixed(2).padStart(5, "0")}`
}

export function formatMediaDate(value?: string | null) {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

// ─── Pieces ───────────────────────────────────────────────────────────────────

const SECTION_TITLE = "font-semibold text-[18px] tracking-tight text-foreground/90"
const LABEL = "text-muted-foreground font-medium"
const VALUE = "min-w-0 font-medium text-foreground/80"
const GRID = "grid grid-cols-[130px_1fr] gap-x-3 gap-y-3.5 text-[17px]"
/** Blue is reserved for links and active states — never for plain metadata. */
const LINK = "text-link hover:text-link/80 font-medium hover:underline flex items-center gap-1.5 w-fit transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"

function Section({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("space-y-4 min-w-0", className)}>
      <h3 className={SECTION_TITLE}>{title}</h3>
      {children}
    </div>
  )
}

function CopyableId({ label, value }: { label: string; value: string | null }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="flex items-center justify-between gap-3 min-w-0">
      <span className="text-muted-foreground font-medium shrink-0 w-[90px]">{label}</span>
      <div className="flex items-center gap-2 min-w-0 bg-muted/20 rounded px-2.5 py-1 border border-border/50 max-w-full">
        <span className="font-mono text-muted-foreground truncate text-[14px]">{value || "—"}</span>
        {value && (
          <button
            type="button"
            aria-label={`Copy ${label}`}
            title={`Copy ${label}`}
            onClick={(e) => {
              e.stopPropagation()
              void navigator.clipboard?.writeText(value)
              setCopied(true)
              setTimeout(() => setCopied(false), 1500)
            }}
            className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground shrink-0 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {copied
              ? <IconCheck className="size-3.5 text-emerald-600 dark:text-emerald-400" />
              : <IconCopy className="size-3.5" />}
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Sheet ────────────────────────────────────────────────────────────────────

export interface MediaDetailSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** `null` renders the empty state — the sheet can open before metadata resolves. */
  file: MediaDetailFile | null
  /**
   * Ad-account labels this media is assigned to. `undefined` hides the section, which is
   * what Portal Vault wants: every row there is already scoped to one ad account.
   */
  assignedTo?: string[]
  /** Rendered under the header, e.g. a pending-load hint. */
  notice?: React.ReactNode
  /**
   * Overrides the resolver URL. Assets that never came from Portal (manual uploads) have
   * no `assetId`, so they pass their own `file_url`; `null` disables the button.
   * Omit for Portal media — the resolver, not the raw R2 URL, is the supported path.
   */
  viewMediaHref?: string | null
}

export function MediaDetailSheet({
  open, onOpenChange, file, assignedTo, notice, viewMediaHref,
}: MediaDetailSheetProps) {
  const href = viewMediaHref !== undefined
    ? viewMediaHref
    : (file?.assetId ? portalMediaHref(file) : null)
  const links: { label: string; href: string | null }[] = file ? [
    { label: "Product Detail Page (PDP)", href: file.pdpUrl },
    { label: "Sales Page", href: file.salesPageUrl },
    { label: "Landing Page", href: file.landingUrl },
    { label: "Checkout Funnel", href: file.checkoutFunnelUrl },
  ] : []
  const hasAnyLink = links.some(l => l.href)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md w-full overflow-y-auto p-0 flex flex-col gap-0 border-l border-border/40 shadow-xl bg-card">
        <SheetHeader className="px-6 py-5 border-b border-border/40 bg-muted/20 shrink-0">
          <SheetTitle className="text-base font-semibold">Media Details</SheetTitle>
          <SheetDescription className="text-xs">
            Metadata joined live from Creative Portal.
          </SheetDescription>
        </SheetHeader>

        {!file ? (
          // The notice renders here too: a surface that opens the sheet from something
          // other than a Portal row (Tracking opens it from a Meta ad) has to be able to
          // say *why* there is no metadata. Without this the empty state answered
          // "no metadata yet" to four different situations, one of which is "Portal is
          // fine, this ad was simply never launched from AdLauncher".
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {notice}
            <p className="text-sm text-muted-foreground">No metadata for this media yet.</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-6 space-y-8">
            {notice}

            {/* View media — deliberately here and not in a footer: it is the first thing
                a reader wants after opening a row, and a sticky footer put it below four
                scrolling sections. No <video>/<img> is mounted in this sheet: the
                resolver allows 120 GET/HEAD per IP per minute and the office shares one
                IP, so preview stays one explicit click. */}
            {href ? (
              <a
                href={href}
                target="_blank"
                rel="noreferrer"
                onClick={e => e.stopPropagation()}
                className="flex w-full items-center justify-center gap-2 h-10 bg-primary text-primary-foreground font-medium text-sm rounded-lg hover:bg-primary/90 active:bg-primary/95 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                View media <IconExternalLink className="size-4" />
              </a>
            ) : (
              <button
                type="button"
                disabled
                title="This asset has no viewable URL"
                className="flex w-full items-center justify-center gap-2 h-10 bg-muted text-muted-foreground font-medium text-sm rounded-lg border border-border cursor-not-allowed"
              >
                View media <IconExternalLink className="size-4" />
              </button>
            )}

            {/* File Info */}
            <Section title="File Information">
              <div className="rounded-lg border bg-muted/20 px-3 py-2 text-[17px] font-medium text-foreground/80 break-words leading-relaxed shadow-sm">
                {file.name}
              </div>
              <div className={GRID}>
                <span className={LABEL}>Type</span><span className={VALUE}>{file.mimeType || (file.mediaType === "image" ? "Image" : "Video")}</span>
                <span className={LABEL}>Size</span><span className={VALUE}>{formatMediaBytes(file.sizeBytes)}</span>
                <span className={LABEL}>Dimensions</span><span className={VALUE}>{file.width && file.height ? `${file.width}x${file.height}` : "—"}</span>
                <span className={LABEL}>Duration</span><span className={VALUE}>{formatMediaDuration(file.durationSeconds)}</span>
                <span className={LABEL}>Added</span><span className={VALUE}>{formatMediaDate(file.createdAt)}</span>
              </div>
              <div className="rounded-md border border-border/50 bg-muted/20 px-3 py-2 text-[14px] font-mono text-muted-foreground break-all leading-relaxed">
                {file.objectKey}
              </div>
            </Section>

            {/* Assigned To — Assets / Portal Media only. */}
            {assignedTo !== undefined && (
              <Section title="Assigned To">
                <div className="flex flex-wrap gap-1.5">
                  {assignedTo.length > 0 ? assignedTo.map(label => (
                    <span
                      key={label}
                      className="text-[13px] px-2 py-1 rounded-full font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200 shadow-sm dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800"
                    >
                      {label}
                    </span>
                  )) : (
                    <span className="text-[15px] text-muted-foreground">Not assigned to any ad account yet</span>
                  )}
                </div>
              </Section>
            )}

            {/* Brand & Product */}
            <Section title="Product & Context">
              <div className={cn(GRID, "p-3 rounded-lg border bg-muted/10 shadow-sm")}>
                <span className={LABEL}>Brand</span>
                <span className="font-medium min-w-0 break-words text-foreground/90">
                  {file.brandName || "—"}{" "}
                  {file.brandSlug ? <span className="text-muted-foreground font-normal text-[15px]">({file.brandSlug})</span> : ""}
                </span>
                <span className={LABEL}>Product</span><span className={cn(VALUE, "break-words leading-snug")}>{file.productName || "—"}</span>
                <span className={cn(LABEL, "flex items-center")}>Language</span>
                <span className="min-w-0 flex items-center">
                  {file.language
                    ? <span className="uppercase text-[13px] font-bold bg-muted text-foreground border border-border px-2 py-0.5 rounded shadow-sm">{file.language}</span>
                    : "—"}
                </span>
                <span className={LABEL}>Brief Type</span><span className={cn(VALUE, "break-words")}>{file.briefType || "—"}</span>
                <span className={LABEL}>Voice</span><span className={cn(VALUE, "break-words")}>{file.voiceVariant || "—"}</span>
              </div>
            </Section>

            {/* Links */}
            <Section title="Links">
              <div className="flex flex-col gap-3 text-[17px] p-3 rounded-lg border bg-muted/10 shadow-sm">
                {hasAnyLink ? links.map(({ label, href }) => href && (
                  <a key={label} href={href} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className={LINK}>
                    {label} <IconExternalLink className="size-4" />
                  </a>
                )) : (
                  <span className="text-muted-foreground italic">No links on this asset</span>
                )}
              </div>
            </Section>

            {/* Identifiers */}
            <Section title="Identifiers" className="pb-6">
              <div className="flex flex-col gap-3.5 p-3 rounded-lg border bg-muted/10 shadow-sm text-[16px]">
                <CopyableId label="Asset ID" value={file.assetId} />
                <CopyableId label="Brand ID" value={file.brandId} />
                <CopyableId label="Product ID" value={file.productId} />
              </div>
            </Section>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
