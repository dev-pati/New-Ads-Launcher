"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import Image from "next/image"
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
  IconMessage,
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
  IconDeviceDesktop,
  IconSparkles,
  IconCheck,
  IconLogout,
} from "@tabler/icons-react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu"

type SubItem = { label: string; href: string }
type NavSection = {
  id: string
  label: string
  icon: React.ElementType
  subItems: SubItem[]
}

type ThemeMode = "system" | "light" | "dark" | "dark-premium"
function normalizeThemeMode(value?: string | null): ThemeMode {
  if (value === "system" || value === "dark" || value === "dark-premium") return value
  return "light"
}

const navSections: NavSection[] = [
  {
    id: "search",
    label: "Search",
    icon: IconSearch,
    subItems: [
      { label: "Search", href: "/search" },
    ],
  },
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
    id: "page-manager",
    label: "Page Manager",
    icon: IconMessage,
    subItems: [
      { label: "Page Manager", href: "/page-manager" },
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

function getActiveSection(pathname: string): string {
  if (pathname.startsWith("/launch") || pathname.startsWith("/ads-manager") || pathname.startsWith("/templates")) return "launch"
  if (pathname.startsWith("/assets")) return "assets"
  if (pathname.startsWith("/insights")) return "insights"
  if (pathname.startsWith("/page-manager")) return "page-manager"
  if (pathname.startsWith("/automate")) return "automate"
  if (pathname.startsWith("/connect") || pathname.startsWith("/rate-limit")) return "connect"
  if (pathname.startsWith("/ad-accounts")) return "ad-accounts"
  if (pathname.startsWith("/inspo")) return "inspo"
  if (pathname.startsWith("/project")) return "projects"
  if (pathname.startsWith("/search")) return "search"
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
  const { theme, setTheme } = useTheme()
  const { settings, updateSettings } = useUserSettings()
  const [collapsed, setCollapsed] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const notifButtonRef = useRef<HTMLButtonElement>(null)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  // The sidebar owns the feed and hands it to the panel. Two components each calling
  // the hook would open two realtime channels on the same topic in one tab.
  const { notifications, unreadCount, loading: notifLoading, live: notifLive, markRead, markAllRead, refresh: refreshNotifs } = useNotifications()
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

  const selectedTheme: ThemeMode = normalizeThemeMode(theme ?? settings?.theme)
  useEffect(() => {
    setTheme(selectedTheme)
  }, [selectedTheme, setTheme])

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" })
    router.push("/auth/login")
    router.refresh()
  }

  const setAppTheme = (next: ThemeMode) => {
    setUserMenuOpen(false)
    setTheme(next)
    updateSettings({ theme: next })
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
          <div className="size-8 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden bg-primary/10">
            {activeOrg?.logo_url ? (
              <Image src={activeOrg.logo_url} alt="" width={32} height={32} className="size-full object-cover" />
            ) : (
              <div className="size-full bg-primary text-primary-foreground flex items-center justify-center">
                {orgInitials}
              </div>
            )}
          </div>
          {!collapsed && (
            <span className="font-heading text-sm font-semibold text-sidebar-foreground truncate">
              {activeOrg?.name || "Workspace"}
            </span>
          )}
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          {/* The bell used to live here, at size-6 next to the collapse chevron, and
              disappeared entirely when the sidebar collapsed. It is now a first-class
              row in the footer. */}
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
                  "relative flex items-center gap-2.5 h-9 px-3 mx-2 rounded-lg text-sm font-medium transition-colors before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:h-5 before:w-0.5 before:rounded-full before:bg-primary before:opacity-0 before:transition-opacity",
                  isActive
                    ? "text-foreground bg-sidebar-accent before:opacity-100"
                    : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent"
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
                      <p className="text-xs font-medium text-sidebar-foreground/70 uppercase tracking-wide mb-1.5">
                        Your team&apos;s last 30d
                      </p>
                      <div className="flex items-center gap-4">
                        <div>
                          <div className="text-xs font-bold text-sidebar-foreground">
                            {launchStats.ads === null ? "—" : launchStats.ads.toLocaleString()}
                          </div>
                          <div className="text-xs text-sidebar-foreground/60">Ads</div>
                        </div>
                        <div>
                          <div className="text-xs font-bold text-sidebar-foreground">
                            {launchStats.batches === null ? "—" : launchStats.batches}
                          </div>
                          <div className="text-xs text-sidebar-foreground/60">Batches</div>
                        </div>
                        <div>
                          <div className="text-xs font-bold text-sidebar-foreground">
                            {launchStats.saved === null ? "—" : launchStats.saved}
                          </div>
                          <div className="text-xs text-sidebar-foreground/60">Templates</div>
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
                          "flex items-center h-8 px-3 rounded-lg text-sm transition-colors mb-0.5 w-full",
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

      {/* User footer */}
      <div className="border-t border-sidebar-border p-2 space-y-1">
        {/* Notifications — sits directly above the profile row, matches the nav rhythm
            (h-9 / rounded-lg / size-[18px]) and stays reachable when collapsed. */}
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <button
              ref={notifButtonRef}
              onClick={() => setNotifOpen(v => !v)}
              aria-label="Notifications"
              aria-expanded={notifOpen}
              className={cn(
                "relative flex items-center gap-2.5 h-9 w-full rounded-lg text-sm font-medium transition-colors cursor-pointer",
                collapsed ? "justify-center px-0" : "px-3",
                notifOpen
                  ? "bg-sidebar-accent text-sidebar-foreground"
                  : "text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              )}
            >
              <span className="relative shrink-0 flex items-center">
                <IconBell className={cn("size-[18px]", unreadCount > 0 && "text-primary")} />
                {/* Collapsed has no room for a count, so it degrades to a dot. */}
                {unreadCount > 0 && (
                  collapsed ? (
                    <span className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-primary ring-2 ring-sidebar" />
                  ) : null
                )}
              </span>
              {!collapsed && (
                <>
                  <span className="flex-1 text-left">Notifications</span>
                  {unreadCount > 0 && (
                    <span className="shrink-0 min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-primary-foreground text-xs font-semibold flex items-center justify-center leading-none">
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                  )}
                </>
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" className="font-medium">
            {unreadCount > 0
              ? `Notifications — ${unreadCount} unread`
              : "Notifications"}
          </TooltipContent>
        </Tooltip>

        {notifOpen && (
          <NotificationsDropdown
            anchorRef={notifButtonRef}
            notifications={notifications}
            unreadCount={unreadCount}
            loading={notifLoading}
            live={notifLive}
            onRead={markRead}
            onReadAll={markAllRead}
            onRefresh={refreshNotifs}
            onClose={() => setNotifOpen(false)}
          />
        )}

        <DropdownMenu open={userMenuOpen} onOpenChange={setUserMenuOpen}>
          <DropdownMenuTrigger asChild>
            <button
              className={cn(
                "flex items-center gap-2 w-full rounded-lg p-1 hover:bg-sidebar-accent transition-colors",
                collapsed && "justify-center"
              )}
            >
              <div className="size-7 rounded-full bg-primary/15 flex items-center justify-center text-primary text-xs font-semibold shrink-0 overflow-hidden">
                {userAvatarUrl ? (
                  <img src={userAvatarUrl} alt="" className="size-7 object-cover" />
                ) : (
                  userInitials
                )}
              </div>
              {!collapsed && (
                <div className="flex-1 min-w-0 text-left">
                  {userName && <p className="text-xs font-medium text-sidebar-foreground truncate">{userName}</p>}
                  {userEmail && <p className="text-xs text-sidebar-foreground/45 truncate">{userEmail}</p>}
                </div>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="top" className="w-48">
            <DropdownMenuItem asChild>
              <Link href="/projects"><IconBuilding className="size-4" /> Lobby</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/rewards"><IconGift className="size-4" /> Rewards</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/settings"><IconSettings className="size-4" /> Settings</Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                {selectedTheme === "system" && <IconDeviceDesktop className="size-4" />}
                {selectedTheme === "light" && <IconSun className="size-4" />}
                {selectedTheme === "dark" && <IconMoon className="size-4" />}
                {selectedTheme === "dark-premium" && <IconSparkles className="size-4 text-primary" />}
                Theme: {selectedTheme === "system" ? "Auto" : selectedTheme === "dark" ? "Dark" : selectedTheme === "dark-premium" ? "Pro Max" : "Light"}
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-64 p-2">
                <DropdownMenuItem onClick={() => setAppTheme("system")} className="items-start gap-3 py-3">
                  <IconDeviceDesktop className="mt-0.5 size-5" />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">Auto</div>
                    <div className="text-xs text-muted-foreground">Use the same theme as your device</div>
                  </div>
                  {selectedTheme === "system" && <IconCheck className="mt-0.5 size-4" />}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setAppTheme("light")} className="items-start gap-3 py-3">
                  <IconSun className="mt-0.5 size-5" />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">Light</div>
                    <div className="text-xs text-muted-foreground">Light background with dark text</div>
                  </div>
                  {selectedTheme === "light" && <IconCheck className="mt-0.5 size-4" />}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setAppTheme("dark")} className="items-start gap-3 py-3">
                  <IconMoon className="mt-0.5 size-5" />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">Dark</div>
                    <div className="text-xs text-muted-foreground">Dark background with light text</div>
                  </div>
                  {selectedTheme === "dark" && <IconCheck className="mt-0.5 size-4" />}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setAppTheme("dark-premium")} className="items-start gap-3 py-3">
                  <IconSparkles className="mt-0.5 size-5 text-primary" />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-primary">Pro Max</div>
                    <div className="text-xs text-muted-foreground">Deep premium dark background</div>
                  </div>
                  {selectedTheme === "dark-premium" && <IconCheck className="mt-0.5 size-4" />}
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout}>
              <IconLogout className="size-4" /> Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  )
}
