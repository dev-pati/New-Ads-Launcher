"use client"

import { useCallback } from "react"

export interface PresenceUser {
  userId: string
  userName: string
  color: string
  editingCell: { rowId: string; colField: string } | null
}

interface UsePresenceOptions {
  orgId: string
  userId: string
  userName: string
}

export function useCreativesPresence(_options: UsePresenceOptions) {
  const updateMyCell = useCallback((_rowId: string, _colField: string) => {}, [])
  const clearMyCell = useCallback(() => {}, [])
  return { others: [] as PresenceUser[], updateMyCell, clearMyCell }
}
