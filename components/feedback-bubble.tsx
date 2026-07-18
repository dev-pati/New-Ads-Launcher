"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import {
  IconMessage,
  IconLoader2,
  IconCheck,
  IconAlertTriangle,
  IconX,
  IconClipboard,
} from "@tabler/icons-react"

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import {
  FEEDBACK_FEATURES,
  FEEDBACK_SEVERITIES,
  FEEDBACK_TYPES,
  functionsForArea,
  resolveFeatureByPath,
} from "@/lib/feedback-taxonomy"

const ACCEPTED_IMAGE = ["image/png", "image/jpeg", "image/webp"]

type SubmitState =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "success" }
  | { kind: "error"; message: string }

export function FeedbackBubble() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [open, setOpen] = useState(false)

  const initial = useMemo(() => resolveFeatureByPath(pathname || "/"), [pathname])

  const [area, setArea] = useState(initial.area)
  const [fn, setFn] = useState(initial.fn)
  const [type, setType] = useState<string>("bug")
  const [severity, setSeverity] = useState<string>("medium")
  const [evidence, setEvidence] = useState("")
  const [expected, setExpected] = useState("")
  const [referenceUrl, setReferenceUrl] = useState("")
  const [extraNote, setExtraNote] = useState("")
  const [expectedDoneAt, setExpectedDoneAt] = useState("")
  const [screenshot, setScreenshot] = useState<File | null>(null)
  const [pasteError, setPasteError] = useState<string | null>(null)
  const [state, setState] = useState<SubmitState>({ kind: "idle" })

  function onAreaChange(nextArea: string) {
    setArea(nextArea)
    setFn(functionsForArea(nextArea)[0]?.value ?? "")
  }

  // Paste handler — global while popover open
  const fileInputRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (!open) return
    function onPaste(e: ClipboardEvent) {
      const items = e.clipboardData?.items
      if (!items) return
      for (const it of items) {
        if (it.kind === "file" && ACCEPTED_IMAGE.includes(it.type)) {
          const f = it.getAsFile()
          if (f) {
            setScreenshot(f)
            setPasteError(null)
            e.preventDefault()
            return
          }
        }
      }
      let hadImage = false
      for (const it of items) if (it.kind === "file" && it.type.startsWith("image/")) hadImage = true
      if (hadImage) {
        setPasteError("Image must be PNG, JPG, or WebP")
        e.preventDefault()
      }
    }
    window.addEventListener("paste", onPaste)
    return () => window.removeEventListener("paste", onPaste)
  }, [open])

  function resetForm() {
    setEvidence("")
    setExpected("")
    setReferenceUrl("")
    setExtraNote("")
    setExpectedDoneAt("")
    setScreenshot(null)
    setPasteError(null)
    setState({ kind: "idle" })
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (state.kind === "submitting") return
    if (!evidence.trim() || !expected.trim()) return

    setState({ kind: "submitting" })
    try {
      const fd = new FormData()
      fd.set("feature_area", area)
      fd.set("feature_function", fn)
      fd.set("feedback_type", type)
      fd.set("severity", severity)
      fd.set("observed_evidence", evidence.trim())
      fd.set("expected_result", expected.trim())
      if (referenceUrl.trim()) fd.set("reference_url", referenceUrl.trim())
      if (extraNote.trim()) fd.set("extra_note", extraNote.trim())
      if (expectedDoneAt) fd.set("expected_done_at", expectedDoneAt)
      const artifact = pathname
        ? pathname + (searchParams?.toString() ? `?${searchParams.toString()}` : "")
        : ""
      fd.set("artifact_url", artifact)
      if (screenshot) fd.set("screenshot", screenshot)

      const res = await fetch("/api/feedback", { method: "POST", body: fd })
      if (!res.ok) {
        const txt = await res.text().catch(() => "")
        setState({ kind: "error", message: `Failed (${res.status}). ${txt.slice(0, 200)}` })
        return
      }
      setState({ kind: "success" })
      setTimeout(() => {
        setOpen(false)
        resetForm()
      }, 1600)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Network error"
      setState({ kind: "error", message: msg })
    }
  }

  const functions = functionsForArea(area)

  return (
    <Popover
      modal={false}
      open={open}
      onOpenChange={(v) => {
        if (v) {
          setArea(initial.area)
          setFn(initial.fn)
        } else {
          setTimeout(resetForm, 200)
        }
        setOpen(v)
      }}
    >
      <PopoverTrigger asChild>
        <button
          aria-label="Send feedback"
          className="fixed bottom-6 right-6 z-50 size-12 rounded-full bg-primary text-primary-foreground shadow-lg ring-1 ring-primary/30 flex items-center justify-center hover:bg-primary/90 transition-all"
        >
          <IconMessage className="size-5" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="end"
        sideOffset={8}
        onInteractOutside={(e) => e.preventDefault()}
        className="w-[420px] max-w-[calc(100vw-2rem)] max-h-[70vh] overflow-y-auto overflow-x-hidden p-4 gap-3 z-50 pointer-events-auto bg-popover text-popover-foreground border border-border shadow-2xl ring-1 ring-foreground/10"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-0.5">
            <p className="font-heading text-sm font-semibold leading-none text-foreground">Send feedback</p>
            <p className="text-xs text-muted-foreground">
              Auto-tagged from this page.
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => setOpen(false)}
            aria-label="Close"
          >
            <IconX />
          </Button>
        </div>

        {state.kind === "success" ? (
          <div className="flex flex-col items-center justify-center py-8 gap-2 text-center border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 rounded-md px-4">
            <div className="size-10 rounded-full flex items-center justify-center bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300">
              <IconCheck className="size-5" />
            </div>
            <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">Thanks — feedback sent</p>
            <p className="text-xs text-muted-foreground">Closing…</p>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="grid gap-2.5">
            <div className="grid grid-cols-2 gap-2">
              <Field label="Feature area">
                <Select value={area} onValueChange={onAreaChange}>
                  <SelectTrigger className="w-full dark:bg-input">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent position="popper" className="max-h-60 overflow-y-auto">
                    {FEEDBACK_FEATURES.map((a) => (
                      <SelectItem key={a.area} value={a.area}>
                        {a.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Feature function">
                <Select value={fn} onValueChange={setFn}>
                  <SelectTrigger className="w-full dark:bg-input">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent position="popper" className="max-h-60 overflow-y-auto">
                    {functions.map((f) => (
                      <SelectItem key={f.value} value={f.value}>
                        {f.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Field label="Type">
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger className="w-full dark:bg-input">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent position="popper" className="max-h-60 overflow-y-auto">
                    {FEEDBACK_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Severity">
                <Select value={severity} onValueChange={setSeverity}>
                  <SelectTrigger className="w-full dark:bg-input">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent position="popper" className="max-h-60 overflow-y-auto min-w-[var(--radix-select-trigger-width)]">
                    {FEEDBACK_SEVERITIES.map((s) => (
                      <SelectItem
                        key={s.value}
                        value={s.value}
                        title={`${s.label} — ${s.description}`}
                      >
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <Field label="What you observed" required>
              <Textarea
                value={evidence}
                onChange={(e) => setEvidence(e.target.value)}
                placeholder="What happened? Steps to reproduce…"
                required
                className="min-h-14 w-full dark:bg-input"
              />
            </Field>

            <Field label="What you expected" required>
              <Textarea
                value={expected}
                onChange={(e) => setExpected(e.target.value)}
                placeholder="What should have happened?"
                required
                className="min-h-14 w-full dark:bg-input"
              />
            </Field>

            <Field label="Screenshot (PNG/JPG/WebP) — Ctrl/Cmd+V">
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ACCEPTED_IMAGE.join(",")}
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    setScreenshot(f ?? null)
                    setPasteError(null)
                  }}
                  className="text-xs file:mr-2 file:rounded file:border-0 file:bg-muted file:px-2 file:py-1 file:text-xs file:font-medium"
                />
                {screenshot && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => {
                      setScreenshot(null)
                      if (fileInputRef.current) fileInputRef.current.value = ""
                    }}
                    aria-label="Remove screenshot"
                  >
                    <IconX />
                  </Button>
                )}
              </div>
              {pasteError && (
                <p className="text-xs text-destructive flex items-center gap-1 mt-1">
                  <IconAlertTriangle className="size-3" /> {pasteError}
                </p>
              )}
              {screenshot && (
                <div className="mt-1.5 relative inline-block p-1 border border-border bg-muted/40 rounded-md">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={URL.createObjectURL(screenshot)}
                    alt="Screenshot preview"
                    className="h-20 rounded-sm object-cover"
                  />
                  <span className="absolute -top-1 -right-1 text-[10px] bg-background border border-border text-foreground px-1.5 py-0.5 rounded-full max-w-[160px] truncate shadow-xs">
                    {screenshot.name}
                  </span>
                </div>
              )}
              <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-1">
                <IconClipboard className="size-3" /> Tip: paste directly with Ctrl/Cmd+V
              </p>
            </Field>

            <div className="grid grid-cols-2 gap-2">
              <Field label="Reference URL (optional)">
                <Input
                  type="url"
                  value={referenceUrl}
                  onChange={(e) => setReferenceUrl(e.target.value)}
                  placeholder="https://…"
                  className="w-full dark:bg-input"
                />
              </Field>
              <Field label="Expected done by (optional)">
                <Input
                  type="date"
                  value={expectedDoneAt}
                  onChange={(e) => setExpectedDoneAt(e.target.value)}
                  className="w-full dark:bg-input"
                />
              </Field>
            </div>

            <Field label="Extra note (optional)">
              <Textarea
                value={extraNote}
                onChange={(e) => setExtraNote(e.target.value)}
                placeholder="Anything else relevant…"
                className="min-h-12 w-full dark:bg-input"
              />
            </Field>

            {state.kind === "error" && (
              <p className="text-xs text-destructive flex items-start gap-1.5 border border-destructive/20 bg-destructive/10 rounded-md px-2.5 py-2">
                <IconAlertTriangle className="size-3.5 shrink-0 mt-0.5" />
                <span>{state.message}</span>
              </p>
            )}

            <div className="flex flex-row justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setOpen(false)}
                disabled={state.kind === "submitting"}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={
                  state.kind === "submitting" || !evidence.trim() || !expected.trim()
                }
              >
                {state.kind === "submitting" ? (
                  <>
                    <IconLoader2 className="animate-spin" />
                    Sending…
                  </>
                ) : (
                  "Send feedback"
                )}
              </Button>
            </div>
          </form>
        )}
      </PopoverContent>
    </Popover>
  )
}

function Field({
  label,
  required,
  children,
}: {
  label: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="grid gap-1">
      <Label className={cn("text-xs", required && "after:content-['*'] after:text-destructive after:ml-0.5")}>
        {label}
      </Label>
      {children}
    </div>
  )
}
