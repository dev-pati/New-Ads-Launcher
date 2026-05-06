"use client"

import { useState, useEffect } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  IconBrandFacebook,
  IconBrandTiktok,
  IconBrandGoogle,
  IconBrandSnapchat,
  IconBrandPinterest,
  IconBrandReddit,
  IconBrandLinkedin,
  IconCheck,
  IconSettings,
  IconChevronDown,
  IconExternalLink,
  IconLink,
  IconApi,
  IconServer,
  IconBuildingStore,
} from "@tabler/icons-react"

type SubTab = "channels" | "media" | "api" | "mcp"

interface AdChannel {
  id: string
  name: string
  description: string
  icon: React.ElementType
  iconColor: string
  iconBg: string
  connected: boolean
  beta?: boolean
}

const AD_CHANNELS: AdChannel[] = [
  {
    id: "meta",
    name: "Meta/Facebook",
    description: "Connected to Meta Business account",
    icon: IconBrandFacebook,
    iconColor: "#1877F2",
    iconBg: "bg-[#1877F2]/10",
    connected: false,
  },
  {
    id: "tiktok",
    name: "TikTok",
    description: "Connect your TikTok Business account to manage TikTok ads",
    icon: IconBrandTiktok,
    iconColor: "#000000",
    iconBg: "bg-black/10 dark:bg-white/10",
    connected: false,
  },
  {
    id: "google",
    name: "Google Ads",
    description: "Connect your Google Ads account to manage Performance Max campaigns",
    icon: IconBrandGoogle,
    iconColor: "#4285F4",
    iconBg: "bg-[#4285F4]/10",
    connected: false,
    beta: true,
  },
  {
    id: "snapchat",
    name: "Snapchat",
    description: "Connect your Snapchat Ads account to launch Snap Ads campaigns",
    icon: IconBrandSnapchat,
    iconColor: "#FFFC00",
    iconBg: "bg-yellow-400/20",
    connected: false,
  },
  {
    id: "pinterest",
    name: "Pinterest",
    description: "Connect your Pinterest Ads account to launch promoted pins",
    icon: IconBrandPinterest,
    iconColor: "#E60023",
    iconBg: "bg-red-500/10",
    connected: false,
  },
  {
    id: "reddit",
    name: "Reddit",
    description: "Connect your Reddit Ads account to launch promoted posts across Reddit",
    icon: IconBrandReddit,
    iconColor: "#FF4500",
    iconBg: "bg-orange-500/10",
    connected: false,
    beta: true,
  },
  {
    id: "linkedin",
    name: "LinkedIn",
    description: "Connect your LinkedIn Ads account to launch sponsored content",
    icon: IconBrandLinkedin,
    iconColor: "#0A66C2",
    iconBg: "bg-[#0A66C2]/10",
    connected: false,
    beta: true,
  },
]

