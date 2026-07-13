"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { useOrg } from "@/lib/org-context"
import { cn } from "@/lib/utils"
import {
  IconGift, IconCopy, IconCheck, IconRocket, IconPhoto,
  IconFileDescription, IconUsers, IconSparkles, IconStar,
  IconTrophy, IconBolt, IconShare,
  IconBrandTwitter, IconMail,
} from "@tabler/icons-react"

// ─── Types ────────────────────────────────────────────────────────────────────

interface Stats {
  launches: number
  creatives: number
  templates: number
  members: number
}

interface Milestone {
  id: string
  label: string
  description: string
  threshold: number
  current: number
  points: number
  icon: React.ElementType
  color: string
}

// ─── Milestone config ─────────────────────────────────────────────────────────

function buildMilestones(stats: Stats): Milestone[] {
  return [
    {
      id: "first_launch",
      label: "First Launch",
      description: "Launch your first ad batch",
      threshold: 1, current: stats.launches, points: 50,
      icon: IconRocket, color: "text-blue-500 bg-blue-500/10",
    },
    {
      id: "launch_10",
      label: "Launch Veteran",
      description: "Launch 10 ad batches",
      threshold: 10, current: stats.launches, points: 150,
      icon: IconBolt, color: "text-violet-500 bg-violet-500/10",
    },
    {
      id: "launch_50",
      label: "Ad Machine",
      description: "Launch 50 ad batches",
      threshold: 50, current: stats.launches, points: 500,
      icon: IconTrophy, color: "text-amber-500 bg-amber-500/10",
    },
    {
      id: "creatives_10",
      label: "Content Creator",
      description: "Upload 10 creatives",
      threshold: 10, current: stats.creatives, points: 100,
      icon: IconPhoto, color: "text-emerald-500 bg-emerald-500/10",
    },
    {
      id: "templates_5",
      label: "Template Master",
      description: "Save 5 ad copy templates",
      threshold: 5, current: stats.templates, points: 75,
      icon: IconFileDescription, color: "text-pink-500 bg-pink-500/10",
    },
    {
      id: "invite_1",
      label: "Team Builder",
      description: "Invite a team member",
      threshold: 1, current: Math.max(0, stats.members - 1), points: 200,
      icon: IconUsers, color: "text-cyan-500 bg-cyan-500/10",
    },
  ]
}

// ─── Components ───────────────────────────────────────────────────────────────

