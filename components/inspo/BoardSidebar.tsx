"use client"

import { useState } from "react"
import {
  IconCompass, IconSparkles, IconPencil, IconBinoculars,
  IconBookmark, IconPlus, IconFolder, IconLoader2, IconChevronDown,
} from "@tabler/icons-react"
import { cn } from "@/lib/utils"
import type { InspoBoard } from "@/types/inspo"

export type InspoSection = "discovery" | "ai" | "create" | "brand-spy" | "saved"

const NAV_ITEMS: { id: InspoSection; label: string; icon: React.ElementType }[] = [
  { id: "discovery",  label: "Discovery",  icon: IconCompass },
  { id: "ai",         label: "AI",         icon: IconSparkles },
  { id: "create",     label: "Create",     icon: IconPencil },
  { id: "brand-spy",  label: "Brand Spy",  icon: IconBinoculars },
  { id: "saved",      label: "Saved Ads",  icon: IconBookmark },
]

interface Props {
  activeSection: InspoSection
  onSectionChange: (s: InspoSection) => void
  activeBoardId: string | null
  onBoardSelect: (id: string | null) => void
  boards: InspoBoard[]
  boardsLoading: boolean
  onCreateBoard: (name: string) => Promise<InspoBoard>
}

export function BoardSidebar({
  activeSection, onSectionChange,
  activeBoardId, onBoardSelect,
  boards, boardsLoading, onCreateBoard,
}: Props) {
  const [creatingBoard, setCreatingBoard]   = useState(false)
  const [newBoardName,  setNewBoardName]    = useState("")
  const [saving,        setSaving]          = useState(false)
  const [boardsOpen,    setBoardsOpen]      = useState(true)

  async function handleCreate() {
    if (!newBoardName.trim()) return
    setSaving(true)
    try {
      const board = await onCreateBoard(newBoardName.trim())
      setCreatingBoard(false)
      setNewBoardName("")
      onBoardSelect(board.id)
    } finally {
      setSaving(false)
    }
  }

  return (
    <aside className="w-52 shrink-0 border-r border-border bg-background flex flex-col h-full overflow-y-auto">
      {/* Nav items */}
      <nav className="pt-3 pb-1">
        {NAV_ITEMS.map(item => {
          const Icon = item.icon
          const active = activeSection === item.id
          return (
            <button
              key={item.id}
              onClick={() => { onSectionChange(item.id); if (item.id !== "discovery") onBoardSelect(null) }}
              className={cn(
                "flex items-center gap-2.5 w-full px-3 py-2 text-sm rounded-lg mx-1 transition-colors",
                active
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              <Icon className="size-4 shrink-0" />
              {item.label}
            </button>
          )
        })}
      </nav>

      {/* Boards section */}
      <div className="mt-2 px-1">
        <button
          onClick={() => setBoardsOpen(p => !p)}
          className="flex items-center justify-between w-full px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
        >
          <span>Boards</span>
          <div className="flex items-center gap-1">
            <span
              onClick={e => { e.stopPropagation(); setCreatingBoard(true); setBoardsOpen(true) }}
              className="p-0.5 rounded hover:bg-muted hover:text-foreground transition-colors"
              title="New board"
            >
              <IconPlus className="size-3.5" />
            </span>
            <IconChevronDown className={cn("size-3.5 transition-transform", boardsOpen && "rotate-180")} />
          </div>
        </button>

        {boardsOpen && (
          <div className="space-y-0.5">
            {boardsLoading && (
              <div className="flex items-center gap-2 px-2 py-1.5 text-sm text-muted-foreground">
                <IconLoader2 className="size-3.5 animate-spin" />
                Loading...
              </div>
            )}

            {!boardsLoading && boards.map(board => (
              <button
                key={board.id}
                onClick={() => { onBoardSelect(board.id); onSectionChange("discovery") }}
                className={cn(
                  "flex items-center gap-2 w-full px-2 py-1.5 text-sm rounded-lg transition-colors text-left",
                  activeBoardId === board.id
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                <IconFolder className="size-3.5 shrink-0" />
                <span className="truncate flex-1">{board.name}</span>
                <span className="text-[10px] ml-auto shrink-0">{board.ad_count || 0}</span>
              </button>
            ))}

            {!boardsLoading && boards.length === 0 && !creatingBoard && (
              <p className="px-2 py-1 text-xs text-muted-foreground">No boards yet</p>
            )}

            {creatingBoard && (
              <div className="px-1 py-1 flex gap-1">
                <input
                  autoFocus
                  value={newBoardName}
                  onChange={e => setNewBoardName(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") handleCreate(); if (e.key === "Escape") { setCreatingBoard(false); setNewBoardName("") } }}
                  placeholder="Board name..."
                  className="flex-1 h-7 px-2 text-xs border rounded-lg focus:outline-none focus:ring-1 focus:ring-ring bg-background"
                />
                <button
                  onClick={handleCreate}
                  disabled={!newBoardName.trim() || saving}
                  className="h-7 px-2 text-xs bg-primary text-primary-foreground rounded-lg disabled:opacity-50"
                >
                  {saving ? <IconLoader2 className="size-3 animate-spin" /> : "Add"}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  )
}
