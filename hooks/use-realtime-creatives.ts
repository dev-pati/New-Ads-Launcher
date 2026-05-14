"use client"

import { useRef } from "react"

interface UseRealtimeCreativesOptions {
  orgId: string
  onInsert: (record: any) => void
  onUpdate: (record: any) => void
  onDelete: (oldRecord: any) => void
}

export function useRealtimeCreatives(_options: UseRealtimeCreativesOptions) {
  return useRef(null)
}
