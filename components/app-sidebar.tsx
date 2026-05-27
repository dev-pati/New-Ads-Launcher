"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useOrg } from "@/lib/org-context"
import { useTheme } from "next-themes"
import { useUserSettings } from "@/hooks/use-user-settings"
import { useNotifications } from "@/hooks/use-notifications"
import { NotificationsDropdown } from "@/components/notifications-dropdown"
import { cn } from "@/lib/utils"
import {
  IconRocket,
  IconPhoto,
  IconChartBar,
  IconBolt,
  IconLink,
  IconBulb,
  IconSearch,
  IconBuilding,
  IconGift,
  IconSettings,
  IconBell,
  IconChevronLeft,
  IconChevronRight,
  IconCreditCard,
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
    ],
  },
  {
    id: "insights",
    label: "Insights",
    icon: IconChartBar,
    subItems: [
      { label: "Insights", href: "/insights" },
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
      { label: "Connect", href: "/connect" },
      { label: "Rate Limit", href: "/rate-limit" },
    ],
  },
  {
    id: "ad-accounts",
    label: "Ad Accounts",
    icon: IconCreditCard,
    subItems: [
      { label: "Ad Accounts", href: "/ad-accounts" },
    ],
  },
  {
    id: "inspo",
    label: "Inspo",
    icon: IconBulb,
    subItems: [
      { label: "Inspo", href: "/inspo" },
    ],
  },
]

const bottomNav = [
  { label: "Project", href: "/projects", icon: IconBuilding },
  { label: "Search", href: "/search", icon: IconSearch },
  { label: "Rewards", href: "/rewards", icon: IconGift },
  { label: "Settings", href: "/settings", icon: IconSettings },
]

function getActiveSection(pathname: string): string {
  if (pathname.startsWith("/launch") || pathname.startsWith("/ads-manager") || pathname.startsWith("/templates")) return "launch"
  if (pathname.startsWith("/assets")) return "assets"
  if (pathname.startsWith("/insights")) return "insights"
  if (pathname.startsWith("/automate")) return "automate"
  if (pathname.startsWith("/connect") || pathname.startsWith("/rate-limit")) return "connect"
  if (pathname.startsWith("/ad-accounts")) return "ad-accounts"
  if (pathname.startsWith("/inspo")) return "inspo"
  if (pathname.startsWith("/project")) return "projects"
  if (pathname.startsWith("/search")) return "search"
  if (pathname.startsWith("/rewards")) return "rewards"
  if (pathname.startsWith("/settings")) return "settings"
  return "launch"
}

interface AppSidebarProps {
  userName?: string
  userEmail?: string
  userAvatarUrl?: string
}

export function AppSidebar({ userName, userEmail, userAvatarUrl }: AppSidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { activeOrg } = useOrg()
  const { resolvedTheme, setTheme } = useTheme()
  const { settings, updateSettings } = useUserSettings()
  const [collapsed, setCollapsed] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const { unreadCount } = useNotifications()
  const activeSection = getActiveSection(pathname)

  const [launchStats, setLaunchStats] = useState<{ ads: number | null; batches: number | null; saved: number | null }>({
    ads: null, batches: null, saved: null,
  })

  useEffect(() => {
    if (!activeOrg?.id) return
    fetch("/api/team-stats?days=30")
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d) return
        setLaunchStats({ ads: d.ads, batches: d.batches, saved: d.templates })
      })
      .catch(() => {})
  }, [activeOrg?.id])

  useEffect(() => {
    if (settings?.theme && settings.theme !== "system") setTheme(settings.theme)
  }, [settings?.theme, setTheme])

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" })
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
            <div className="relative">
              <button
                onClick={() => setNotifOpen(v => !v)}
                className="size-6 flex items-center justify-center rounded hover:bg-sidebar-accent text-sidebar-foreground/50 hover:text-sidebar-foreground transition-colors"
                title="Notifications"
              >
                <IconBell className="size-3.5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 size-3.5 rounded-full bg-red-500 text-[8px] font-bold text-white flex items-center justify-center leading-none">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </button>
              {notifOpen && <NotificationsDropdown onClose={() => setNotifOpen(false)} />}
            </div>
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

              {/* Sub-items — only show when there are multiple sub-items */}
              {isActive && section.subItems.length > 1 && (
                <div className="ml-5 mt-0.5 mb-1">
                  {/* Launch stats widget */}
                  {section.id === "launch" && (
                    <div className="mx-2 mb-2 rounded-lg bg-sidebar-accent px-3 py-2">
                      <p className="text-[10px] font-medium text-sidebar-foreground/40 uppercase tracking-wide mb-1.5">
                        Your team&apos;s last 30d
                      </p>
                      <div className="flex items-center gap-4">
                        <div>
                          <div className="text-xs font-bold text-sidebar-foreground">
                            {launchStats.ads === null ? "—" : launchStats.ads.toLocaleString()}
                          </div>
                          <div className="text-[9px] text-sidebar-foreground/45">Ads</div>
                        </div>
                        <div>
                          <div className="text-xs font-bold text-sidebar-foreground">
                            {launchStats.batches === null ? "—" : launchStats.batches}
                          </div>
                          <div className="text-[9px] text-sidebar-foreground/45">Batches</div>
                        </div>
                        <div>
                          <div className="text-xs font-bold text-sidebar-foreground">
                            {launchStats.saved === null ? "—" : launchStats.saved}
                          </div>
                          <div className="text-[9px] text-sidebar-foreground/45">Templates</div>
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
          <div className="size-7 rounded-full bg-primary/15 flex items-center justify-center text-primary text-xs font-semibold shrink-0 overflow-hidden">
            {userAvatarUrl ? (
              <img src={userAvatarUrl} alt="" className="size-7 object-cover" />
            ) : (
              userInitials
            )}
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
