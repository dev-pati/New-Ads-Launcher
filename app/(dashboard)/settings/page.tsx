"use client"

import { Suspense, useEffect, useState } from "react"
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
  IconKey,
  IconEye,
  IconEyeOff,
  IconCopy,
  IconSparkles,
  IconExternalLink,
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

function SettingsContent() {
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
  const [messageType, setMessageType] = useState<"success" | "error">("success")

  // AI Keys
  const [geminiKey, setGeminiKey] = useState("")
  const [geminiKeyVisible, setGeminiKeyVisible] = useState(false)
  const [openaiKey, setOpenaiKey] = useState("")
  const [openaiKeyVisible, setOpenaiKeyVisible] = useState(false)
  const [loadingAiKeys, setLoadingAiKeys] = useState(true)
  const [savingAiKeys, setSavingAiKeys] = useState(false)
  const [aiKeysSaved, setAiKeysSaved] = useState(false)
  const [aiKeysError, setAiKeysError] = useState("")

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

  useEffect(() => {
    async function fetchAiKeys() {
      setLoadingAiKeys(true)
      try {
        const res = await fetch("/api/settings/ai-keys")
        const data = await res.json()
        setGeminiKey(data.gemini_api_key ?? "")
        setOpenaiKey(data.openai_api_key ?? "")
      } catch { /* ignore */ } finally {
        setLoadingAiKeys(false)
      }
    }
    fetchAiKeys()
  }, [])

  const handleSaveAiKeys = async () => {
    setSavingAiKeys(true)
    setAiKeysError("")
    setAiKeysSaved(false)
    try {
      const res = await fetch("/api/settings/ai-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gemini_api_key: geminiKey, openai_api_key: openaiKey }),
      })
      if (!res.ok) {
        const d = await res.json()
        setAiKeysError(d.error || "Failed to save")
      } else {
        setAiKeysSaved(true)
        setTimeout(() => setAiKeysSaved(false), 3000)
      }
    } catch {
      setAiKeysError("Network error")
    } finally {
      setSavingAiKeys(false)
    }
  }

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
      if (!res.ok) { setMessageType("error"); setMessage(data.error || "Failed to invite"); return }
      if (data.emailWarning) {
        setMessageType("error"); setMessage(data.emailWarning)
      } else {
        setMessageType("success"); setMessage(data.added ? "Member added successfully!" : "Invitation sent!")
      }
      setInviteEmail("")
      fetchMembers()
    } catch {
      setMessageType("error"); setMessage("Failed to invite member")
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
          <TabsTrigger value="ai-keys">
            <IconKey className="mr-1.5 size-4" />
            AI Keys
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
              {message && (
                <p className={`mt-2 text-sm font-medium ${messageType === "success" ? "text-emerald-600" : "text-destructive"}`}>
                  {messageType === "success" ? "✓ " : "✕ "}{message}
                </p>
              )}
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

        {/* AI Keys Tab */}
        <TabsContent value="ai-keys" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <IconSparkles className="size-5 text-primary" />
                AI API Keys
              </CardTitle>
              <CardDescription>
                Configure API keys for AI features (Generate ad copy, Analyze ads, AI Variations).
                Keys are stored per organization and override the server default.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {loadingAiKeys ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <IconLoader2 className="size-4 animate-spin" />Loading...
                </div>
              ) : (
                <>
                  {/* Gemini Key */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="flex items-center gap-2">
                        <img src="https://www.gstatic.com/lamda/images/gemini_sparkle_v002_d4735304ff6292a690345.svg" alt="Gemini" className="size-4" />
                        Google Gemini API Key
                      </Label>
                      <a
                        href="https://aistudio.google.com/app/apikey"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline flex items-center gap-1"
                      >
                        Get key <IconExternalLink className="size-3" />
                      </a>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Used for: Generate ad copy, Analyze ads, AI Variations. Get a key at{" "}
                      <strong>aistudio.google.com</strong> (free tier available, add billing for more quota).
                    </p>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Input
                          type={geminiKeyVisible ? "text" : "password"}
                          value={geminiKey}
                          onChange={e => setGeminiKey(e.target.value)}
                          placeholder="AIzaSy..."
                          className="pr-20 font-mono text-sm"
                        />
                        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setGeminiKeyVisible(v => !v)}
                            className="text-muted-foreground hover:text-foreground p-1"
                          >
                            {geminiKeyVisible ? <IconEyeOff className="size-3.5" /> : <IconEye className="size-3.5" />}
                          </button>
                          {geminiKey && (
                            <button
                              type="button"
                              onClick={() => navigator.clipboard.writeText(geminiKey)}
                              className="text-muted-foreground hover:text-foreground p-1"
                            >
                              <IconCopy className="size-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                    {geminiKey && (
                      <div className="flex items-center gap-1.5 text-xs text-emerald-600">
                        <IconCheck className="size-3.5" />
                        Key configured
                      </div>
                    )}
                  </div>

                  <div className="border-t pt-5 space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="flex items-center gap-2">
                        <svg className="size-4" viewBox="0 0 24 24" fill="currentColor"><path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z"/></svg>
                        OpenAI API Key
                      </Label>
                      <a
                        href="https://platform.openai.com/api-keys"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline flex items-center gap-1"
                      >
                        Get key <IconExternalLink className="size-3" />
                      </a>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Used for: Generate ad copy (URL), Analyze ads, AI Variations. <strong>Recommended</strong> — faster and more stable than Gemini for text tasks. Model: gpt-4o-mini.
                    </p>
                    <div className="relative flex-1">
                      <Input
                        type={openaiKeyVisible ? "text" : "password"}
                        value={openaiKey}
                        onChange={e => setOpenaiKey(e.target.value)}
                        placeholder="sk-proj-..."
                        className="pr-20 font-mono text-sm"
                      />
                      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                        <button type="button" onClick={() => setOpenaiKeyVisible(v => !v)} className="text-muted-foreground hover:text-foreground p-1">
                          {openaiKeyVisible ? <IconEyeOff className="size-3.5" /> : <IconEye className="size-3.5" />}
                        </button>
                        {openaiKey && (
                          <button type="button" onClick={() => navigator.clipboard.writeText(openaiKey)} className="text-muted-foreground hover:text-foreground p-1">
                            <IconCopy className="size-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                    {openaiKey && (
                      <div className="flex items-center gap-1.5 text-xs text-emerald-600">
                        <IconCheck className="size-3.5" />
                        Key configured — OpenAI will be used for text generation
                      </div>
                    )}
                  </div>

                  {aiKeysError && (
                    <p className="text-sm text-destructive">{aiKeysError}</p>
                  )}

                  <Button onClick={handleSaveAiKeys} disabled={savingAiKeys} className="gap-2">
                    {savingAiKeys ? (
                      <><IconLoader2 className="size-4 animate-spin" />Saving...</>
                    ) : aiKeysSaved ? (
                      <><IconCheck className="size-4" />Saved!</>
                    ) : (
                      <><IconKey className="size-4" />Save API Keys</>
                    )}
                  </Button>
                </>
              )}
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

export default function SettingsPage() {
  return (
    <Suspense>
      <SettingsContent />
    </Suspense>
  )
}
