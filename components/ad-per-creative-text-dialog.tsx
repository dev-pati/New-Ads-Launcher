"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { IconVideo, IconRefresh, IconPlus, IconX } from "@tabler/icons-react"

export interface AdCreativeTextConfig {
  creativeId: string
  headlines: string[]
  primaryTexts: string[]
  description: string
  cta: string
  websiteUrl: string
  displayUrl: string
}

const CTA_OPTIONS = [
  ["LEARN_MORE", "Learn More"],
  ["SHOP_NOW", "Shop Now"],
  ["SIGN_UP", "Sign Up"],
  ["DOWNLOAD", "Download"],
  ["GET_QUOTE", "Get Quote"],
  ["SUBSCRIBE", "Subscribe"],
  ["CONTACT_US", "Contact Us"],
  ["APPLY_NOW", "Apply Now"],
  ["GET_OFFER", "Get Offer"],
  ["BOOK_TRAVEL", "Book Travel"],
  ["NO_BUTTON", "No Button"],
]

interface Creative {
  id: string
  file_name: string
  file_url: string
  media_type: "image" | "video"
  headline?: string
  primary_text?: string
  description?: string
  cta?: string
  link_url?: string
}

function defaultConfig(creativeId: string): AdCreativeTextConfig {
  return { creativeId, headlines: [""], primaryTexts: [""], description: "", cta: "LEARN_MORE", websiteUrl: "", displayUrl: "" }
}

interface Props {
  open: boolean
  onClose: () => void
  creatives: Creative[]
  initial: AdCreativeTextConfig[]
  onApply: (configs: AdCreativeTextConfig[]) => void
}

