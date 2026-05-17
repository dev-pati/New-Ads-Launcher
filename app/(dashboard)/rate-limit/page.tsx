"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  IconRefresh, IconTrash, IconShieldCheck, IconAlertTriangle,
  IconCircleX, IconClock, IconActivity, IconServer,
  IconBuildingStore, IconDatabase, IconWifi, IconLoader2,
  IconChevronDown, IconChevronUp,
} from "@tabler/icons-react"

// ─── Types ────────────────────────────────────────────────────────────────────

interface RateLimitData {
  status: "ok" | "warning" | "blocked"
  apiCallSucceeded: boolean
  apiError: any
  appUsage: { call_count: number; total_cputime: number; total_time: number } | null
  businessUsage: any
  adAccountUsage: any
  snapshotAgeSeconds: number | null
  maxAppPct: number
  maxBizPct: number
  maxPct: number
  estimatedMinutesUntilOK: number | null
  cacheBlocked: boolean
  cacheBlockedSeconds: number
  tip: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getStatusColor(status: "ok" | "warning" | "blocked") {
  if (status === "ok")      return { bg: "bg-emerald-500/10", border: "border-emerald-500/30", text: "text-emerald-600 dark:text-emerald-400", dot: "bg-emerald-500" }
  if (status === "warning") return { bg: "bg-amber-500/10",   border: "border-amber-500/30",   text: "text-amber-600 dark:text-amber-400",   dot: "bg-amber-500"   }
  return                           { bg: "bg-red-500/10",     border: "border-red-500/30",     text: "text-red-600 dark:text-red-400",     dot: "bg-red-500"     }
}

function getBarColor(pct: number) {
  if (pct >= 90) return "bg-red-500"
  if (pct >= 75) return "bg-amber-500"
  if (pct >= 50) return "bg-yellow-400"
  return "bg-emerald-500"
}

function UsageBar({ label, value, max = 100 }: { label: string; value: number; max?: number }) {
  const pct = Math.min(100, Math.round((value / max) * 100))
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className={cn("font-mono font-semibold tabular-nums", pct >= 75 ? "text-amber-600 dark:text-amber-400" : pct >= 90 ? "text-red-600" : "text-foreground")}>
          {pct}%
        </span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all duration-700", getBarColor(pct))}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

function StatCard({ icon: Icon, label, value, sub, color = "text-foreground" }: {
  icon: React.ElementType; label: string; value: string; sub?: string; color?: string
}) {
  return (
    <div className="rounded-xl border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium">
        <Icon className="size-3.5" />
        {label}
      </div>
      <p className={cn("text-2xl font-bold tracking-tight", color)}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  )
}

function Countdown({ seconds }: { seconds: number }) {
  const [remaining, setRemaining] = useState(seconds)
  useEffect(() => {
    setRemaining(seconds)
    const id = setInterval(() => setRemaining(s => Math.max(0, s - 1)), 1000)
    return () => clearInterval(id)
  }, [seconds])
  const m = Math.floor(remaining / 60)
  const s = remaining % 60
  return <span className="font-mono font-bold tabular-nums">{m > 0 ? `${m}m ${s}s` : `${s}s`}</span>
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function RateLimitPage() {
  const [data, setData]           = useState<RateLimitData | null>(null)
  const [loading, setLoading]     = useState(false)
  const [clearing, setClearing]   = useState(false)
  const [lastChecked, setLastChecked] = useState<Date | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [history, setHistory]     = useState<{ time: Date; maxPct: number; status: string }[]>([])
  const [bizExpanded, setBizExpanded] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchStatus = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/facebook/rate-limit-status")
      const d   = await res.json()
      setData(d)
      setLastChecked(new Date())
      setHistory(prev => [
        { time: new Date(), maxPct: d.maxPct ?? 0, status: d.status },
        ...prev.slice(0, 19),
      ])
    } catch {
      // keep old data
    } finally {
      setLoading(false)
    }
  }, [])

  const clearCache = async () => {
    setClearing(true)
    try {
      await fetch("/api/facebook/rate-limit-status", { method: "POST" })
      await fetchStatus()
    } finally {
      setClearing(false)
    }
  }

