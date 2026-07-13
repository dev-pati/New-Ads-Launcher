"use client"

import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts"
import { formatViews, formatSpend } from "@/lib/inspo-mock-data"
import type { BrandAnalytics } from "@/lib/brand-spy-analytics"

// ── Stat card ──────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className="bg-card border border-border/60 rounded-2xl px-5 py-4">
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/70 mb-1">{label}</p>
      <p className={`text-2xl font-bold tabular-nums ${accent ? "text-emerald-600 dark:text-emerald-400" : ""}`}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  )
}

// ── Section wrapper ────────────────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-semibold text-foreground mb-3">{title}</h3>
      {children}
    </div>
  )
}

// ── Tooltip ────────────────────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label, formatter }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-popover border border-border rounded-xl px-3 py-2 shadow-lg text-sm">
      <p className="text-muted-foreground text-xs mb-1">{label}</p>
      <p className="font-semibold">{formatter ? formatter(payload[0].value) : payload[0].value}</p>
    </div>
  )
}

interface Props {
  analytics: BrandAnalytics
}

export function OverviewTab({ analytics }: Props) {
  const { demographics: demo } = analytics

  return (
    <div className="space-y-8 pb-8">

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Ads"    value={analytics.totalAds.toString()} sub={`${analytics.activeAds} currently active`} />
        <StatCard label="Total Reach"  value={formatViews(analytics.totalReach)} accent />
        <StatCard label="Est. Spend"   value={formatSpend(analytics.totalSpend)} />
        <StatCard label="Avg. Running" value={`${analytics.avgRunningDays}d`} sub="per ad" />
      </div>

      {/* ── Reach over time + Media type ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        <div className="lg:col-span-2 bg-card border border-border/60 rounded-2xl p-5">
          <p className="text-xs font-semibold text-foreground mb-4">Reach Over Time</p>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={analytics.reachTimeline} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="reachGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.05} />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "currentColor", opacity: 0.5 }} tickLine={false} axisLine={false} interval={3} />
              <YAxis tick={{ fontSize: 10, fill: "currentColor", opacity: 0.5 }} tickLine={false} axisLine={false} tickFormatter={v => formatViews(v)} />
              <Tooltip content={<ChartTooltip formatter={formatViews} />} />
              <Area type="monotone" dataKey="value" stroke="#10b981" strokeWidth={2} fill="url(#reachGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-card border border-border/60 rounded-2xl p-5">
          <p className="text-xs font-semibold text-foreground mb-2">Media Type</p>
          {analytics.mediaTypeBreakdown.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={140}>
                <PieChart>
                  <Pie
                    data={analytics.mediaTypeBreakdown}
                    cx="50%" cy="50%"
                    innerRadius={45} outerRadius={65}
                    paddingAngle={3}
                    dataKey="count"
                  >
                    {analytics.mediaTypeBreakdown.map(entry => (
                      <Cell key={entry.type} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: any, name: any, p: any) => [p.payload.type, `${v} ads`]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap gap-2 mt-1">
                {analytics.mediaTypeBreakdown.map(item => (
                  <div key={item.type} className="flex items-center gap-1.5">
                    <span className="size-2.5 rounded-full shrink-0" style={{ background: item.color }} />
                    <span className="text-xs capitalize text-foreground/70">{item.type} ({item.percentage}%)</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground py-8 text-center">No data</p>
          )}
        </div>
      </div>

      {/* ── Demographics ── */}
      <Section title="Demographics">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

          {/* Top countries */}
          <div className="bg-card border border-border/60 rounded-2xl p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60 mb-3">Top Countries</p>
            <div className="space-y-2.5">
              {demo.topCountries.map(c => (
                <div key={c.country}>
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-sm flex items-center gap-1.5">
                      <span>{c.flag}</span>
                      <span className="text-foreground/80">{c.country}</span>
                    </span>
                    <span className="text-xs font-semibold tabular-nums">{c.percentage}%</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary/70 rounded-full" style={{ width: `${c.percentage}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Gender */}
          <div className="bg-card border border-border/60 rounded-2xl p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60 mb-3">Gender Split</p>
            <div className="space-y-4">
              {[
                { label: "Female", pct: demo.genderFemale, color: "#ec4899" },
                { label: "Male",   pct: demo.genderMale,   color: "#6366f1" },
              ].map(g => (
                <div key={g.label}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-foreground/80">{g.label}</span>
                    <span className="text-xs font-bold tabular-nums">{g.pct}%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${g.pct}%`, background: g.color }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Age */}
          <div className="bg-card border border-border/60 rounded-2xl p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60 mb-3">Age Distribution</p>
            <ResponsiveContainer width="100%" height={130}>
              <BarChart data={demo.ageGroups} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.05} />
                <XAxis dataKey="range" tick={{ fontSize: 9, fill: "currentColor", opacity: 0.5 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fill: "currentColor", opacity: 0.5 }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} />
                <Tooltip formatter={(v: any) => [`${v}%`, "Age group"]} />
                <Bar dataKey="percentage" fill="#6366f1" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </Section>

      {/* ── Top Landing Pages ── */}
      <Section title="Top Landing Pages">
        <div className="bg-card border border-border/60 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50 text-muted-foreground text-xs uppercase tracking-wide">
                <th className="text-left px-5 py-3 font-semibold">URL</th>
                <th className="text-right px-5 py-3 font-semibold">Ads</th>
                <th className="text-right px-5 py-3 font-semibold">Share</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {analytics.landingPages.map((lp, i) => (
                <tr key={i} className="hover:bg-muted/30 transition-colors">
                  <td className="px-5 py-3">
                    <a href={lp.url} target="_blank" rel="noopener noreferrer"
                      onClick={e => e.stopPropagation()}
                      className="text-primary hover:underline text-xs font-mono truncate block max-w-[320px]">
                      {lp.url}
                    </a>
                  </td>
                  <td className="px-5 py-3 text-right font-semibold tabular-nums">{lp.adsCount}</td>
                  <td className="px-5 py-3 text-right">
                    <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">{lp.distribution}%</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* ── Top Performing Ads ── */}
      <Section title="Top Performing Ads">
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {analytics.topAds.map(ad => (
            <div key={ad.id} className="bg-card border border-border/60 rounded-2xl overflow-hidden">
              <div className="relative aspect-[4/3] bg-neutral-100 dark:bg-neutral-900">
                <img src={ad.mediaUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
                {ad.views != null && (
                  <span className="absolute top-2 right-2 bg-black/65 backdrop-blur-sm text-emerald-400 text-xs font-bold px-1.5 py-0.5 rounded-md">
                    {formatViews(ad.views)}
                  </span>
                )}
              </div>
              <div className="px-3 py-2.5">
                <p className="text-xs text-foreground/80 line-clamp-2 leading-snug">
                  {ad.headline || ad.primaryText}
                </p>
                {ad.runningDays && (
                  <p className="text-xs text-muted-foreground mt-1">{ad.runningDays}d running</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </Section>
    </div>
  )
}
