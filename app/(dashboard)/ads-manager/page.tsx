"use client"

import { useState, useEffect } from "react"
import { useAdAccount } from "@/lib/ad-account-context"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  IconSearch,
  IconPlus,
  IconCopy,
  IconPencil,
  IconRefresh,
  IconLoader2,
  IconChevronDown,
  IconToggleLeft,
  IconToggleRight,
} from "@tabler/icons-react"

type AdsTab = "campaigns" | "adsets" | "ads"

interface Campaign {
  id: string
  name: string
  status: string
  effective_status: string
  objective: string
  daily_budget?: string
  lifetime_budget?: string
}

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  PAUSED: "bg-muted text-muted-foreground",
  ARCHIVED: "bg-muted text-muted-foreground",
  DELETED: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",
}

export default function AdsManagerPage() {
  const { selectedAccountId, adAccounts, setSelectedAccountId } = useAdAccount()
  const [adsTab, setAdsTab] = useState<AdsTab>("campaigns")
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState("")

  useEffect(() => {
    if (!selectedAccountId) return
    setLoading(true)
    fetch(`/api/facebook/campaigns?ad_account_id=${encodeURIComponent(selectedAccountId)}`)
      .then(r => r.json())
      .then(d => setCampaigns(d.campaigns || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [selectedAccountId])

  const filtered = campaigns.filter(c =>
    !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.id.includes(search)
  )

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-3.5 border-b shrink-0">
        <h1 className="font-heading text-lg font-bold">Ads Manager</h1>
        <div className="flex-1" />
        <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
          <SelectTrigger className="h-8 text-sm w-[200px]">
            <SelectValue placeholder="Select account..." />
          </SelectTrigger>
          <SelectContent>
            {adAccounts.map(a => (
              <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
          History <IconRefresh className="size-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="size-8">
          <IconRefresh className="size-4 text-muted-foreground" />
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-0 px-6 border-b shrink-0 bg-background">
        {(["campaigns", "adsets", "ads"] as AdsTab[]).map(t => (
          <button
            key={t}
            onClick={() => setAdsTab(t)}
            className={cn(
              "flex items-center gap-1.5 px-0 py-3 mr-7 text-sm border-b-2 transition-colors capitalize",
              adsTab === t
                ? "border-foreground font-medium text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {t === "adsets" ? "Ad Sets" : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 px-6 py-3 border-b shrink-0">
        <div className="relative flex-1 max-w-sm">
          <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground/50" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search to filter by name, ID or metrics..."
            className="w-full pl-9 pr-3 py-2 text-sm bg-muted/40 border rounded-lg outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/50"
          />
        </div>

        <div className="flex items-center gap-1.5 ml-auto">
          <Button size="sm" className="gap-1.5 h-8 text-xs bg-primary text-primary-foreground">
            <IconPlus className="size-3.5" />
            Create
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs">
            <IconCopy className="size-3.5" />
            Duplicate
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs">
            <IconPencil className="size-3.5" />
            Edit
          </Button>
        </div>

        <div className="flex items-center gap-1.5 border-l pl-2">
          <Button variant="outline" size="sm" className="h-8 text-xs gap-1">
            Columns: Performance <IconChevronDown className="size-3" />
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <IconLoader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/20 sticky top-0">
                <th className="w-8 px-4 py-3">
                  <input type="checkbox" className="rounded" />
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">STATUS</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">CAMPAIGN NAME</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">OBJECTIVE</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">BUDGET</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">EFFECTIVE STATUS</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-16 text-muted-foreground text-sm">
                    {loading ? "Loading..." : campaigns.length === 0 ? "No campaigns found" : "No results match your search"}
                  </td>
                </tr>
              ) : (
                filtered.map(c => (
                  <tr key={c.id} className="border-b hover:bg-muted/20 transition-colors group">
                    <td className="px-4 py-3">
                      <input type="checkbox" className="rounded" />
                    </td>
                    <td className="px-4 py-3">
                      <button className="text-muted-foreground hover:text-primary transition-colors">
                        {c.status === "ACTIVE"
                          ? <IconToggleRight className="size-5 text-green-500" />
                          : <IconToggleLeft className="size-5" />
                        }
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-sm">{c.name}</p>
                      <p className="text-[11px] text-muted-foreground">{c.id}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{c.objective}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {c.daily_budget
                        ? `$${(parseInt(c.daily_budget) / 100).toFixed(2)}/day`
                        : c.lifetime_budget
                        ? `$${(parseInt(c.lifetime_budget) / 100).toFixed(2)} lifetime`
                        : "—"
                      }
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        "text-[10px] px-2 py-0.5 rounded-full font-medium",
                        STATUS_COLORS[c.effective_status] || "bg-muted text-muted-foreground"
                      )}>
                        {c.effective_status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
