"use client"

import { useCallback, useEffect, useState } from "react"
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import {
  IconUsers,
  IconPlus,
  IconTrash,
  IconLoader2,
  IconMail,
  IconUserPlus,
} from "@tabler/icons-react"

interface Member {
  id: string
  role: string
  joined_at: string
  user: {
    id: string
    full_name: string
    avatar_url?: string
  }
}

interface AvailableAccount {
  id: string
  email: string
  full_name?: string | null
  avatar_url?: string | null
  created_at: string
}

export default function OrganizationPage() {
  const { activeOrgId, activeOrg } = useOrg()
  const [members, setMembers] = useState<Member[]>([])
  const [availableAccounts, setAvailableAccounts] = useState<AvailableAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteRole, setInviteRole] = useState("editor")
  const [selectedAccountId, setSelectedAccountId] = useState("")
  const [existingRole, setExistingRole] = useState("editor")
  const [inviting, setInviting] = useState(false)
  const [addingExisting, setAddingExisting] = useState(false)
  const [removing, setRemoving] = useState<string | null>(null)
  const [message, setMessage] = useState("")
  const isAdmin = activeOrg?.role === "admin"

  const fetchMembers = useCallback(async () => {
    if (!activeOrgId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/orgs/${activeOrgId}/members`)
      const data = await res.json()
      setMembers(data.members || [])
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [activeOrgId])

  const fetchAvailableAccounts = useCallback(async () => {
    if (!activeOrgId || !isAdmin) {
      setAvailableAccounts([])
      setSelectedAccountId("")
      return
    }

    try {
      const res = await fetch(`/api/orgs/${activeOrgId}/members?available=true`)
      if (!res.ok) {
        setAvailableAccounts([])
        return
      }
      const data = await res.json()
      setAvailableAccounts(data.accounts || [])
      setSelectedAccountId((current) => (
        (data.accounts || []).some((account: AvailableAccount) => account.id === current)
          ? current
          : ""
      ))
    } catch {
      setAvailableAccounts([])
    }
  }, [activeOrgId, isAdmin])

  useEffect(() => {
    fetchMembers()
    fetchAvailableAccounts()
  }, [fetchMembers, fetchAvailableAccounts])

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inviteEmail || !activeOrgId) return

    setInviting(true)
    setMessage("")
    try {
      const res = await fetch(`/api/orgs/${activeOrgId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      })
      const data = await res.json()

      if (!res.ok) {
        setMessage(data.error || "Failed to invite")
        return
      }

      if (data.added) {
        setMessage("Member added successfully!")
        fetchMembers()
        fetchAvailableAccounts()
      } else {
        setMessage("Invitation sent!")
      }
      setInviteEmail("")
    } catch {
      setMessage("Failed to invite member")
    } finally {
      setInviting(false)
    }
  }

  const handleAddExisting = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedAccountId || !activeOrgId) return

    setAddingExisting(true)
    setMessage("")
    try {
      const res = await fetch(`/api/orgs/${activeOrgId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: selectedAccountId, role: existingRole }),
      })
      const data = await res.json()

      if (!res.ok) {
        setMessage(data.error || "Failed to add account")
        return
      }

      setMessage("Member added successfully!")
      setSelectedAccountId("")
      fetchMembers()
      fetchAvailableAccounts()
    } catch {
      setMessage("Failed to add account")
    } finally {
      setAddingExisting(false)
    }
  }

  const handleRemove = async (memberId: string) => {
    if (!activeOrgId) return
    setRemoving(memberId)
    try {
      await fetch(`/api/orgs/${activeOrgId}/members?member_id=${memberId}`, {
        method: "DELETE",
      })
      setMembers((prev) => prev.filter((m) => m.id !== memberId))
      fetchAvailableAccounts()
    } catch {
      // ignore
    } finally {
      setRemoving(null)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">Organization</h1>
        <p className="text-sm text-muted-foreground">
          Manage your team members and permissions.
        </p>
      </div>

      {/* Org Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IconUsers className="size-5" />
            {activeOrg?.name || "Organization"}
          </CardTitle>
          <CardDescription>
            Current organization. Members can collaborate on creatives in real-time.
          </CardDescription>
        </CardHeader>
      </Card>

      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IconUserPlus className="size-5" />
              Add Existing Account
            </CardTitle>
            <CardDescription>
              Add a registered account that is not yet a member of this organization.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddExisting} className="flex items-end gap-3">
              <div className="min-w-0 flex-1 space-y-2">
                <Label>Account</Label>
                <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select an account" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableAccounts.length === 0 ? (
                      <SelectItem value="none" disabled>
                        No accounts available
                      </SelectItem>
                    ) : (
                      availableAccounts.map((account) => (
                        <SelectItem key={account.id} value={account.id}>
                          {account.full_name ? `${account.full_name} - ${account.email}` : account.email}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-32 space-y-2">
                <Label>Role</Label>
                <Select value={existingRole} onValueChange={setExistingRole}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="editor">Editor</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                type="submit"
                disabled={addingExisting || !selectedAccountId || availableAccounts.length === 0}
              >
                {addingExisting ? (
                  <IconLoader2 className="size-4 animate-spin" />
                ) : (
                  <IconPlus className="size-4" />
                )}
                Add
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Invite Member */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IconMail className="size-5" />
            Invite Member
          </CardTitle>
          <CardDescription>
            Add a team member by email. If they already have an account, they will be added immediately.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleInvite} className="flex items-end gap-3">
            <div className="flex-1 space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                placeholder="colleague@example.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                required
              />
            </div>
            <div className="w-32 space-y-2">
              <Label>Role</Label>
              <Select value={inviteRole} onValueChange={setInviteRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="editor">Editor</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" disabled={inviting}>
              {inviting ? (
                <IconLoader2 className="size-4 animate-spin" />
              ) : (
                <IconPlus className="size-4" />
              )}
              Invite
            </Button>
          </form>
          {message && (
            <p className="mt-2 text-sm text-muted-foreground">{message}</p>
          )}
        </CardContent>
      </Card>

      {/* Members List */}
      <Card>
        <CardHeader>
          <CardTitle>Members ({members.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <IconLoader2 className="size-4 animate-spin" />
              Loading members...
            </div>
          ) : (
            <div className="space-y-3">
              {members.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex size-8 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
                      {m.user?.full_name?.charAt(0)?.toUpperCase() || "?"}
                    </div>
                    <div>
                      <p className="text-sm font-medium">
                        {m.user?.full_name || "Unknown"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Joined {new Date(m.joined_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={m.role === "admin" ? "default" : "secondary"}>
                      {m.role}
                    </Badge>
                    {members.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        onClick={() => handleRemove(m.id)}
                        disabled={removing === m.id}
                      >
                        {removing === m.id ? (
                          <IconLoader2 className="size-3.5 animate-spin" />
                        ) : (
                          <IconTrash className="size-3.5 text-muted-foreground" />
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
