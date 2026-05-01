"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useAdAccount } from "@/lib/ad-account-context"
import {
  IconPlus, IconTrash, IconLoader2, IconSearch, IconCheck,
  IconLayoutGrid, IconAlertTriangle,
} from "@tabler/icons-react"

interface Preset {
  id: string
  name: string
  objective: string
  targeting: any
  optimization_goal: string
  billing_event: string
  bid_strategy?: string
  adset_name?: string
  campaign_name?: string
  created_at: string
}

interface Campaign { id: string; name: string; status: string; effective_status: string }
interface AdSet { id: string; name: string; status: string; effective_status: string }
interface Ad { id: string; name: string; status: string; creative?: { thumbnail_url?: string; image_url?: string } }

function formatTargeting(targeting: any): string {
  if (!targeting) return "—"
  const parts: string[] = []
  const countries = targeting.geo_locations?.countries
  if (countries?.length) parts.push(countries.join(", "))
  if (targeting.age_min || targeting.age_max) {
    parts.push(`Age ${targeting.age_min || ""}–${targeting.age_max || ""}`)
  }
  const genders = targeting.genders
  if (genders?.length === 1) parts.push(genders[0] === 1 ? "Male" : "Female")
  return parts.join(" · ") || "—"
}

export default function PresetsPage() {
  const { selectedAccountId } = useAdAccount()
  const [presets, setPresets] = useState<Preset[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [importOpen, setImportOpen] = useState(false)

  const fetchPresets = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/presets")
      const d = await res.json()
      setPresets(d.presets || [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchPresets() }, [])

  const handleDelete = async (id: string) => {
    setDeleting(id)
    await fetch(`/api/presets/${id}`, { method: "DELETE" })
    setPresets(prev => prev.filter(p => p.id !== id))
    setDeleting(null)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold">Ad Set Presets</h1>
          <p className="text-sm text-muted-foreground">
            Save targeting &amp; bid settings from existing ad sets. Use them when launching ads — no need to select a template each time.
          </p>
        </div>
        <Button onClick={() => setImportOpen(true)} size="sm">
          <IconPlus className="size-4" /> Import from Facebook
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <IconLoader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : presets.length === 0 ? (
        <div className="rounded-lg border border-dashed p-16 text-center">
          <IconLayoutGrid className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-3 text-sm font-medium">No presets yet</p>
          <p className="mt-1 text-xs text-muted-foreground max-w-xs mx-auto">
            Import settings from an existing Facebook ad set to use as a preset when launching new ads.
          </p>
          <Button size="sm" className="mt-4" onClick={() => setImportOpen(true)}>
            <IconPlus className="size-4" /> Import from Facebook
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {presets.map(p => (
            <div key={p.id} className="flex items-center gap-4 rounded-lg border px-4 py-3 hover:bg-muted/30">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{p.name}</p>
                <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                  <span className="text-xs text-muted-foreground">{p.objective?.replace(/_/g, " ")}</span>
                  <span className="text-xs text-muted-foreground">·</span>
                  <span className="text-xs text-muted-foreground">{formatTargeting(p.targeting)}</span>
                  {p.optimization_goal && (
                    <>
                      <span className="text-xs text-muted-foreground">·</span>
                      <span className="text-xs text-muted-foreground">{p.optimization_goal.replace(/_/g, " ")}</span>
                    </>
                  )}
                  {p.bid_strategy && (
                    <>
                      <span className="text-xs text-muted-foreground">·</span>
                      <span className="text-xs text-muted-foreground">{p.bid_strategy.replace(/_/g, " ")}</span>
                    </>
                  )}
                </div>
                {(p.campaign_name || p.adset_name) && (
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    From: {p.campaign_name} {p.adset_name ? `→ ${p.adset_name}` : ""}
                  </p>
                )}
              </div>
              <Button
                variant="ghost" size="icon" className="size-8 shrink-0"
                onClick={() => handleDelete(p.id)}
                disabled={deleting === p.id}
              >
                {deleting === p.id
                  ? <IconLoader2 className="size-4 animate-spin" />
                  : <IconTrash className="size-4 text-muted-foreground" />}
              </Button>
            </div>
          ))}
        </div>
      )}

      <ImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        adAccountId={selectedAccountId}
        onImported={(preset) => { setPresets(prev => [preset, ...prev]); setImportOpen(false) }}
      />
    </div>
  )
}