  useEffect(() => { fetchStatus() }, [fetchStatus])

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (autoRefresh) timerRef.current = setInterval(fetchStatus, 30_000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [autoRefresh, fetchStatus])

  const sc = data ? getStatusColor(data.status) : getStatusColor("ok")

  const bizEntries: { bizId: string; type: string; callCount: number; cpu: number; time: number; waitMin: number }[] = []
  if (data?.businessUsage) {
    for (const [bizId, items] of Object.entries(data.businessUsage)) {
      if (!Array.isArray(items)) continue
      for (const item of items as any[]) {
        bizEntries.push({
          bizId,
          type: item.type || "—",
          callCount: item.call_count || 0,
          cpu: item.total_cputime || 0,
          time: item.total_time || 0,
          waitMin: item.estimated_time_to_regain_access || 0,
        })
      }
    }
  }

  return (
    <div className="flex flex-col h-full overflow-auto bg-background">
      {/* ── Header ── */}
      <div className="px-6 py-5 border-b shrink-0 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold tracking-tight">Meta API Rate Limit Monitor</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Theo dõi mức sử dụng API Meta để tránh bị rate limit
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {lastChecked && (
            <span className="text-xs text-muted-foreground tabular-nums hidden sm:block">
              Checked {lastChecked.toLocaleTimeString("vi-VN")}
            </span>
          )}
          <button
            onClick={() => setAutoRefresh(v => !v)}
            className={cn(
              "flex items-center gap-1.5 h-8 px-3 rounded-lg border text-xs transition-colors",
              autoRefresh ? "border-primary/40 bg-primary/10 text-primary" : "bg-background hover:bg-muted/50"
            )}
          >
            <IconActivity className="size-3.5" />
            Auto {autoRefresh ? "ON" : "OFF"}
          </button>
          <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={fetchStatus} disabled={loading}>
            <IconRefresh className={cn("size-3.5", loading && "animate-spin")} />
            Refresh
          </Button>
          {data?.cacheBlocked && (
            <Button size="sm" variant="destructive" className="h-8 gap-1.5" onClick={clearCache} disabled={clearing}>
              {clearing ? <IconLoader2 className="size-3.5 animate-spin" /> : <IconTrash className="size-3.5" />}
              Clear Cache
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 px-6 py-6 space-y-6 max-w-5xl mx-auto w-full">
        {loading && !data && (
          <div className="flex items-center justify-center h-48 gap-2 text-sm text-muted-foreground">
            <IconLoader2 className="size-4 animate-spin" /> Đang kiểm tra…
          </div>
        )}

        {data && (
          <>
            {/* ── Status Banner ── */}
            <div className={cn("rounded-2xl border p-5 flex items-center gap-4", sc.bg, sc.border)}>
              <div className={cn("size-12 rounded-xl flex items-center justify-center shrink-0", sc.bg, sc.border, "border")}>
                {data.status === "ok"      && <IconShieldCheck className={cn("size-6", sc.text)} />}
                {data.status === "warning" && <IconAlertTriangle className={cn("size-6", sc.text)} />}
                {data.status === "blocked" && <IconCircleX className={cn("size-6", sc.text)} />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={cn("font-bold text-base", sc.text)}>
                    {data.status === "ok"      && "Hệ thống bình thường"}
                    {data.status === "warning" && "Cảnh báo — gần đến giới hạn"}
                    {data.status === "blocked" && "Đang bị rate limit"}
                  </span>
                  <span className={cn("size-2 rounded-full animate-pulse", sc.dot)} />
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">{data.tip}</p>
              </div>
              {data.estimatedMinutesUntilOK && (
                <div className="text-right shrink-0">
                  <p className="text-xs text-muted-foreground mb-0.5">Chờ thêm</p>
                  <p className={cn("text-2xl font-bold tabular-nums", sc.text)}>
                    ~{data.estimatedMinutesUntilOK} phút
                  </p>
                </div>
              )}
            </div>

            {/* ── Summary Stats ── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard
                icon={IconActivity}
                label="App Usage (max)"
                value={`${data.maxAppPct}%`}
                sub="call count / cpu / time"
                color={data.maxAppPct >= 90 ? "text-red-600" : data.maxAppPct >= 75 ? "text-amber-600" : "text-emerald-600"}
              />
              <StatCard
                icon={IconBuildingStore}
                label="Ads Mgmt Usage"
                value={`${data.maxBizPct}%`}
                sub="business-level quota"
                color={data.maxBizPct >= 90 ? "text-red-600" : data.maxBizPct >= 75 ? "text-amber-600" : "text-emerald-600"}
              />
              <StatCard
                icon={IconDatabase}
                label="Cache"
                value={data.cacheBlocked ? "Blocked" : "OK"}
                sub={data.cacheBlocked ? `Còn ${data.cacheBlockedSeconds}s` : "Sẵn sàng"}
                color={data.cacheBlocked ? "text-amber-600" : "text-emerald-600"}
              />
              <StatCard
                icon={IconWifi}
                label="API Call"
                value={data.apiCallSucceeded ? "Thành công" : "Lỗi"}
                sub={data.apiError ? `Code ${data.apiError.code}` : "GET /me OK"}
                color={data.apiCallSucceeded ? "text-emerald-600" : "text-red-600"}
              />
            </div>

            {/* ── Gauge Cards ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* App-level */}
              <div className="rounded-xl border bg-card p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <div className="size-7 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                    <IconServer className="size-3.5 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">App-Level Usage</p>
                    <p className="text-[10px] text-muted-foreground">X-App-Usage header</p>
                  </div>
                </div>
                {data.appUsage ? (
                  <div className="space-y-3">
                    <UsageBar label="API Call Count"  value={data.appUsage.call_count}    />
                    <UsageBar label="CPU Time"        value={data.appUsage.total_cputime} />
                    <UsageBar label="Total Time"      value={data.appUsage.total_time}    />
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic">Không có dữ liệu</p>
                )}
                <div className="pt-1 border-t">
                  <p className="text-[10px] text-muted-foreground">
                    Giới hạn: 200 calls/giờ mỗi app token. Khi đạt 100% → error code 4.
                  </p>
                </div>
              </div>

              {/* Business / ADS_MANAGEMENT */}
              <div className="rounded-xl border bg-card p-5 space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="size-7 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
                      <IconBuildingStore className="size-3.5 text-violet-500" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">Ads Management Usage</p>
                      <p className="text-[10px] text-muted-foreground">X-Business-Use-Case-Usage (ADS_MANAGEMENT)</p>
                    </div>
                  </div>
                  {data.snapshotAgeSeconds !== null && data.businessUsage && (
                    <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
                      last known{" "}
                      {data.snapshotAgeSeconds < 60
                        ? `${data.snapshotAgeSeconds}s ago`
                        : `${Math.round(data.snapshotAgeSeconds / 60)}m ago`}
                    </span>
                  )}
                </div>
                {bizEntries.filter(e => e.type === "ADS_MANAGEMENT").length > 0 ? (
                  <div className="space-y-3">
                    {bizEntries.filter(e => e.type === "ADS_MANAGEMENT").slice(0, 1).map((e, i) => (
                      <div key={i} className="space-y-3">
                        <UsageBar label="API Call Count" value={e.callCount} />
                        <UsageBar label="CPU Time"       value={e.cpu}       />
                        <UsageBar label="Total Time"     value={e.time}      />
                        {e.waitMin > 0 && (
                          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-red-500/10 border border-red-500/20">
                            <IconClock className="size-3.5 text-red-500 shrink-0" />
                            <p className="text-xs text-red-600 dark:text-red-400 font-medium">
                              Chờ ~{e.waitMin} phút để regain access
                            </p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground italic">Chưa có dữ liệu</p>
                    <p className="text-[10px] text-muted-foreground/70 leading-relaxed">
                      Header này chỉ trả về khi gọi ad-account API (getAdAccounts, launch…).
                      Dữ liệu sẽ xuất hiện sau lần load đầu tiên.
                    </p>
                  </div>
                )}
                <div className="pt-1 border-t">
                  <p className="text-[10px] text-muted-foreground">
                    Khi đạt 100% → "too many calls to this ad-account". Đây là lý do tại sao có thể bị block dù App Usage chỉ 4%.
                  </p>
                </div>
              </div>
            </div>

            {/* ── Cache Status ── */}
            {data.cacheBlocked && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-5 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="size-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
                    <IconDatabase className="size-4 text-amber-500" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">Server Cache đang block</p>
                    <p className="text-xs text-muted-foreground">
                      App không gọi Meta API cho đến khi hết backoff. Tự clear sau{" "}
                      <Countdown seconds={data.cacheBlockedSeconds} />.
                    </p>
                  </div>
                </div>
                <Button size="sm" variant="outline" className="h-8 gap-1.5 border-amber-500/30 shrink-0" onClick={clearCache} disabled={clearing}>
                  {clearing ? <IconLoader2 className="size-3.5 animate-spin" /> : <IconTrash className="size-3.5" />}
                  Clear ngay
                </Button>
              </div>
            )}

            {/* ── Business Usage Detail ── */}
            {bizEntries.length > 0 && (
              <div className="rounded-xl border bg-card overflow-hidden">
                <button
                  className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-muted/30 transition-colors"
                  onClick={() => setBizExpanded(v => !v)}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">Business Usage — Chi tiết</span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-muted text-muted-foreground">{bizEntries.length} entries</span>
                  </div>
                  {bizExpanded ? <IconChevronUp className="size-4 text-muted-foreground" /> : <IconChevronDown className="size-4 text-muted-foreground" />}
                </button>
                {bizExpanded && (
                  <div className="border-t divide-y">
                    {bizEntries.map((e, i) => (
                      <div key={i} className="px-5 py-3 flex items-center gap-4 flex-wrap text-sm">
                        <code className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">{e.bizId}</code>
                        <span className="font-medium text-xs">{e.type}</span>
                        <div className="flex items-center gap-3 ml-auto text-xs text-muted-foreground">
                          <span>Calls: <b className="text-foreground">{e.callCount}%</b></span>
                          <span>CPU: <b className="text-foreground">{e.cpu}%</b></span>
                          <span>Time: <b className="text-foreground">{e.time}%</b></span>
                          {e.waitMin > 0 && (
                            <span className="text-red-600 font-semibold">Wait {e.waitMin}m</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── History ── */}
            {history.length > 0 && (
              <div className="rounded-xl border bg-card p-5 space-y-3">
                <p className="text-sm font-semibold">Lịch sử kiểm tra (phiên này)</p>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {history.map((h, i) => {
                    const c = getStatusColor(h.status as any)
                    return (
                      <div key={i} className="flex items-center gap-3 text-xs">
                        <span className="text-muted-foreground tabular-nums w-20 shrink-0">
                          {h.time.toLocaleTimeString("vi-VN")}
                        </span>
                        <span className={cn("size-2 rounded-full shrink-0", c.dot)} />
                        <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className={cn("h-full rounded-full", getBarColor(h.maxPct))}
                            style={{ width: `${Math.max(2, h.maxPct)}%` }}
                          />
                        </div>
                        <span className={cn("font-mono font-semibold w-8 text-right", c.text)}>{h.maxPct}%</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* ── Error Detail ── */}
            {data.apiError && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-5 space-y-2">
                <p className="text-sm font-semibold text-red-700 dark:text-red-400 flex items-center gap-2">
                  <IconCircleX className="size-4" /> API Error
                </p>
                <pre className="text-xs text-red-600 dark:text-red-400 font-mono whitespace-pre-wrap break-all">
                  {JSON.stringify(data.apiError, null, 2)}
                </pre>
              </div>
            )}

            {/* ── Legend ── */}
            <div className="rounded-xl border bg-muted/30 p-5 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Giải thích</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-muted-foreground">
                <div><span className="font-semibold text-emerald-600">0–74%</span> — Bình thường, có thể dùng thoải mái</div>
                <div><span className="font-semibold text-amber-600">75–89%</span> — Cảnh báo, hạn chế gọi API nặng</div>
                <div><span className="font-semibold text-red-600">90–100%</span> — Nguy hiểm, sắp hoặc đang bị block</div>
                <div><span className="font-semibold">App-level</span>: error code 4 — "Application request limit"</div>
                <div><span className="font-semibold">Ads Mgmt</span>: lỗi "too many calls to this ad-account"</div>
                <div><span className="font-semibold">Cache block</span>: server không gọi Meta, dùng stale data</div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
