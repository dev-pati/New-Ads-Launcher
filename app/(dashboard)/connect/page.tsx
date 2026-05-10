"use client"

import { useState, useEffect, useCallback } from "react"
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
  IconPlus,
  IconTrash,
  IconCopy,
  IconLoader2,
  IconKey,
  IconAlertCircle,
  IconCode,
  IconBolt,
  IconX,
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

// ─── MCP Tools list ──────────────────────────────────────────────────────────

const MCP_TOOLS = [
  { name: "get_ad_accounts", desc: "List all connected ad accounts" },
  { name: "get_campaigns", desc: "List campaigns with ROAS, spend, purchases" },
  { name: "get_adsets", desc: "List ad sets with budget and performance" },
  { name: "get_ad_insights", desc: "Detailed metrics — ROAS, CPC, CTR, CPM" },
  { name: "toggle_status", desc: "Pause or resume any campaign / ad set / ad" },
  { name: "adjust_budget", desc: "Change daily or lifetime budget" },
  { name: "get_media_library", desc: "Browse images and videos in media library" },
  { name: "get_automation_rules", desc: "List Facebook Automated Rules" },
]

// ─── MCP Tab ─────────────────────────────────────────────────────────────────

function McpTab() {
  const [keys, setKeys] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [newKey, setNewKey] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const [error, setError] = useState("")
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [showConnectModal, setShowConnectModal] = useState(false)

  const mcpUrl = typeof window !== "undefined"
    ? `${window.location.origin}/api/mcp`
    : "/api/mcp"

  const fetchKeys = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/mcp/keys")
      const d = await res.json()
      setKeys(d.keys || [])
    } catch {}
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchKeys() }, [fetchKeys])

  async function generateKey() {
    setGenerating(true); setError(""); setNewKey(null)
    try {
      const res = await fetch("/api/mcp/keys", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Claude Desktop" }) })
      const d = await res.json()
      if (!res.ok) { setError(d.error || "Failed"); return }
      setNewKey(d.key.api_key)
      setKeys(prev => [d.key, ...prev])
    } catch (e: any) { setError(e.message) }
    finally { setGenerating(false) }
  }

  async function deleteKey(id: string) {
    setDeletingId(id)
    try {
      await fetch("/api/mcp/keys", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) })
      setKeys(prev => prev.filter(k => k.id !== id))
      if (newKey && keys.find(k => k.id === id)?.api_key === newKey) setNewKey(null)
    } catch {}
    finally { setDeletingId(null) }
  }

  function copyText(text: string, field?: string) {
    navigator.clipboard.writeText(text)
    if (field) {
      setCopiedField(field)
      setTimeout(() => setCopiedField(null), 2000)
    } else {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const displayKey = newKey || keys[0]?.api_key
  const claudeConfig = displayKey ? JSON.stringify({
    mcpServers: {
      adlauncher: {
        url: mcpUrl,
        headers: { Authorization: `Bearer ${displayKey}` },
      },
    },
  }, null, 2) : null

  return (
    <div className="max-w-3xl space-y-6">
      {/* Connect with Claude.ai modal */}
      {showConnectModal && displayKey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-background rounded-2xl shadow-2xl border w-full max-w-lg mx-4 flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <div className="flex items-center gap-3">
                <div className="size-8 rounded-lg bg-[#D97757]/10 flex items-center justify-center">
                  <svg viewBox="0 0 24 24" className="size-5 fill-[#D97757]"><path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm0 18c-4.411 0-8-3.589-8-8s3.589-8 8-8 8 3.589 8 8-3.589 8-8 8z"/></svg>
                </div>
                <h2 className="font-semibold text-base">Connect to Claude.ai</h2>
              </div>
              <button onClick={() => setShowConnectModal(false)} className="text-muted-foreground hover:text-foreground">
                <IconX className="size-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              <p className="text-sm text-muted-foreground">
                Làm theo 3 bước dưới đây. Mỗi bước có nút copy — chỉ cần paste vào Claude.ai là xong.
              </p>

              {/* Step 1 */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="size-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center shrink-0">1</span>
                  <p className="text-sm font-medium">Mở trang Integrations của Claude.ai</p>
                </div>
                <div className="ml-8">
                  <Button
                    size="sm"
                    className="gap-2 text-xs"
                    onClick={() => window.open("https://claude.ai/settings/integrations", "_blank")}
                  >
                    <IconExternalLink className="size-3.5" />
                    Mở Claude.ai → Settings → Integrations
                  </Button>
                  <p className="text-xs text-muted-foreground mt-1.5">Bấm <strong>"Add Integration"</strong> hoặc <strong>"Add custom integration"</strong></p>
                </div>
              </div>

              {/* Step 2 */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="size-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center shrink-0">2</span>
                  <p className="text-sm font-medium">Điền URL của MCP Server</p>
                </div>
                <div className="ml-8 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-xs bg-muted border rounded-lg px-3 py-2 font-mono">{mcpUrl}</code>
                    <Button size="sm" variant="outline" className="shrink-0 gap-1.5 text-xs h-8"
                      onClick={() => copyText(mcpUrl, "url")}>
                      <IconCopy className="size-3.5" />
                      {copiedField === "url" ? "Copied!" : "Copy"}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">Paste vào ô <strong>Integration URL</strong></p>
                </div>
              </div>

              {/* Step 3 */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="size-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center shrink-0">3</span>
                  <p className="text-sm font-medium">Thêm API Key vào header</p>
                </div>
                <div className="ml-8 space-y-1.5">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Header name:</p>
                      <div className="flex items-center gap-1.5">
                        <code className="flex-1 text-xs bg-muted border rounded-lg px-2 py-1.5 font-mono">Authorization</code>
                        <Button size="sm" variant="outline" className="shrink-0 px-2 h-7"
                          onClick={() => copyText("Authorization", "hname")}>
                          <IconCopy className="size-3" />
                        </Button>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Header value:</p>
                      <div className="flex items-center gap-1.5">
                        <code className="flex-1 text-xs bg-muted border rounded-lg px-2 py-1.5 font-mono truncate">Bearer {displayKey.slice(0, 12)}...</code>
                        <Button size="sm" variant="outline" className="shrink-0 px-2 h-7"
                          onClick={() => copyText(`Bearer ${displayKey}`, "hval")}>
                          <IconCopy className="size-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                  {copiedField === "hval" && (
                    <p className="text-xs text-green-600 dark:text-green-400">✅ Copied full header value!</p>
                  )}
                  <p className="text-xs text-muted-foreground">Paste vào phần <strong>Custom headers</strong> của integration form</p>
                </div>
              </div>

              {/* Done */}
              <div className="flex items-start gap-2 p-3 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900 text-sm text-green-700 dark:text-green-400">
                <IconCheck className="size-4 shrink-0 mt-0.5" />
                <span>Sau khi save, mở chat mới trong Claude.ai và thử: <em>"Show me my ad accounts"</em></span>
              </div>
            </div>

            <div className="px-6 py-4 border-t flex justify-end">
              <Button variant="outline" onClick={() => setShowConnectModal(false)}>Đóng</Button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start gap-4 p-5 rounded-xl border bg-gradient-to-br from-primary/5 to-primary/0">
        <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <IconServer className="size-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h3 className="font-semibold text-base">AdLauncher MCP Server</h3>
              <p className="text-sm text-muted-foreground mt-0.5">
                Kết nối Claude với Facebook Ads data của bạn. Hỏi, phân tích, và thực hiện action bằng ngôn ngữ tự nhiên.
              </p>
            </div>
            {displayKey && (
              <Button
                size="sm"
                className="gap-2 shrink-0"
                onClick={() => setShowConnectModal(true)}
              >
                <IconExternalLink className="size-4" />
                Connect với Claude.ai
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2 mt-2">
            <span className="size-2 rounded-full bg-green-500 inline-block" />
            <span className="text-xs text-green-600 dark:text-green-400 font-medium">Server Online</span>
            <span className="text-xs text-muted-foreground ml-2 font-mono">{mcpUrl}</span>
          </div>
        </div>
      </div>

      {/* API Keys */}
      <div className="border rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b bg-muted/20">
          <div className="flex items-center gap-2">
            <IconKey className="size-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">API Keys</h3>
          </div>
          <Button size="sm" className="gap-1.5 text-xs" onClick={generateKey} disabled={generating}>
            {generating
              ? <IconLoader2 className="size-3.5 animate-spin" />
              : <IconPlus className="size-3.5" />
            }
            Generate Key
          </Button>
        </div>

        {/* New key banner */}
        {newKey && (
          <div className="px-5 py-4 bg-green-50 dark:bg-green-950/20 border-b border-green-200 dark:border-green-900">
            <p className="text-xs font-medium text-green-700 dark:text-green-400 mb-2">
              ✅ Key generated — copy it now, it won't be shown again in full.
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs bg-background border rounded-lg px-3 py-2 font-mono break-all">{newKey}</code>
              <Button size="sm" variant="outline" className="shrink-0 gap-1.5 text-xs" onClick={() => copyText(newKey)}>
                <IconCopy className="size-3.5" />
                {copied ? "Copied!" : "Copy"}
              </Button>
            </div>
          </div>
        )}

        {error && (
          <div className="px-5 py-3 flex items-center gap-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/20 border-b">
            <IconAlertCircle className="size-4 shrink-0" />{error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <IconLoader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : keys.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <IconKey className="size-8 text-muted-foreground/30 mb-2" />
            <p className="text-sm text-muted-foreground">No API keys yet. Generate one to connect Claude.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/30">
              <tr>
                <th className="text-left px-5 py-2.5 text-xs font-medium text-muted-foreground">Name</th>
                <th className="text-left px-5 py-2.5 text-xs font-medium text-muted-foreground">Key</th>
                <th className="text-left px-5 py-2.5 text-xs font-medium text-muted-foreground">Last Used</th>
                <th className="text-left px-5 py-2.5 text-xs font-medium text-muted-foreground">Created</th>
                <th className="px-5 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {keys.map(k => (
                <tr key={k.id} className="hover:bg-muted/20">
                  <td className="px-5 py-3 font-medium">{k.name}</td>
                  <td className="px-5 py-3 font-mono text-xs text-muted-foreground">
                    {k.api_key ? `${k.api_key.slice(0, 12)}${"•".repeat(20)}` : "••••••••••••"}
                  </td>
                  <td className="px-5 py-3 text-muted-foreground text-xs">
                    {k.last_used_at ? new Date(k.last_used_at).toLocaleDateString() : "Never"}
                  </td>
                  <td className="px-5 py-3 text-muted-foreground text-xs">
                    {new Date(k.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button onClick={() => deleteKey(k.id)} disabled={deletingId === k.id} className="text-muted-foreground hover:text-destructive transition-colors">
                      {deletingId === k.id
                        ? <IconLoader2 className="size-4 animate-spin" />
                        : <IconTrash className="size-4" />
                      }
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Claude Desktop config */}
      {claudeConfig && (
        <div className="border rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b bg-muted/20">
            <div className="flex items-center gap-2">
              <IconCode className="size-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold">Claude Desktop Config</h3>
            </div>
            <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => copyText(claudeConfig)}>
              <IconCopy className="size-3.5" />{copied ? "Copied!" : "Copy"}
            </Button>
          </div>
          <div className="p-5">
            <p className="text-xs text-muted-foreground mb-3">
              Add this to your <code className="bg-muted px-1 py-0.5 rounded text-xs">claude_desktop_config.json</code> file:
            </p>
            <pre className="text-xs bg-muted/50 rounded-lg p-4 overflow-x-auto font-mono leading-relaxed border">{claudeConfig}</pre>
            <p className="text-xs text-muted-foreground mt-3">
              Config file location: <code className="bg-muted px-1 py-0.5 rounded">~/Library/Application Support/Claude/claude_desktop_config.json</code> (macOS) or <code className="bg-muted px-1 py-0.5 rounded">%APPDATA%\Claude\claude_desktop_config.json</code> (Windows)
            </p>
          </div>
        </div>
      )}

      {/* Available tools */}
      <div className="border rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b bg-muted/20 flex items-center gap-2">
          <IconBolt className="size-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Available Tools ({MCP_TOOLS.length})</h3>
        </div>
        <div className="divide-y">
          {MCP_TOOLS.map(t => (
            <div key={t.name} className="flex items-center gap-3 px-5 py-3">
              <code className="text-xs font-mono bg-primary/8 text-primary px-2 py-0.5 rounded shrink-0">{t.name}</code>
              <span className="text-sm text-muted-foreground">{t.desc}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Example prompts */}
      <div className="border rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b bg-muted/20">
          <h3 className="text-sm font-semibold">Example Prompts for Claude</h3>
        </div>
        <div className="p-5 space-y-2">
          {[
            "Which campaigns had the highest ROAS this week?",
            "Pause all ad sets with ROAS below 1 in account act_123456",
            "What's the total spend across all accounts in the last 30 days?",
            "Show me all videos in the media library",
            "Increase the daily budget of adset 98765 to $200",
            "Which campaigns are currently paused?",
          ].map(p => (
            <div key={p} className="flex items-start gap-2 text-sm text-muted-foreground">
              <span className="text-primary mt-0.5 shrink-0">→</span>
              <span>"{p}"</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

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
          <McpTab />
        )}
      </div>
    </div>
  )
}
