"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { createClient } from "@/lib/supabase/client"
import { TooltipProvider } from "@/components/ui/tooltip"
import { OrgProvider, useOrg } from "@/lib/org-context"
import { IconLoader2 } from "@tabler/icons-react"

function DashboardContent({ children, userName, userEmail }: {
  children: React.ReactNode
  userName?: string
  userEmail?: string
}) {
  const { hasOrg, loading } = useOrg()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !hasOrg) {
      router.push("/projects")
    }
  }, [loading, hasOrg, router])

  if (loading) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <IconLoader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!hasOrg) return null

  return (
    <SidebarProvider>
      <AppSidebar userName={userName} userEmail={userEmail} />
      <SidebarInset>
        <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
        </header>
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  )
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [user, setUser] = useState<{ name?: string; email?: string } | null>(null)

  useEffect(() => {
    async function getUser() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUser({
          name: user.user_metadata?.full_name || user.email?.split("@")[0],
          email: user.email,
        })
      }
    }
    getUser()
  }, [])

  return (
    <OrgProvider>
      <TooltipProvider>
        <DashboardContent userName={user?.name} userEmail={user?.email}>
          {children}
        </DashboardContent>
      </TooltipProvider>
    </OrgProvider>
  )
}
