"use client"

import type { PresenceUser } from "@/hooks/use-presence"

interface PresenceAvatarsProps {
  users: PresenceUser[]
}

export function PresenceAvatars({ users }: PresenceAvatarsProps) {
  if (users.length === 0) return null

  return (
    <div className="flex items-center gap-1">
      {users.map((u) => (
        <div
          key={u.userId}
          className="flex size-7 items-center justify-center rounded-full text-xs font-medium text-white"
          style={{ backgroundColor: u.color }}
          title={`${u.userName}${u.editingCell ? ` (editing)` : ""}`}
        >
          {u.userName.charAt(0).toUpperCase()}
        </div>
      ))}
      <span className="ml-1 text-xs text-muted-foreground">
        {users.length} online
      </span>
    </div>
  )
}
