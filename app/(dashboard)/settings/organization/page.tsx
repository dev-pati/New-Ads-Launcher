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
import {
  IconUsers,
  IconPlus,
  IconTrash,
  IconLoader2,
  IconMail,
  IconUserPlus,
} from "@tabler/icons-react"

const ROLES = [
  { value: "admin",     label: "Admin",     description: "Full access. Can invite/remove members, manage settings, launch ads, edit ads, and delete ads." },
  { value: "editor",    label: "Editor",    description: "Can create workspaces, manage integrations, launch ads, edit ads in Manage, and delete ads." },
  { value: "launcher",  label: "Launcher",  description: "Can launch ads and edit ads in Manage. Cannot delete ads or manage team/workspace settings." },
  { value: "uploader",  label: "Uploader",  description: "Can upload media and content. Cannot launch, edit, or delete ads." },
  { value: "analyst",   label: "Analyst",   description: "Can view reports and statistics. Cannot launch, edit, or delete ads." },
  { value: "commenter", label: "Commenter", description: "Can view and write comments. Cannot launch, edit, or delete ads." },
]

function RoleBadge({ role }: { role: string }) {
  const cls: Record<string, string> = {
    admin:     "bg-primary text-primary-foreground",
    editor:    "bg-secondary text-secondary-foreground",
    launcher:  "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
    uploader:  "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
    analyst:   "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
    commenter: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  }
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${cls[role] ?? cls.editor}`}>
      {role}
    </span>
  )
}

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
  const [updatingRole, setUpdatingRole] = useState<string | null>(null)
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
      if (!res.ok) { setAvailableAccounts([]); return }
      const data = await res.json()
      setAvailableAccounts(data.accounts || [])
      setSelectedAccountId((current) => (
        (data.accounts || []).some((a: AvailableAccount) => a.id === current) ? current : ""
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
      if (!res.ok) { setMessage(data.error || "Failed to invite"); return }
      setMessage(data.added ? "Member added successfully!" : "Invitation sent!")
      setInviteEmail("")
      fetchMembers()
      fetchAvailableAccounts()
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
      if (!res.ok) { setMessage(data.error || "Failed to add account"); return }
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

  const handleUpdateRole = async (memberId: string, newRole: string) => {
    if (!activeOrgId) return
    setUpdatingRole(memberId)
    try {
      await fetch(`/api/orgs/${activeOrgId}/members`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ member_id: memberId, role: newRole }),
      })
      setMembers((prev) => prev.map((m) => m.id === memberId ? { ...m, role: newRole } : m))
    } catch {
      // ignore
    } finally {
      setUpdatingRole(null)
    }
  }

  const handleRemove = async (memberId: string) => {
    if (!activeOrgId) return
    setRemoving(memberId)
    try {
      await fetch(`/api/orgs/${activeOrgId}/members?member_id=${memberId}`, { method: "DELETE" })
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

      {/* Add Existing Account */}
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
                      <SelectItem value="none" disabled>No accounts available</SelectItem>
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
              <div className="w-44 space-y-2">
                <Label>Role</Label>
                <Select value={existingRole} onValueChange={setExistingRole}>
                  <SelectTrigger>
                    <SelectValue>{ROLES.find(r => r.value === existingRole)?.label}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => (
                      <SelectItem key={r.value} value={r.value} textValue={r.label}>
                        <div>
                          <p className="font-medium">{r.label}</p>
                          <p className="text-xs text-muted-foreground">{r.description}</p>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" disabled={addingExisting || !selectedAccountId || availableAccounts.length === 0}>
                {addingExisting ? <IconLoader2 className="size-4 animate-spin" /> : <IconPlus className="size-4" />}
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
            <div className="w-44 space-y-2">
              <Label>Role</Label>
              <Select value={inviteRole} onValueChange={setInviteRole}>
                <SelectTrigger>
                  <SelectValue>{ROLES.find(r => r.value === inviteRole)?.label}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r.value} value={r.value} textValue={r.label}>
                      <div>
                        <p className="font-medium">{r.label}</p>
                        <p className="text-xs text-muted-foreground">{r.description}</p>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" disabled={inviting}>
              {inviting ? <IconLoader2 className="size-4 animate-spin" /> : <IconPlus className="size-4" />}
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
                <div key={m.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex items-center gap-3">
                    {m.user?.avatar_url ? (
                      <img src={m.user.avatar_url} alt={m.user.full_name || ""} className="size-8 rounded-full object-cover" />
                    ) : (
                      <div className="flex size-8 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
                        {m.user?.full_name?.charAt(0)?.toUpperCase() || "?"}
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-medium">{m.user?.full_name || "Unknown"}</p>
                      <p className="text-xs text-muted-foreground">
                        Joined {new Date(m.joined_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isAdmin ? (
                      <div className="relative">
                        {updatingRole === m.id && (
                          <IconLoader2 className="absolute right-7 top-1/2 size-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />
                        )}
                        <Select
                          value={m.role}
                          onValueChange={(val) => handleUpdateRole(m.id, val)}
                          disabled={updatingRole === m.id}
                        >
                          <SelectTrigger className="h-7 w-32 text-xs">
                            <SelectValue>{ROLES.find(r => r.value === m.role)?.label ?? m.role}</SelectValue>
                          </SelectTrigger>
                          <SelectContent align="end">
                            {ROLES.map((r) => (
                              <SelectItem key={r.value} value={r.value} textValue={r.label}>
                                <div>
                                  <p className="font-medium">{r.label}</p>
                                  <p className="text-xs text-muted-foreground">{r.description}</p>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ) : (
                      <RoleBadge role={m.role} />
                    )}
                    {isAdmin && members.length > 1 && (
                      <Button variant="ghost" size="icon" className="size-8" onClick={() => handleRemove(m.id)} disabled={removing === m.id}>
                        {removing === m.id ? <IconLoader2 className="size-3.5 animate-spin" /> : <IconTrash className="size-3.5 text-muted-foreground" />}
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
