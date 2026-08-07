"use client"

import { useEffect, useMemo, useState } from "react"
import { IconChevronLeft, IconChevronRight, IconFileText, IconSearch, IconX } from "@tabler/icons-react"
import { HELP_GLOSSARY, getGlossaryEntry } from "@/lib/help-glossary"
import { useHelp } from "@/lib/help-context"
import { cn } from "@/lib/utils"

const TOPICS = HELP_GLOSSARY.slice(0, 5)

export function HelpSidebar() {
  const { isOpen, activeTermKey, openHelp, closeHelp } = useHelp()
  const [query, setQuery] = useState("")
  const [satisfaction, setSatisfaction] = useState<number | null>(null)
  const active = activeTermKey ? getGlossaryEntry(activeTermKey) : null

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return HELP_GLOSSARY
    return HELP_GLOSSARY.filter((entry) =>
      [entry.term, entry.tooltip, entry.where, entry.explanation].some((value) => value.toLowerCase().includes(q))
    )
  }, [query])

  useEffect(() => {
    if (!isOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeHelp()
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [closeHelp, isOpen])

  if (!isOpen) return null

  return (
    <aside
      role="dialog"
      aria-label="Help glossary"
      className="flex h-full w-[380px] max-w-[calc(100vw-16px)] shrink-0 flex-col overflow-hidden border-l bg-background text-foreground"
    >
      {/* Header */}
      <header className="flex shrink-0 items-center justify-between border-b px-4 py-3.5">
        <h2 className="text-base font-semibold">Help</h2>
        <button
          onClick={closeHelp}
          className="flex size-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <IconX className="size-4" />
          <span className="sr-only">Close help</span>
        </button>
      </header>

      <div className="flex-1 overflow-y-auto">
        {active ? (
          /* Detail view */
          <article className="px-4 py-4">
            <button
              onClick={() => openHelp()}
              className="mb-4 flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            >
              <IconChevronLeft className="size-4" />
              All articles
            </button>

            <h3 className="text-lg font-semibold leading-snug">{active.term}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{active.tooltip}</p>

            <div className="mt-5 space-y-4 border-t pt-5">
              <section>
                <p className="text-sm leading-relaxed">{active.explanation}</p>
              </section>

              <section className="bg-muted/40 rounded-lg p-3.5">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Where you will see it
                </h4>
                <p className="mt-1.5 text-sm text-foreground">{active.where}</p>
              </section>

              {active.gotchas?.length ? (
                <section>
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Common mistakes
                  </h4>
                  <ul className="mt-2 space-y-2 text-sm">
                    {active.gotchas.map((gotcha) => (
                      <li key={gotcha} className="flex gap-2 leading-relaxed">
                        <span className="mt-0.5 size-1.5 shrink-0 rounded-full bg-amber-500" />
                        <span className="text-muted-foreground">{gotcha}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              {active.related?.length ? (
                <section>
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Related terms
                  </h4>
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    {active.related.map((key) => {
                      const related = getGlossaryEntry(key)
                      if (!related) return null
                      return (
                        <button
                          key={key}
                          onClick={() => openHelp(key)}
                          className="rounded-full border bg-card px-3 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/8"
                        >
                          {related.term}
                        </button>
                      )
                    })}
                  </div>
                </section>
              ) : null}
            </div>
          </article>
        ) : (
          /* Browse view */
          <div className="px-4 py-4">
            {/* Search */}
            <label className="flex h-9 items-center gap-2 rounded-lg border bg-card px-3 text-sm focus-within:ring-2 focus-within:ring-ring">
              <IconSearch className="size-4 shrink-0 text-muted-foreground" />
              <span className="sr-only">Search help</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search help"
                className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
              />
              {query ? (
                <button
                  onClick={() => setQuery("")}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label="Clear search"
                >
                  <IconX className="size-3.5" />
                </button>
              ) : null}
            </label>

            {/* Topics pills */}
            {!query ? (
              <div className="mt-3.5 flex flex-wrap gap-2">
                {TOPICS.map((topic) => (
                  <button
                    key={topic.key}
                    onClick={() => openHelp(topic.key)}
                    className="rounded-full border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
                  >
                    {topic.term.replace(/\s*\(.*\)/, "")}
                  </button>
                ))}
              </div>
            ) : null}

            {/* Recommended articles / search results */}
            <section className="mt-5">
              <h3 className="mb-1 text-sm font-semibold text-muted-foreground">
                {query ? `Results (${filtered.length})` : "Recommended articles"}
              </h3>
              <ul className="divide-y">
                {filtered.map((entry) => (
                  <li key={entry.key}>
                    <button
                      onClick={() => openHelp(entry.key)}
                      className={cn(
                        "flex w-full items-start gap-3 py-3 text-left transition-colors hover:bg-muted/50 -mx-2 px-2 rounded-md",
                      )}
                    >
                      <IconFileText className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-foreground">{entry.term}</span>
                        <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground line-clamp-2">
                          {entry.tooltip}
                        </span>
                      </div>
                      <IconChevronRight className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    </button>
                  </li>
                ))}
                {filtered.length === 0 && (
                  <li className="py-10 text-center text-sm text-muted-foreground">
                    No articles match "{query}".
                  </li>
                )}
              </ul>
            </section>

            {/* Additional resources */}
            {!query ? (
              <section className="mt-6">
                <h3 className="mb-1 text-sm font-semibold text-muted-foreground">Additional resources</h3>
                <ul className="divide-y">
                  {RESOURCES.map((resource) => (
                    <li key={resource.label}>
                      <a
                        href={resource.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex w-full items-center gap-3 py-3 text-left text-sm font-medium text-primary transition-colors hover:underline -mx-2 px-2 rounded-md"
                      >
                        <span className="flex-1">{resource.label}</span>
                        <IconChevronRight className="size-4 shrink-0" />
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {/* Feedback */}
            {!query ? (
              <section className="mt-6 border-t pt-5">
                <h3 className="text-sm font-semibold text-foreground">
                  How satisfied or dissatisfied are you with Ads Manager Help?
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">Your feedback helps improve this feature.</p>
                <div className="mt-3 flex items-center gap-3">
                  {[
                    { value: 1, label: "Very dissatisfied", icon: "😖" },
                    { value: 2, label: "Dissatisfied", icon: "🙁" },
                    { value: 3, label: "Neutral", icon: "😐" },
                    { value: 4, label: "Satisfied", icon: "🙂" },
                    { value: 5, label: "Very satisfied", icon: "😀" },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setSatisfaction(opt.value)}
                      title={opt.label}
                      aria-label={opt.label}
                      className={cn(
                        "flex size-9 items-center justify-center rounded-full border text-lg transition-all",
                        satisfaction === opt.value
                          ? "border-primary bg-primary/10 scale-110"
                          : "border-border bg-card grayscale hover:grayscale-0 hover:bg-muted"
                      )}
                    >
                      {opt.icon}
                    </button>
                  ))}
                </div>
              </section>
            ) : null}

            {/* Footer */}
            {!query ? (
              <footer className="mt-6 flex flex-col gap-2 border-t pt-4 text-xs text-muted-foreground">
                <span>© {new Date().getFullYear()} AdLauncher · Help content for internal teams</span>
              </footer>
            ) : null}
          </div>
        )}
      </div>
    </aside>
  )
}

const RESOURCES = [
  { label: "Meta Ads Help Center", href: "https://www.facebook.com/business/help" },
  { label: "Blueprint e-learning", href: "https://www.facebook.com/business/learn" },
  { label: "Advertising Policies", href: "https://transparency.meta.com/policies/ad-policies/" },
]
