"use client"

import { useEffect, useState } from "react"
import { IconLoader2, IconPlus, IconRefresh, IconX } from "@tabler/icons-react"
import { cn } from "@/lib/utils"
import type { CommentsData } from "./use-comments"

const TEMPLATES = [
  {
    id: "thank-kind", name: "Thank kind comments",
    trigger: "WHEN tone is positive · THEN AI drafts a thank-you reply",
    desc: "Spot upbeat comments and reply with a warm, on-brand thank-you. Great for boosting engagement on top-performing creatives.",
    time: "~30 seconds to set up", popular: true, icon: "❤️",
    trigger_type: "sentiment_positive", action_type: "ai_reply", trigger_value: "",
  },
  {
    id: "auto-hide-spam", name: "Auto-hide spam",
    trigger: "WHEN comment contains spam keywords · THEN hide it from public view",
    desc: "Quietly hide common spam patterns (links, scams, promo bait) so your ad creatives stay clean.",
    time: "~30 seconds to set up", popular: false, icon: "🛡️",
    trigger_type: "keyword", action_type: "hide", trigger_value: "spam,scam,click here,free money,DM me,WhatsApp",
  },
  {
    id: "catch-complaints", name: "Catch complaints",
    trigger: "WHEN tone is negative · THEN AI drafts an empathetic reply",
    desc: "Catch unhappy comments early and draft an empathetic, problem-solving reply for your team to approve before sending.",
    time: "~1 minute to set up", popular: false, icon: "😕",
    trigger_type: "sentiment_negative", action_type: "draft_reply", trigger_value: "",
  },
  {
    id: "answer-faqs", name: "Answer FAQs",
    trigger: "WHEN comment asks a question · THEN AI drafts an answer",
    desc: "Detect questions and draft AI answers grounded in your product info — you approve before anything goes live.",
    time: "~1 minute to set up", popular: false, icon: "😊",
    trigger_type: "question", action_type: "draft_reply", trigger_value: "",
  },
  {
    id: "promote-positive", name: "Promote on positive",
    trigger: "WHEN tone is positive · THEN reply with a discount code",
    desc: "Reward fans who leave positive comments with a discount code or link — a low-effort upsell on warm traffic.",
    time: "~1 minute to set up", popular: false, icon: "🎁",
    trigger_type: "sentiment_positive", action_type: "custom_reply", trigger_value: "",
  },
  {
    id: "hide-off-topic", name: "Hide off-topic",
    trigger: "WHEN comment contains off-topic keywords · THEN hide it",
    desc: "Keep ad threads on-topic by quietly hiding tangential or trolling comments.",
    time: "~30 seconds to set up", popular: false, icon: "🚫",
    trigger_type: "keyword", action_type: "hide", trigger_value: "politics,religion,hate,competitor",
  },
]

function AutomationToast({ msg }: { msg: string }) {
  if (!msg) return null
  return (
    <div className="fixed top-4 right-4 z-50 rounded-xl bg-foreground px-4 py-2.5 text-sm text-background shadow-xl animate-in slide-in-from-top-2">
      {msg}
    </div>
  )
}

