"use client"

import { useEffect, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import Link from "next/link"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import {
  IconTargetArrow,
  IconAd2,
  IconBrandFacebook,
  IconLogout,
  IconCheck,
  IconSettings,
  IconUpload,
  IconArrowLeft,
  IconExternalLink,
  IconSun,
  IconMoon,
  IconLayoutGrid,
} from "@tabler/icons-react"
import { createClient } from "@/lib/supabase/client"
import { useOrg } from "@/lib/org-context"
import { useTheme } from "next-themes"
import { useUserSettings } from "@/hooks/use-user-settings"
import Image from "next/image"

const navItems = [
  { title: "Campaigns", href: "/campaigns", icon: IconTargetArrow },
  { title: "Ads Manager", href: "/ads", icon: IconAd2 },
  { title: "Upload Ads", href: "/upload-ads", icon: IconUpload },
  { title: "Presets", href: "/presets", icon: IconLayoutGrid },
  { title: "Pages", href: "/pages", icon: IconExternalLink },
  { title: "Settings", href: "/settings", icon: IconSettings, adminOnly: true },
] as const

interface AppSidebarProps {
  userName?: string
  userEmail?: string
}

export function AppSidebar({ userName, userEmail }: AppSidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { activeOrg } = useOrg()
  const { resolvedTheme, setTheme } = useTheme()
  const { settings, updateSettings } = useUserSettings()
  const [fbConnection, setFbConnection] = useState<{
    connected: boolean
    name?: string
    picture?: string
  }>({ connected: false })

  // Apply saved theme from DB on load
  useEffect(() => {
    if (settings?.theme && settings.theme !== "system") {
      setTheme(settings.theme)
    }
  }, [settings?.theme, setTheme])

  useEffect(() => {
    async function checkFbConnection() {
      try {
        const res = await fetch("/api/facebook/connection")
        const data = await res.json()
        if (data.connected) {
          setFbConnection({
            connected: true,
            name: data.user?.name,
            picture: data.user?.picture,
          })
        }
      } catch {
        // ignore
      }
    }
    checkFbConnection()
  }, [])

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/auth/login")
    router.refresh()
  }

  const handleConnectFb = () => {
    window.location.href = "/api/auth/facebook"
  }

  return (
    <Sidebar>
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-2">
          <Image
            src="/applogo.webp"
            alt="Logo"
            width={32}
            height={32}
            className="bg-white"
          />
          <span className="font-heading text-base font-semibold">
            AdLauncher
          </span>
        </div>
        {/* Org info + back */}
        {activeOrg && (
          <div className="flex items-center gap-2 px-2 pb-1">
            <Link
              href="/projects"
              className="flex size-7 items-center justify-center rounded hover:bg-muted"
            >
              <IconArrowLeft className="size-3.5 text-muted-foreground" />
            </Link>
            <span className="truncate text-xs font-medium text-muted-foreground">
              {activeOrg.name}
            </span>
          </div>
        )}
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.filter((item) => !("adminOnly" in item && item.adminOnly) || activeOrg?.role === "admin").map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={
                      pathname === item.href ||
                      (item.href !== "/settings" &&
                        pathname.startsWith(item.href))
                    }
                  >
                    <Link href={item.href}>
                      <item.icon className="size-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="gap-3">
        {/* Facebook Connection Block */}
        <div className="mx-2 rounded-lg border bg-card p-3">
          {fbConnection.connected ? (
            <div className="flex flex-col items-center gap-2 text-center">
              {fbConnection.picture ? (
                <img
                  src={fbConnection.picture}
                  alt={fbConnection.name || ""}
                  className="size-10 rounded-full"
                />
              ) : (
                <div className="flex size-10 items-center justify-center rounded-full bg-[#1877F2]/10">
                  <IconBrandFacebook className="size-5 text-[#1877F2]" />
                </div>
              )}
              <div>
                <div className="flex items-center justify-center gap-1">
                  <IconCheck className="size-3.5 text-green-500" />
                  <span className="text-xs font-medium text-green-600">
                    Connected
                  </span>
                </div>
                <p className="mt-0.5 text-sm ">
                  {fbConnection.name}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 text-center">
              <div className="flex size-10 items-center justify-center rounded-full bg-[#1877F2]/10">
                <IconBrandFacebook className="size-5 text-[#1877F2]" />
              </div>
              <p className="text-xs text-muted-foreground">
                Connect to Facebook
              </p>
              <Button
                size="sm"
                className="w-full bg-[#1877F2] text-white hover:bg-[#166FE5]"
                onClick={handleConnectFb}
              >
                <IconBrandFacebook className="size-3.5" />
                Connect
              </Button>
            </div>
          )}
        </div>

        {/* User info + Logout */}
        <div className="flex items-center justify-between px-2 pb-1">
          <div className="min-w-0">
            {userName && (
              <p className="truncate text-sm font-medium">{userName}</p>
            )}
            {userEmail && (
              <p className="truncate text-xs text-muted-foreground">
                {userEmail}
              </p>
            )}
          </div>
          <div className="flex shrink-0 items-center">
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={() => {
                const newTheme = resolvedTheme === "dark" ? "light" : "dark"
                setTheme(newTheme)
                updateSettings({ theme: newTheme })
              }}
              title="Toggle theme"
            >
              {resolvedTheme === "dark" ? <IconSun className="size-4" /> : <IconMoon className="size-4" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={handleLogout}
              title="Logout"
            >
              <IconLogout className="size-4" />
            </Button>
          </div>
        </div>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}
