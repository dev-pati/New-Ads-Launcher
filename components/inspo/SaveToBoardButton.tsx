"use client"

import { useState, useRef, useEffect } from "react"
import { IconBookmark, IconBookmarkFilled, IconLoader2, IconPlus, IconCheck } from "@tabler/icons-react"
import { cn } from "@/lib/utils"
import type { InspoBoard, DiscoveryAd } from "@/types/inspo"

interface Props {
  ad: DiscoveryAd
  boards: InspoBoard[]
  savedBoardIds: Set<string>
  onSave: (boardId: string) => Promise<void>
  onUnsave: (boardId: string) => Promise<void>
  onCreateBoard: (name: string) => Promise<InspoBoard>
  size?: "sm" | "md"
  overlayMode?: boolean
}

export function SaveToBoardButton({
  ad, boards, savedBoardIds, onSave, onUnsave, onCreateBoard, size = "md", overlayMode = false,
}: Props) {
  const [open, setOpen]             = useState(false)
  const [loading, setLoading]       = useState<string | null>(null)
  const [creating, setCreating]     = useState(false)
  const [newName, setNewName]       = useState("")
  const [creating2, setCreating2]   = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const isSaved = savedBoardIds.size > 0

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false); setCreating(false); setNewName("")
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  useEffect(() => {
    if (creating && inputRef.current) inputRef.current.focus()
  }, [creating])

  async function toggle(boardId: string) {
    setLoading(boardId)
    try {
      if (savedBoardIds.has(boardId)) await onUnsave(boardId)
      else await onSave(boardId)
    } finally {
      setLoading(null)
    }
  }

  async function handleCreate() {
    if (!newName.trim()) return
    setCreating2(true)
    try {
      const board = await onCreateBoard(newName.trim())
      await onSave(board.id)
      setCreating(false)
      setNewName("")
    } finally {
      setCreating2(false)
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={e => { e.stopPropagation(); setOpen(p => !p) }}
        className={cn(
          "flex items-center justify-center rounded-lg transition-colors",
          size === "sm" ? "size-7" : "size-8",
          overlayMode
            ? isSaved
              ? "bg-primary text-white shadow border-0 hover:bg-primary/90"
              : "bg-white/90 backdrop-blur-sm text-neutral-700 shadow border-0 hover:bg-white hover:text-neutral-900"
            : isSaved
              ? "border bg-primary/10 border-primary/30 text-primary hover:bg-primary/20"
              : "border bg-background border-border text-muted-foreground hover:text-foreground hover:bg-muted"
        )}
        title={isSaved ? "Saved" : "Save to board"}
      >
        {isSaved
          ? <IconBookmarkFilled className={size === "sm" ? "size-3.5" : "size-4"} />
          : <IconBookmark className={size === "sm" ? "size-3.5" : "size-4"} />
        }
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 bg-popover border rounded-xl shadow-lg w-52 py-1.5">
          <p className="px-3 py-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
            Save to board
          </p>

          {boards.length === 0 && !creating && (
            <p className="px-3 py-2 text-sm text-muted-foreground">No boards yet</p>
          )}

          {boards.map(board => {
            const saved = savedBoardIds.has(board.id)
            const isLoading = loading === board.id
            return (
              <button
                key={board.id}
                onClick={() => toggle(board.id)}
                disabled={!!loading}
                className="flex items-center gap-2 w-full px-3 py-1.5 text-sm hover:bg-muted text-left disabled:opacity-50"
              >
                {isLoading
                  ? <IconLoader2 className="size-4 animate-spin shrink-0" />
                  : saved
                  ? <IconCheck className="size-4 text-primary shrink-0" />
                  : <span className="size-4 rounded border border-border shrink-0" />
                }
                <span className="truncate">{board.name}</span>
                <span className="ml-auto text-xs text-muted-foreground">{board.ad_count || 0}</span>
              </button>
            )
          })}

          {creating ? (
            <div className="px-2 pt-1 pb-1.5 flex gap-1">
              <input
                ref={inputRef}
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") handleCreate(); if (e.key === "Escape") { setCreating(false); setNewName("") } }}
                placeholder="Board name..."
                className="flex-1 h-7 px-2 text-sm border rounded-lg focus:outline-none focus:ring-1 focus:ring-ring bg-background"
              />
              <button
                onClick={handleCreate}
                disabled={!newName.trim() || creating2}
                className="h-7 px-2 text-sm bg-primary text-primary-foreground rounded-lg disabled:opacity-50"
              >
                {creating2 ? <IconLoader2 className="size-3.5 animate-spin" /> : "Add"}
              </button>
            </div>
          ) : (
            <button
              onClick={() => setCreating(true)}
              className="flex items-center gap-2 w-full px-3 py-1.5 text-sm hover:bg-muted text-muted-foreground"
            >
              <IconPlus className="size-4" />
              New board
            </button>
          )}
        </div>
      )}
    </div>
  )
}
