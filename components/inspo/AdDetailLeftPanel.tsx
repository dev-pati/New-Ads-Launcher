"use client"

import { useState } from "react"
import {
  IconCopy, IconCheck, IconDownload, IconSparkles,
  IconPhoto, IconChevronDown, IconChevronUp,
} from "@tabler/icons-react"
import type { DiscoveryAd, InspoBoard } from "@/types/inspo"
import { formatViews, formatSpend, timeAgo } from "@/lib/inspo-mock-data"
import { SaveToBoardButton } from "./SaveToBoardButton"

function SectionLabel({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-5 pt-4 pb-1.5">
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">{title}</p>
      {action}
    </div>
  )
}

function Divider() {
  return <div className="mx-5 border-t border-border/50 my-0.5" />
}

interface Props {
  ad: DiscoveryAd
  boards: InspoBoard[]
  savedBoardIds: Set<string>
  onSave: (boardId: string) => Promise<void>
  onUnsave: (boardId: string) => Promise<void>
  onCreateBoard: (name: string) => Promise<InspoBoard>
  onCloneWithAI: () => void
}

export function AdDetailLeftPanel({
  ad, boards, savedBoardIds, onSave, onUnsave, onCreateBoard, onCloneWithAI,
}: Props) {
  const [copied,       setCopied]       = useState(false)
  const [scriptCopied, setScriptCopied] = useState(false)
  const [jsonOpen,     setJsonOpen]     = useState(false)

  function copyAdCopy() {
    navigator.clipboard.writeText(ad.primaryText)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  function copyScript() {
    const text = [ad.headline, ad.primaryText].filter(Boolean).join("\n\n")
    navigator.clipboard.writeText(text)
    setScriptCopied(true)
    setTimeout(() => setScriptCopied(false), 1500)
  }

  function download() {
    const a = document.createElement("a")
    a.href = ad.mediaUrl
    a.download = `${ad.brandName.replace(/\s+/g, "_")}_ad`
    a.target = "_blank"
    a.click()
  }

  const details: { label: string; value: string }[] = [
    { label: "Format",   value: ad.format ?? "" },
    { label: "Platform", value: ad.platform ?? "" },
    { label: "Category", value: ad.category ?? "" },
    { label: "Language", value: ad.language ?? "" },
    { label: "Ad Angle", value: ad.angle ?? "" },
    { label: "Emotion",  value: ad.emotion ?? "" },
    { label: "Theme",    value: ad.theme ?? "" },
    { label: "USP",      value: ad.usp ?? "" },
    { label: "Desire",   value: ad.desire ?? "" },
    { label: "Since",    value: ad.firstSeenAt ? timeAgo(ad.firstSeenAt) : "" },
  ].filter(d => d.value)

  return (
    <div className="w-[280px] shrink-0 border-r border-border bg-background flex flex-col overflow-y-auto scrollbar-thin">

      {/* ── PERFORMANCE ── */}
      <SectionLabel title="Performance" />
      <div className="px-5 pb-2 space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Reach</span>
          <span className="text-sm font-semibold tabular-nums">
            {ad.views != null ? `${formatViews(ad.views)} views` : "—"}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Est. Spend</span>
          <span className="text-sm font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
            {ad.estimatedSpend != null ? formatSpend(ad.estimatedSpend) : "—"}
          </span>
        </div>
        {ad.runningDays != null && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Running</span>
            <span className="text-sm font-semibold">{ad.runningDays} days</span>
          </div>
        )}
      </div>

      <Divider />

      {/* ── AD COPY ── */}
      <SectionLabel
        title="Ad Copy"
        action={
          <button
            onClick={copyAdCopy}
            className="p-1 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            title="Copy ad copy"
          >
            {copied
              ? <IconCheck className="size-3.5 text-emerald-500" />
              : <IconCopy className="size-3.5" />
            }
          </button>
        }
      />
      <div className="px-5 pb-3">
        {ad.headline && (
          <p className="text-[13px] font-semibold text-foreground mb-2 leading-snug">{ad.headline}</p>
        )}
        <p className="text-[13px] text-foreground/80 leading-relaxed whitespace-pre-line">{ad.primaryText}</p>
        {ad.cta && (
          <div className="mt-3">
            <span className="inline-block text-[11px] font-semibold border border-border rounded-lg px-3 py-1 text-foreground/70 bg-muted/50 uppercase tracking-wide">
              {ad.cta}
            </span>
          </div>
        )}
      </div>

      {/* Debug JSON toggle */}
      <div className="px-5 pb-2">
        <button
          onClick={() => setJsonOpen(p => !p)}
          className="flex items-center gap-1 text-[10px] text-muted-foreground/50 hover:text-muted-foreground/80 transition-colors"
        >
          {jsonOpen ? <IconChevronUp className="size-3" /> : <IconChevronDown className="size-3" />}
          Debug JSON (Ad ID: {ad.id})
        </button>
        {jsonOpen && (
          <pre className="mt-1.5 text-[10px] bg-muted/60 rounded-lg px-3 py-2 overflow-x-auto text-muted-foreground leading-relaxed max-h-32">
            {JSON.stringify({ id: ad.id, platform: ad.platform, format: ad.format, tags: ad.tags }, null, 2)}
          </pre>
        )}
      </div>

      <Divider />

      {/* ── DETAILS ── */}
      <SectionLabel title="Details" />
      <div className="px-5 pb-3 space-y-2">
        {details.map(({ label, value }) => (
          <div key={label} className="flex items-center justify-between">
            <span className="text-[13px] text-muted-foreground">{label}</span>
            <span className="text-[13px] text-foreground capitalize font-medium">{value}</span>
          </div>
        ))}
      </div>

      <Divider />

      {/* ── GENERATE BRAND ── */}
      <SectionLabel title="Generate Brand" />
      <div className="px-5 pb-3">
        <button
          onClick={onCloneWithAI}
          className="flex items-center justify-center gap-2 w-full h-9 bg-primary text-primary-foreground text-sm font-medium rounded-xl hover:bg-primary/90 transition-colors"
        >
          <IconSparkles className="size-4" />
          Clone with AI for {ad.mediaType === "video" ? "videos" : "images"}
        </button>
      </div>

      <Divider />

      {/* ── ACTIONS ── */}
      <SectionLabel title="Actions" />
      <div className="px-5 pb-6 space-y-2">
        {/* Save to Board — full-width */}
        <SaveToBoardButton
          ad={ad}
          boards={boards}
          savedBoardIds={savedBoardIds}
          onSave={onSave}
          onUnsave={onUnsave}
          onCreateBoard={onCreateBoard}
          variant="block"
        />

        {/* Copy Script + Download */}
        <div className="flex gap-2">
          <button
            onClick={copyScript}
            className="flex-1 flex items-center justify-center gap-1.5 h-9 text-[13px] border border-border rounded-xl hover:bg-muted transition-colors text-foreground/80"
          >
            {scriptCopied
              ? <IconCheck className="size-3.5 text-emerald-500" />
              : <IconCopy className="size-3.5" />
            }
            {scriptCopied ? "Copied!" : "Copy Script"}
          </button>
          <button
            onClick={download}
            className="flex-1 flex items-center justify-center gap-1.5 h-9 text-[13px] border border-border rounded-xl hover:bg-muted transition-colors text-foreground/80"
          >
            <IconDownload className="size-3.5" />
            Download
          </button>
        </div>

        {/* Thumbnail */}
        <button className="flex items-center justify-center gap-1.5 w-full h-9 text-[13px] border border-border rounded-xl hover:bg-muted transition-colors text-foreground/80">
          <IconPhoto className="size-3.5" />
          Thumbnail
        </button>
      </div>
    </div>
  )
}
