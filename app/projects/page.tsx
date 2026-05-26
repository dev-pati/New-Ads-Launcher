"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  IconBuilding,
  IconPlus,
  IconUsers,
  IconLogout,
  IconLoader2,
  IconChevronRight,
  IconArrowLeft,
  IconTrash,
  IconAlertTriangle,
} from "@tabler/icons-react"
import Image from "next/image"
import Link from "next/link"

interface Org {
  id: string
  name: string
  slug: string
  role: string
  created_at: string
  member_count?: number
}

export default function HomePage() {
  const router = useRouter()
  const [orgs, setOrgs] = useState<Org[]>([])
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<{ name?: string; email?: string } | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [newOrgName, setNewOrgName] = useState("")
  const [creating, setCreating] = useState(false)
  const [deleteOrg, setDeleteOrg] = useState<Org | null>(null)
  const [deleteConfirmName, setDeleteConfirmName] = useState("")
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    async function init() {
      const me = await fetch("/api/auth/me")
      const { user } = me.ok ? await me.json() : { user: null }

      if (user) {
        setUser({
          name: user.full_name || user.email?.split("@")[0],
          email: user.email,
        })
      }

      try {
        const res = await fetch("/api/orgs")
        const data = await res.json()
        setOrgs(data.orgs || [])
      } catch {
        // ignore
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [])

  const handleSelectOrg = (org: Org) => {
    document.cookie = `active_org_id=${org.id}; path=/; max-age=${60 * 60 * 24 * 365}`
    router.push("/launch")
  }

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newOrgName.trim()) return

    setCreating(true)
    try {
      const res = await fetch("/api/orgs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newOrgName.trim() }),
      })
      const data = await res.json()

      if (res.ok) {
        setOrgs((prev) => [...prev, { ...data.org, role: "admin" }])
        setNewOrgName("")
        setDialogOpen(false)
      }
    } catch {
      // ignore
    } finally {
      setCreating(false)
    }
  }

  const handleDeleteOrg = async () => {
    if (!deleteOrg || deleteConfirmName !== deleteOrg.name) return

    setDeleting(true)
    try {
      const res = await fetch(`/api/orgs/${deleteOrg.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmName: deleteConfirmName }),
      })

      if (res.ok) {
        setOrgs((prev) => prev.filter((org) => org.id !== deleteOrg.id))
        document.cookie = "active_org_id=; path=/; max-age=0"
        setDeleteOrg(null)
        setDeleteConfirmName("")
      }
    } catch {
      // ignore
    } finally {
      setDeleting(false)
    }
  }

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" })
    router.push("/auth/login")
  }

  return (
    <div className="min-h-svh bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <Image src="/applogo.webp" className="bg-white" alt="Logo" width={28} height={28} />
            <span className="font-heading text-lg font-semibold">AdLauncher</span>
          </div>
          <div className="flex items-center gap-3">
            {user && (
              <div className="text-right text-sm">
                <span className="font-semibold text-foreground block md:inline md:mr-1.5">{user.name}</span>
                <span className="text-xs text-muted-foreground">({user.email})</span>
              </div>
            )}
            <Button variant="ghost" size="icon" onClick={handleLogout} title="Logout">
              <IconLogout className="size-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="mx-auto max-w-4xl px-6 py-10">
        <Link href="/" className="mb-4 text-sm flex items-center gap-2">
          <IconArrowLeft className="size-3" />
          Back to Home
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-heading text-2xl font-bold">Organizations</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Select an organization to manage your ads.
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <IconPlus className="size-4" />
                Create Organization
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle>Create Organization</DialogTitle>
                <DialogDescription>
                  Create a new organization to collaborate with your team.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateOrg} className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label>Organization Name</Label>
                  <Input
                    placeholder="My Agency"
                    value={newOrgName}
                    onChange={(e) => setNewOrgName(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={creating}>
                  {creating ? (
                    <IconLoader2 className="size-4 animate-spin" />
                  ) : (
                    "Create"
                  )}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Org list */}
        <div className="mt-8">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <IconLoader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : orgs.length === 0 ? (
            <div className="rounded-lg border border-dashed p-12 text-center">
              <IconBuilding className="mx-auto size-10 text-muted-foreground" />
              <p className="mt-3 text-sm font-medium">No organizations yet</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Create your first organization to get started.
              </p>
              <Button className="mt-4" onClick={() => setDialogOpen(true)}>
                <IconPlus className="size-4" />
                Create Organization
              </Button>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {orgs.map((org) => (
                <Card
                  key={org.id}
                  className="cursor-pointer transition-all hover:shadow-md hover:border-primary/50"
                  onClick={() => handleSelectOrg(org)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
                        <IconBuilding className="size-5 text-primary" />
                      </div>
                      <div className="flex items-center gap-1">
                        {org.role === "admin" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 text-muted-foreground hover:text-destructive"
                            onClick={(event) => {
                              event.stopPropagation()
                              setDeleteOrg(org)
                              setDeleteConfirmName("")
                            }}
                            title="Delete organization"
                          >
                            <IconTrash className="size-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-muted-foreground"
                          onClick={(event) => {
                            event.stopPropagation()
                            handleSelectOrg(org)
                          }}
                          title="Open organization"
                        >
                          <IconChevronRight className="size-4" />
                        </Button>
                      </div>
                    </div>
                    <CardTitle className="mt-3 text-lg">{org.name}</CardTitle>
                    <CardDescription className="flex items-center gap-1">
                      <IconUsers className="size-3.5" />
                      {org.role === "admin" ? "Admin" : "Editor"}
                    </CardDescription>
                  </CardHeader>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>

      <Dialog
        open={!!deleteOrg}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteOrg(null)
            setDeleteConfirmName("")
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <IconAlertTriangle className="size-5" />
              Delete Organization
            </DialogTitle>
            <DialogDescription>
              This will permanently delete <strong>{deleteOrg?.name}</strong> and all associated data.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Type the organization name to confirm deletion.
            </p>
            <Input
              placeholder={deleteOrg?.name || "Organization name"}
              value={deleteConfirmName}
              onChange={(e) => setDeleteConfirmName(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setDeleteOrg(null)
                setDeleteConfirmName("")
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteOrg}
              disabled={deleting || deleteConfirmName !== deleteOrg?.name}
            >
              {deleting ? <IconLoader2 className="size-4 animate-spin" /> : <IconTrash className="size-4" />}
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
