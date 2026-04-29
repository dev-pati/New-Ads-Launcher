"use client"

import { useEffect, useState } from "react"
import { useOrg } from "@/lib/org-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  IconPlus,
  IconLoader2,
  IconTrash,
  IconExternalLink,
} from "@tabler/icons-react"

interface PageLink {
  id: string
  name: string
  url: string
  created_at: string
}

export default function PagesPage() {
  const { activeOrgId } = useOrg()
  const [pageLinks, setPageLinks] = useState<PageLink[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [formName, setFormName] = useState("")
  const [formUrl, setFormUrl] = useState("")

  const fetchPages = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/page-links")
      const data = await res.json()
      setPageLinks(data.pageLinks || [])
    } catch { /* ignore */ } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchPages() }, [activeOrgId])

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formName.trim() || !formUrl.trim()) return
    setSaving(true)
    try {
      const res = await fetch("/api/page-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: formName.trim(), url: formUrl.trim() }),
      })
      if (res.ok) {
        const data = await res.json()
        setPageLinks(prev => [data.pageLink, ...prev])
        setFormName("")
        setFormUrl("")
        setDialogOpen(false)
      }
    } catch { /* ignore */ } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    setDeleting(id)
    try {
      await fetch(`/api/page-links/${id}`, { method: "DELETE" })
      setPageLinks(prev => prev.filter(p => p.id !== id))
    } catch { /* ignore */ } finally {
      setDeleting(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold">Pages</h1>
          <p className="text-sm text-muted-foreground">
            Manage landing page URLs for your ads.
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <IconPlus className="size-4" />
              Add Page
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Add Page</DialogTitle>
              <DialogDescription>
                Add a landing page URL that can be used in ads.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAdd} className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>Page Name</Label>
                <Input
                  placeholder="Main Landing Page"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>URL</Label>
                <Input
                  type="url"
                  placeholder="https://example.com/landing"
                  value={formUrl}
                  onChange={(e) => setFormUrl(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={saving}>
                {saving ? <IconLoader2 className="size-4 animate-spin" /> : "Add Page"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <IconLoader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : pageLinks.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <IconExternalLink className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-2 text-sm font-medium">No pages yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Add landing page URLs to use in your ads.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {pageLinks.map((p) => (
            <Card key={p.id}>
              <CardContent className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-medium">{p.name}</p>
                  <a
                    href={p.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-500 hover:underline"
                  >
                    {p.url}
                  </a>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  onClick={() => handleDelete(p.id)}
                  disabled={deleting === p.id}
                >
                  {deleting === p.id ? (
                    <IconLoader2 className="size-4 animate-spin" />
                  ) : (
                    <IconTrash className="size-4 text-muted-foreground" />
                  )}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
