"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { AppSidebar } from "@/components/app-sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"
import { OrgProvider, useOrg } from "@/lib/org-context"
import { AdAccountProvider } from "@/lib/ad-account-context"
import { IconLoader2, IconAlertTriangle, IconX } from "@tabler/icons-react"

type MetaStatus = { connected: boolean; status: string; message: string | null; accountName: string | null }

function MetaConnectionBanner() {
  const [status, setStatus]   = useState<MetaStatus | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    fetch("/api/meta/connection-status")
      .then(r => r.json())
      .then(d => setStatus(d))
      .catch(() => {})
  }, [])

  if (!status || status.connected || dismissed) return null

  const isBlocked  = status.status === "blocked" || status.status === "restricted"
  const isExpired  = status.status === "expired"

  const bg    = isBlocked  ? "bg-red-50 border-red-300 text-red-800 dark:bg-red-950/30 dark:border-red-700 dark:text-red-300"
              : isExpired  ? "bg-amber-50 border-amber-300 text-amber-800 dark:bg-amber-950/30 dark:border-amber-700 dark:text-amber-300"
              :               "bg-yellow-50 border-yellow-300 text-yellow-800 dark:bg-yellow-950/30 dark:border-yellow-700 dark:text-yellow-300"

  return (
    <div className={`flex items-center gap-2 px-4 py-2 text-sm border-b ${bg}`}>
      <IconAlertTriangle className="size-4 shrink-0" />
      <span className="flex-1">
        {status.accountName && <strong className="mr-1">[{status.accountName}]</strong>}
        {status.message}
      </span>
      <button onClick={() => setDismissed(true)} className="opacity-60 hover:opacity-100">
        <IconX className="size-4" />
      </button>
    </div>
  )
}

function DashboardContent({
  children,
  userName,
  userEmail,
  userAvatarUrl,
}: {
  children: React.ReactNode
  userName?: string
  userEmail?: string
  userAvatarUrl?: string
}) {
  const { hasOrg, loading } = useOrg()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !hasOrg) router.push("/projects")
  }, [loading, hasOrg, router])

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <IconLoader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!hasOrg) return null

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <AppSidebar userName={userName} userEmail={userEmail} userAvatarUrl={userAvatarUrl} />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <MetaConnectionBanner />
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  )
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<{ name?: string; email?: string; avatarUrl?: string } | null>(null)

  useEffect(() => {
    async function getUser() {
      const res = await fetch("/api/auth/me")
      if (res.ok) {
        const { user } = await res.json()
        setUser({
          name: user.full_name || user.email?.split("@")[0],
          email: user.email,
          avatarUrl: user.avatar_url || user.user_metadata?.avatar_url,
        })
      }
    }
    getUser()
  }, [])

  return (
    <OrgProvider>
      <AdAccountProvider>
        <TooltipProvider>
          <DashboardContent userName={user?.name} userEmail={user?.email} userAvatarUrl={user?.avatarUrl}>
            {children}
          </DashboardContent>
        </TooltipProvider>
      </AdAccountProvider>
    </OrgProvider>
  )
}
