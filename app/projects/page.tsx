"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
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

  useEffect(() => {
    async function init() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        setUser({
          name: user.user_metadata?.full_name || user.email?.split("@")[0],
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

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
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
              <span className="text-sm text-muted-foreground">{user.email}</span>
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
                      <IconChevronRight className="size-4 text-muted-foreground" />
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
    </div>
  )
}
