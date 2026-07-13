"use client"

import { useEffect, useState, useRef } from "react"
import { useAdAccount } from "@/lib/ad-account-context"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { LaunchAdsDialog } from "@/components/launch-ads-dialog"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  IconPhoto,
  IconCheck,
  IconBrandGoogleDrive, IconLoader2, IconRocket,
} from "@tabler/icons-react"
import { CreativeCardMedia } from "@/components/creative-card-media"

interface Creative {
  id: string
  file_name: string
  file_url: string
  media_type: "image" | "video"
  headline?: string
  primary_text?: string
  cta: string
  link_url?: string
  fb_image_url?: string
  fb_thumbnail_url?: string
  fb_image_hash?: string
  fb_video_id?: string
  ad_account?: { id: string; name: string }
}

const PAGE_SIZE = 20

export default function UploadAdsPage() {
  const { selectedAccountId: adAccountId } = useAdAccount()
  const [creatives, setCreatives] = useState<Creative[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [launchOpen, setLaunchOpen] = useState(false)

  const [gdriveImporting, setGdriveImporting] = useState(false)
  const gdriveScriptsReady = useRef(false)
  const gdriveTokenRef = useRef<string | null>(null)

  const fetchCreatives = async (cursor: string | null, reset: boolean) => {
    if (reset) setLoading(true); else setLoadingMore(true)
    try {
      const params = new URLSearchParams({ ad_account_id: adAccountId, limit: String(PAGE_SIZE) })
      if (cursor) params.set("cursor", cursor)
      const res = await fetch(`/api/creatives?${params}`)
      const data = await res.json()
      const list: Creative[] = data.creatives || []
      setCreatives(prev => reset ? list : [...prev, ...list])
      setNextCursor(data.nextCursor ?? null)
      setHasMore(data.hasMore ?? false)

      // Poll thumbnails only for videos in this batch with exponential backoff
      const RETRY_DELAYS = [10_000, 30_000, 60_000, 120_000, 240_000]
      const videosMissingThumb = list.filter(c => c.media_type === "video" && !!(c as any).fb_video_id && !c.fb_thumbnail_url)
      for (const c of videosMissingThumb) {
        let attempt = 0
        const poll = () => {
          if (attempt >= RETRY_DELAYS.length) return
          setTimeout(async () => {
            if (document.hidden) { poll(); return }  // skip API call when tab not visible, retry same delay
            try {
              const d = await fetch(`/api/creatives/${c.id}/thumbnail`, { method: "POST" }).then(r => r.json())
              if (d.thumbnail_url || d.source_url) {
                setCreatives(prev => prev.map(x => x.id === c.id ? { ...x, fb_thumbnail_url: d.thumbnail_url || x.fb_thumbnail_url, file_url: d.source_url || x.file_url || d.thumbnail_url } : x))
                if (d.thumbnail_url && d.source_url) return
              }
              attempt++; poll()
            } catch { attempt++; poll() }
          }, RETRY_DELAYS[attempt])
        }
        poll()
      }
    } catch { /* ignore */ } finally {
      setLoading(false); setLoadingMore(false)
    }
  }

  useEffect(() => {
    if (!adAccountId) return
    setCreatives([]); setSelected(new Set()); setNextCursor(null); setHasMore(false)
    fetchCreatives(null, true)
  }, [adAccountId])

  // ── Google Drive Picker ──────────────────────────────────────────
  const loadGoogleScript = (src: string) => new Promise<void>((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return }
    const s = document.createElement("script")
    s.src = src; s.async = true
    s.onload = () => resolve(); s.onerror = reject
    document.head.appendChild(s)
  })

  const openGoogleDrivePicker = async () => {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || ""
    if (!clientId) {
      alert("Missing Google Client ID in environment variables")
      return
    }

    if (!gdriveScriptsReady.current) {
      setGdriveImporting(true)
      try {
        await Promise.all([
          loadGoogleScript("https://apis.google.com/js/api.js"),
          loadGoogleScript("https://accounts.google.com/gsi/client"),
        ])
        gdriveScriptsReady.current = true
      } catch (e) {
        setGdriveImporting(false)
        alert("Failed to load Google API scripts")
        return
      }
      setGdriveImporting(false)
    }

    try {
      const getToken = () => new Promise<string>((resolve, reject) => {
        const tc = (window as any).google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: "https://www.googleapis.com/auth/drive.readonly",
          callback: (resp: any) => {
            if (resp.error) { reject(new Error(resp.error)); return }
            gdriveTokenRef.current = resp.access_token
            resolve(resp.access_token)
          },
        })
        tc.requestAccessToken({ prompt: gdriveTokenRef.current ? "" : "consent" })
      })

      const token = gdriveTokenRef.current || await getToken()

      await new Promise<void>(resolve => (window as any).gapi.load("picker", resolve))

      const P = (window as any).google.picker
      const picker = new P.PickerBuilder()
        .addView(
          new P.DocsView()
            .setIncludeFolders(true)
            .setMimeTypes("image/jpeg,image/png,image/gif,image/webp,video/mp4,video/quicktime,video/x-msvideo")
        )
        .addView(new P.DocsView(P.ViewId.DOCS_IMAGES_AND_VIDEOS))
        .setOAuthToken(token)
        .enableFeature(P.Feature.MULTISELECT_ENABLED)
        .setCallback(async (data: any) => {
          if (data.action !== P.Action.PICKED) return
          const files = data.docs as { id: string; name: string; mimeType: string }[]
          
          setGdriveImporting(true)
          for (const f of files) {
            try {
              const res = await fetch("/api/google/import-drive", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  accessToken: gdriveTokenRef.current,
                  fileId: f.id,
                  fileName: f.name,
                  mimeType: f.mimeType,
                  adAccountId,
                }),
              })
              if (res.ok) {
                const d = await res.json()
                // Auto-add to grid and select it!
                setCreatives(prev => [d.creative, ...prev])
                setSelected(prev => new Set([...prev, d.creative.id]))
              } else {
                const errData = await res.json()
                console.error("Drive import failed for", f.name, errData)
              }
            } catch (err: any) {
              console.error("Drive import error for", f.name, err)
            }
          }
          setGdriveImporting(false)
        })
        .build()
      picker.setVisible(true)
    } catch (err: any) {
      console.error("Google Drive connection failed", err)
      setGdriveImporting(false)
    }
  }

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectAll = () => {
    if (selected.size === creatives.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(creatives.map((c) => c.id)))
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold">Upload Ads</h1>
          <p className="text-sm text-muted-foreground">
            Select creatives to create and launch ads on Facebook.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button size="sm" variant="outline" onClick={openGoogleDrivePicker} disabled={gdriveImporting}>
            {gdriveImporting ? (
              <IconLoader2 className="size-4 animate-spin" />
            ) : (
              <IconBrandGoogleDrive className="size-4 text-[#4285F4]" />
            )}
            Import from Drive
          </Button>
          {selected.size > 0 && (
            <span className="text-sm text-muted-foreground">
              {selected.size} selected
            </span>
          )}
          <Button size="sm" disabled={selected.size === 0} onClick={() => setLaunchOpen(true)}>
            <IconRocket className="size-4" />
            Launch Ads ({selected.size})
          </Button>
        </div>
      </div>

      {/* Select all */}
      {creatives.length > 0 && (
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={selectAll}>
            {selected.size === creatives.length ? "Deselect All" : "Select All"}
          </Button>
        </div>
      )}

      {/* Grid of creatives */}
      {loading ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {[...Array(8)].map((_, i) => (
            <Skeleton key={i} className="h-64 rounded-lg" />
          ))}
        </div>
      ) : creatives.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <IconPhoto className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-2 text-sm font-medium">No creatives available</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Go to Ads Manager to upload creatives first.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {creatives.map((c) => {
            const isSelected = selected.has(c.id)
            return (
              <Card
                key={c.id}
                className={`cursor-pointer transition-all hover:shadow-md pt-0 ${
                  isSelected ? "ring-2 ring-primary" : ""
                }`}
                onClick={() => toggleSelect(c.id)}
              >
                <div className="relative">
                  {/* Selection indicator */}
                  <div
                    className={`absolute top-2 right-2 z-10 flex size-6 items-center justify-center rounded-full border-2 transition-colors ${
                      isSelected
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-muted-foreground/30 bg-background/80"
                    }`}
                  >
                    {isSelected && <IconCheck className="size-3.5" />}
                  </div>

                  <CreativeCardMedia creative={c} className="h-40 w-full rounded-t-xl object-cover object-center" />
                </div>

                <CardContent className="p-3">
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <p className="truncate text-sm font-semibold" title={c.file_name}>{c.file_name}</p>
                    {(c.fb_image_hash || c.fb_video_id) ? (
                      <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 shrink-0 text-xs gap-0.5 h-5 px-1.5 font-medium border-emerald-200 border">
                        <IconCheck className="size-3" />
                        Ready
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50 shrink-0 text-xs h-5 px-1.5 font-medium">
                        Pending
                      </Badge>
                    )}
                  </div>
                  
                  <div className="space-y-1.5 h-[2.5rem] flex flex-col justify-center">
                    {c.headline ? (
                      <p className="truncate text-xs text-muted-foreground" title={c.headline}>
                        <span className="font-medium text-foreground/70">Headline:</span> {c.headline}
                      </p>
                    ) : (
                       <p className="text-xs text-muted-foreground/40 italic">
                         No headline
                       </p>
                    )}
                    {c.primary_text && (
                      <p className="truncate text-xs text-muted-foreground" title={c.primary_text}>
                        <span className="font-medium text-foreground/70">Text:</span> {c.primary_text}
                      </p>
                    )}
                  </div>

                  <div className="mt-3 pt-2.5 border-t flex items-center justify-between">
                    <Badge variant="outline" className="text-xs font-normal bg-muted/30">
                      CTA: <span className="font-semibold ml-1">{c.cta ? c.cta.replace(/_/g, " ") : "LEARN MORE"}</span>
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {hasMore && (
        <div className="flex justify-center pt-2">
          <Button variant="outline" size="sm" onClick={() => fetchCreatives(nextCursor, false)} disabled={loadingMore} className="gap-2 min-w-[140px]">
            {loadingMore ? <><IconLoader2 className="size-3.5 animate-spin" />Loading…</> : `Load More (${creatives.length} loaded)`}
          </Button>
        </div>
      )}

      <LaunchAdsDialog
        open={launchOpen}
        onClose={() => setLaunchOpen(false)}
        selectedCreativeIds={Array.from(selected)}
        adAccountId={adAccountId}
      />
    </div>
  )
}
