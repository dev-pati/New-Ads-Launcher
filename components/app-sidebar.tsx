"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import Image from "next/image"
import { usePathname, useRouter } from "next/navigation"
import { useOrg } from "@/lib/org-context"
import { useAdAccount } from "@/lib/ad-account-context"
import { useTheme } from "next-themes"
import { useUserSettings } from "@/hooks/use-user-settings"
import { useNotifications } from "@/hooks/use-notifications"
import { NotificationsDropdown } from "@/components/notifications-dropdown"
import { AccountHealthPanel } from "@/components/account-health-panel"
import { cn } from "@/lib/utils"
import {
  IconRocket,
  IconPhoto,
  IconChartBar,
  IconMessage,
  IconBolt,
  IconLink,
  IconBulb,
  IconRoute,
  IconSearch,
  IconBuilding,
  IconSettings,
  IconBell,
  IconCreditCard,
  IconSun,
  IconMoon,
  IconDeviceDesktop,
  IconSparkles,
  IconCheck,
  IconLogout,
  IconHelp,
  IconActivityHeartbeat,
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

// ponytail: hover-to-expand overlay sidebar. Only the nav area expands on hover.
// Footer (settings/help/search/profile) stays collapsed â€” no expand on hover.
// Upgrade path: add a "pin" toggle to lock expanded state if users request it.

const navSections: NavSection[] = [
  {
    id: "ad-accounts",
    label: "Ad Accounts",
    icon: IconCreditCard,
    subItems: [{ label: "Ad Accounts", href: "/ad-accounts" }],
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
    subItems: [{ label: "All Assets", href: "/assets" }],
  },
  {
    id: "insights",
    label: "Insights",
    icon: IconChartBar,
    subItems: [{ label: "Insights", href: "/insights" }],
  },
  {
    id: "page-manager",
    label: "Page Manager",
    icon: IconMessage,
    subItems: [{ label: "Page Manager", href: "/page-manager" }],
  },
  {
    id: "connect",
    label: "Connects",
    icon: IconLink,
    subItems: [
      { label: "Connect", href: "/connect" },
      { label: "Rate Limit", href: "/rate-limit" },
    ],
  },
  {
    id: "automate",
    label: "Automation",
    icon: IconBolt,
    subItems: [
      { label: "Automations", href: "/automate" },
      { label: "Rules", href: "/automate/rules" },
    ],
  },
  {
    id: "inspo",
    label: "Inspo",
    icon: IconBulb,
    subItems: [{ label: "Inspo", href: "/inspo" }],
  },
  {
    id: "tracking",
    label: "Tracking",
    icon: IconRoute,
    subItems: [{ label: "Tracking", href: "/tracking" }],
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
  if (pathname.startsWith("/tracking")) return "tracking"
  if (pathname.startsWith("/project")) return "projects"
  if (pathname.startsWith("/search")) return "search"
  return ""
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
  const { selectedAccount } = useAdAccount()
  const { theme, setTheme } = useTheme()
  const { settings, updateSettings } = useUserSettings()
  const [hovered, setHovered] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const notifButtonRef = useRef<HTMLButtonElement>(null)
  const healthButtonRef = useRef<HTMLButtonElement>(null)
  const [healthOpen, setHealthOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
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
  const expanded = hovered
  const isFooterActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`)
  const healthNeedsAttention = selectedAccount?.account_status !== undefined && selectedAccount.account_status !== 1

  return (
    <aside className="relative w-14 shrink-0 z-40" onMouseLeave={() => setHovered(false)}>
      <div
        className={cn(
          "absolute inset-y-0 left-0 flex flex-col h-full bg-sidebar border-r border-sidebar-border overflow-hidden transition-[width] duration-200 ease-in-out",
          expanded ? "w-[210px]" : "w-14"
        )}
      >
        {/* Header: org logo only */}
        <div className="flex h-14 shrink-0 items-center border-b border-sidebar-border px-2">
          <div className={cn("flex items-center gap-2 min-w-0", !expanded && "mx-auto")}>
            <div className="size-7 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden bg-primary/10">
              {activeOrg?.logo_url ? (
                <Image src={activeOrg.logo_url} alt="" width={28} height={28} className="size-full object-cover" />
              ) : (
                <div className="size-full bg-primary text-primary-foreground flex items-center justify-center">
                  {orgInitials}
                </div>
              )}
            </div>
            {expanded && (
              <span className="font-heading text-sm font-semibold text-sidebar-foreground truncate">
                {activeOrg?.name || "Workspace"}
              </span>
            )}
          </div>
        </div>

        {/* Main nav â€” hover here expands sidebar */}
        <nav
          className="flex-1 overflow-y-auto py-2 space-y-0.5"
          onMouseEnter={() => setHovered(true)}
        >
          {/* Notification bell â€” top of nav */}
          {expanded ? (
            <div className="px-2 mb-1">
              <button
                ref={notifButtonRef}
                onClick={() => {
                  setNotifOpen(v => !v)
                  setHealthOpen(false)
                }}
                className={cn(
                  "relative flex items-center gap-2.5 h-9 px-3 w-full rounded-lg text-sm font-medium transition-colors",
                  notifOpen
                    ? "text-foreground bg-sidebar-accent"
                    : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent"
                )}
              >
                <IconBell className={cn("size-4 shrink-0", unreadCount > 0 && "text-primary")} />
                <span>Notifications</span>
                {unreadCount > 0 && (
                  <span className="ml-auto min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold flex items-center justify-center leading-none">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </button>
            </div>
          ) : (
            <div className="mb-1 flex justify-center px-2">
              <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                  <button
                    ref={notifButtonRef}
                    onClick={() => {
                      setNotifOpen(v => !v)
                      setHealthOpen(false)
                    }}
                    aria-label="Notifications"
                    aria-expanded={notifOpen}
                    className={cn(
                      "relative flex items-center justify-center rounded-lg transition-colors cursor-pointer size-10",
                      notifOpen
                        ? "bg-sidebar-accent text-sidebar-foreground"
                        : "text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                    )}
                  >
                    <IconBell className={cn("size-5", unreadCount > 0 && "text-primary")} />
                    {unreadCount > 0 && (
                      <span className="absolute -right-1 -top-1 flex h-[17px] min-w-[17px] items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold leading-none text-destructive-foreground ring-2 ring-sidebar">
                        {unreadCount > 99 ? "99+" : unreadCount}
                      </span>
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="font-medium">
                  {unreadCount > 0 ? `Notifications â€” ${unreadCount} unread` : "Notifications"}
                </TooltipContent>
              </Tooltip>
            </div>
          )}

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

          {/* Separator between notification and nav sections */}
          <div className="mx-3 my-2 border-t border-sidebar-border" />

          {navSections.map((section) => {
            const isActive = activeSection === section.id
            const Icon = section.icon

            if (!expanded) {
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
                      <Icon className="size-5" />
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

                {isActive && section.subItems.length > 1 && (
                  <div className="ml-5 mr-2 mt-0.5 mb-1">
                    {section.id === "launch" && (
                      <div className="mb-2 rounded-lg bg-sidebar-accent px-2.5 py-2">
                        <p className="text-xs font-medium text-sidebar-foreground/70 uppercase tracking-wide mb-1.5 truncate">
                          Your team&apos;s last 30d
                        </p>
                        <div className="grid grid-cols-3 gap-1">
                          <div>
                            <div className="text-xs font-bold text-sidebar-foreground">
                              {launchStats.ads === null ? "â€”" : launchStats.ads.toLocaleString()}
                            </div>
                            <div className="text-xs text-sidebar-foreground/60">Ads</div>
                          </div>
                          <div>
                            <div className="text-xs font-bold text-sidebar-foreground">
                              {launchStats.batches === null ? "â€”" : launchStats.batches}
                            </div>
                            <div className="text-xs text-sidebar-foreground/60">Batches</div>
                          </div>
                          <div>
                            <div className="text-xs font-bold text-sidebar-foreground">
                              {launchStats.saved === null ? "â€”" : launchStats.saved}
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

        {/* Footer: Account health, Settings, Help, Search, Profile. */}
        <div className="border-t border-sidebar-border p-2">
          <div className={cn("flex items-center gap-0.5", expanded ? "flex-row justify-center" : "flex-col")}>
            <button
              ref={healthButtonRef}
              aria-label="Account health"
              aria-expanded={healthOpen}
              onClick={() => {
                setHealthOpen(open => !open)
                setNotifOpen(false)
              }}
              className={cn(
                "relative flex size-9 items-center justify-center rounded-lg text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground",
                healthOpen && "bg-sidebar-accent text-sidebar-foreground"
              )}
            >
              <IconActivityHeartbeat className="size-[18px]" />
              {healthNeedsAttention && <span className="absolute right-0.5 top-0.5 size-2 rounded-full bg-destructive ring-2 ring-sidebar" />}
            </button>

            {healthOpen && (
              <AccountHealthPanel anchorRef={healthButtonRef} onClose={() => setHealthOpen(false)} />
            )}

            <Link
              href="/settings"
              aria-current={isFooterActive("/settings") ? "page" : undefined}
              className={cn(
                "flex size-9 items-center justify-center rounded-lg text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground",
                isFooterActive("/settings") && "bg-sidebar-primary text-sidebar-primary-foreground"
              )}
            >
              <IconSettings className="size-[18px]" />
            </Link>
            <Link
              href="/help"
              aria-current={isFooterActive("/help") ? "page" : undefined}
              className={cn(
                "flex size-9 items-center justify-center rounded-lg text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground",
                isFooterActive("/help") && "bg-sidebar-primary text-sidebar-primary-foreground"
              )}
            >
              <IconHelp className="size-[18px]" />
            </Link>
            <Link
              href="/search"
              aria-current={isFooterActive("/search") ? "page" : undefined}
              className={cn(
                "flex size-9 items-center justify-center rounded-lg text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground",
                isFooterActive("/search") && "bg-sidebar-primary text-sidebar-primary-foreground"
              )}
            >
              <IconSearch className="size-[18px]" />
            </Link>

            {/* Profile avatar â€” theme + lobby + log out */}
            <DropdownMenu open={userMenuOpen} onOpenChange={setUserMenuOpen}>
              <DropdownMenuTrigger asChild>
                <button
                  aria-label="Profile"
                  className="flex size-9 items-center justify-center rounded-full transition-colors hover:bg-sidebar-accent"
                >
                  <div className="rounded-full bg-primary/15 flex items-center justify-center text-primary font-semibold overflow-hidden size-6 text-[10px]">
                    {userAvatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={userAvatarUrl} alt="" className="size-full object-cover" />
                    ) : (
                      userInitials
                    )}
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" side="top" className="w-48">
                <DropdownMenuItem asChild>
                  <Link href="/projects"><IconBuilding className="size-4" /> Lobby</Link>
                </DropdownMenuItem>
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
                        <div className="text-xs text-muted-foreground">Match system setting</div>
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
        </div>
      </div>
    </aside>
  )
}