function MilestoneCard({ m }: { m: Milestone }) {
  const done = m.current >= m.threshold
  const pct = Math.min(100, Math.round((m.current / m.threshold) * 100))
  const Icon = m.icon

  return (
    <div className={cn(
      "rounded-xl border p-4 transition-all",
      done ? "bg-card border-primary/30 shadow-sm" : "bg-card"
    )}>
      <div className="flex items-start gap-3 mb-3">
        <div className={cn("size-9 rounded-lg flex items-center justify-center shrink-0", m.color)}>
          <Icon className="size-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <p className="text-sm font-semibold">{m.label}</p>
            {done && <IconCheck className="size-3.5 text-primary" />}
          </div>
          <p className="text-xs text-muted-foreground">{m.description}</p>
        </div>
        <div className={cn(
          "text-xs font-bold px-2 py-1 rounded-full",
          done ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
        )}>
          +{m.points} pts
        </div>
      </div>

      {/* Progress */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{done ? "Completed!" : `${m.current} / ${m.threshold}`}</span>
          <span>{pct}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className={cn("h-full rounded-full transition-all duration-700", done ? "bg-primary" : "bg-primary/40")}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  )
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button
      onClick={copy}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all hover:bg-muted"
    >
      {copied ? <><IconCheck className="size-3.5 text-primary" />Copied!</> : <><IconCopy className="size-3.5" />{label}</>}
    </button>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function RewardsPage() {
  const { activeOrg } = useOrg()
  const [stats, setStats] = useState<Stats>({ launches: 0, creatives: 0, templates: 0, members: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!activeOrg?.id) return
    const load = async () => {
      const supabase = createClient()
      const [l, c, t, m] = await Promise.all([
        supabase.from("launch_batches").select("id", { count: "exact", head: true }).eq("org_id", activeOrg.id),
        supabase.from("creatives").select("id", { count: "exact", head: true }).eq("org_id", activeOrg.id),
        supabase.from("ad_copy_templates").select("id", { count: "exact", head: true }).eq("org_id", activeOrg.id),
        supabase.from("org_members").select("id", { count: "exact", head: true }).eq("org_id", activeOrg.id),
      ])
      setStats({
        launches: l.count ?? 0,
        creatives: c.count ?? 0,
        templates: t.count ?? 0,
        members: m.count ?? 0,
      })
      setLoading(false)
    }
    load()
  }, [activeOrg?.id])

  const milestones = buildMilestones(stats)
  const earned = milestones.filter(m => m.current >= m.threshold).reduce((s, m) => s + m.points, 0)
  const total = milestones.reduce((s, m) => s + m.points, 0)

  const referralLink = typeof window !== "undefined"
    ? `${window.location.origin}/auth/signup?ref=${activeOrg?.slug || activeOrg?.id?.slice(0, 8) || "org"}`
    : ""

  return (
    <div className="flex-1 overflow-y-auto bg-background">
      <div className="max-w-3xl mx-auto px-6 py-8 space-y-8">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <IconGift className="size-6 text-primary" />
            Rewards
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Earn points by using AdLauncher and referring teammates.
          </p>
        </div>

        {/* Points summary */}
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2 rounded-2xl border bg-gradient-to-br from-primary/5 to-primary/10 p-6">
            <p className="text-xs font-medium text-muted-foreground mb-1">Your points</p>
            {loading
              ? <div className="h-10 w-24 rounded bg-muted animate-pulse" />
              : <p className="text-4xl font-black tracking-tight">{earned.toLocaleString()}</p>
            }
            <div className="mt-3 space-y-1">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Progress to max</span>
                <span>{earned} / {total} pts</span>
              </div>
              <div className="h-2 rounded-full bg-primary/15 overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-700"
                  style={{ width: total > 0 ? `${Math.round((earned / total) * 100)}%` : "0%" }}
                />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border bg-card p-5 flex flex-col justify-between">
            <div>
              <div className="size-9 rounded-xl bg-amber-500/10 flex items-center justify-center mb-3">
                <IconStar className="size-4 text-amber-500" />
              </div>
              <p className="text-xs text-muted-foreground">Milestones done</p>
              <p className="text-2xl font-bold mt-0.5">
                {milestones.filter(m => m.current >= m.threshold).length}
                <span className="text-sm font-normal text-muted-foreground"> / {milestones.length}</span>
              </p>
            </div>
            <p className="text-xs text-muted-foreground">Complete all to earn {total} pts total</p>
          </div>
        </div>

        {/* Referral */}
        <div className="rounded-2xl border bg-card p-6">
          <div className="flex items-start gap-4 mb-5">
            <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <IconShare className="size-5 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold">Refer a teammate</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                Invite someone to AdLauncher and earn <strong className="text-foreground">200 points</strong> when they join your org.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 p-3 rounded-xl bg-muted/50 border mb-4">
            <p className="flex-1 text-sm font-mono text-muted-foreground truncate">{referralLink || "Loading…"}</p>
            <CopyButton text={referralLink} label="Copy link" />
          </div>

          <div className="flex items-center gap-2">
            <p className="text-xs text-muted-foreground">Share via:</p>
            <button
              onClick={() => window.open(`mailto:?subject=Join me on AdLauncher&body=Hey! I've been using AdLauncher to launch Meta ads faster. Join here: ${referralLink}`, "_blank")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium hover:bg-muted transition-colors"
            >
              <IconMail className="size-3.5" />Email
            </button>
            <button
              onClick={() => window.open(`https://twitter.com/intent/tweet?text=I'm launching Meta ads way faster with @AdLauncher 🚀 Try it: ${referralLink}`, "_blank")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium hover:bg-muted transition-colors"
            >
              <IconBrandTwitter className="size-3.5" />Twitter
            </button>
          </div>
        </div>

        {/* How to earn */}
        <div>
          <h2 className="font-semibold mb-3 flex items-center gap-2">
            <IconSparkles className="size-4 text-primary" />
            How to earn points
          </h2>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: "Launch your first batch", pts: 50, icon: IconRocket },
              { label: "Upload 10 creatives", pts: 100, icon: IconPhoto },
              { label: "Reach 10 launches", pts: 150, icon: IconBolt },
              { label: "Invite a team member", pts: 200, icon: IconUsers },
              { label: "Save 5 templates", pts: 75, icon: IconFileDescription },
              { label: "Launch 50 batches", pts: 500, icon: IconTrophy },
            ].map(({ label, pts, icon: Icon }) => (
              <div key={label} className="flex items-center gap-3 px-4 py-3 rounded-xl border bg-card">
                <Icon className="size-4 text-muted-foreground shrink-0" />
                <span className="text-sm flex-1">{label}</span>
                <span className="text-xs font-semibold text-primary">+{pts}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Milestones */}
        <div>
          <h2 className="font-semibold mb-3 flex items-center gap-2">
            <IconTrophy className="size-4 text-primary" />
            Milestones
          </h2>
          {loading
            ? <div className="grid grid-cols-2 gap-3">{[...Array(6)].map((_, i) => <div key={i} className="h-28 rounded-xl bg-muted animate-pulse" />)}</div>
            : <div className="grid grid-cols-2 gap-3">{milestones.map(m => <MilestoneCard key={m.id} m={m} />)}</div>
          }
        </div>

        {/* Coming soon */}
        <div className="rounded-2xl border border-dashed bg-muted/20 p-6 text-center">
          <IconGift className="size-8 text-muted-foreground/40 mx-auto mb-2" />
          <p className="font-medium text-sm">More rewards coming soon</p>
          <p className="text-xs text-muted-foreground mt-1">Redeem points for subscription discounts, priority support, and exclusive features.</p>
        </div>

      </div>
    </div>
  )
}
