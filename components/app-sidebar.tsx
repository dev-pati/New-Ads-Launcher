"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { useOrg } from "@/lib/org-context"
import { useTheme } from "next-themes"
import { useUserSettings } from "@/hooks/use-user-settings"
import { cn } from "@/lib/utils"
import {
  IconRocket,
  IconPhoto,
  IconChartBar,
  IconBolt,
  IconLink,
  IconBulb,
  IconSearch,
  IconGift,
  IconSettings,
  IconBell,
  IconChevronLeft,
  IconChevronRight,
  IconSun,
  IconMoon,
  IconLogout,
} from "@tabler/icons-react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

type SubItem = { label: string; href: string }
type NavSection = {
  id: string
  label: string
  icon: React.ElementType
  subItems: SubItem[]
}

const navSections: NavSection[] = [
  {
    id: "launch",
    label: "Launch",
    icon: IconRocket,
    subItems: [
      { label: "Ad Launcher", href: "/launch" },
      { label: "Ads Manager", href: "/ads-manager" },
      { label: "Templates", href: "/templates" },
    ],
  },
  {
    id: "assets",
    label: "Assets",
    icon: IconPhoto,
    subItems: [
      { label: "All Assets", href: "/assets" },
      { label: "Boards", href: "/assets/boards" },
      { label: "My Uploads", href: "/assets/my-uploads" },
    ],
  },
  {
    id: "insights",
    label: "Insights",
    icon: IconChartBar,
    subItems: [
      { label: "Top Ads", href: "/insights" },
      { label: "Statistics", href: "/insights/statistics" },
      { label: "Comments", href: "/insights/comments" },
    ],
  },
  {
    id: "automate",
    label: "Automate",
    icon: IconBolt,
    subItems: [
      { label: "Automations", href: "/automate" },
      { label: "Rules", href: "/automate/rules" },
    ],
  },
  {
    id: "connect",
    label: "Connect",
    icon: IconLink,
    subItems: [
      { label: "Ad Channels", href: "/connect" },
      { label: "Media", href: "/connect/media" },
      { label: "API", href: "/connect/api" },
      { label: "MCP", href: "/connect/mcp" },
    ],
  },
  {
    id: "inspo",
    label: "Inspo",
    icon: IconBulb,
    subItems: [
      { label: "Ad Scan", href: "/inspo" },
      { label: "AI", href: "/inspo/ai" },
      { label: "Brand Spy", href: "/inspo/brand-spy" },
      { label: "Saved Ads", href: "/inspo/saved" },
    ],
  },
]

const bottomNav = [
  { label: "Search", href: "/search", icon: IconSearch },
  { label: "Rewards", href: "/rewards", icon: IconGift },
  { label: "Settings", href: "/settings", icon: IconSettings },
]