function ImportDialog({ open, onClose, adAccountId, onImported }: {
  open: boolean
  onClose: () => void
  adAccountId: string
  onImported: (preset: Preset) => void
}) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [adsets, setAdsets] = useState<AdSet[]>([])
  const [ads, setAds] = useState<Ad[]>([])
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null)
  const [selectedAdset, setSelectedAdset] = useState<AdSet | null>(null)
  const [selectedAd, setSelectedAd] = useState<Ad | null>(null)
  const [searchCampaign, setSearchCampaign] = useState("")
  const [searchAdset, setSearchAdset] = useState("")
  const [searchAd, setSearchAd] = useState("")
  const [loadingC, setLoadingC] = useState(false)
  const [loadingA, setLoadingA] = useState(false)
  const [loadingAd, setLoadingAd] = useState(false)
  const [name, setName] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!open || !adAccountId) return
    setLoadingC(true)
    fetch(`/api/facebook/campaigns?ad_account_id=${adAccountId}`)
      .then(r => r.json())
      .then(d => setCampaigns(d.campaigns || []))
      .finally(() => setLoadingC(false))
    setSelectedCampaign(null); setSelectedAdset(null); setSelectedAd(null)
    setName(""); setError("")
  }, [open, adAccountId])

  useEffect(() => {
    if (!selectedCampaign) { setAdsets([]); setSelectedAdset(null); return }
    setLoadingA(true)
    fetch(`/api/facebook/adsets?ad_account_id=${adAccountId}&campaign_id=${selectedCampaign.id}`)
      .then(r => r.json())
      .then(d => setAdsets(d.adSets || []))
      .finally(() => setLoadingA(false))
    setSelectedAdset(null); setAds([]); setSelectedAd(null)
  }, [selectedCampaign])

  useEffect(() => {
    if (!selectedAdset) { setAds([]); setSelectedAd(null); return }
    setLoadingAd(true)
    fetch(`/api/facebook/ads?ad_account_id=${adAccountId}&adset_id=${selectedAdset.id}`)
      .then(r => r.json())
      .then(d => setAds(d.ads || []))
      .finally(() => setLoadingAd(false))
    setSelectedAd(null)
  }, [selectedAdset])

  useEffect(() => {
    if (selectedAdset && !name) setName(selectedAdset.name)
  }, [selectedAdset])

  const handleSave = async () => {
    if (!selectedAd || !name.trim()) return
    setSaving(true); setError("")
    try {
      const res = await fetch("/api/presets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), adId: selectedAd.id }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error)
      onImported(d.preset)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const filteredC = campaigns.filter(c => c.name.toLowerCase().includes(searchCampaign.toLowerCase()))
  const filteredA = adsets.filter(a => a.name.toLowerCase().includes(searchAdset.toLowerCase()))
  const filteredAd = ads.filter(a => a.name.toLowerCase().includes(searchAd.toLowerCase()))

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="w-[90vw] max-w-4xl h-[80vh] max-h-[80vh] flex flex-col gap-0 p-0 overflow-hidden">
        <DialogHeader className="px-6 py-4 border-b shrink-0">
          <DialogTitle>Import Preset from Facebook</DialogTitle>
          <p className="text-sm text-muted-foreground">Select an existing ad to copy its targeting and bid settings.</p>
        </DialogHeader>

        <div className="flex-1 overflow-auto p-6 space-y-4 min-h-0">
          {/* 3-column picker */}
          <div className="grid grid-cols-3 gap-3 h-72">
            {/* Campaigns */}
            <div className="rounded-lg border flex flex-col overflow-hidden">
              <div className="border-b p-2 font-medium text-sm shrink-0">Campaigns</div>
              <div className="p-2 shrink-0">
                <div className="relative">
                  <IconSearch className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                  <Input value={searchCampaign} onChange={e => setSearchCampaign(e.target.value)} placeholder="Search..." className="h-7 pl-6 text-xs" />
                </div>
              </div>
              <div className="overflow-y-auto flex-1 px-2 pb-2 space-y-0.5">
                {loadingC ? <div className="flex justify-center py-4"><IconLoader2 className="size-4 animate-spin" /></div>
                  : filteredC.map(c => (
                    <button key={c.id} onClick={() => setSelectedCampaign(selectedCampaign?.id === c.id ? null : c)}
                      className={`w-full text-left px-2 py-1.5 rounded text-xs hover:bg-muted break-words leading-tight ${selectedCampaign?.id === c.id ? "bg-primary/10 text-primary font-medium" : ""}`}>
                      {selectedCampaign?.id === c.id && <IconCheck className="inline size-3 mr-1" />}{c.name}
                    </button>
                  ))}
              </div>
            </div>

            {/* Ad Sets */}
            <div className="rounded-lg border flex flex-col overflow-hidden">
              <div className="border-b p-2 font-medium text-sm shrink-0">Ad Sets</div>
              <div className="p-2 shrink-0">
                <div className="relative">
                  <IconSearch className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                  <Input value={searchAdset} onChange={e => setSearchAdset(e.target.value)} placeholder="Search..." className="h-7 pl-6 text-xs" />
                </div>
              </div>
              <div className="overflow-y-auto flex-1 px-2 pb-2 space-y-0.5">
                {!selectedCampaign ? <p className="text-center text-xs text-muted-foreground py-4">Select a campaign first</p>
                  : loadingA ? <div className="flex justify-center py-4"><IconLoader2 className="size-4 animate-spin" /></div>
                  : filteredA.map(a => (
                    <button key={a.id} onClick={() => setSelectedAdset(selectedAdset?.id === a.id ? null : a)}
                      className={`w-full text-left px-2 py-1.5 rounded text-xs hover:bg-muted break-words leading-tight ${selectedAdset?.id === a.id ? "bg-primary/10 text-primary font-medium" : ""}`}>
                      {selectedAdset?.id === a.id && <IconCheck className="inline size-3 mr-1" />}{a.name}
                    </button>
                  ))}
              </div>
            </div>

            {/* Ads */}
            <div className="rounded-lg border flex flex-col overflow-hidden">
              <div className="border-b p-2 font-medium text-sm shrink-0">Ads <span className="text-xs font-normal text-muted-foreground">(pick any one)</span></div>
              <div className="p-2 shrink-0">
                <div className="relative">
                  <IconSearch className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                  <Input value={searchAd} onChange={e => setSearchAd(e.target.value)} placeholder="Search..." className="h-7 pl-6 text-xs" />
                </div>
              </div>
              <div className="overflow-y-auto flex-1 px-2 pb-2 space-y-0.5">
                {!selectedAdset ? <p className="text-center text-xs text-muted-foreground py-4">Select an ad set first</p>
                  : loadingAd ? <div className="flex justify-center py-4"><IconLoader2 className="size-4 animate-spin" /></div>
                  : filteredAd.map(a => (
                    <button key={a.id} onClick={() => setSelectedAd(selectedAd?.id === a.id ? null : a)}
                      className={`w-full text-left px-2 py-1.5 rounded text-xs hover:bg-muted flex items-center gap-2 ${selectedAd?.id === a.id ? "bg-primary/10 text-primary font-medium" : ""}`}>
                      {(a.creative?.thumbnail_url || a.creative?.image_url)
                        ? <img src={a.creative.thumbnail_url || a.creative.image_url} alt="" className="size-8 rounded object-cover shrink-0" />
                        : <div className="size-8 rounded bg-muted shrink-0" />}
                      <span className="break-words min-w-0 leading-tight">
                        {selectedAd?.id === a.id && <IconCheck className="inline size-3 mr-1" />}{a.name}
                      </span>
                    </button>
                  ))}
              </div>
            </div>
          </div>

          {/* Preset name */}
          {selectedAd && (
            <div className="space-y-1.5">
              <p className="text-sm font-medium">Preset Name</p>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. DE - Sales - ROAS 1.5" />
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              <IconAlertTriangle className="size-3.5 shrink-0" />{error}
            </div>
          )}
        </div>

        <div className="border-t px-6 py-3 flex items-center justify-end gap-3 shrink-0">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={!selectedAd || !name.trim() || saving}>
            {saving ? <><IconLoader2 className="size-4 animate-spin" /> Saving...</> : "Save Preset"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
