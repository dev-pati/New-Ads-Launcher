"use client"

import { useEffect, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { LaunchAdsDialog } from "@/components/launch-ads-dialog"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  IconPhoto,
  IconVideo,
  IconCheck,
  IconRocket,
} from "@tabler/icons-react"

interface Creative {
  id: string
  file_name: string
  file_url: string
  media_type: "image" | "video"
  headline?: string
  primary_text?: string
  cta: string
  link_url?: string
  fb_image_hash?: string
  fb_video_id?: string
  ad_account?: { id: string; name: string }
}

export default function UploadAdsPage() {
  const [creatives, setCreatives] = useState<Creative[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [launchOpen, setLaunchOpen] = useState(false)
  const [adAccountId, setAdAccountId] = useState("")

  useEffect(() => {
    fetch("/api/facebook/upload-credentials")
      .then((r) => r.json())
      .then((d) => { if (d.adAccountId) setAdAccountId(d.adAccountId) })
      .catch(() => {})
  }, [])

  useEffect(() => {
    async function fetch_() {
      try {
        const res = await fetch("/api/creatives")
        const data = await res.json()
        setCreatives(data.creatives || [])
      } catch {
        // ignore
      } finally {
        setLoading(false)
      }
    }
    fetch_()
  }, [])

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

                  {/* Preview */}
                  {c.media_type === "video" ? (
                    <div className="flex h-40 items-center justify-center rounded-t-xl bg-muted">
                      <IconVideo className="size-8 text-muted-foreground" />
                    </div>
                  ) : (
                    <img
                      src={c.file_url}
                      alt={c.file_name}
                      className="h-40 w-full rounded-t-xl object-cover object-center"
                    />
                  )}
                </div>

                <CardContent className="p-3">
                  <p className="truncate text-sm font-medium">{c.file_name}</p>
                  {c.headline && (
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {c.headline}
                    </p>
                  )}
                  <div className="mt-2 flex items-center gap-1.5">
                    <Badge variant="outline" className="text-[10px]">
                      {c.cta.replace(/_/g, " ")}
                    </Badge>
                    {(c.fb_image_hash || c.fb_video_id) && (
                      <Badge variant="default" className="text-[10px] gap-0.5">
                        <IconCheck className="size-2.5" />
                        Meta
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
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
