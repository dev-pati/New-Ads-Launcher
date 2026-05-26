"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { AppSidebar } from "@/components/app-sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"
import { OrgProvider, useOrg } from "@/lib/org-context"
import { AdAccountProvider } from "@/lib/ad-account-context"
import { IconLoader2 } from "@tabler/icons-react"

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
      <main className="flex-1 overflow-auto min-w-0">
        {children}
      </main>
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
