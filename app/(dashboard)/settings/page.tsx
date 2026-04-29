"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  IconBrandFacebook,
  IconCheck,
  IconLoader2,
  IconUsers,
  IconPlus,
  IconTrash,
  IconMail,
  IconRefresh,
  IconClock,
  IconAlertTriangle,
} from "@tabler/icons-react"

interface FbConnection {
  connected: boolean
  user?: { id: string; name: string; picture?: string }
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

interface Invitation {
  id: string
  email: string
  role: string
  created_at: string
  expires_at: string
}

export default function SettingsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { activeOrgId, activeOrg } = useOrg()

  // Facebook connection
  const [connection, setConnection] = useState<FbConnection>({ connected: false })
  const [fbLoading, setFbLoading] = useState(true)
  const [disconnecting, setDisconnecting] = useState(false)

  // Members
  const [members, setMembers] = useState<Member[]>([])
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [membersLoading, setMembersLoading] = useState(true)
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteRole, setInviteRole] = useState("editor")
  const [inviting, setInviting] = useState(false)
  const [removing, setRemoving] = useState<string | null>(null)
  const [resending, setResending] = useState<string | null>(null)
  const [deletingInvite, setDeletingInvite] = useState<string | null>(null)
  const [message, setMessage] = useState("")

  // Delete org
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteStep, setDeleteStep] = useState(1) // 1: warning, 2: type name, 3: final confirm
  const [deleteConfirmName, setDeleteConfirmName] = useState("")
  const [deleting, setDeleting] = useState(false)

  // Fetch Facebook connection
  useEffect(() => {
    async function check() {
      try {
        const res = await fetch("/api/facebook/connection")
        const data = await res.json()
        setConnection(data)
      } catch { /* ignore */ } finally {
        setFbLoading(false)
      }
    }
    check()
  }, [searchParams])

  // Fetch members + invitations
  const fetchMembers = async () => {
    if (!activeOrgId) return
    setMembersLoading(true)
    try {
      const [membersRes, invitationsRes] = await Promise.all([
        fetch(`/api/orgs/${activeOrgId}/members`),
        fetch(`/api/orgs/${activeOrgId}/invitations`),
      ])
      const membersData = await membersRes.json()
      const invitationsData = await invitationsRes.json()
      setMembers(membersData.members || [])
      setInvitations(invitationsData.invitations || [])
    } catch { /* ignore */ } finally {
      setMembersLoading(false)
    }
  }

  useEffect(() => { fetchMembers() }, [activeOrgId])

  const handleConnect = () => { window.location.href = "/api/auth/facebook" }

  const handleDisconnect = async () => {
    setDisconnecting(true)
    try {
      await fetch("/api/facebook/connection", { method: "DELETE" })
      setConnection({ connected: false })
    } catch { /* ignore */ } finally {
      setDisconnecting(false)
    }
  }

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
    } catch {
      setMessage("Failed to invite member")
    } finally {
      setInviting(false)
    }
  }

  const handleRemove = async (memberId: string) => {
    if (!activeOrgId) return
    setRemoving(memberId)
    try {
      await fetch(`/api/orgs/${activeOrgId}/members?member_id=${memberId}`, { method: "DELETE" })
      setMembers((prev) => prev.filter((m) => m.id !== memberId))
    } catch { /* ignore */ } finally {
      setRemoving(null)
    }
  }

  const handleDeleteInvitation = async (invitationId: string) => {
    if (!activeOrgId) return
    setDeletingInvite(invitationId)
    try {
      await fetch(`/api/orgs/${activeOrgId}/invitations?invitation_id=${invitationId}`, { method: "DELETE" })
      setInvitations((prev) => prev.filter((i) => i.id !== invitationId))
    } catch { /* ignore */ } finally {
      setDeletingInvite(null)
    }
  }

  const handleResendInvitation = async (invitationId: string) => {
    if (!activeOrgId) return
    setResending(invitationId)
    try {
      await fetch(`/api/orgs/${activeOrgId}/invitations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invitation_id: invitationId }),
      })
      setMessage("Invitation resent!")
      fetchMembers()
    } catch { /* ignore */ } finally {
      setResending(null)
    }
  }

  const isExpired = (expiresAt: string) => new Date(expiresAt) < new Date()

  const handleDeleteOrg = async () => {
    if (!activeOrgId || deleteConfirmName !== activeOrg?.name) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/orgs/${activeOrgId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmName: deleteConfirmName }),
      })
      if (res.ok) {
        document.cookie = "active_org_id=; path=/; max-age=0"
        router.push("/projects")
        router.refresh()
      }
    } catch { /* ignore */ } finally {
      setDeleting(false)
    }
  }

  const openDeleteDialog = () => {
    setDeleteStep(1)
    setDeleteConfirmName("")
    setDeleteDialogOpen(true)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage connections, team members, and organization settings.
        </p>
      </div>

      <Tabs defaultValue="team">
        <TabsList>
          <TabsTrigger value="team">
            <IconUsers className="mr-1.5 size-4" />
            Team
          </TabsTrigger>
          <TabsTrigger value="connections">
            <IconBrandFacebook className="mr-1.5 size-4" />
            Connections
          </TabsTrigger>
        </TabsList>

        {/* Team Tab */}
        <TabsContent value="team" className="space-y-6 mt-6">
          {/* Org Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <IconUsers className="size-5" />
                {activeOrg?.name || "Organization"}
              </CardTitle>
              <CardDescription>
                Manage your team members and permissions.
              </CardDescription>
            </CardHeader>
          </Card>

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
                  {inviting ? <IconLoader2 className="size-4 animate-spin" /> : <IconPlus className="size-4" />}
                  Invite
                </Button>
              </form>
              {message && <p className="mt-2 text-sm text-muted-foreground">{message}</p>}
            </CardContent>
          </Card>

          {/* Members + Pending Invitations */}
          <Card>
            <CardHeader>
              <CardTitle>
                Members ({members.length})
                {invitations.length > 0 && (
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    + {invitations.length} pending
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {membersLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <IconLoader2 className="size-4 animate-spin" />
                  Loading members...
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Active members */}
                  {members.map((m) => (
                    <div key={m.id} className="flex items-center justify-between rounded-lg border p-3">
                      <div className="flex items-center gap-3">
                        <div className="flex size-8 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
                          {m.user?.full_name?.charAt(0)?.toUpperCase() || "?"}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{m.user?.full_name || "Unknown"}</p>
                          <p className="text-xs text-muted-foreground">
                            Joined {new Date(m.joined_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={m.role === "admin" ? "default" : "secondary"}>{m.role}</Badge>
                        {members.length > 1 && (
                          <Button variant="ghost" size="icon" className="size-8" onClick={() => handleRemove(m.id)} disabled={removing === m.id}>
                            {removing === m.id ? <IconLoader2 className="size-3.5 animate-spin" /> : <IconTrash className="size-3.5 text-muted-foreground" />}
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}

                  {/* Pending invitations */}
                  {invitations.map((inv) => (
                    <div key={inv.id} className="flex items-center justify-between rounded-lg border border-dashed p-3">
                      <div className="flex items-center gap-3">
                        <div className="flex size-8 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
                          <IconMail className="size-3.5" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">{inv.email}</p>
                          <p className="flex items-center gap-1 text-xs text-muted-foreground">
                            <IconClock className="size-3" />
                            {isExpired(inv.expires_at) ? (
                              <span className="text-destructive">Expired</span>
                            ) : (
                              <>Expires {new Date(inv.expires_at).toLocaleDateString()}</>
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-amber-600 border-amber-300">pending</Badge>
                        <Badge variant="secondary">{inv.role}</Badge>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          title="Resend invitation"
                          onClick={() => handleResendInvitation(inv.id)}
                          disabled={resending === inv.id}
                        >
                          {resending === inv.id ? <IconLoader2 className="size-3.5 animate-spin" /> : <IconRefresh className="size-3.5 text-muted-foreground" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          title="Cancel invitation"
                          onClick={() => handleDeleteInvitation(inv.id)}
                          disabled={deletingInvite === inv.id}
                        >
                          {deletingInvite === inv.id ? <IconLoader2 className="size-3.5 animate-spin" /> : <IconTrash className="size-3.5 text-muted-foreground" />}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          {/* Danger Zone */}
          <Card className="border-destructive/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <IconAlertTriangle className="size-5" />
                Danger Zone
              </CardTitle>
              <CardDescription>
                Permanently delete this organization and all its data.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="destructive" onClick={openDeleteDialog}>
                <IconTrash className="size-4" />
                Delete Organization
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Connections Tab */}
        <TabsContent value="connections" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <IconBrandFacebook className="size-5 text-[#1877F2]" />
                Facebook Connection
              </CardTitle>
              <CardDescription>
                Connect your Facebook account to manage ads and campaigns.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {fbLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <IconLoader2 className="size-4 animate-spin" />
                  Checking connection...
                </div>
              ) : connection.connected ? (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {connection.user?.picture && (
                      <img src={connection.user.picture} alt={connection.user.name} className="size-10 rounded-full" />
                    )}
                    <div>
                      <div className="flex items-center gap-1.5">
                        <IconCheck className="size-4 text-green-500" />
                        <span className="font-medium">{connection.user?.name}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">Facebook account connected</p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={handleDisconnect} disabled={disconnecting}>
                    {disconnecting ? "Disconnecting..." : "Disconnect"}
                  </Button>
                </div>
              ) : (
                <Button onClick={handleConnect} className="bg-[#1877F2] text-white hover:bg-[#166FE5]">
                  <IconBrandFacebook className="size-4" />
                  Connect with Facebook
                </Button>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Delete Organization Dialog - Multi-step */}
      <Dialog open={deleteDialogOpen} onOpenChange={(open) => { if (!open) { setDeleteDialogOpen(false); setDeleteStep(1); setDeleteConfirmName("") } }}>
        <DialogContent className="max-w-md">
          {deleteStep === 1 && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-destructive">
                  <IconAlertTriangle className="size-5" />
                  Delete Organization
                </DialogTitle>
                <DialogDescription>
                  Are you sure you want to delete <strong>{activeOrg?.name}</strong>? This action will permanently remove:
                </DialogDescription>
              </DialogHeader>
              <ul className="space-y-1.5 text-sm text-muted-foreground pl-4 list-disc">
                <li>All team members and invitations</li>
                <li>All creatives and ad campaigns</li>
                <li>All Facebook connections and settings</li>
                <li>All page links and configurations</li>
              </ul>
              <p className="text-sm font-medium text-destructive">This action cannot be undone.</p>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
                <Button variant="destructive" onClick={() => setDeleteStep(2)}>I understand, continue</Button>
              </div>
            </>
          )}

          {deleteStep === 2 && (
            <>
              <DialogHeader>
                <DialogTitle>Confirm by typing the organization name</DialogTitle>
                <DialogDescription>
                  Type <strong className="text-foreground">{activeOrg?.name}</strong> to confirm deletion.
                </DialogDescription>
              </DialogHeader>
              <Input
                placeholder="Type organization name..."
                value={deleteConfirmName}
                onChange={(e) => setDeleteConfirmName(e.target.value)}
                autoFocus
              />
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setDeleteStep(1)}>Back</Button>
                <Button
                  variant="destructive"
                  disabled={deleteConfirmName !== activeOrg?.name}
                  onClick={() => setDeleteStep(3)}
                >
                  Next
                </Button>
              </div>
            </>
          )}

          {deleteStep === 3 && (
            <>
              <DialogHeader>
                <DialogTitle className="text-destructive">Final Confirmation</DialogTitle>
                <DialogDescription>
                  You are about to permanently delete <strong className="text-foreground">{activeOrg?.name}</strong> and all associated data. This is your last chance to cancel.
                </DialogDescription>
              </DialogHeader>
              <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-4 text-center">
                <IconAlertTriangle className="mx-auto size-8 text-destructive" />
                <p className="mt-2 text-sm font-medium">This will permanently delete everything.</p>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
                <Button variant="destructive" onClick={handleDeleteOrg} disabled={deleting}>
                  {deleting ? <IconLoader2 className="size-4 animate-spin" /> : <IconTrash className="size-4" />}
                  Delete Forever
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
