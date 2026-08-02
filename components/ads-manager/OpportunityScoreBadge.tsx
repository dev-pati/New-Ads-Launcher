"use client"

import { useEffect, useState } from "react"
import { IconAlertCircle } from "@tabler/icons-react"

import { cn } from "@/lib/utils"

type ScoreState =
  | { accountId: string; status: "loading" }
  | { accountId: string; status: "available"; score: number; weight: number | null }
  | { accountId: string; status: "unsupported" }
  | { accountId: string; status: "error" }

interface OpportunityScoreResponse {
  available?: boolean
  score?: number | null
  weight?: number | null
  error?: string
}

interface OpportunityScoreBadgeProps {
  adAccountId: string
  className?: string
}

export function OpportunityScoreBadge({
  adAccountId,
  className,
}: OpportunityScoreBadgeProps) {
  const [state, setState] = useState<ScoreState>({ accountId: adAccountId, status: "loading" })

  useEffect(() => {
    if (!adAccountId) return

    const controller = new AbortController()

    const params = new URLSearchParams({ ad_account_id: adAccountId })

    fetch(`/api/facebook/opportunity-score?${params}`, { signal: controller.signal })
      .then(async response => {
        const payload = (await response.json()) as OpportunityScoreResponse
        if (!response.ok) throw new Error(payload.error || "Failed to load Opportunity Score")

        if (!payload.available || typeof payload.score !== "number") {
          setState({ accountId: adAccountId, status: "unsupported" })
          return
        }

        setState({
          accountId: adAccountId,
          status: "available",
          score: payload.score,
          weight: typeof payload.weight === "number" ? payload.weight : null,
        })
      })
      .catch(error => {
        if (error instanceof DOMException && error.name === "AbortError") return
        setState({ accountId: adAccountId, status: "error" })
      })

    return () => controller.abort()
  }, [adAccountId])

  if (!adAccountId) return null

  if (state.accountId !== adAccountId || state.status === "loading") {
    return (
      <div
        className={cn("flex h-8 items-center gap-2 rounded-md bg-muted/60 px-2.5", className)}
        role="status"
        aria-label="Loading Opportunity Score"
      >
        <span className="size-5 animate-pulse rounded-full border-2 border-muted-foreground/20" />
        <span className="h-3 w-24 animate-pulse rounded bg-muted-foreground/15" />
      </div>
    )
  }

  if (state.status === "unsupported") return null

  if (state.status === "error") {
    return (
      <div
        className={cn("flex h-8 items-center gap-1.5 rounded-md bg-muted/50 px-2.5 text-xs text-muted-foreground", className)}
        title="Opportunity Score could not be loaded. The rest of Ads Manager is still available."
      >
        <IconAlertCircle className="size-4" />
        <span>Opportunity score unavailable</span>
      </div>
    )
  }

  const circumference = 2 * Math.PI * 14
  const dashOffset = circumference * (1 - state.score / 100)

  return (
    <div
      className={cn("flex h-8 items-center gap-2 rounded-md bg-muted/60 px-2.5", className)}
      title={state.weight === null
        ? `Meta Opportunity Score: ${state.score}`
        : `Meta Opportunity Score: ${state.score} · Weight: ${state.weight}`}
      aria-label={`Opportunity score ${state.score} out of 100`}
    >
      <span className="relative flex size-7 shrink-0 items-center justify-center">
        <svg className="size-7 -rotate-90" viewBox="0 0 32 32" aria-hidden="true">
          <circle cx="16" cy="16" r="14" fill="none" className="stroke-muted-foreground/20" strokeWidth="3" />
          <circle
            cx="16"
            cy="16"
            r="14"
            fill="none"
            stroke="#1877f2"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
          />
        </svg>
        <span className="absolute text-[9px] font-bold tabular-nums text-foreground">{state.score}</span>
      </span>
      <span className="whitespace-nowrap text-xs font-medium text-foreground">Opportunity score</span>
    </div>
  )
}
