export type MetaAssignmentPhase = "assigning" | "processing" | "ready" | "error"

export interface MetaAssignmentProgress {
  creativeId: string
  phase: MetaAssignmentPhase
  percent: number | null
  error?: string
}

export function normalizeMetaProcessingPercent(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 100) {
    return null
  }
  return Math.round(value)
}
