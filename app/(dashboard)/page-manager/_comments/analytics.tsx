"use client"

import type { ReactNode } from "react"
import { useState } from "react"
import {
  Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts"
import { IconChartBar, IconLoader2, IconMessage, IconRefresh, IconThumbUp } from "@tabler/icons-react"
import { cn } from "@/lib/utils"
import type { CommentsData } from "./use-comments"

function AnalyticsKpi({ label, value, icon, trend, sub, isScore }: {
  label: string; value: number; icon: ReactNode; trend?: number; sub?: string; isScore?: boolean
}) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="mb-2 flex items-start justify-between">
        <p className="text-xs text-muted-foreground">{label}</p>
        <span className="text-muted-foreground/40">{icon}</span>
      </div>
      <p className="text-2xl font-bold">{isScore ? value.toFixed(2) : value.toLocaleString()}</p>
      {trend !== undefined ? (
        <p className={cn("mt-0.5 flex items-center gap-1 text-xs", trend >= 0 ? "text-emerald-500" : "text-rose-500")}>
          {trend >= 0 ? "↑" : "↓"} {Math.abs(trend).toFixed(1)}% vs previous period
        </p>
      ) : null}
      {sub ? <p className="mt-0.5 text-xs text-muted-foreground/60">{sub}</p> : null}
    </div>
  )
}

export function CommentAnalyticsSection({ commentsData }: { commentsData: CommentsData }) {
  const { commentsAnalytics, commentsAnalyticsLoading, loadComments } = commentsData
  const [refreshing, setRefreshing] = useState(false)

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await loadComments(true)
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Last 30 days</span>
        <button
          onClick={() => void handleRefresh()}
          className="flex h-8 w-8 items-center justify-center rounded-lg border transition-colors hover:bg-muted/50"
        >
          {refreshing ? <IconLoader2 className="size-3.5 animate-spin" /> : <IconRefresh className="size-3.5" />}
        </button>
      </div>

      {commentsAnalyticsLoading ? (
        <div className="flex justify-center py-20">
          <IconLoader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : !commentsAnalytics ? (
        <div className="flex flex-col items-center justify-center gap-3 py-20">
          <IconMessage className="size-10 text-muted-foreground/20" />
          <p className="text-sm text-muted-foreground">Sync comments first to see analytics.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <AnalyticsKpi label="Total Comments" value={commentsAnalytics.total || 0} icon={<IconMessage className="size-4" />} trend={commentsAnalytics.trend?.total} />
            <AnalyticsKpi label="Avg. Sentiment" value={commentsAnalytics.avgSentiment || 0} icon={<IconThumbUp className="size-4" />} trend={commentsAnalytics.trend?.sentiment} isScore />
            <AnalyticsKpi label="Positive Comments" value={commentsAnalytics.positive || 0} icon={<IconChartBar className="size-4" />} sub={`${commentsAnalytics.total > 0 ? ((commentsAnalytics.positive / commentsAnalytics.total) * 100).toFixed(0) : 0}% of total`} />
            <AnalyticsKpi label="Total Reactions" value={commentsAnalytics.totalReactions || 0} icon={<IconThumbUp className="size-4" />} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border bg-card p-4">
              <h3 className="mb-3 text-sm font-semibold">Sentiment Trend</h3>
              {commentsAnalytics.trend_data?.length ? (
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={commentsAnalytics.trend_data}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                    <XAxis dataKey="label" tick={{ fontSize: 9 }} />
                    <YAxis tick={{ fontSize: 9 }} domain={[0, 100]} />
                    <Tooltip contentStyle={{ fontSize: 11, borderRadius: 6 }} formatter={(v) => [Number(v).toFixed(1), "Score"]} />
                    <Line type="monotone" dataKey="score" name="Score" stroke="#3b82f6" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">No data yet</div>
              )}
            </div>

            <div className="rounded-xl border bg-card p-4">
              <h3 className="mb-3 text-sm font-semibold">Comment Volume</h3>
              {commentsAnalytics.volume_data?.length ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={commentsAnalytics.volume_data}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                    <XAxis dataKey="label" tick={{ fontSize: 9 }} />
                    <YAxis tick={{ fontSize: 9 }} />
                    <Tooltip contentStyle={{ fontSize: 11, borderRadius: 6 }} />
                    <Bar dataKey="count" name="Comments" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">No data yet</div>
              )}
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border bg-card p-4">
              <h3 className="mb-4 text-sm font-semibold">Sentiment Distribution</h3>
              <div className="flex items-end justify-around">
                {[
                  { label: "Positive", value: commentsAnalytics.positive || 0, color: "#10b981" },
                  { label: "Neutral", value: commentsAnalytics.neutral || 0, color: "#94a3b8" },
                  { label: "Negative", value: commentsAnalytics.negative || 0, color: "#ef4444" },
                ].map(s => (
                  <div key={s.label} className="flex flex-col items-center gap-2">
                    <span className="text-2xl font-bold">{s.value}</span>
                    <div className="flex items-center gap-1.5">
                      <span className="size-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                      <span className="text-xs text-muted-foreground">{s.label}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border bg-card p-4">
              <h3 className="mb-3 text-sm font-semibold">Top Themes</h3>
              {commentsAnalytics.themes?.length ? (
                <div className="flex flex-wrap gap-2">
                  {commentsAnalytics.themes.slice(0, 12).map(t => (
                    <span key={t.theme} className="flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs text-primary">
                      {t.theme}
                      {t.count > 1 ? <span className="text-xs opacity-60">×{t.count}</span> : null}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No themes yet. Sync comments first.</p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
