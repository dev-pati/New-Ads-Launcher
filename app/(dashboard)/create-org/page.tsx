"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
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
import { IconBuilding, IconLoader2 } from "@tabler/icons-react"

export default function CreateOrgPage() {
  const router = useRouter()
  const { refreshOrgs } = useOrg()
  const [name, setName] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    setLoading(true)
    setError("")
    try {
      const res = await fetch("/api/orgs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || "Failed to create organization")
        return
      }

      // Set active org cookie
      document.cookie = `active_org_id=${data.org.id}; path=/; max-age=${60 * 60 * 24 * 365}`
      await refreshOrgs()
      router.push("/campaigns")
      router.refresh()
    } catch {
      setError("Failed to create organization")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-primary/10">
            <IconBuilding className="size-6 text-primary" />
          </div>
          <CardTitle>Create Organization</CardTitle>
          <CardDescription>
            Create your organization to start managing ads with your team.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="space-y-4">
            {error && (
              <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label>Organization Name</Label>
              <Input
                placeholder="My Agency"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <IconLoader2 className="size-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Organization"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
