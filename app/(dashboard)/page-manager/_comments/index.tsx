"use client"

import { useCallback, useMemo } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { IconBolt, IconChartBar, IconHistory, IconLayoutList } from "@tabler/icons-react"
import { cn } from "@/lib/utils"
import type { CommentsData } from "./use-comments"
import { CommentQueueSection } from "./queue"
import { CommentAutomationSection } from "./automation"
import { CommentAnalyticsSection } from "./analytics"
import { CommentHistorySection } from "./history"

type CommentSection = "queue" | "analytics" | "automation" | "history"

const SECTIONS: Array<{ id: CommentSection; label: string; icon: typeof IconLayoutList }> = [
  { id: "queue", label: "Queue", icon: IconLayoutList },
  { id: "analytics", label: "Analytics", icon: IconChartBar },
  { id: "automation", label: "Automation", icon: IconBolt },
  { id: "history", label: "History", icon: IconHistory },
]

type CommentOperationsProps = {
  selectedPage: { id: string; name?: string | null } | null
  competitorKeywords: string[]
  commentsData: CommentsData
}

/**
 * Insights' 4-section shell (queue/analytics/automation/history) over Page Manager's
 * 26-field comment model. Section state lives in `?section=`, local to this module —
 * not a reusable hook, page-manager/page.tsx never reads it.
 */
export function CommentOperations({ selectedPage, competitorKeywords, commentsData }: CommentOperationsProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const section = useMemo<CommentSection>(() => {
    const raw = searchParams.get("section")
    return raw === "analytics" || raw === "automation" || raw === "history" ? raw : "queue"
  }, [searchParams])

  const setSection = useCallback((next: CommentSection) => {
    const params = new URLSearchParams(searchParams.toString())
    if (next === "queue") params.delete("section")
    else params.set("section", next)
    const qs = params.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }, [pathname, router, searchParams])

  const { commentsError } = commentsData

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-1 rounded-2xl border bg-card p-1">
        {SECTIONS.map(item => (
          <button
            key={item.id}
            onClick={() => setSection(item.id)}
            className={cn(
              "flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm transition-colors",
              section === item.id
                ? "bg-primary/10 font-medium text-primary"
                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
            )}
          >
            <item.icon className="size-3.5" />
            {item.label}
          </button>
        ))}
      </div>

      {commentsError ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/70 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
          {commentsError}
        </div>
      ) : null}

      {section === "queue" ? (
        <CommentQueueSection selectedPage={selectedPage} competitorKeywords={competitorKeywords} commentsData={commentsData} />
      ) : section === "analytics" ? (
        <CommentAnalyticsSection commentsData={commentsData} />
      ) : section === "automation" ? (
        <CommentAutomationSection commentsData={commentsData} />
      ) : (
        <CommentHistorySection />
      )}
    </div>
  )
}
