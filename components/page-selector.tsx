"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { IconCheck, IconLoader2 } from "@tabler/icons-react"

interface Page {
  id: string
  name: string
  access_token: string
  category: string
  picture?: { data: { url: string } }
}

interface PageSelectorProps {
  isConnected: boolean
  selectedPageId?: string
  onPageSelected?: (page: Page) => void
}

export function PageSelector({
  isConnected,
  selectedPageId,
  onPageSelected,
}: PageSelectorProps) {
  const [pages, setPages] = useState<Page[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isConnected) return

    async function fetchPages() {
      // Check shared sessionStorage cache (same key as launch/page.tsx)
      try {
        const cached = sessionStorage.getItem("fb_pages_cache")
        if (cached) {
          const { ts, pages: p } = JSON.parse(cached)
          if (Date.now() - ts < 10 * 60 * 1000 && Array.isArray(p)) {
            setPages(p)
            return
          }
        }
        // Also respect rate-limit cooldown
        const rl = sessionStorage.getItem("fb_pages_ratelimit")
        if (rl && Date.now() - parseInt(rl, 10) < 5 * 60 * 1000) {
          setError("Facebook API rate limit active. Try again in a few minutes.")
          return
        }
      } catch {}

      setLoading(true)
      setError(null)
      try {
        const res = await fetch("/api/facebook/pages")
        const data = await res.json()
        if (!res.ok) throw new Error(data.error)
        setPages(data.pages)
        try { sessionStorage.setItem("fb_pages_cache", JSON.stringify({ ts: Date.now(), pages: data.pages })) } catch {}
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load pages")
      } finally {
        setLoading(false)
      }
    }

    fetchPages()
  }, [isConnected])

  const handleSelectPage = async (page: Page) => {
    setSaving(page.id)
    try {
      const res = await fetch("/api/facebook/select-page", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pageId: page.id,
          pageName: page.name,
          // pageAccessToken intentionally omitted — server resolves token
          pageCategory: page.category,
          pagePictureUrl: page.picture?.data?.url,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error)
      }

      onPageSelected?.(page)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to select page")
    } finally {
      setSaving(null)
    }
  }

  if (!isConnected) {
    return (
      <Card className="opacity-60">
        <CardHeader>
          <CardTitle>Select a Page</CardTitle>
          <CardDescription>
            Connect your Facebook account first to see your pages.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No account connected</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Select a Page</CardTitle>
        <CardDescription>
          Choose the Facebook Page you want to use for launching ads.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading && (
          <div className="flex items-center gap-2 py-8 justify-center text-muted-foreground">
            <IconLoader2 className="size-4 animate-spin" />
            Loading your pages...
          </div>
        )}

        {error && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {!loading && !error && pages.length === 0 && (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No pages found. Make sure you have admin access to at least one
            Facebook Page.
          </p>
        )}

        {!loading && pages.length > 0 && (
          <div className="space-y-2">
            {pages.map((page) => {
              const isSelected = selectedPageId === page.id
              return (
                <div
                  key={page.id}
                  className={`flex items-center justify-between rounded-lg border p-3 transition-colors ${
                    isSelected
                      ? "border-primary bg-primary/5"
                      : "hover:bg-muted/50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {page.picture?.data?.url ? (
                      <img
                        src={page.picture.data.url}
                        alt={page.name}
                        className="size-10 rounded-full"
                      />
                    ) : (
                      <div className="flex size-10 items-center justify-center rounded-full bg-muted text-sm font-medium">
                        {page.name.charAt(0)}
                      </div>
                    )}
                    <div>
                      <p className="font-medium">{page.name}</p>
                      <Badge variant="secondary" className="text-xs">
                        {page.category}
                      </Badge>
                    </div>
                  </div>

                  {isSelected ? (
                    <div className="flex items-center gap-1.5 text-sm text-primary">
                      <IconCheck className="size-4" />
                      Selected
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSelectPage(page)}
                      disabled={saving === page.id}
                    >
                      {saving === page.id ? (
                        <IconLoader2 className="size-3 animate-spin" />
                      ) : (
                        "Select"
                      )}
                    </Button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