function getActiveSection(pathname: string): string {
  if (pathname.startsWith("/launch") || pathname.startsWith("/ads-manager") || pathname.startsWith("/templates")) return "launch"
  if (pathname.startsWith("/assets")) return "assets"
  if (pathname.startsWith("/insights")) return "insights"
  if (pathname.startsWith("/automate")) return "automate"
  if (pathname.startsWith("/connect")) return "connect"
  if (pathname.startsWith("/inspo")) return "inspo"
  if (pathname.startsWith("/search")) return "search"
  if (pathname.startsWith("/rewards")) return "rewards"
  if (pathname.startsWith("/settings")) return "settings"
  return "launch"
}

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
  const [collapsed, setCollapsed] = useState(false)
  const activeSection = getActiveSection(pathname)

  useEffect(() => {
    if (settings?.theme && settings.theme !== "system") setTheme(settings.theme)
  }, [settings?.theme, setTheme])

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/auth/login")
    router.refresh()
  }

  const toggleTheme = () => {
    const newTheme = resolvedTheme === "dark" ? "light" : "dark"
    setTheme(newTheme)
    updateSettings({ theme: newTheme })
  }

  const orgInitials = activeOrg?.name ? activeOrg.name.slice(0, 2).toUpperCase() : "AD"
  const userInitials = userName ? userName.slice(0, 2).toUpperCase() : (userEmail ? userEmail.slice(0, 2).toUpperCase() : "??")

  return (
    <aside
      className={cn(
        "flex flex-col h-full shrink-0 bg-sidebar border-r border-sidebar-border transition-[width] duration-200 ease-in-out overflow-hidden",
        collapsed ? "w-[60px]" : "w-[210px]"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 h-12 border-b border-sidebar-border shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="size-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold text-xs shrink-0">
            {orgInitials}
          </div>
          {!collapsed && (
            <span className="font-heading text-sm font-semibold text-sidebar-foreground truncate">
              {activeOrg?.name || "Workspace"}
            </span>
          )}
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          {!collapsed && (
            <button
              className="size-6 flex items-center justify-center rounded hover:bg-sidebar-accent text-sidebar-foreground/50 hover:text-sidebar-foreground transition-colors"
              title="Notifications"
            >
              <IconBell className="size-3.5" />
            </button>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="size-6 flex items-center justify-center rounded hover:bg-sidebar-accent text-sidebar-foreground/50 hover:text-sidebar-foreground transition-colors"
          >
            {collapsed ? <IconChevronRight className="size-3.5" /> : <IconChevronLeft className="size-3.5" />}
          </button>
        </div>
      </div>

      {/* Main nav */}
      <nav className="flex-1 overflow-y-auto py-2 space-y-0.5">
        {navSections.map((section) => {
          const isActive = activeSection === section.id
          const Icon = section.icon

          if (collapsed) {
            return (
              <Tooltip key={section.id} delayDuration={0}>
                <TooltipTrigger asChild>
                  <Link
                    href={section.subItems[0].href}
                    className={cn(
                      "flex items-center justify-center h-10 mx-2 rounded-lg transition-colors",
                      isActive
                        ? "bg-sidebar-primary text-sidebar-primary-foreground"
                        : "text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                    )}
                  >
                    <Icon className="size-[18px]" />
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right" className="font-medium">
                  {section.label}
                </TooltipContent>
              </Tooltip>
            )
          }

          return (
            <div key={section.id}>
              {/* Section header row */}
              <Link
                href={section.subItems[0].href}
                className={cn(
                  "flex items-center gap-2.5 h-9 px-3 mx-2 rounded-lg text-sm font-medium transition-colors",
                  isActive
                    ? "text-foreground"
                    : "text-sidebar-foreground/55 hover:text-sidebar-foreground hover:bg-sidebar-accent"
                )}
              >
                <Icon className={cn("size-4 shrink-0", isActive ? "text-primary" : "")} />
                <span>{section.label}</span>
              </Link>

              {/* Sub-items */}
              {isActive && (
                <div className="ml-5 mt-0.5 mb-1">
                  {/* Launch stats widget */}
                  {section.id === "launch" && (
                    <div className="mx-2 mb-2 rounded-lg bg-sidebar-accent px-3 py-2">
                      <p className="text-[10px] font-medium text-sidebar-foreground/40 uppercase tracking-wide mb-1.5">
                        Your team's last 30d
                      </p>
                      <div className="flex items-center gap-4">
                        <div>
                          <div className="text-xs font-bold text-sidebar-foreground">—</div>
                          <div className="text-[9px] text-sidebar-foreground/45">Ads</div>
                        </div>
                        <div>
                          <div className="text-xs font-bold text-sidebar-foreground">—</div>
                          <div className="text-[9px] text-sidebar-foreground/45">Batches</div>
                        </div>
                        <div>
                          <div className="text-xs font-bold text-sidebar-foreground">—</div>
                          <div className="text-[9px] text-sidebar-foreground/45">Saved</div>
                        </div>
                      </div>
                    </div>
                  )}

                  {section.subItems.map((sub) => {
                    const isSubActive = pathname === sub.href || pathname.startsWith(sub.href + "/")
                    return (
                      <Link
                        key={sub.href}
                        href={sub.href}
                        className={cn(
                          "flex items-center h-8 px-3 rounded-lg text-sm transition-colors mb-0.5",
                          isSubActive
                            ? "bg-sidebar-primary text-sidebar-primary-foreground font-medium"
                            : "text-sidebar-foreground/65 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                        )}
                      >
                        {sub.label}
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </nav>

      {/* Bottom nav */}
      <div className="border-t border-sidebar-border py-1.5">
        {bottomNav.map((item) => {
          const Icon = item.icon
          const isActive = pathname.startsWith(item.href)
          if (collapsed) {
            return (
              <Tooltip key={item.href} delayDuration={0}>
                <TooltipTrigger asChild>
                  <Link
                    href={item.href}
                    className={cn(
                      "flex items-center justify-center h-9 mx-2 rounded-lg transition-colors",
                      isActive
                        ? "bg-sidebar-primary text-sidebar-primary-foreground"
                        : "text-sidebar-foreground/55 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                    )}
                  >
                    <Icon className="size-4" />
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right">{item.label}</TooltipContent>
              </Tooltip>
            )
          }
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 h-9 px-3 mx-2 rounded-lg text-sm transition-colors",
                isActive
                  ? "bg-sidebar-primary text-sidebar-primary-foreground font-medium"
                  : "text-sidebar-foreground/55 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              )}
            >
              <Icon className="size-4" />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </div>

      {/* User footer */}
      <div className="border-t border-sidebar-border p-2">
        <div className={cn("flex items-center gap-2", collapsed && "justify-center")}>
          <div className="size-7 rounded-full bg-primary/15 flex items-center justify-center text-primary text-xs font-semibold shrink-0">
            {userInitials}
          </div>
          {!collapsed && (
            <>
              <div className="flex-1 min-w-0">
                {userName && <p className="text-xs font-medium text-sidebar-foreground truncate">{userName}</p>}
                {userEmail && <p className="text-[10px] text-sidebar-foreground/45 truncate">{userEmail}</p>}
              </div>
              <div className="flex items-center gap-0.5 shrink-0">
                <button
                  onClick={toggleTheme}
                  className="size-6 flex items-center justify-center rounded hover:bg-sidebar-accent text-sidebar-foreground/50 hover:text-sidebar-foreground transition-colors"
                >
                  {resolvedTheme === "dark" ? <IconSun className="size-3.5" /> : <IconMoon className="size-3.5" />}
                </button>
                <button
                  onClick={handleLogout}
                  className="size-6 flex items-center justify-center rounded hover:bg-sidebar-accent text-sidebar-foreground/50 hover:text-sidebar-foreground transition-colors"
                >
                  <IconLogout className="size-3.5" />
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </aside>
  )
}
