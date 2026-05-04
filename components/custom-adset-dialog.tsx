"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { IconSearch, IconPlus, IconX, IconBolt, IconPhoto, IconVideo } from "@tabler/icons-react"

interface Creative {
  id: string
  file_name: string
  file_url: string
  media_type: "image" | "video"
}

export interface AdsetConfig {
  name: string
  creativeIds: string[]
}

export interface CampaignConfig {
  name: string
  adsets: AdsetConfig[]
}

interface Props {
  open: boolean
  onClose: () => void
  creativeIds: string[]
  campaignNames: string[]
  onApply: (config: CampaignConfig[]) => void
}

export function CustomAdSetDialog({ open, onClose, creativeIds, campaignNames, onApply }: Props) {
  const [creatives, setCreatives] = useState<Creative[]>([])
  const [config, setConfig] = useState<CampaignConfig[]>([])
  const [activeKey, setActiveKey] = useState("0-0") // "campIdx-adsetIdx"
  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState<"all" | "images" | "videos">("all")
  const [usageFilter, setUsageFilter] = useState<"all" | "used" | "unused">("unused")

  useEffect(() => {
    if (!open || !creativeIds.length) return
    fetch("/api/creatives")
      .then(r => r.json())
      .then(d => {
        const all: Creative[] = d.creatives || []
        setCreatives(all.filter(c => creativeIds.includes(c.id)))
      })
  }, [open])

  useEffect(() => {
    if (!open) return
    const names = campaignNames.length > 0 ? campaignNames : ["Campaign 1"]
    setConfig(names.map((name, i) => ({
      name,
      adsets: [{ name: `Ad Set ${i + 1}`, creativeIds: [] }]
    })))
    setActiveKey("0-0")
  }, [open, campaignNames.join("|")])

  const [ci, ai] = activeKey.split("-").map(Number)

  const assignedIds = new Set(config.flatMap(c => c.adsets.flatMap(a => a.creativeIds)))

  const filtered = creatives.filter(c => {
    if (assignedIds.has(c.id)) return false
    if (typeFilter === "images" && c.media_type !== "image") return false
    if (typeFilter === "videos" && c.media_type !== "video") return false
    if (search && !c.file_name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const toggleCreative = (creativeId: string) => {
    setConfig(prev => prev.map((camp, cIdx) => ({
      ...camp,
      adsets: camp.adsets.map((adset, aIdx) => {
        if (cIdx === ci && aIdx === ai) {
          const has = adset.creativeIds.includes(creativeId)
          return { ...adset, creativeIds: has ? adset.creativeIds.filter(id => id !== creativeId) : [...adset.creativeIds, creativeId] }
        }
        return { ...adset, creativeIds: adset.creativeIds.filter(id => id !== creativeId) }
      })
    })))
  }

  const addAdset = (campIdx: number) => {
    setConfig(prev => {
      const next = prev.map((c, i) => i !== campIdx ? c : {
        ...c, adsets: [...c.adsets, { name: `Ad Set ${c.adsets.length + 1}`, creativeIds: [] }]
      })
      setActiveKey(`${campIdx}-${next[campIdx].adsets.length - 1}`)
      return next
    })
  }

  const removeAdset = (campIdx: number, adsetIdx: number) => {
    setConfig(prev => prev.map((c, i) => i !== campIdx ? c : {
      ...c, adsets: c.adsets.filter((_, j) => j !== adsetIdx)
    }))
    setActiveKey(`${campIdx}-0`)
  }

  const clearAdset = (campIdx: number, adsetIdx: number) => {
    setConfig(prev => prev.map((c, i) => i !== campIdx ? c : {
      ...c, adsets: c.adsets.map((a, j) => j !== adsetIdx ? a : { ...a, creativeIds: [] })
    }))
  }

  const updateAdsetName = (campIdx: number, adsetIdx: number, name: string) => {
    setConfig(prev => prev.map((c, i) => i !== campIdx ? c : {
      ...c, adsets: c.adsets.map((a, j) => j !== adsetIdx ? a : { ...a, name })
    }))
  }

  const autoGroup = () => {
    const slots = config.flatMap((c, ci) => c.adsets.map((_, ai) => ({ ci, ai })))
    if (!slots.length) return
    const next = config.map(c => ({ ...c, adsets: c.adsets.map(a => ({ ...a, creativeIds: [] as string[] })) }))
    creatives.forEach((creative, i) => {
      const slot = slots[i % slots.length]
      next[slot.ci].adsets[slot.ai].creativeIds.push(creative.id)
    })
    setConfig(next)
  }

  const validAdsets = config.flatMap(c => c.adsets).filter(a => a.creativeIds.length > 0)
  const totalAds = config.reduce((s, c) => s + c.adsets.reduce((ss, a) => ss + a.creativeIds.length, 0), 0)

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="w-[98vw] max-w-[98vw] h-[95vh] max-h-[95vh] p-0 overflow-hidden flex flex-col gap-0">
        <DialogHeader className="px-6 py-4 border-b shrink-0">
          <DialogTitle className="text-xl">Build Custom Ad Set Configuration</DialogTitle>
          <p className="text-sm text-muted-foreground">Organize your media into custom ad sets (1-50 ads per ad set)</p>
        </DialogHeader>

        <div className="flex flex-1 overflow-hidden min-h-0">
          {/* LEFT: Media */}
          <div className="w-[380px] shrink-0 border-r flex flex-col overflow-hidden">
            <div className="p-3 border-b space-y-2 shrink-0">
              <div className="relative">
                <IconSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input placeholder="Search by name..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
              </div>
              <div className="flex items-center gap-1.5 flex-wrap text-xs">
                <span className="text-muted-foreground">Type:</span>
                {(["all","images","videos"] as const).map(t => (
                  <button key={t} type="button" onClick={() => setTypeFilter(t)}
                    className={`rounded border px-2 py-0.5 capitalize ${typeFilter===t ? "border-primary text-primary bg-primary/5" : "hover:bg-muted"}`}>
                    {t==="all"?"All":t==="images"?"Images":"Videos"}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3">
              {filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <IconPhoto className="size-10 mb-2 opacity-30" />
                  <p className="text-sm">No media found</p>
                  <p className="text-xs">Upload media to get started</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {filtered.map(creative => {
                    const inActive = config[ci]?.adsets[ai]?.creativeIds.includes(creative.id)
                    const isUsed = assignedIds.has(creative.id)
                    return (
                      <button key={creative.id} type="button" onClick={() => toggleCreative(creative.id)}
                        className={`relative rounded-lg overflow-hidden border-2 transition-all text-left ${
                          inActive ? "border-primary" : isUsed ? "border-muted opacity-50" : "border-transparent hover:border-muted-foreground/30"
                        }`}>
                        {creative.file_url ? (
                          <img src={creative.file_url} alt={creative.file_name} className="w-full aspect-square object-cover bg-muted" />
                        ) : (
                          <div className="w-full aspect-square bg-muted flex items-center justify-center">
                            <IconVideo className="size-6 text-muted-foreground" />
                          </div>
                        )}
                        <p className="text-[10px] truncate px-1 py-0.5">{creative.file_name}</p>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT: Ad Sets */}
          <div className="flex-1 flex flex-col overflow-hidden min-w-0">
            <div className="px-4 py-3 border-b flex items-center justify-between shrink-0">
              <div>
                <h3 className="font-semibold">Ad Sets</h3>
                <p className="text-xs text-muted-foreground">Click media to add 1-50 ads per ad set</p>
              </div>
              <Button variant="outline" size="sm" onClick={autoGroup}>
                <IconBolt className="size-4 mr-1" /> Auto Group
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              {config.map((camp, campIdx) => (
                <div key={campIdx}>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-sm">
                      {camp.name}
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        {camp.adsets.length} ad set{camp.adsets.length > 1 ? "s" : ""}, {camp.adsets.reduce((s, a) => s + a.creativeIds.length, 0)} ads
                      </span>
                    </h4>
                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => addAdset(campIdx)}>
                      <IconPlus className="size-3 mr-1" /> New Ad Set
                    </Button>
                  </div>

                  <div className="space-y-2">
                    {camp.adsets.map((adset, adsetIdx) => {
                      const key = `${campIdx}-${adsetIdx}`
                      const isActive = activeKey === key
                      return (
                        <div key={adsetIdx} onClick={() => setActiveKey(key)}
                          className={`rounded-lg border-2 p-3 cursor-pointer transition-all ${isActive ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/50"}`}>
                          <div className="flex items-center gap-2 mb-2" onClick={e => e.stopPropagation()}>
                            <Input value={adset.name} onChange={e => updateAdsetName(campIdx, adsetIdx, e.target.value)}
                              className="h-7 text-sm flex-1" onClick={e => { e.stopPropagation(); setActiveKey(key) }} />
                            <span className="text-xs text-muted-foreground shrink-0">{adset.creativeIds.length}/50</span>
                            <button type="button" onClick={() => clearAdset(campIdx, adsetIdx)}
                              className="text-xs text-muted-foreground hover:text-foreground shrink-0">Clear All</button>
                            {camp.adsets.length > 1 && (
                              <button type="button" onClick={() => removeAdset(campIdx, adsetIdx)}
                                className="text-xs text-destructive hover:opacity-80 shrink-0">Remove</button>
                            )}
                          </div>

                          {adset.creativeIds.length === 0 ? (
                            <div className="border-2 border-dashed rounded-md p-3 text-center text-xs text-muted-foreground">
                              Click media on the left to add to this ad set
                            </div>
                          ) : (
                            <div className="flex flex-wrap gap-1.5">
                              {adset.creativeIds.map(cid => {
                                const cr = creatives.find(c => c.id === cid)
                                if (!cr) return null
                                return (
                                  <div key={cid} className="group relative size-14 rounded overflow-hidden border shrink-0">
                                    {cr.file_url
                                      ? <img src={cr.file_url} alt={cr.file_name} className="w-full h-full object-cover" />
                                      : <div className="w-full h-full bg-muted flex items-center justify-center"><IconVideo className="size-4 text-muted-foreground" /></div>}
                                    <button
                                      type="button"
                                      onClick={e => { e.stopPropagation(); setConfig(prev => prev.map((c, cIdx) => cIdx !== campIdx ? c : { ...c, adsets: c.adsets.map((a, aIdx) => aIdx !== adsetIdx ? a : { ...a, creativeIds: a.creativeIds.filter(id => id !== cid) }) })) }}
                                      className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
                                    >
                                      <IconX className="size-4 text-white" />
                                    </button>
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t px-6 py-3 flex items-center justify-between shrink-0">
          <p className="text-sm text-amber-600">
            {totalAds === 0 && "⚠ All media has been removed from ad sets. Add media to continue."}
          </p>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">
              {validAdsets.length === 0 ? "No valid ad sets" : `${validAdsets.length} ad set${validAdsets.length > 1 ? "s" : ""}, ${totalAds} ads`}
            </span>
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={() => { onApply(config); onClose() }} disabled={validAdsets.length === 0}>
              Apply Configuration
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
