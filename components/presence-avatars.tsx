"use client"

import type { PresenceUser } from "@/hooks/use-presence"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

interface PresenceAvatarsProps {
  users: PresenceUser[]
}

export function PresenceAvatars({ users }: PresenceAvatarsProps) {
  if (users.length === 0) return null

  return (
    <div className="flex items-center gap-1">
      {users.map((u) => (
        <Avatar
          key={u.userId}
          size="sm"
          title={`${u.userName}${u.editingCell ? ` (editing)` : ""}`}
        >
          <AvatarFallback
            className="text-white font-medium"
            style={{ backgroundColor: u.color }}
          >
            {u.userName.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
      ))}
      <span className="ml-1 text-xs text-muted-foreground">
        {users.length} online
      </span>
    </div>
  )
}