export default function ConnectPage() {
  const [subTab, setSubTab] = useState<SubTab>("channels")
  const [channels, setChannels] = useState(AD_CHANNELS)
  const [fbConnected, setFbConnected] = useState(false)
  const [fbName, setFbName] = useState("")
  const [fbPicture, setFbPicture] = useState("")
  const [adAccountCount, setAdAccountCount] = useState(0)

  useEffect(() => {
    fetch("/api/facebook/connection")
      .then(r => r.json())
      .then(d => {
        if (d.connected) {
          setFbConnected(true)
          setFbName(d.user?.name || "")
          setFbPicture(d.user?.picture || "")
          setChannels(prev => prev.map(c => c.id === "meta" ? { ...c, connected: true } : c))
        }
      })
      .catch(() => {})

    fetch("/api/facebook/ad-accounts")
      .then(r => r.json())
      .then(d => setAdAccountCount((d.adAccounts || []).length))
      .catch(() => {})
  }, [])

  const handleConnect = (channelId: string) => {
    if (channelId === "meta") {
      window.location.href = "/api/auth/facebook"
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-6 py-5 border-b shrink-0">
        <h1 className="font-heading text-xl font-bold">Connect</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Connect the ad platforms your team launches and manages.
        </p>
      </div>

      {/* Sub tabs */}
      <div className="flex items-center gap-0 px-6 border-b shrink-0">
        {[
          { id: "channels", label: "Ad Channels", icon: IconLink },
          { id: "media", label: "Media", icon: IconBuildingStore },
          { id: "api", label: "API", icon: IconApi },
          { id: "mcp", label: "MCP", icon: IconServer },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setSubTab(t.id as SubTab)}
            className={cn(
              "flex items-center gap-1.5 px-0 py-3 mr-7 text-sm border-b-2 transition-colors",
              subTab === t.id
                ? "border-foreground font-medium text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <t.icon className="size-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto px-6 py-6">
        {subTab === "channels" && (
          <div className="max-w-3xl space-y-4">
            {/* Workspace info card */}
            {fbConnected && (
              <div className="border rounded-xl p-4 bg-card">
                <h3 className="text-sm font-semibold mb-3">Current Workspace</h3>
                <div className="flex items-center gap-6">
                  <div>
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium">Ad Accounts</p>
                    <p className="text-sm font-semibold mt-0.5">{adAccountCount} connected</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium">Platform</p>
                    <p className="text-sm font-semibold mt-0.5">Meta/Facebook</p>
                  </div>
                  {fbName && (
                    <div>
                      <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium">Connected as</p>
                      <p className="text-sm font-semibold mt-0.5">{fbName}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Ad channels list */}
            <div className="border rounded-xl overflow-hidden bg-card">
              <div className="px-5 py-3.5 border-b bg-muted/20">
                <h3 className="text-sm font-semibold">Ad Channels</h3>
              </div>
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="px-5 py-3 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wide w-16">LOGO</th>
                    <th className="px-5 py-3 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">NAME</th>
                    <th className="px-5 py-3 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">DESCRIPTION</th>
                    <th className="px-5 py-3 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wide w-28">STATUS</th>
                    <th className="px-5 py-3 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wide w-36">ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {channels.map((channel, i) => {
                    const Icon = channel.icon
                    return (
                      <tr key={channel.id} className={cn("border-b last:border-0 hover:bg-muted/20 transition-colors", i === 0 && "bg-muted/5")}>
                        <td className="px-5 py-4">
                          <div className={cn("size-10 rounded-xl flex items-center justify-center", channel.iconBg)}>
                            <Icon className="size-5" style={{ color: channel.iconColor }} />
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{channel.name}</span>
                            {channel.beta && (
                              <span className="text-[10px] px-1.5 py-0.5 bg-primary/10 text-primary rounded-full font-semibold">BETA</span>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <p className="text-sm text-muted-foreground">{channel.description}</p>
                        </td>
                        <td className="px-5 py-4">
                          {channel.connected ? (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-2 py-1 rounded-full">
                              <IconCheck className="size-3" />
                              Connected
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground bg-muted px-2 py-1 rounded-full">
                              Connect
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          {channel.connected ? (
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs gap-1.5"
                              onClick={() => handleConnect(channel.id)}
                            >
                              <IconSettings className="size-3.5" />
                              Reconnect
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              className="text-xs gap-1.5"
                              onClick={() => handleConnect(channel.id)}
                              disabled={channel.id !== "meta"}
                            >
                              Connect
                            </Button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {subTab === "media" && (
          <div className="max-w-2xl">
            <div className="border rounded-xl p-8 text-center bg-card">
              <IconBuildingStore className="size-10 text-muted-foreground/40 mx-auto mb-3" />
              <h3 className="text-sm font-semibold">Media Integrations</h3>
              <p className="text-sm text-muted-foreground mt-1">Connect Google Drive, Dropbox, and other media sources.</p>
              <Button className="mt-4" size="sm" disabled>Coming Soon</Button>
            </div>
          </div>
        )}

        {subTab === "api" && (
          <div className="max-w-2xl">
            <div className="border rounded-xl p-8 text-center bg-card">
              <IconApi className="size-10 text-muted-foreground/40 mx-auto mb-3" />
              <h3 className="text-sm font-semibold">API Access</h3>
              <p className="text-sm text-muted-foreground mt-1">Generate API keys and access our developer documentation.</p>
              <Button className="mt-4" size="sm" disabled>Coming Soon</Button>
            </div>
          </div>
        )}

        {subTab === "mcp" && (
          <div className="max-w-2xl">
            <div className="border rounded-xl p-8 text-center bg-card">
              <IconServer className="size-10 text-muted-foreground/40 mx-auto mb-3" />
              <h3 className="text-sm font-semibold">MCP Server</h3>
              <p className="text-sm text-muted-foreground mt-1">Connect via Model Context Protocol for AI-powered automations.</p>
              <Button className="mt-4" size="sm" disabled>Coming Soon</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