export function CommentAutomationSection({ commentsData }: { commentsData: CommentsData }) {
  const { commentAutomations, setCommentAutomations, loadCommentAutomations } = commentsData
  const [refreshing, setRefreshing] = useState(false)
  const [pendingTemplateId, setPendingTemplateId] = useState<string | null>(null)
  const [toast, setToast] = useState("")

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(""), 3000)
    return () => clearTimeout(timer)
  }, [toast])

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await loadCommentAutomations(true)
    } finally {
      setRefreshing(false)
    }
  }

  const useTemplate = async (template: typeof TEMPLATES[0]) => {
    if (pendingTemplateId) return
    setPendingTemplateId(template.id)
    try {
      const res = await fetch("/api/comments/automations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: template.name, description: template.desc,
          trigger_type: template.trigger_type, trigger_value: template.trigger_value,
          action_type: template.action_type, template_name: template.id,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (data.automation) {
        setCommentAutomations(prev => [data.automation, ...prev])
        setToast(`"${template.name}" added!`)
      }
    } finally {
      setPendingTemplateId(null)
    }
  }

  const toggleAuto = async (id: string, is_active: boolean) => {
    await fetch(`/api/comments/automations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active }),
    })
    setCommentAutomations(prev => prev.map(a => a.id === id ? { ...a, is_active } : a))
  }

  const deleteAuto = async (id: string) => {
    await fetch(`/api/comments/automations/${id}`, { method: "DELETE" })
    setCommentAutomations(prev => prev.filter(a => a.id !== id))
    setToast("Automation removed")
  }

  return (
    <div className="space-y-6">
      <AutomationToast msg={toast} />

      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold">Comment automation</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Automations that watch your comments and react for you. Pick one to start, or build your own.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={() => void handleRefresh()}
            className="flex h-8 w-8 items-center justify-center rounded-lg border transition-colors hover:bg-muted/50"
          >
            {refreshing ? <IconLoader2 className="size-3.5 animate-spin" /> : <IconRefresh className="size-3.5" />}
          </button>
          <button className="flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90">
            <IconPlus className="size-3.5" /> New automation
          </button>
        </div>
      </div>

      {commentAutomations.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Your Automations</p>
          {commentAutomations.map(a => (
            <div key={a.id} className="flex items-center justify-between rounded-xl border bg-card p-3.5 transition-colors hover:bg-muted/20">
              <div className="flex min-w-0 items-center gap-3">
                <div className={cn("size-2.5 shrink-0 rounded-full", a.is_active ? "bg-emerald-500" : "bg-muted-foreground/30")} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{a.name}</p>
                  <p className="text-xs text-muted-foreground">{a.run_count} run{a.run_count !== 1 ? "s" : ""}</p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  onClick={() => void toggleAuto(a.id, !a.is_active)}
                  className={cn("h-7 rounded-lg border px-2.5 text-xs font-medium transition-colors",
                    a.is_active
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20"
                      : "text-muted-foreground hover:bg-muted/50")}
                >
                  {a.is_active ? "Active" : "Inactive"}
                </button>
                <button
                  onClick={() => void deleteAuto(a.id)}
                  className="flex h-7 w-7 items-center justify-center rounded-lg transition-colors hover:bg-destructive/10 hover:text-destructive"
                >
                  <IconX className="size-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <div className="rounded-xl border bg-muted/20 p-8 text-center">
        <div className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-600 dark:bg-violet-900/30 dark:text-violet-400">
          ✨ Get started in 30 seconds
        </div>
        <h3 className="text-xl font-bold">Pick a template to get your first automation running</h3>
        <p className="mx-auto mt-1.5 max-w-md text-sm text-muted-foreground">
          Templates are pre-built automations for common situations. They&apos;re tested, ready to go, and you can tweak them later.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {TEMPLATES.map(t => {
          const added = commentAutomations.some(a => a.template_name === t.id)
          return (
            <div key={t.id} className="flex flex-col gap-3 rounded-xl border bg-card p-4 transition-shadow hover:shadow-md">
              <div className="flex items-start justify-between">
                <span className="text-2xl leading-none">{t.icon}</span>
                {t.popular ? (
                  <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-bold text-rose-600 dark:bg-rose-900/30 dark:text-rose-400">
                    Popular
                  </span>
                ) : null}
              </div>
              <div>
                <p className="text-sm font-semibold">{t.name}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{t.trigger}</p>
              </div>
              <p className="flex-1 text-xs leading-relaxed text-muted-foreground">{t.desc}</p>
              <div className="flex items-center justify-between border-t pt-1">
                <span className="text-xs text-muted-foreground/60">{t.time}</span>
                <button
                  onClick={() => !added && void useTemplate(t)}
                  disabled={pendingTemplateId === t.id}
                  className={cn("flex items-center gap-1 text-xs font-medium transition-colors",
                    added ? "cursor-default text-muted-foreground/40" : "text-primary hover:text-primary/70")}
                >
                  {added ? "Added ✓" : pendingTemplateId === t.id ? "Adding…" : "Use this template →"}
                </button>
              </div>
            </div>
          )
        })}
      </div>

      <p className="pb-4 text-center text-sm text-muted-foreground">
        Want full control?{" "}
        <button className="text-primary hover:underline">Build a custom automation →</button>
      </p>
    </div>
  )
}