export function AdPerCreativeTextDialog({ open, onClose, creatives, initial, onApply }: Props) {
  const [configs, setConfigs] = useState<AdCreativeTextConfig[]>([])

  useEffect(() => {
    if (!open) return
    const next = creatives.map(cr => {
      const existing = initial.find(c => c.creativeId === cr.id)
      return existing ?? defaultConfig(cr.id)
    })
    setConfigs(next)
  }, [open, creatives.map(c => c.id).join("|")])

  const update = (i: number, patch: Partial<AdCreativeTextConfig>) =>
    setConfigs(prev => prev.map((c, idx) => idx === i ? { ...c, ...patch } : c))

  const resetAll = () => setConfigs(creatives.map(cr => defaultConfig(cr.id)))

  const copyFirstDown = () => {
    if (!configs.length) return
    const first = configs[0]
    setConfigs(prev => prev.map((c, i) => i === 0 ? c : {
      ...c,
      headlines: [...first.headlines],
      primaryTexts: [...first.primaryTexts],
      description: first.description,
      cta: first.cta,
      websiteUrl: first.websiteUrl,
      displayUrl: first.displayUrl,
    }))
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="w-[98vw] max-w-[98vw] h-[92vh] max-h-[92vh] p-0 overflow-hidden flex flex-col gap-0">
        <DialogHeader className="px-6 py-4 border-b shrink-0">
          <DialogTitle className="text-xl">Edit Text for Each Ad</DialogTitle>
          <p className="text-sm text-muted-foreground">Configure unique text for individual ads</p>
        </DialogHeader>

        <div className="px-6 py-2 border-b flex items-center gap-3 shrink-0">
          <button type="button" onClick={resetAll}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <IconRefresh className="size-3.5" /> Reset All
          </button>
          {configs.length > 1 && (
            <button type="button" onClick={copyFirstDown}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
              Copy row 1 down
            </button>
          )}
        </div>

        <div className="flex-1 overflow-auto min-h-0">
          <table className="border-collapse min-w-max w-full text-sm">
            <thead className="sticky top-0 z-10 bg-background">
              <tr className="border-b">
                <th className="text-left px-4 py-2.5 font-medium text-xs text-muted-foreground uppercase tracking-wide w-[180px] border-r">Ad</th>
                <th className="text-left px-4 py-2.5 font-medium text-xs text-muted-foreground uppercase tracking-wide w-[240px] border-r">Headline</th>
                <th className="text-left px-4 py-2.5 font-medium text-xs text-muted-foreground uppercase tracking-wide w-[320px] border-r">Primary Text</th>
                <th className="text-left px-4 py-2.5 font-medium text-xs text-muted-foreground uppercase tracking-wide w-[200px] border-r">Link Description</th>
                <th className="text-left px-4 py-2.5 font-medium text-xs text-muted-foreground uppercase tracking-wide w-[160px] border-r">Call to Action</th>
                <th className="text-left px-4 py-2.5 font-medium text-xs text-muted-foreground uppercase tracking-wide w-[220px] border-r">Website URL</th>
                <th className="text-left px-4 py-2.5 font-medium text-xs text-muted-foreground uppercase tracking-wide w-[180px]">Display URL</th>
              </tr>
            </thead>
            <tbody>
              {creatives.map((cr, i) => {
                const cfg = configs[i]
                if (!cfg) return null
                return (
                  <tr key={cr.id} className="border-b align-top hover:bg-muted/20">
                    {/* Creative thumbnail + name */}
                    <td className="px-4 py-3 border-r">
                      <div className="flex flex-col items-center gap-1.5">
                        {cr.media_type === "image" ? (
                          <img src={cr.file_url} alt={cr.file_name} className="w-16 h-16 object-cover rounded border" />
                        ) : (
                          <div className="w-16 h-16 bg-muted rounded border flex items-center justify-center">
                            <IconVideo className="size-6 text-muted-foreground" />
                          </div>
                        )}
                        <p className="text-[10px] text-muted-foreground text-center break-all leading-tight max-w-[140px]">{cr.file_name}</p>
                      </div>
                    </td>

                    {/* Headlines */}
                    <td className="px-4 py-3 border-r">
                      <div className="space-y-1.5">
                        {cfg.headlines.map((h, hi) => (
                          <div key={hi} className="flex gap-1">
                            <Input
                              value={h}
                              onChange={e => {
                                const u = [...cfg.headlines]; u[hi] = e.target.value
                                update(i, { headlines: u })
                              }}
                              placeholder={hi === 0 && cr.headline ? cr.headline : `Headline ${hi + 1}`}
                              className="flex-1 h-8 text-xs"
                            />
                            {cfg.headlines.length > 1 && (
                              <button type="button" onClick={() => update(i, { headlines: cfg.headlines.filter((_, j) => j !== hi) })}
                                className="text-muted-foreground hover:text-foreground shrink-0">
                                <IconX className="size-3.5" />
                              </button>
                            )}
                          </div>
                        ))}
                        <button type="button" onClick={() => update(i, { headlines: [...cfg.headlines, ""] })}
                          className="flex items-center gap-1 text-xs text-primary hover:underline">
                          <IconPlus className="size-3" /> Add
                        </button>
                      </div>
                    </td>

                    {/* Primary Texts */}
                    <td className="px-4 py-3 border-r">
                      <div className="space-y-1.5">
                        {cfg.primaryTexts.map((pt, pi) => (
                          <div key={pi} className="flex gap-1 items-start">
                            <Textarea
                              value={pt}
                              onChange={e => {
                                const u = [...cfg.primaryTexts]; u[pi] = e.target.value
                                update(i, { primaryTexts: u })
                              }}
                              placeholder={pi === 0 && cr.primary_text ? cr.primary_text : `Primary text ${pi + 1}`}
                              className="flex-1 text-xs min-h-[100px] resize-y"
                            />
                            {cfg.primaryTexts.length > 1 && (
                              <button type="button" onClick={() => update(i, { primaryTexts: cfg.primaryTexts.filter((_, j) => j !== pi) })}
                                className="text-muted-foreground hover:text-foreground shrink-0 mt-1">
                                <IconX className="size-3.5" />
                              </button>
                            )}
                          </div>
                        ))}
                        <button type="button" onClick={() => update(i, { primaryTexts: [...cfg.primaryTexts, ""] })}
                          className="flex items-center gap-1 text-xs text-primary hover:underline">
                          <IconPlus className="size-3" /> Add
                        </button>
                      </div>
                    </td>

                    {/* Link Description */}
                    <td className="px-4 py-3 border-r">
                      <Input
                        value={cfg.description}
                        onChange={e => update(i, { description: e.target.value })}
                        placeholder={cr.description || "Description"}
                        className="h-8 text-xs"
                      />
                    </td>

                    {/* CTA */}
                    <td className="px-4 py-3 border-r">
                      <div className="space-y-1">
                        <select
                          value={cfg.cta}
                          onChange={e => update(i, { cta: e.target.value })}
                          className="h-8 w-full rounded-md border bg-background px-2 text-xs"
                        >
                          {CTA_OPTIONS.map(([val, label]) => (
                            <option key={val} value={val}>{label}</option>
                          ))}
                        </select>
                        {cr.cta && cr.cta !== cfg.cta && (
                          <p className="text-[10px] text-muted-foreground">Current: {cr.cta}</p>
                        )}
                      </div>
                    </td>

                    {/* Website URL */}
                    <td className="px-4 py-3 border-r">
                      <Input
                        value={cfg.websiteUrl}
                        onChange={e => update(i, { websiteUrl: e.target.value })}
                        placeholder={cr.link_url || "https://..."}
                        className="h-8 text-xs"
                      />
                    </td>

                    {/* Display URL */}
                    <td className="px-4 py-3">
                      <Input
                        value={cfg.displayUrl}
                        onChange={e => update(i, { displayUrl: e.target.value })}
                        placeholder="example.com"
                        className="h-8 text-xs"
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="border-t px-6 py-3 flex items-center justify-end gap-3 shrink-0">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => { onApply(configs); onClose() }}>Apply</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
