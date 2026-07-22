"use client"

import { useCallback, useEffect, useMemo, useState, type ElementType, type ReactNode } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import {
  DEFAULT_PAGE_MANAGER_SETTINGS,
  type PageManagerSettings,
  type PageManagerSettingSection,
  type QuickReplyTemplate,
} from "@/lib/page-manager-settings"
import {
  IconAlertTriangle,
  IconBrandFacebook,
  IconBrandInstagram,
  IconArrowBackUp,
  IconCalendarTime,
  IconCheck,
  IconChevronDown,
  IconCirclePlus,
  IconDots,
  IconClock,
  IconGif,
  IconInfoCircle,
  IconEye,
  IconEyeOff,
  IconExternalLink,
  IconFilter,
  IconMessage,
  IconBrandMessenger,
  IconLayoutList,
  IconList,
  IconClockPlay,
  IconMicrophone,
  IconMoodSmile,
  IconPaperclip,
  IconPin,
  IconPhoto,
  IconPlayerPlay,
  IconPlus,
  IconLoader2,
  IconRefresh,
  IconSearch,
  IconSend,
  IconSettings,
  IconSparkles,
  IconShield,
  IconThumbUp,
  IconVideo,
  IconUsers,
  IconColumns3,
  IconX,
  IconInbox,
  IconLayoutSidebar,
} from "@tabler/icons-react"

type PageItem = {
  id: string
  name: string
  picture?: string
  status: "connected" | "synced" | "permission_required" | "disconnected"
  followers: string
  inbox: number
  comments: number
  posts: number
  note: string
}

type PageOption = {
  id: string
  workspacePageId?: string
  metaPageId?: string
  name: string
  category: string
  picture?: string
  status: "connected" | "synced" | "permission_required" | "disconnected"
  isActive?: boolean
}

type AdAccountOption = {
  id: string
  account_id?: string
  name: string
  currency?: string
  account_status?: number
  owner_business?: { id?: string; name?: string }
}

type ThreadItem = {
  id: string
  pageId: string
  name: string
  lastMessage: string
  updatedAt: string
  unread: number
  label: "Sales" | "Support" | "Lead" | "Spam"
  sentiment: "positive" | "neutral" | "negative"
}

type UnifiedInboxThread = {
  id: string
  sourceType: "messenger" | "facebook_comment" | "instagram_comment" | "instagram_dm"
  sourceLabel: string
  pageId: string
  name: string
  lastMessage: string
  updatedAt: string
  latestMessage: string
  latestAt: string
  lastInteractionAt: number
  unread: number
  label: ThreadItem["label"]
  sentiment: ThreadItem["sentiment"]
  responseStatus: "pending" | "replied" | "open" | "hidden"
  status: string
  taskState: "open" | "closed"
  assignedTo: string
  tags: string[]
  comment?: ManagedComment
  commentId?: string
  postId?: string | null
  postMessage?: string | null
  conversation?: MessengerConversation
  conversationId?: string
  customerPsid?: string
  customerProfilePic?: string | null
}

type InboxReplyRecord = {
  text: string
  action: "auto_sent_preview" | "manual_preview"
  at: string
  timestamp: number
  responder: "ai" | "agent"
}

type PostItem = {
  id: string
  scope: "public" | "dark"
  pageId: string
  title: string
  message: string
  time: string
  mediaType: "image" | "video"
  imageUrl: string
  comments: number
  engagement: number
  reach: number
  status: "live" | "draft" | "boosted"
}

type CommentItem = {
  id: string
  pageId: string
  author: string
  message: string
  time: string
  sentiment: "positive" | "neutral" | "negative"
  hidden: boolean
  replied: boolean
  thread: string
}

type RuleItem = {
  name: string
  trigger: string
  action: string
  status: "active" | "draft" | "blocked"
}

type PageInsightPost = {
  id: string
  message: string
  created_time?: string | null
  permalink_url?: string | null
  full_picture?: string | null
  story?: string | null
  status_type?: string | null
  reactions?: number
  comments?: number
  shares?: number
  engagement?: number
  reach?: number
  impressions?: number
  video_views?: number
}

type LaunchBatch = {
  id: string
  page_id?: string | null
  page_name?: string | null
  ad_account_id?: string | null
  ad_account_name?: string | null
  user_name?: string | null
  status?: string
  created_at?: string
  created_ads?: Array<{
    adId?: string
    adSetId?: string
    adSetName?: string
    creativeId?: string
    fileName?: string
    thumbnailUrl?: string | null
    mediaType?: "image" | "video"
    mode?: string
    postId?: string | null
    postUrl?: string | null
  }>
}

type DarkPostItem = {
  batchId: string
  source: "launch_history" | "meta"
  pageId: string
  pageName?: string | null
  userName?: string | null
  adAccountName?: string | null
  launchedAt?: string
  status?: string
  adId?: string
  adSetId?: string
  adSetName?: string
  creativeId?: string
  fileName?: string
  thumbnailUrl?: string | null
  mediaType?: "image" | "video"
  mode?: string
  postId?: string | null
  postUrl?: string | null
  storyIdSource?: "object_story_id" | "effective_object_story_id" | null
  objectStoryId?: string | null
  effectiveObjectStoryId?: string | null
  adName?: string | null
  campaignName?: string | null
  spend?: number | null
  impressions?: number | null
  reach?: number | null
  results?: number | null
  roas?: number | null
  primaryText?: string | null
  headline?: string | null
}

type DarkPostsMeta = {
  inspectedAds: number
  adsWithStoryId: number
  paging?: { after?: string; before?: string } | null
}

type AdInsight = {
  adId: string
  name?: string
  status?: string
  effectiveStatus?: string
  spend: number
  impressions: number
  clicks: number
  ctr: number
  cpc: number
  cpm: number
  reach: number
  actions: number
  costPerAction: number
}

type AiReplyResult = {
  model: string
  intent: string
  confidence: number
  riskLevel: "low" | "medium" | "high"
  action: "send" | "draft" | "assign" | "ignore"
  draftReply: string
  reason: string
  matchedRules: string[]
  matchedTemplate?: { id: string; name: string; shortcut: string } | null
  evidence?: Array<{ id: string; title: string; kind: string; shortcut?: string }>
  customerLanguage?: "vi" | "en"
  guardrails?: {
    threshold: number
    autoReplyEnabled: boolean
    aiDraftReplies: boolean
    fallbackAction: string
    quietHoursActive?: boolean
  }
}

type PostDetailItem = {
  key: string
  scope: "public" | "dark"
  pageId: string
  postId?: string | null
  title: string
  message: string
  time?: string | null
  imageUrl?: string | null
  mediaType: "image" | "video"
  permalink?: string | null
  reactions?: number
  comments?: number
  shares?: number
  engagement?: number
  reach?: number | null
  impressions?: number | null
  videoViews?: number | null
  adId?: string | null
  adSetId?: string | null
  adSetName?: string | null
  campaignName?: string | null
  adName?: string | null
  adAccountName?: string | null
  source?: "launch_history" | "meta"
}

type ManagedComment = {
  id: string
  fb_comment_id: string
  fb_post_id: string | null
  fb_post_message: string | null
  fb_post_permalink?: string | null
  fb_post_full_picture?: string | null
  fb_post_reactions?: number | null
  fb_post_comments?: number | null
  fb_post_shares?: number | null
  page_id: string
  page_name?: string | null
  message: string
  from_name: string | null
  from_id: string | null
  sentiment: "positive" | "neutral" | "negative"
  sentiment_score: number | null
  themes: string[]
  like_count: number
  comment_count: number
  is_hidden: boolean
  is_replied: boolean
  draft_reply?: string | null
  fb_created_time: string | null
  intent?: string | null
  risk_level?: "low" | "medium" | "high" | null
  assigned_to?: string | null
  needs_human?: boolean | null
  has_phone?: boolean | null
}

type MessengerMessage = {
  id: string
  direction: "inbound" | "outbound"
  message_type: "text" | "postback" | "attachment" | "unknown"
  message: string | null
  attachments?: any[]
  fb_created_time: string | null
  created_at: string
}

type MessengerConversation = {
  id: string
  page_id: string
  page_name?: string | null
  customer_psid: string
  customer_name: string | null
  customer_profile_pic?: string | null
  status: "open" | "pending" | "replied" | "closed" | "archived"
  assigned_to?: string | null
  unread_count: number
  last_message: string | null
  last_message_at: string | null
  last_inbound_at?: string | null
  last_outbound_at?: string | null
  messages: MessengerMessage[]
}

type MessengerAttachmentPreview = {
  type: string
  url: string
  title: string
}

type InboxSourceType = UnifiedInboxThread["sourceType"]

type FacebookPostContext = {
  url: string
  storyFbid?: string | null
  pageId?: string | null
  commentId?: string | null
}

type FacebookPostPreview = {
  pageName: string
  pagePicture?: string | null
  message: string
  createdAt?: string | null
  mediaUrl?: string | null
  mediaType: "image" | "video"
  permalink?: string | null
  commentId?: string | null
  reactions?: number | null
  comments?: number | null
  shares?: number | null
}

type CommentAutomation = {
  id: string
  name: string
  description: string | null
  trigger_type: string
  trigger_value: string | null
  action_type: string
  action_value: string | null
  is_active: boolean
  template_name: string | null
  run_count: number
}

type CommentAnalytics = {
  total: number
  positive: number
  neutral: number
  negative: number
  totalReactions: number
  avgSentiment: number
  trend?: { total: number; sentiment: number }
  trend_data?: Array<{ label: string; score: number }>
  volume_data?: Array<{ label: string; count: number }>
  themes?: Array<{ theme: string; count: number }>
}

type CommentFilter = "all" | "unreplied" | "positive" | "neutral" | "negative" | "has_phone" | "competitor" | "ad_comments"
type CommentSort = "newest" | "oldest" | "most-liked"

const COMMENT_PHONE_RE = /(?:\+?84|0)\d[\d\s.()-]{7,14}\d|\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/

function commentHasPhone(comment: { message?: string | null; has_phone?: boolean | null }) {
  if (comment.has_phone) return true
  return COMMENT_PHONE_RE.test(comment.message || "")
}

function commentIsCompetitor(
  comment: { message?: string | null; themes?: string[] | null },
  keywords: string[]
) {
  const msg = (comment.message || "").toLowerCase()
  if (!msg) return false
  if (/(?:inbox\s+mình|shop\s+bán\s+bên|zalo\s*:|liên\s*hệ\s*zalo)/i.test(msg)) return true
  const fromSettings = (keywords || []).map(k => k.trim().toLowerCase()).filter(Boolean)
  return fromSettings.some(k => msg.includes(k)) || (comment.themes || []).some(t => /competitor|spam|đối thủ/i.test(t))
}

type CacheEnvelope<T> = {
  ts: number
  value: T
}

const PAGE_MANAGER_CACHE_TTL_MS = 5 * 60 * 1000
const PAGE_MANAGER_COMMENT_CACHE_TTL_MS = 2 * 60 * 1000
const PAGE_MANAGER_AUTOMATION_CACHE_TTL_MS = 10 * 60 * 1000

function readCachedValue<T>(key: string, ttlMs: number) {
  try {
    const raw = sessionStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CacheEnvelope<T>
    if (!parsed?.ts || Date.now() - parsed.ts > ttlMs) return null
    return parsed.value
  } catch {
    return null
  }
}

function writeCachedValue<T>(key: string, value: T) {
  try {
    sessionStorage.setItem(key, JSON.stringify({ ts: Date.now(), value } satisfies CacheEnvelope<T>))
  } catch { }
}

function getTimeValue(value?: string | null) {
  const time = value ? new Date(value).getTime() : 0
  return Number.isFinite(time) ? time : 0
}

function getRelativeThreadTimestamp(value: string) {
  const now = Date.now()
  const normalized = value.trim().toLowerCase()
  const number = Number(normalized.match(/\d+/)?.[0] || 0)

  if (normalized.includes("m ago")) return now - number * 60_000
  if (normalized.includes("h ago")) return now - number * 60 * 60_000
  if (normalized.includes("d ago")) return now - number * 24 * 60 * 60_000
  return now
}

function sortByNewest<T extends { created_time?: string | null; launchedAt?: string | null; time?: string | null }>(items: T[]) {
  return [...items].sort((a, b) => {
    const right = getTimeValue(b.created_time || b.launchedAt || b.time)
    const left = getTimeValue(a.created_time || a.launchedAt || a.time)
    return right - left
  })
}

const PAGES: PageItem[] = [
  {
    id: "p-1",
    name: "Wellness Nest Daily",
    picture: "/applogo.webp",
    status: "connected",
    followers: "18.2K",
    inbox: 14,
    comments: 89,
    posts: 42,
    note: "Primary review page for Page Manager demo.",
  },
  {
    id: "p-2",
    name: "Dr. Emily's Health Insights",
    picture: "/applogo.webp",
    status: "synced",
    followers: "9.4K",
    inbox: 5,
    comments: 31,
    posts: 18,
    note: "Used for public post and comment moderation examples.",
  },
  {
    id: "p-3",
    name: "Apex Everyday",
    picture: "/applogo.webp",
    status: "permission_required",
    followers: "7.1K",
    inbox: 0,
    comments: 0,
    posts: 11,
    note: "Comment sync uses the selected Page token after Facebook reconnect.",
  },
]

const THREADS: ThreadItem[] = [
  {
    id: "t-1",
    pageId: "p-1",
    name: "Hannah Parker",
    lastMessage: "Can you send the pricing breakdown?",
    updatedAt: "2m ago",
    unread: 2,
    label: "Lead",
    sentiment: "positive",
  },
  {
    id: "t-2",
    pageId: "p-1",
    name: "Marcus Reed",
    lastMessage: "The post link is not working on mobile.",
    updatedAt: "18m ago",
    unread: 0,
    label: "Support",
    sentiment: "negative",
  },
  {
    id: "t-3",
    pageId: "p-2",
    name: "Ava Johnson",
    lastMessage: "Thanks, this helped a lot.",
    updatedAt: "1h ago",
    unread: 0,
    label: "Sales",
    sentiment: "positive",
  },
  {
    id: "t-4",
    pageId: "p-1",
    name: "Noah Chen",
    lastMessage: "Do you have more details on the bundle?",
    updatedAt: "3h ago",
    unread: 1,
    label: "Lead",
    sentiment: "neutral",
  },
]

export const POSTS: PostItem[] = [
  {
    id: "post-1",
    scope: "public",
    pageId: "p-1",
    title: "Women's bone health explainer",
    message: "A short educational post about bone density, flexibility, and menopausal changes.",
    time: "Mar 9, 10:00 AM",
    mediaType: "image",
    imageUrl: "https://images.unsplash.com/photo-1519494026892-80bbd2d6fd6b?auto=format&fit=crop&w=900&q=80",
    comments: 36,
    engagement: 182,
    reach: 4_120,
    status: "live",
  },
  {
    id: "post-2",
    scope: "public",
    pageId: "p-1",
    title: "Shilajit benefits carousel",
    message: "Educational creative with layered product benefits and trust messaging.",
    time: "Mar 8, 4:14 PM",
    mediaType: "video",
    imageUrl: "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=900&q=80",
    comments: 21,
    engagement: 97,
    reach: 2_801,
    status: "boosted",
  },
  {
    id: "post-3",
    scope: "dark",
    pageId: "p-1",
    title: "Offer test creative",
    message: "Dark post mapped to an ad set with performance tracking and no public timeline visibility.",
    time: "Campaign linked",
    mediaType: "video",
    imageUrl: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=900&q=80",
    comments: 9,
    engagement: 64,
    reach: 1_106,
    status: "live",
  },
]

const COMMENTS: CommentItem[] = [
  {
    id: "c-1",
    pageId: "p-1",
    author: "Emily Carter",
    message: "What is the price for the 3-pack bundle?",
    time: "4m ago",
    sentiment: "positive",
    hidden: false,
    replied: false,
    thread: "Product question",
  },
  {
    id: "c-2",
    pageId: "p-1",
    author: "Jason Lee",
    message: "This looks fake. I tried and the link was broken.",
    time: "27m ago",
    sentiment: "negative",
    hidden: true,
    replied: true,
    thread: "Spam / negative",
  },
  {
    id: "c-3",
    pageId: "p-2",
    author: "Sofia Tran",
    message: "Great summary. Can you post more on recovery?",
    time: "1h ago",
    sentiment: "positive",
    hidden: false,
    replied: false,
    thread: "Engagement",
  },
  {
    id: "c-4",
    pageId: "p-1",
    author: "Mike Brown",
    message: "DM me your number.",
    time: "2h ago",
    sentiment: "neutral",
    hidden: true,
    replied: false,
    thread: "Sensitive content",
  },
]

const RULES: RuleItem[] = [
  { name: "Hide toxic replies", trigger: "Spam / phone number / competitor mention", action: "Auto hide comment", status: "active" },
  { name: "Lead capture", trigger: "Question + pricing intent", action: "Send template reply", status: "active" },
  { name: "Escalate support", trigger: "Negative sentiment", action: "Assign to support queue", status: "draft" },
  { name: "Review gate", trigger: "Comment contains offer code", action: "Route to approval", status: "active" },
]

const PAGE_MANAGER_TABS = [
  { id: "inbox", label: "Inbox" },
  { id: "posts", label: "Post" },
  { id: "comments", label: "Comment" },
  { id: "statistics", label: "Statistic" },
  { id: "settings", label: "Setting" },
] as const

const PERMISSIONS = [
  { key: "business_management", label: "Business Managers", state: "ready" },
  { key: "pages_show_list", label: "Page list access", state: "ready" },
  { key: "pages_read_engagement", label: "Comment sync", state: "ready" },
  { key: "pages_manage_engagement", label: "Reply / hide comments", state: "ready" },
  { key: "pages_messaging", label: "Inbox / Messenger", state: "ready" },
  { key: "pages_manage_metadata", label: "Messenger webhooks", state: "ready" },
  { key: "pages_manage_posts", label: "Publish Page posts", state: "ready" },
  { key: "ads_management", label: "Ads management (Ad Comments)", state: "ready" },
]

const FANPAGE_SETTINGS_TABS: Array<{ id: PageManagerSettingSection; label: string; description: string }> = [
  { id: "general", label: "General", description: "Page identity, language, timezone, and operating hours." },
  { id: "notifications", label: "Notifications", description: "Who gets alerted and when the team receives updates." },
  { id: "conversations", label: "Conversations", description: "Inbox sync defaults, status handling, and handoff copy." },
  { id: "automation", label: "Automation", description: "AI draft replies, auto-reply guardrails, and fallback behavior." },
  { id: "commentModeration", label: "Comment Moderation", description: "Spam, phone, competitor, and toxicity filtering rules." },
  { id: "assignmentRules", label: "Assignment Rules", description: "Routing logic for sales, support, and negative sentiment." },
  { id: "tags", label: "Tags", description: "Reusable labels and keyword-based auto-tagging." },
  { id: "quickReplyTemplates", label: "Quick Reply Templates", description: "Saved reply snippets for inbox and comment workflows." },
  { id: "integrations", label: "Integrations", description: "Webhook destinations and external workflow links." },
  { id: "permissions", label: "Permissions", description: "Operational restrictions and Meta permission checklist." },
  { id: "advanced", label: "Advanced", description: "Retention, sync interval, dry-run, and debug controls." },
]

type PageManagerAuditLog = {
  id: string
  action: string
  section: string | null
  changes: any
  created_at: string
  actor_id: string | null
}

function stateTone(state: string) {
  if (state === "ready" || state === "active") return "bg-emerald-50 text-emerald-700 border-emerald-200"
  if (state === "pending" || state === "draft") return "bg-amber-50 text-amber-700 border-amber-200"
  if (state === "planned") return "bg-slate-50 text-slate-600 border-slate-200"
  return "bg-red-50 text-red-700 border-red-200"
}

function pageStatusMeta(status: PageOption["status"]) {
  if (status === "connected") return { label: "Connected", dot: "bg-emerald-500", text: "text-emerald-700" }
  if (status === "synced") return { label: "Synced", dot: "bg-blue-500", text: "text-blue-700" }
  if (status === "disconnected") return { label: "Disconnected", dot: "bg-red-500", text: "text-red-700" }
  return { label: "Permission needed", dot: "bg-amber-500", text: "text-amber-700" }
}

function datePresetToDays(value: string) {
  if (value === "last_7d") return 7
  if (value === "last_90d") return 90
  return 30
}

function normalizeMetaAccountId(id?: string | null) {
  return (id || "").replace(/^act_/, "")
}

function compactNumber(value?: number | null) {
  if (value == null || Number.isNaN(value)) return "-"
  return Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value)
}

function fullNumber(value?: number | null) {
  if (value == null || Number.isNaN(value)) return "-"
  return Intl.NumberFormat("en-US").format(value)
}

function money(value?: number | null) {
  if (value == null || Number.isNaN(value)) return "-"
  return Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value)
}

function postDate(value?: string | null) {
  if (!value) return "No timestamp"
  return new Date(value).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
}

function mapMetaDarkPost(item: any, fallbackPageId: string, fallbackPageName: string | undefined, adAccountName: string | null): DarkPostItem {
  return {
    batchId: item.id || `${item.adId || "meta"}:${item.postId || item.createdTime || ""}`,
    source: "meta",
    pageId: item.pageId || fallbackPageId,
    pageName: item.pageName || fallbackPageName || null,
    userName: "Meta",
    adAccountName,
    launchedAt: item.createdTime || undefined,
    status: item.effectiveStatus || item.adStatus,
    adId: item.adId,
    adSetId: item.adSetId || undefined,
    adSetName: item.adSetName || undefined,
    creativeId: undefined,
    fileName: item.headline || item.adName || item.primaryText || "Meta dark post",
    thumbnailUrl: item.thumbnailUrl || null,
    mediaType: item.mediaType === "video" ? "video" : "image",
    mode: "meta",
    postId: item.postId || null,
    postUrl: item.postUrl || null,
    storyIdSource: item.storyIdSource || null,
    objectStoryId: item.objectStoryId || null,
    effectiveObjectStoryId: item.effectiveObjectStoryId || null,
    adName: item.adName || null,
    campaignName: item.campaignName || null,
    spend: typeof item.spend === "number" ? item.spend : null,
    impressions: typeof item.impressions === "number" ? item.impressions : null,
    reach: typeof item.reach === "number" ? item.reach : null,
    results: typeof item.results === "number" ? item.results : null,
    roas: typeof item.roas === "number" ? item.roas : null,
    primaryText: item.primaryText || null,
    headline: item.headline || null,
  }
}

function StatCard({ label, value, desc, icon: Icon }: { label: string; value: string; desc: string; icon: ElementType }) {
  return (
    <Card size="sm" className="border-border/70 shadow-none">
      <CardContent className="p-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight">{value}</p>
          <p className="mt-1 text-xs text-muted-foreground">{desc}</p>
        </div>
        <div className="size-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <Icon className="size-4" />
        </div>
      </CardContent>
    </Card>
  )
}

function getMessengerAttachmentPreviews(message: MessengerMessage): MessengerAttachmentPreview[] {
  const attachments = Array.isArray(message.attachments) ? message.attachments : []

  return attachments
    .map((attachment: any) => {
      const type = String(attachment?.type || attachment?.mime_type || "attachment").toLowerCase()
      const payload = attachment?.payload || attachment
      const url = String(payload?.url || payload?.sticker_url || payload?.image_url || payload?.src || "").trim()
      if (!url) return null

      const title =
        type.includes("image") ? "Image" :
          type.includes("video") ? "Video" :
            type.includes("audio") ? "Audio" :
              type.includes("file") ? "File" :
                type.includes("sticker") ? "Sticker" :
                  "Attachment"

      return { type, url, title }
    })
    .filter(Boolean) as MessengerAttachmentPreview[]
}

function MessengerAttachmentContent({ message }: { message: MessengerMessage }) {
  const attachments = getMessengerAttachmentPreviews(message)
  const visibleText = message.message && message.message !== "[Attachment]" ? message.message : ""

  if (!attachments.length) {
    return <p className="whitespace-pre-wrap">{visibleText || "[Attachment]"}</p>
  }

  return (
    <div className="space-y-2">
      {visibleText ? <p className="whitespace-pre-wrap">{visibleText}</p> : null}
      {attachments.map((attachment, index) => {
        if (attachment.type.includes("image") || attachment.type.includes("sticker")) {
          return (
            <a key={`${attachment.url}-${index}`} href={attachment.url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-xl border bg-background/70">
              <img src={attachment.url} alt={attachment.title} className="max-h-80 w-full object-contain" loading="lazy" />
            </a>
          )
        }

        if (attachment.type.includes("video")) {
          return (
            <video key={`${attachment.url}-${index}`} src={attachment.url} controls className="max-h-80 w-full rounded-xl border bg-black" />
          )
        }

        if (attachment.type.includes("audio")) {
          return <audio key={`${attachment.url}-${index}`} src={attachment.url} controls className="w-full" />
        }

        return (
          <a
            key={`${attachment.url}-${index}`}
            href={attachment.url}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-between gap-3 rounded-xl border bg-background/70 px-3 py-2 text-xs hover:bg-muted/70"
          >
            <span>{attachment.title}</span>
            <span className="text-muted-foreground">Open</span>
          </a>
        )
      })}
    </div>
  )
}

function isFacebookCommentBridgeMessage(message?: string | null) {
  const text = String(message || "")
  return /facebook created this chat because .* commented on your post/i.test(text) ||
    (/commented on your post/i.test(text) && /comment_id=|story_fbid=|facebook\.com\/story\.php/i.test(text))
}

function inferConversationSourceType(conversation: MessengerConversation): InboxSourceType {
  const messages = conversation.messages || []
  if (messages.some(message => isFacebookCommentBridgeMessage(message.message))) return "facebook_comment"
  return "messenger"
}

function cleanFacebookCommentBridgeMessage(message?: string | null) {
  if (isFacebookCommentBridgeMessage(message)) {
    return "This conversation was created from a Facebook post comment."
  }

  const cleaned = String(message || "")
    .replace(/^Facebook created this chat because\s+/i, "")
    .replace(/\s+You can reply.*$/i, "")
    .replace(/\s*comment\([^)]*\)\s*/i, " ")
    .replace(/\s*https?:\/\/\S+\s*/gi, " ")
    .trim()

  if (!cleaned || /story_fbid=|comment_id=|facebook\.com\/story\.php/i.test(cleaned)) {
    return "This conversation was created from a Facebook post comment."
  }

  return cleaned
}

function extractFacebookPostContext(message?: string | null): FacebookPostContext | null {
  const text = String(message || "")
  const directUrl = text.match(/https?:\/\/(?:www\.)?facebook\.com\/story\.php\?[^)\s]+/i)?.[0]
  const storyFbid = text.match(/[?&]story_fbid=([^&)\s]+)/i)?.[1]
  const pageId = text.match(/[?&]id=([^&)\s]+)/i)?.[1]
  const commentId = text.match(/[?&]comment_id=([^&)\s]+)/i)?.[1]

  if (directUrl) {
    return {
      url: directUrl.replace("facebook.com", "www.facebook.com"),
      storyFbid: storyFbid ? decodeURIComponent(storyFbid) : null,
      pageId: pageId ? decodeURIComponent(pageId) : null,
      commentId: commentId ? decodeURIComponent(commentId) : null,
    }
  }

  if (!storyFbid || !pageId) return null

  const params = new URLSearchParams({
    story_fbid: decodeURIComponent(storyFbid),
    id: decodeURIComponent(pageId),
  })
  if (commentId) params.set("comment_id", decodeURIComponent(commentId))

  return {
    url: `https://www.facebook.com/story.php?${params.toString()}`,
    storyFbid: decodeURIComponent(storyFbid),
    pageId: decodeURIComponent(pageId),
    commentId: commentId ? decodeURIComponent(commentId) : null,
  }
}

function getFacebookPostContext(thread: UnifiedInboxThread): FacebookPostContext | null {
  const bridgeContext = extractFacebookPostContext(getFacebookCommentContextMessage(thread)?.message)
  if (bridgeContext) return bridgeContext
  if (thread.postId) return { url: `https://www.facebook.com/${thread.postId}` }
  return null
}

function normalizeFacebookObjectId(value?: string | null) {
  return decodeURIComponent(String(value || ""))
    .replace(/^https?:\/\/(?:www\.)?facebook\.com\//i, "")
    .replace(/^story\.php\?/i, "")
    .trim()
}

function facebookObjectIdsMatch(left?: string | null, right?: string | null) {
  const a = normalizeFacebookObjectId(left)
  const b = normalizeFacebookObjectId(right)
  if (!a || !b) return false
  return a === b || a.endsWith(`_${b}`) || b.endsWith(`_${a}`)
}

function findFacebookPostForThread(thread: UnifiedInboxThread, posts: PostDetailItem[]) {
  const context = getFacebookPostContext(thread)
  const targetIds = [thread.postId, context?.storyFbid, context?.url].filter(Boolean) as string[]
  if (!targetIds.length) return null

  return posts.find(post => {
    const candidateIds = [post.postId, post.permalink, post.key].filter(Boolean) as string[]
    return targetIds.some(target => candidateIds.some(candidate => facebookObjectIdsMatch(candidate, target) || String(candidate).includes(target)))
  }) || null
}

function buildFacebookPostPreview(thread: UnifiedInboxThread, page: PageOption | null | undefined, posts: PostDetailItem[]): FacebookPostPreview {
  const context = getFacebookPostContext(thread)
  const matchedPost = findFacebookPostForThread(thread, posts)

  return {
    pageName: page?.name || "Facebook Page",
    pagePicture: page?.picture || null,
    message: matchedPost?.message || matchedPost?.title || thread.postMessage || "Open the original post/comment on Facebook.",
    createdAt: matchedPost?.time || thread.comment?.fb_created_time || null,
    mediaUrl: matchedPost?.imageUrl || thread.comment?.fb_post_full_picture || null,
    mediaType: matchedPost?.mediaType || "image",
    permalink: matchedPost?.permalink || thread.comment?.fb_post_permalink || context?.url || null,
    commentId: context?.commentId || thread.comment?.fb_comment_id || thread.commentId || null,
    reactions: matchedPost?.reactions ?? thread.comment?.fb_post_reactions ?? null,
    comments: matchedPost?.comments ?? thread.comment?.fb_post_comments ?? null,
    shares: matchedPost?.shares ?? thread.comment?.fb_post_shares ?? null,
  }
}

function facebookPostPreviewNeedsHydration(preview: FacebookPostPreview | null) {
  if (!preview) return false
  const hasOriginalText = preview.message && preview.message !== "Open the original post/comment on Facebook."
  const hasMetrics = preview.reactions != null || preview.comments != null || preview.shares != null
  return !hasOriginalText || (!preview.mediaUrl && !hasMetrics)
}

function getConversationDisplayMessages(thread: UnifiedInboxThread) {
  const messages = thread.conversation?.messages || []
  if (thread.sourceType !== "facebook_comment") return messages
  return messages.filter(message => !isFacebookCommentBridgeMessage(message.message))
}

function getFacebookCommentContextMessage(thread: UnifiedInboxThread) {
  return thread.conversation?.messages?.find(message => isFacebookCommentBridgeMessage(message.message)) || null
}

function InboxAvatar({
  name,
  src,
  size = "default",
  online,
  sourceType,
}: {
  name: string
  src?: string | null
  size?: "sm" | "default" | "lg"
  online?: boolean
  sourceType?: "messenger" | "facebook_comment" | "instagram_comment" | "instagram_message"
}) {
  const initial = name?.trim()?.charAt(0)?.toUpperCase() || "?"
  return (
    <div className="relative inline-block">
      <Avatar size={size} className={cn(size === "lg" && "size-14", size === "default" && "size-10", size === "sm" && "size-8")}>
        {src ? <AvatarImage src={src} alt={name} /> : null}
        <AvatarFallback className="bg-[#E4E6EB] text-[#050505]">{initial}</AvatarFallback>
        {online ? <span className="absolute bottom-0 right-0 size-3 rounded-full border-2 border-white bg-emerald-500" /> : null}
      </Avatar>
      {sourceType && (
        <span className={cn(
          "absolute -bottom-1 -right-1 flex items-center justify-center rounded-full border border-white p-0.5 shadow-sm",
          sourceType === "messenger" ? "bg-[#0084FF] text-white" : "bg-[#1877F2] text-white"
        )}>
          {sourceType === "messenger" ? (
            <IconBrandMessenger className="size-2.5" />
          ) : (
            <IconMessage className="size-2.5" />
          )}
        </span>
      )}
    </div>
  )
}

function PreviewImage({ src, alt, mediaType }: { src: string; alt: string; mediaType: "image" | "video" }) {
  return (
    <div className="relative aspect-[4/3] overflow-hidden rounded-lg bg-muted">
      <img src={src} alt={alt} className="size-full object-cover" loading="lazy" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent" />
      <div className="absolute bottom-2 left-2 flex items-center gap-1 rounded-full bg-black/55 px-2 py-1 text-xs font-medium text-white">
        {mediaType === "video" ? <IconPlayerPlay className="size-3" /> : <IconPhoto className="size-3" />}
        {mediaType === "video" ? "Video" : "Image"}
      </div>
    </div>
  )
}

function FacebookPostPreviewCard({ preview }: { preview: FacebookPostPreview }) {
  return (
    <div className="rounded-[22px] border border-[#E4E6EB] bg-white shadow-sm dark:bg-background">
      <div className="flex items-start justify-between gap-3 p-3">
        <div className="flex min-w-0 items-start gap-2.5">
          <InboxAvatar name={preview.pageName} src={preview.pagePicture} size="sm" online />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-[#050505] dark:text-foreground">{preview.pageName}</p>
            <p className="text-xs text-[#65676B]">
              {preview.createdAt ? postDate(preview.createdAt) : "Facebook post"} · Sponsored
            </p>
          </div>
        </div>
        {preview.permalink ? (
          <a
            href={preview.permalink}
            target="_blank"
            rel="noreferrer"
            className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[#E4E6EB] px-2.5 py-1.5 text-xs font-medium text-[#0084FF] hover:bg-[#F0F2F5]"
          >
            Open
            <IconExternalLink className="size-3.5" />
          </a>
        ) : null}
      </div>

      <div className="px-3 pb-3">
        <p className="whitespace-pre-wrap text-sm leading-5 text-[#050505] dark:text-foreground">{preview.message}</p>
      </div>

      {preview.mediaUrl ? (
        <div className="border-y border-[#E4E6EB] bg-black">
          <div className="relative mx-auto max-h-[420px] overflow-hidden bg-black">
            <img src={preview.mediaUrl} alt="" className="max-h-[420px] w-full object-contain" loading="lazy" />
            {preview.mediaType === "video" ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="flex size-12 items-center justify-center rounded-full bg-black/55 text-white">
                  <IconPlayerPlay className="size-6" />
                </span>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-3 px-3 py-2 text-xs text-[#65676B]">
        <div className="flex items-center gap-1.5">
          <span className="flex size-5 items-center justify-center rounded-full bg-[#1877F2] text-white">
            <IconThumbUp className="size-3" />
          </span>
          <span>{compactNumber(preview.reactions)}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1">
            <IconMessage className="size-3.5" />
            {compactNumber(preview.comments)} comments
          </span>
          <span className="inline-flex items-center gap-1">
            <IconArrowBackUp className="size-3.5" />
            {compactNumber(preview.shares)} shares
          </span>
        </div>
      </div>

      {preview.commentId ? (
        <div className="border-t border-[#E4E6EB] px-3 py-2 text-xs text-[#65676B]">
          Comment ID: {preview.commentId}
        </div>
      ) : null}
    </div>
  )
}

function PageTag({ page }: { page: PageItem }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border bg-background px-3 py-2">
      <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center overflow-hidden shrink-0">
        {page.picture || page.id ? <img src={page.picture || `/api/facebook/page-picture?page_id=${page.id}`} alt="" className="size-full object-cover" /> : <IconBrandFacebook className="size-4 text-[#1877F2]" />}
      </div>
      <div className="min-w-0">
        <div className="text-sm font-medium truncate">{page.name}</div>
        <div className="text-xs text-muted-foreground truncate">{page.followers} followers</div>
      </div>
    </div>
  )
}

function SettingPanel({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border bg-background p-4">
      <div className="mb-4">
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">{children}</div>
    </div>
  )
}

function ToggleSetting({
  label,
  description,
  checked,
  onChange,
}: {
  label: string
  description: string
  checked: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 rounded-lg border bg-muted/20 p-3 transition-colors hover:bg-muted/40">
      <span className="min-w-0">
        <span className="block text-sm font-medium">{label}</span>
        <span className="mt-1 block text-xs leading-5 text-muted-foreground">{description}</span>
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={event => onChange(event.target.checked)}
        className="mt-1 size-4 accent-primary"
      />
    </label>
  )
}

function TextSetting({
  label,
  description,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string
  description?: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  type?: string
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
      <Input type={type} value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder} />
    </div>
  )
}

function NumberSetting({
  label,
  description,
  value,
  onChange,
  min = 0,
  max,
}: {
  label: string
  description?: string
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
      <Input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={event => onChange(Number(event.target.value))}
      />
    </div>
  )
}

function SelectSetting({
  label,
  description,
  value,
  onChange,
  options,
}: {
  label: string
  description?: string
  value: string
  onChange: (value: string) => void
  options: Array<{ value: string; label: string }>
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map(option => (
            <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

function listToText(value: string[]) {
  return value.join(", ")
}

function textToList(value: string) {
  return Array.from(new Set(value.split(",").map(item => item.trim()).filter(Boolean)))
}

function ListSetting({
  label,
  description,
  value,
  onChange,
  placeholder,
}: {
  label: string
  description?: string
  value: string[]
  onChange: (value: string[]) => void
  placeholder?: string
}) {
  return (
    <div className="space-y-2 md:col-span-2">
      <Label>{label}</Label>
      {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
      <Textarea
        value={listToText(value)}
        onChange={event => onChange(textToList(event.target.value))}
        placeholder={placeholder}
        className="min-h-20"
      />
    </div>
  )
}

export default function PageManagerPage() {
  const [selectedPageId, setSelectedPageId] = useState("")
  const [pageOptions, setPageOptions] = useState<PageOption[]>([])
  const [pagePickerOpen, setPagePickerOpen] = useState(false)
  const [pagePickerSearch, setPagePickerSearch] = useState("")
  const [pagePickerLoading, setPagePickerLoading] = useState(false)
  const [pagePickerError, setPagePickerError] = useState("")
  const [addPagesOpen, setAddPagesOpen] = useState(false)
  const [managePagesOpen, setManagePagesOpen] = useState(false)
  const [availablePages, setAvailablePages] = useState<PageOption[]>([])
  const [availablePagesLoading, setAvailablePagesLoading] = useState(false)
  const [availablePagesSearch, setAvailablePagesSearch] = useState("")
  const [selectedAvailablePageIds, setSelectedAvailablePageIds] = useState<string[]>([])
  const [workspacePages, setWorkspacePages] = useState<PageOption[]>([])
  const [workspacePagesLoading, setWorkspacePagesLoading] = useState(false)
  const [pageActionLoading, setPageActionLoading] = useState(false)
  const [pagesModalError, setPagesModalError] = useState("")
  const [adAccounts, setAdAccounts] = useState<AdAccountOption[]>([])
  const [selectedAdAccountId, setSelectedAdAccountId] = useState("")
  const [adAccountsLoading, setAdAccountsLoading] = useState(false)
  const [adAccountsError, setAdAccountsError] = useState("")
  const [datePreset, setDatePreset] = useState("last_30d")
  const [tab, setTab] = useState<(typeof PAGE_MANAGER_TABS)[number]["id"]>("inbox")
  const [viewDensity, setViewDensity] = useState<"comfortable" | "compact">("comfortable")
  const [activeAgents, setActiveAgents] = useState<{ [threadId: string]: string[] }>({
    "thread-1": ["Kevin", "Seth"] // Mock state for Agent Collision testing
  })
  const [postScope, setPostScope] = useState<"all" | "public" | "dark">("all")
  const [darkPostPageScope, setDarkPostPageScope] = useState<"ad_account" | "selected_page">("selected_page")
  const [selectedThreadId, setSelectedThreadId] = useState(THREADS[0].id)
  const [inboxSourceFilter, setInboxSourceFilter] = useState<"all" | "unread" | "messenger" | "comments" | "ad_comments" | "needs_human" | "orders" | "mentions" | "created_by_me" | "spam">("all")
  const [inboxSearchQuery, setInboxSearchQuery] = useState("")
  const [inboxSearchOpen, setInboxSearchOpen] = useState(false)
  const [inboxSortMode, setInboxSortMode] = useState<"recent" | "alphabet">("recent")
  const [inboxSortMenuOpen, setInboxSortMenuOpen] = useState(false)
  const [sidebarWidth, setSidebarWidth] = useState(220)
  const [queueWidth, setQueueWidth] = useState(360)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)

  const handleDragResize = useCallback((type: "sidebar" | "queue") => (e: React.MouseEvent) => {
    e.preventDefault()
    const startX = e.clientX
    const startWidth = type === "sidebar" ? sidebarWidth : queueWidth
    const frameMax = Math.round(window.innerWidth * 0.3)
    const min = type === "sidebar" ? 180 : 280
    const max = Math.min(frameMax, type === "sidebar" ? 480 : 720)
    const onMouseMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientX - startX
      const newWidth = Math.max(min, Math.min(startWidth + delta, max))
      if (type === "sidebar") setSidebarWidth(newWidth)
      else setQueueWidth(newWidth)
    }
    const onMouseUp = () => {
      document.removeEventListener("mousemove", onMouseMove)
      document.removeEventListener("mouseup", onMouseUp)
    }
    document.addEventListener("mousemove", onMouseMove)
    document.addEventListener("mouseup", onMouseUp)
  }, [sidebarWidth, queueWidth])
  const [inboxListScrollTop, setInboxListScrollTop] = useState(0)
  const [inboxContextOpen, setInboxContextOpen] = useState(false)
  const [selectedCommentFilter, setSelectedCommentFilter] = useState<CommentFilter>("all")
  const [commentSort, setCommentSort] = useState<CommentSort>("newest")
  const [query, setQuery] = useState("")
  const [comments, setComments] = useState<ManagedComment[]>([])
  const [commentsLoading, setCommentsLoading] = useState(false)
  const [commentsError, setCommentsError] = useState("")
  const [commentsSyncing, setCommentsSyncing] = useState(false)
  const [commentsAnalytics, setCommentsAnalytics] = useState<CommentAnalytics | null>(null)
  const [commentsAnalyticsLoading, setCommentsAnalyticsLoading] = useState(false)
  const [postPreviewOverrides, setPostPreviewOverrides] = useState<Record<string, Partial<FacebookPostPreview>>>({})
  const [postPreviewHydrationAttempts, setPostPreviewHydrationAttempts] = useState<Record<string, boolean>>({})
  const [commentAutomations, setCommentAutomations] = useState<CommentAutomation[]>([])
  const [selectedCommentId, setSelectedCommentId] = useState("")
  const [replyText, setReplyText] = useState("")
  const [replyLoading, setReplyLoading] = useState(false)
  const [commentActionLoading, setCommentActionLoading] = useState(false)
  const [pageInsightPosts, setPageInsightPosts] = useState<PageInsightPost[]>([])
  const [pageInsightTotals, setPageInsightTotals] = useState<any>(null)
  const [pageInsightLoading, setPageInsightLoading] = useState(false)
  const [pageInsightError, setPageInsightError] = useState("")
  const [pageInsightPermissionRequired, setPageInsightPermissionRequired] = useState(false)
  const [launchBatches, setLaunchBatches] = useState<LaunchBatch[]>([])
  const [launchHistoryLoading, setLaunchHistoryLoading] = useState(false)
  const [launchHistoryError, setLaunchHistoryError] = useState("")
  const [metaDarkPosts, setMetaDarkPosts] = useState<DarkPostItem[]>([])
  const [metaDarkPostsMeta, setMetaDarkPostsMeta] = useState<DarkPostsMeta | null>(null)
  const [metaDarkPostsLoading, setMetaDarkPostsLoading] = useState(false)
  const [metaDarkPostsError, setMetaDarkPostsError] = useState("")
  const [composerOpen, setComposerOpen] = useState(false)
  const [composerMessage, setComposerMessage] = useState("")
  const [composerImageUrl, setComposerImageUrl] = useState("")
  const [composerLoading, setComposerLoading] = useState(false)
  const [composerError, setComposerError] = useState("")
  const [composerSuccess, setComposerSuccess] = useState("")
  const [selectedPostKey, setSelectedPostKey] = useState("")
  const [darkPostInsights, setDarkPostInsights] = useState<Record<string, AdInsight>>({})
  const [darkPostInsightsLoading, setDarkPostInsightsLoading] = useState(false)
  const [darkPostInsightsError, setDarkPostInsightsError] = useState("")
  const [postComments, setPostComments] = useState<ManagedComment[]>([])
  const [postCommentsLoading, setPostCommentsLoading] = useState(false)
  const [postCommentsSyncing, setPostCommentsSyncing] = useState(false)
  const [postCommentsError, setPostCommentsError] = useState("")
  const [selectedPostCommentId, setSelectedPostCommentId] = useState("")
  const [postReplyText, setPostReplyText] = useState("")
  const [postCommentActionLoading, setPostCommentActionLoading] = useState(false)
  const [settingsTab, setSettingsTab] = useState<PageManagerSettingSection>("general")
  const [pageManagerSettings, setPageManagerSettings] = useState<PageManagerSettings>(DEFAULT_PAGE_MANAGER_SETTINGS)
  const [settingsLoading, setSettingsLoading] = useState(false)
  const [settingsSaving, setSettingsSaving] = useState(false)
  const [settingsError, setSettingsError] = useState("")
  const [settingsSuccess, setSettingsSuccess] = useState("")
  const [settingsSetupRequired, setSettingsSetupRequired] = useState(false)
  const [settingsUpdatedAt, setSettingsUpdatedAt] = useState<string | null>(null)
  const [settingsAuditLogs, setSettingsAuditLogs] = useState<PageManagerAuditLog[]>([])
  const [copyTargetPageId, setCopyTargetPageId] = useState("")
  const [settingsCopying, setSettingsCopying] = useState(false)
  const [aiReplyMessage, setAiReplyMessage] = useState("How much is the bundle and how long does shipping take?")
  const [aiReplyContext, setAiReplyContext] = useState("Wellness supplement brand. Keep replies concise and route refund, medical, or complaint issues to support.")
  const [aiReplyLoading, setAiReplyLoading] = useState(false)
  const [aiReplyError, setAiReplyError] = useState("")
  const [aiReplyResult, setAiReplyResult] = useState<AiReplyResult | null>(null)
  const [inboxReplyText, setInboxReplyText] = useState("")
  const [inboxReplyDrafts, setInboxReplyDrafts] = useState<Record<string, string>>({})
  const [inboxScheduleAt, setInboxScheduleAt] = useState("")
  const [inboxEmotionStatus, setInboxEmotionStatus] = useState<"neutral" | "happy" | "concerned" | "urgent">("neutral")
  const [inboxAttachmentNote, setInboxAttachmentNote] = useState("")
  const [inboxGifQuery, setInboxGifQuery] = useState("")
  const [inboxAiLoading, setInboxAiLoading] = useState(false)
  const [inboxAiError, setInboxAiError] = useState("")
  const [inboxAiResult, setInboxAiResult] = useState<AiReplyResult | null>(null)
  const [inboxAutoReplies, setInboxAutoReplies] = useState<Record<string, InboxReplyRecord>>({})
  const [inboxHandledThreads, setInboxHandledThreads] = useState<Record<string, boolean>>({})
  const [inboxAssignments, setInboxAssignments] = useState<Record<string, string>>({})
  const [inboxTaskState, setInboxTaskState] = useState<Record<string, "open" | "closed">>({})
  const [inboxPinnedThreads, setInboxPinnedThreads] = useState<Record<string, boolean>>({})
  const [inboxGroups, setInboxGroups] = useState<Record<string, string[]>>({})
  const [inboxGroupCollapsed, setInboxGroupCollapsed] = useState<Record<string, boolean>>({})
  const [draggingThreadId, setDraggingThreadId] = useState<string | null>(null)
  const [pinnedContextMenu, setPinnedContextMenu] = useState<{ threadId: string; x: number; y: number } | null>(null)
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false)
  const [inboxAiProcessedThreads, setInboxAiProcessedThreads] = useState<Record<string, boolean>>({})
  const [messengerConversations, setMessengerConversations] = useState<MessengerConversation[]>([])
  const [messengerLoading, setMessengerLoading] = useState(false)
  const [messengerError, setMessengerError] = useState("")
  const [messengerSetupRequired, setMessengerSetupRequired] = useState(false)
  const [messengerSyncing, setMessengerSyncing] = useState(false)
  const [messengerSubscribing, setMessengerSubscribing] = useState(false)
  const [messengerWebhookStatus, setMessengerWebhookStatus] = useState<"idle" | "ready">("idle")

  const mapApiPage = useCallback((page: any): PageOption => ({
    id: page.page_id || page.id,
    workspacePageId: page.workspace_page_id,
    metaPageId: page.meta_page_id,
    name: page.name || page.page_name || page.page_id || page.id,
    category: page.category || "Facebook Page",
    picture: page.picture || page.page_picture_url || undefined,
    status: page.status || "connected",
    isActive: page.is_active !== false,
  }), [])

  const loadWorkspacePages = useCallback(async (activeOnly = true) => {
    setPagePickerLoading(activeOnly)
    setWorkspacePagesLoading(!activeOnly)
    setPagePickerError("")
    try {
      const res = await fetch(`/api/workspace/pages${activeOnly ? "" : "?active=false"}`)
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Failed to load workspace Pages")
      const pages = Array.isArray(data.pages) ? data.pages.map(mapApiPage) : []
      if (activeOnly) setPageOptions(pages)
      else setWorkspacePages(pages)
      return pages
    } catch (err: any) {
      const message = err?.message || "Unable to load workspace Pages."
      if (activeOnly) {
        setPageOptions([])
        setPagePickerError(message)
      } else {
        setWorkspacePages([])
        setPagesModalError(message)
      }
      return []
    } finally {
      setPagePickerLoading(false)
      setWorkspacePagesLoading(false)
    }
  }, [mapApiPage])

  const loadAvailablePages = useCallback(async () => {
    setAvailablePagesLoading(true)
    setPagesModalError("")
    try {
      const res = await fetch("/api/meta/pages/available")
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Failed to load available Pages")
      const pages = Array.isArray(data.pages) ? data.pages.map(mapApiPage) : []
      setAvailablePages(pages)
      return pages
    } catch (err: any) {
      setAvailablePages([])
      setPagesModalError(err?.message || "Unable to load available Pages.")
      return []
    } finally {
      setAvailablePagesLoading(false)
    }
  }, [mapApiPage])

  const syncMetaPages = useCallback(async () => {
    setPageActionLoading(true)
    setPagesModalError("")
    try {
      const res = await fetch("/api/meta/pages/sync", { method: "POST" })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Failed to sync Meta Pages")
      await loadAvailablePages()
      return data
    } catch (err: any) {
      setPagesModalError(err?.message || "Unable to sync Meta Pages.")
      return null
    } finally {
      setPageActionLoading(false)
    }
  }, [loadAvailablePages])

  useEffect(() => {
    void loadWorkspacePages(true)
  }, [loadWorkspacePages])

  useEffect(() => {
    if (selectedPageId && pageOptions.some(page => page.id === selectedPageId)) return
    setSelectedPageId(pageOptions[0]?.id || "")
  }, [pageOptions, selectedPageId])

  useEffect(() => {
    let active = true

    async function loadAdAccounts() {
      setAdAccountsLoading(true)
      setAdAccountsError("")
      try {
        const res = await fetch("/api/facebook/ad-accounts")
        const data = await res.json().catch(() => ({}))
        if (!res.ok && !Array.isArray(data.adAccounts)) {
          throw new Error(data.error || "Failed to load ad accounts")
        }

        const accounts: AdAccountOption[] = (data.adAccounts || []).map((account: any) => ({
          id: account.id || account.fb_ad_account_id,
          account_id: account.account_id || account.fb_account_id,
          name: account.name || account.id || account.fb_ad_account_id,
          currency: account.currency,
          account_status: account.account_status,
          owner_business: account.owner_business || account.business,
        })).filter((account: AdAccountOption) => !!account.id)

        if (active) {
          setAdAccounts(accounts)
          setSelectedAdAccountId(prev => {
            if (prev && accounts.some(account => account.id === prev)) return prev
            const stored = localStorage.getItem("page_manager_selected_ad_account_id")
            return stored && accounts.some(account => account.id === stored)
              ? stored
              : accounts[0]?.id || ""
          })
        }
      } catch (err: any) {
        if (active) {
          setAdAccounts([])
          setAdAccountsError(err?.message || "Unable to load ad accounts.")
        }
      } finally {
        if (active) setAdAccountsLoading(false)
      }
    }

    loadAdAccounts()
    return () => {
      active = false
    }
  }, [])

  const selectedPage = useMemo(
    () => pageOptions.find(option => option.id === selectedPageId) || pageOptions[0] || null,
    [pageOptions, selectedPageId]
  )
  const selectedAdAccount = useMemo(
    () => adAccounts.find(account => account.id === selectedAdAccountId) || null,
    [adAccounts, selectedAdAccountId]
  )
  const selectedDemoPage = useMemo(
    () => PAGES.find(page => page.name === selectedPage?.name) || null,
    [selectedPage?.name]
  )
  const selectedPageMock = useMemo(
    () => selectedDemoPage || PAGES[0],
    [selectedDemoPage]
  )
  const filteredPageOptions = useMemo(() => {
    const q = pagePickerSearch.trim().toLowerCase()
    if (!q) return pageOptions
    return pageOptions.filter(page =>
      [page.name, page.category, page.status].some(value => value.toLowerCase().includes(q))
    )
  }, [pageOptions, pagePickerSearch])
  const copyTargetPages = useMemo(
    () => pageOptions.filter(page => page.id !== selectedPage?.id),
    [pageOptions, selectedPage?.id]
  )
  const filteredAvailablePages = useMemo(() => {
    const q = availablePagesSearch.trim().toLowerCase()
    if (!q) return availablePages
    return availablePages.filter(page =>
      [page.name, page.category, page.status].some(value => value.toLowerCase().includes(q))
    )
  }, [availablePages, availablePagesSearch])

  const updateSettingsSection = useCallback(
    <T extends PageManagerSettingSection>(section: T, patch: Partial<PageManagerSettings[T]>) => {
      setPageManagerSettings(prev => ({
        ...prev,
        [section]: {
          ...prev[section],
          ...patch,
        },
      }))
      setSettingsSuccess("")
      setSettingsError("")
    },
    []
  )

  const loadPageManagerSettings = useCallback(async () => {
    const pageId = selectedPage?.id
    if (!pageId) return
    setSettingsLoading(true)
    setSettingsError("")
    setSettingsSuccess("")
    try {
      const res = await fetch(`/api/page-manager/settings?page_id=${encodeURIComponent(pageId)}`)
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data.error) throw new Error(data.error || "Unable to load Page Manager settings.")
      setPageManagerSettings(data.settings || DEFAULT_PAGE_MANAGER_SETTINGS)
      setSettingsUpdatedAt(data.updatedAt || null)
      setSettingsAuditLogs(Array.isArray(data.auditLogs) ? data.auditLogs : [])
      setSettingsSetupRequired(Boolean(data.setupRequired))
    } catch (err: any) {
      setPageManagerSettings(DEFAULT_PAGE_MANAGER_SETTINGS)
      setSettingsAuditLogs([])
      setSettingsUpdatedAt(null)
      setSettingsSetupRequired(false)
      setSettingsError(err?.message || "Unable to load Page Manager settings.")
    } finally {
      setSettingsLoading(false)
    }
  }, [selectedPage?.id])

  const savePageManagerSettings = useCallback(async () => {
    const pageId = selectedPage?.id
    if (!pageId) return
    setSettingsSaving(true)
    setSettingsError("")
    setSettingsSuccess("")
    try {
      const res = await fetch("/api/page-manager/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          page_id: pageId,
          section: settingsTab,
          settings: pageManagerSettings,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data.error) throw new Error(data.error || "Unable to save Page Manager settings.")
      setPageManagerSettings(data.settings || pageManagerSettings)
      setSettingsUpdatedAt(data.updatedAt || new Date().toISOString())
      setSettingsSetupRequired(Boolean(data.setupRequired))
      const successMessage = data.changes?.length ? `Saved ${data.changes.length} change(s).` : "No changes to save."
      await loadPageManagerSettings()
      setSettingsSuccess(successMessage)
    } catch (err: any) {
      setSettingsError(err?.message || "Unable to save Page Manager settings.")
    } finally {
      setSettingsSaving(false)
    }
  }, [loadPageManagerSettings, pageManagerSettings, selectedPage?.id, settingsTab])

  const copyPageManagerSettings = useCallback(async () => {
    const sourcePageId = selectedPage?.id
    if (!sourcePageId || !copyTargetPageId) return
    setSettingsCopying(true)
    setSettingsError("")
    setSettingsSuccess("")
    try {
      const res = await fetch("/api/page-manager/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "copy",
          source_page_id: sourcePageId,
          target_page_id: copyTargetPageId,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data.error) throw new Error(data.error || "Unable to copy settings.")
      const target = pageOptions.find(page => page.id === copyTargetPageId)
      setSettingsSetupRequired(Boolean(data.setupRequired))
      const successMessage = `Copied settings to ${target?.name || "target Page"}.`
      setCopyTargetPageId("")
      await loadPageManagerSettings()
      setSettingsSuccess(successMessage)
    } catch (err: any) {
      setSettingsError(err?.message || "Unable to copy settings.")
    } finally {
      setSettingsCopying(false)
    }
  }, [copyTargetPageId, loadPageManagerSettings, pageOptions, selectedPage?.id])

  const generateAiReplyPreview = useCallback(async () => {
    const pageId = selectedPage?.id
    if (!pageId) return
    setAiReplyLoading(true)
    setAiReplyError("")
    try {
      const res = await fetch("/api/page-manager/ai-reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          page_id: pageId,
          message: aiReplyMessage,
          context: aiReplyContext,
          customer_name: "Hannah Parker",
          settings: pageManagerSettings,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data.error) throw new Error(data.error || "Unable to generate AI reply.")
      setAiReplyResult(data as AiReplyResult)
    } catch (err: any) {
      setAiReplyError(err?.message || "Unable to generate AI reply.")
    } finally {
      setAiReplyLoading(false)
    }
  }, [aiReplyContext, aiReplyMessage, pageManagerSettings, selectedPage?.id])

  useEffect(() => {
    if (tab !== "settings") return
    void loadPageManagerSettings()
  }, [loadPageManagerSettings, tab])

  const getThreadAssignment = useCallback((thread: ThreadItem) => {
    const override = inboxAssignments[thread.id]
    if (override) return override

    const rules = pageManagerSettings.assignmentRules
    if (!rules.enabled) return "Unassigned"
    if (thread.sentiment === "negative") return rules.negativeSentimentQueue || "Support"

    const message = thread.lastMessage.toLowerCase()
    if (rules.supportKeywords.some(keyword => message.includes(keyword.toLowerCase()))) {
      return rules.defaultTeam === "sales" ? "Support" : rules.defaultTeam || "Support"
    }
    if (rules.salesKeywords.some(keyword => message.includes(keyword.toLowerCase()))) {
      return rules.defaultTeam || "Sales"
    }
    if (rules.assignmentMode === "manual") return rules.defaultAssignee || "Unassigned"
    if (rules.assignmentMode === "team_queue") return rules.defaultTeam || "Team queue"
    if (rules.assignmentMode === "self_assign") return "Unassigned"
    return rules.defaultTeam || "Sales"
  }, [inboxAssignments, pageManagerSettings.assignmentRules])

  const getThreadTags = useCallback((thread: ThreadItem) => {
    const tags = new Set<string>([thread.label])
    const message = thread.lastMessage.toLowerCase()
    const settings = pageManagerSettings.tags

    if (settings.autoTagging) {
      settings.autoApplyRules.forEach(rule => {
        const [rawKeyword, rawTag] = rule.split("=>").map(part => part?.trim()).filter(Boolean)
        if (rawKeyword && rawTag && message.includes(rawKeyword.toLowerCase())) tags.add(rawTag)
      })
      if (settings.vipKeywords.some(keyword => message.includes(keyword.toLowerCase()))) tags.add("VIP")
      if (thread.sentiment === "negative") tags.add("Support")
    }

    return Array.from(tags).slice(0, 3)
  }, [pageManagerSettings.tags])

  const loadMessengerInbox = useCallback(async () => {
    const pageId = selectedPage?.id
    if (!pageId) return

    setMessengerLoading(true)
    setMessengerError("")
    setMessengerSetupRequired(false)

    try {
      const res = await fetch(`/api/page-manager/messenger/inbox?page_id=${encodeURIComponent(pageId)}&limit=80`)
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Unable to load Messenger inbox.")
      setMessengerConversations(Array.isArray(data.conversations) ? data.conversations : [])
      setMessengerSetupRequired(Boolean(data.setupRequired))
      // pageNotRegistered is an info state, not an error — show it gently
      if (data.setupRequired && data.error) setMessengerError(data.error)
      else if (data.pageNotRegistered && data.info) setMessengerError("") // clear error, show demo state
    } catch (err: any) {
      setMessengerConversations([])
      setMessengerError(err?.message || "Unable to load Messenger inbox.")
    } finally {
      setMessengerLoading(false)
    }
  }, [selectedPage?.id])

  const patchMessengerConversation = useCallback(async (
    conversationId: string,
    pageId: string,
    patch: { unread_count?: number; status?: MessengerConversation["status"]; assigned_to?: string }
  ) => {
    setMessengerConversations(prev => prev.map(conversation =>
      conversation.id === conversationId && conversation.page_id === pageId
        ? { ...conversation, ...patch }
        : conversation
    ))

    try {
      const res = await fetch("/api/page-manager/messenger/inbox", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversation_id: conversationId,
          page_id: pageId,
          ...patch,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.conversation) {
        setMessengerConversations(prev => prev.map(conversation =>
          conversation.id === conversationId ? { ...conversation, ...data.conversation } : conversation
        ))
      }
    } catch (err) {
      console.error("[page-manager] failed to patch Messenger conversation", err)
    }
  }, [])

  const allPageThreads = useMemo<UnifiedInboxThread[]>(() => {
    const settings = pageManagerSettings.conversations
    const realMessengerThreads: UnifiedInboxThread[] = messengerConversations
      .filter(conversation => conversation.page_id === selectedPage?.id)
      .map(conversation => {
        const sourceType = inferConversationSourceType(conversation)
        const sourceLabel = sourceType === "facebook_comment" ? "Facebook Comment" : "Messenger"
        const id = `${sourceType}:${conversation.id}`
        const reply = inboxAutoReplies[id]
        const replied = Boolean(reply || conversation.status === "replied")
        const closed = conversation.status === "closed" || inboxTaskState[id] === "closed"
        const pending = !replied && !closed && (conversation.status === "pending" || (conversation.unread_count || 0) > 0)
        const displayMessages = sourceType === "facebook_comment"
          ? conversation.messages.filter(message => !isFacebookCommentBridgeMessage(message.message))
          : conversation.messages
        const lastDisplayMessage = displayMessages[displayMessages.length - 1]
        const baseThread: ThreadItem = {
          id,
          pageId: conversation.page_id,
          name: conversation.customer_name || conversation.customer_psid || "Messenger user",
          lastMessage: lastDisplayMessage?.message || conversation.last_message || `${sourceLabel} interaction`,
          updatedAt: conversation.last_message_at ? postDate(conversation.last_message_at) : "No timestamp",
          unread: conversation.unread_count || 0,
          label: "Lead",
          sentiment: "neutral",
        }
        const lastInteractionAt = reply?.timestamp || getTimeValue(conversation.last_message_at)

        return {
          ...baseThread,
          sourceType,
          sourceLabel,
          conversation,
          conversationId: conversation.id,
          customerPsid: conversation.customer_psid,
          customerProfilePic: conversation.customer_profile_pic || null,
          latestMessage: reply ? `You: ${reply.text}` : baseThread.lastMessage,
          latestAt: reply?.at || baseThread.updatedAt,
          lastInteractionAt,
          responseStatus: replied ? "replied" : pending ? "pending" : "open",
          status: replied ? "replied" : closed ? "closed" : pending ? "pending" : conversation.status || settings.defaultStatus,
          taskState: inboxTaskState[id] || (conversation.status === "closed" ? "closed" : "open"),
          assignedTo: inboxAssignments[id] || conversation.assigned_to || getThreadAssignment(baseThread),
          tags: Array.from(new Set([sourceLabel, ...getThreadTags(baseThread)])).slice(0, 4),
        } satisfies UnifiedInboxThread
      })

    const demoMessengerThreads: UnifiedInboxThread[] = THREADS
      .filter(t => selectedDemoPage ? t.pageId === selectedDemoPage.id : false)
      .filter(t => !settings.ignoreStickerOnlyMessages || !/^(\s*sticker\s*|[👍😀😂❤️]+\s*)$/i.test(t.lastMessage.trim()))
      .map(thread => {
        const reply = inboxAutoReplies[thread.id]
        const handled = Boolean(inboxHandledThreads[thread.id])
        const replied = Boolean(reply)
        const pending = thread.unread > 0 && !replied && !handled
        const lastInteractionAt = reply?.timestamp || getRelativeThreadTimestamp(thread.updatedAt)
        return {
          ...thread,
          sourceType: "messenger",
          sourceLabel: "Messenger",
          unread: replied || handled ? 0 : thread.unread,
          latestMessage: reply ? `You: ${reply.text}` : thread.lastMessage,
          latestAt: reply?.at || thread.updatedAt,
          lastInteractionAt,
          responseStatus: replied || handled ? "replied" : pending ? "pending" : "open",
          status: replied || handled ? "replied" : inboxTaskState[thread.id] === "closed" ? "closed" : pending ? "pending" : settings.defaultStatus,
          taskState: inboxTaskState[thread.id] || "open",
          assignedTo: getThreadAssignment(thread),
          tags: getThreadTags(thread),
        } satisfies UnifiedInboxThread
      })

    const commentThreads: UnifiedInboxThread[] = comments
      .filter(comment => comment.page_id === selectedPage?.id)
      .map(comment => {
        const id = `comment:${comment.id}`
        const reply = inboxAutoReplies[id]
        const handled = Boolean(inboxHandledThreads[id] || comment.is_replied)
        const replied = Boolean(reply || comment.is_replied)
        const pending = !replied && !handled && !comment.is_hidden
        const baseThread: ThreadItem = {
          id,
          pageId: comment.page_id,
          name: comment.from_name || "Facebook user",
          lastMessage: comment.message,
          updatedAt: comment.fb_created_time ? postDate(comment.fb_created_time) : "No timestamp",
          unread: pending ? 1 : 0,
          label: comment.sentiment === "negative" ? "Support" : comment.sentiment === "positive" ? "Lead" : "Sales",
          sentiment: comment.sentiment,
        }
        const tags = Array.from(new Set([
          "Facebook Comment",
          ...getThreadTags(baseThread),
          ...(comment.themes || []).slice(0, 1),
          ...(comment.is_hidden ? ["Hidden"] : []),
        ])).slice(0, 4)
        const lastInteractionAt = reply?.timestamp || getTimeValue(comment.fb_created_time)

        return {
          ...baseThread,
          sourceType: "facebook_comment",
          sourceLabel: "Facebook Comment",
          comment,
          commentId: comment.id,
          postId: comment.fb_post_id,
          postMessage: comment.fb_post_message,
          unread: replied || handled ? 0 : baseThread.unread,
          latestMessage: reply ? `You: ${reply.text}` : comment.message,
          latestAt: reply?.at || baseThread.updatedAt,
          lastInteractionAt,
          responseStatus: comment.is_hidden ? "hidden" : replied || handled ? "replied" : pending ? "pending" : "open",
          status: comment.is_hidden ? "hidden" : replied || handled ? "replied" : inboxTaskState[id] === "closed" ? "closed" : pending ? "pending" : settings.defaultStatus,
          taskState: inboxTaskState[id] || (replied ? "closed" : "open"),
          assignedTo: getThreadAssignment(baseThread),
          tags,
        } satisfies UnifiedInboxThread
      })

    return [...realMessengerThreads, ...demoMessengerThreads, ...commentThreads].sort((a, b) => {
      const recency = b.lastInteractionAt - a.lastInteractionAt
      if (recency !== 0) return recency
      if (settings.unreadFirst) return b.unread - a.unread
      return 0
    })
  }, [
    getThreadAssignment,
    getThreadTags,
    comments,
    messengerConversations,
    inboxHandledThreads,
    inboxAutoReplies,
    inboxAssignments,
    inboxPinnedThreads,
    inboxTaskState,
    pageManagerSettings.conversations,
    selectedDemoPage,
    selectedPage?.id,
  ])

  const pageThreads = useMemo(() => {
    const normalizedQuery = inboxSearchQuery.trim().toLowerCase()
    const matched = allPageThreads.filter(thread => {
      if (normalizedQuery) {
        const groupLabel = thread.sourceType === "facebook_comment"
          ? thread.postId ? "ad comments" : "comments"
          : "messenger"
        const haystack = `${thread.name} ${thread.latestMessage} ${thread.sourceLabel} ${groupLabel} ${thread.assignedTo || ""} ${thread.tags.join(" ")} ${thread.responseStatus} ${thread.responseStatus === "pending" ? "open inbox" : ""}`.toLowerCase()
        if (!haystack.includes(normalizedQuery)) return false
      }
      if (inboxSourceFilter === "unread") return thread.unread > 0 || thread.responseStatus === "pending"
      if (inboxSourceFilter === "messenger") return thread.sourceType === "messenger"
      if (inboxSourceFilter === "comments") return thread.sourceType === "facebook_comment" || thread.sourceType === "instagram_comment"
      if (inboxSourceFilter === "ad_comments") return (thread.sourceType === "facebook_comment" || thread.sourceType === "instagram_comment") && Boolean(thread.postId)
      if (inboxSourceFilter === "needs_human") return thread.sentiment === "negative" || thread.tags.some(tag => /support|hidden|spam|complaint|medical/i.test(tag))
      if (inboxSourceFilter === "orders") return thread.tags.some(tag => /order|cod/i.test(tag))
      if (inboxSourceFilter === "mentions") return thread.latestMessage.includes("@") || thread.tags.some(tag => tag.toLowerCase() === "mention")
      if (inboxSourceFilter === "created_by_me") return thread.latestMessage.startsWith("You:") || thread.responseStatus === "replied"
      if (inboxSourceFilter === "spam") return thread.tags.some(tag => /spam/i.test(tag))
      return true
    })
    if (inboxSortMode === "alphabet") {
      return [...matched].sort((a, b) => a.name.localeCompare(b.name))
    }
    return matched
  }, [allPageThreads, inboxSearchQuery, inboxSourceFilter, inboxSortMode])

  const togglePinThread = useCallback((threadId: string) => {
    setInboxPinnedThreads(prev => {
      const next = { ...prev }
      if (next[threadId]) delete next[threadId]
      else next[threadId] = true
      return next
    })
    setPinnedContextMenu(null)
  }, [])

  const threadGroupId = useCallback((threadId: string): string | null => {
    for (const [leadId, members] of Object.entries(inboxGroups)) {
      if (members.includes(threadId)) return leadId
    }
    return null
  }, [inboxGroups])

  // Drag thread B onto thread A → group (iPhone-folder style).
  const mergeThreadInto = useCallback((draggedId: string, targetId: string) => {
    if (draggedId === targetId) return
    setInboxGroups(prev => {
      const next: Record<string, string[]> = {}
      for (const [lead, members] of Object.entries(prev)) {
        const filtered = members.filter(id => id !== draggedId)
        if (filtered.length >= 2) next[lead] = filtered
        // else: group dissolves when it drops below 2 members
      }

      const targetGroupLead = (() => {
        for (const [lead, members] of Object.entries(next)) {
          if (members.includes(targetId)) return lead
        }
        return null
      })()

      if (targetGroupLead) {
        next[targetGroupLead] = Array.from(new Set([...next[targetGroupLead], draggedId]))
      } else {
        next[targetId] = Array.from(new Set([targetId, draggedId]))
      }

      return next
    })
  }, [])

  const removeThreadFromGroup = useCallback((threadId: string) => {
    setInboxGroups(prev => {
      const next: Record<string, string[]> = {}
      for (const [lead, members] of Object.entries(prev)) {
        const filtered = members.filter(id => id !== threadId)
        if (filtered.length >= 2) {
          next[filtered.includes(lead) ? lead : filtered[0]] = filtered
        }
      }
      return next
    })
  }, [])

  const dismissGroup = useCallback((groupId: string) => {
    setInboxGroups(prev => {
      const next = { ...prev }
      delete next[groupId]
      return next
    })
    setInboxGroupCollapsed(prev => {
      const next = { ...prev }
      delete next[groupId]
      return next
    })
  }, [])

  const groupedPageThreads = useMemo(() => {
    const byId = new Map(pageThreads.map(thread => [thread.id, thread]))
    const consumed = new Set<string>()
    const items: Array<
      | { kind: "thread"; thread: UnifiedInboxThread }
      | { kind: "group"; groupId: string; lead: UnifiedInboxThread; members: UnifiedInboxThread[] }
    > = []

    for (const thread of pageThreads) {
      if (consumed.has(thread.id)) continue
      const members = (inboxGroups[thread.id] || []).map(id => byId.get(id)).filter(Boolean) as UnifiedInboxThread[]
      if (members.length >= 2) {
        members.forEach(member => consumed.add(member.id))
        items.push({ kind: "group", groupId: thread.id, lead: thread, members })
        continue
      }
      if (threadGroupId(thread.id)) continue
      items.push({ kind: "thread", thread })
    }

    return items
  }, [inboxGroups, pageThreads, threadGroupId])

  const pinnedPageThreads = useMemo(
    () => pageThreads.filter(thread => inboxPinnedThreads[thread.id]),
    [inboxPinnedThreads, pageThreads]
  )

  const renderPinnedAvatar = useCallback((thread: UnifiedInboxThread) => (
    <button
      key={`pinned-${thread.id}`}
      type="button"
      draggable
      title={thread.name}
      onDragStart={event => {
        setDraggingThreadId(thread.id)
        event.dataTransfer.setData("text/plain", thread.id)
        event.dataTransfer.effectAllowed = "move"
      }}
      onDragEnd={() => setDraggingThreadId(null)}
      onClick={() => setSelectedThreadId(thread.id)}
      onContextMenu={event => {
        event.preventDefault()
        setPinnedContextMenu({ threadId: thread.id, x: event.clientX, y: event.clientY })
      }}
      className={cn(
        "rounded-full p-0.5 transition-colors hover:bg-[#E7F3FF]",
        selectedThreadId === thread.id && "bg-[#E7F3FF] ring-2 ring-[#0084FF]/35"
      )}
    >
      <InboxAvatar
        name={thread.name}
        src={thread.customerProfilePic || (thread.id === "thread-1" ? (selectedPage?.picture || (selectedPage?.id ? `/api/facebook/page-picture?page_id=${selectedPage.id}` : "/applogo.webp")) : null)}
        online={thread.unread > 0 || thread.responseStatus === "pending"}
      />
    </button>
  ), [selectedPage?.id, selectedPage?.picture, selectedThreadId])

  const renderInboxThreadCard = useCallback((thread: UnifiedInboxThread) => {
    const isActive = selectedThreadId === thread.id
    const isPinned = Boolean(inboxPinnedThreads[thread.id])
    const groupId = threadGroupId(thread.id)
    const isCompact = viewDensity === "compact"

    // SLA Countdown Calculation (15 minutes limit)
    let slaText = ""
    let slaColorClass = ""
    if (thread.responseStatus === "pending" && thread.lastInteractionAt) {
      const msElapsed = Date.now() - thread.lastInteractionAt
      const msRemaining = (15 * 60 * 1000) - msElapsed
      if (msRemaining <= 0) {
        slaText = "EXPIRED"
        slaColorClass = "bg-red-500 text-white animate-pulse"
      } else {
        const minsRemaining = Math.floor(msRemaining / (60 * 1000))
        slaText = `${minsRemaining}m SLA`
        if (minsRemaining <= 5) {
          slaColorClass = "bg-amber-500 text-white animate-pulse"
        } else {
          slaColorClass = "bg-emerald-500 text-white"
        }
      }
    }

    return (
      <button
        key={thread.id}
        draggable
        onDragStart={event => {
          setDraggingThreadId(thread.id)
          event.dataTransfer.setData("text/plain", thread.id)
          event.dataTransfer.effectAllowed = "move"
        }}
        onDragEnd={() => setDraggingThreadId(null)}
        onDragOver={event => {
          if (draggingThreadId && draggingThreadId !== thread.id) event.preventDefault()
        }}
        onDrop={event => {
          event.preventDefault()
          const draggedId = event.dataTransfer.getData("text/plain") || draggingThreadId
          if (draggedId && draggedId !== thread.id) mergeThreadInto(draggedId, thread.id)
          setDraggingThreadId(null)
        }}
        onClick={() => setSelectedThreadId(thread.id)}
        onContextMenu={event => {
          event.preventDefault()
          setPinnedContextMenu({ threadId: thread.id, x: event.clientX, y: event.clientY })
        }}
        className={cn(
          "grid w-full min-w-0 items-start gap-2.5 rounded-2xl px-3 text-left transition-colors",
          isCompact ? "min-h-[64px] grid-cols-[36px_minmax(0,1fr)] py-1.5" : "min-h-[92px] grid-cols-[48px_minmax(0,1fr)] py-2",
          isActive ? "bg-[#E7F3FF] dark:bg-primary/15" : "hover:bg-[#F0F2F5] dark:hover:bg-muted/70",
          isPinned && "ring-1 ring-[#0084FF]/25"
        )}
      >
        <InboxAvatar
          name={thread.name}
          src={thread.customerProfilePic || (thread.id === "thread-1" ? (selectedPage?.picture || (selectedPage?.id ? `/api/facebook/page-picture?page_id=${selectedPage.id}` : "/applogo.webp")) : null)}
          online={thread.unread > 0 || thread.responseStatus === "pending"}
          size={isCompact ? "sm" : "default"}
          sourceType={thread.sourceType as any}
        />

        <div className="min-w-0 max-w-full">
          <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
            <p className={cn("min-w-0 max-w-full truncate text-sm text-[#050505] dark:text-foreground", thread.responseStatus === "pending" || thread.unread > 0 ? "font-semibold" : "font-medium")}>
              {isPinned ? <IconPin className="mr-1 inline size-3.5 text-[#0084FF]" /> : null}
              {thread.name}
            </p>
            <span className="max-w-[84px] truncate text-xs text-[#65676B]">{thread.latestAt}</span>
          </div>
          {!isCompact && (
            <div className="mt-0.5 grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
              <p className={cn(
                "min-w-0 max-w-full truncate text-xs leading-5",
                thread.responseStatus === "pending" || thread.unread > 0 ? "font-semibold text-[#050505] dark:text-foreground" : "text-[#65676B]"
              )}>
                {thread.latestMessage}
              </p>
              {thread.unread > 0 ? <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-[#0084FF] text-xs font-bold text-white">{thread.unread}</span> : null}
            </div>
          )}
          <div className="mt-1 flex max-w-full flex-wrap items-center gap-1">
            {slaText && (
              <Badge className={cn("h-5 whitespace-nowrap rounded-full px-2 text-[10px] font-bold border-none", slaColorClass)}>
                <IconClockPlay className="mr-0.5 size-3" />
                {slaText}
              </Badge>
            )}
            <Badge
              variant="outline"
              className={cn(
                "h-5 whitespace-nowrap rounded-full px-2 text-xs",
                thread.sourceType === "facebook_comment" || thread.sourceType === "instagram_comment"
                  ? "border-violet-200 bg-violet-50 text-violet-700"
                  : "border-blue-200 bg-blue-50 text-blue-700"
              )}
            >
              {thread.sourceLabel}
            </Badge>
            <Badge
              variant="outline"
              className={cn(
                "h-5 whitespace-nowrap rounded-full px-2 text-xs",
                thread.responseStatus === "replied" && "border-emerald-200 bg-emerald-50 text-emerald-700",
                thread.responseStatus === "pending" && "border-amber-200 bg-amber-50 text-amber-700",
                thread.responseStatus === "hidden" && "border-slate-200 bg-slate-100 text-slate-700",
                thread.responseStatus === "open" && "border-border/70 bg-muted/40 text-muted-foreground"
              )}
            >
              {thread.responseStatus === "replied" ? "Replied" : thread.responseStatus === "pending" ? "Pending" : thread.responseStatus === "hidden" ? "Hidden" : "Open"}
            </Badge>
            {isPinned && !isCompact ? (
              <Badge variant="outline" className="h-5 whitespace-nowrap rounded-full border-blue-200 bg-blue-50 px-2 text-xs text-blue-700">Pinned</Badge>
            ) : null}
            {groupId && !isCompact ? (
              <Badge variant="outline" className="h-5 whitespace-nowrap rounded-full border-slate-200 bg-slate-50 px-2 text-xs text-slate-700">Grouped</Badge>
            ) : null}
          </div>
          {!isCompact && (
            <div className="mt-1 flex max-w-full items-center gap-1 text-xs text-[#65676B]">
              {thread.assignedTo && thread.assignedTo !== "Unassigned" ? <span className="truncate">{thread.assignedTo}</span> : <span>Unassigned</span>}
            </div>
          )}
        </div>
      </button>
    )
  }, [
    draggingThreadId,
    inboxPinnedThreads,
    mergeThreadInto,
    selectedPage?.id,
    selectedPage?.picture,
    selectedThreadId,
    threadGroupId,
    viewDensity,
  ])

  const selectedThread = useMemo(
    () => pageThreads.find(t => t.id === selectedThreadId) || pageThreads[0] || {
      ...THREADS[0],
      id: "empty-inbox",
      pageId: selectedPage?.id || "selected-page",
      name: "No conversation selected",
      lastMessage: "No Messenger messages or ad comments loaded for this Page yet.",
      updatedAt: "Now",
      unread: 0,
      label: "Support",
      sentiment: "neutral",
      sourceType: "messenger",
      sourceLabel: "Unified Inbox",
      latestMessage: "No Messenger messages or ad comments loaded for this Page yet.",
      latestAt: "Now",
      lastInteractionAt: Date.now(),
      responseStatus: "open",
      status: pageManagerSettings.conversations.defaultStatus,
      taskState: "open",
      assignedTo: "Unassigned",
      tags: ["Empty"],
    } satisfies UnifiedInboxThread,
    [pageManagerSettings.conversations.defaultStatus, pageThreads, selectedPage?.id, selectedThreadId]
  )
  const selectedThreadAutoReply = selectedThread ? inboxAutoReplies[selectedThread.id] : null
  const shouldShowSelectedThreadAutoReply = Boolean(
    selectedThreadAutoReply &&
    !(
      (selectedThread.sourceType === "messenger" || selectedThread.sourceType === "facebook_comment") &&
      selectedThread.conversation?.messages?.some(message =>
        message.direction === "outbound" &&
        (message.message || "").trim() === selectedThreadAutoReply.text.trim()
      )
    )
  )
  const selectedThreadMeta = useMemo(() => {
    const thread = selectedThread as ThreadItem & Partial<{
      assignedTo: string
      tags: string[]
      status: string
      responseStatus: string
      latestMessage: string
      latestAt: string
      taskState: "open" | "closed"
    }>

    return {
      assignedTo: thread.assignedTo || getThreadAssignment(selectedThread),
      tags: thread.tags || getThreadTags(selectedThread),
      status: thread.status || pageManagerSettings.conversations.defaultStatus,
      responseStatus: thread.responseStatus || "open",
      latestMessage: thread.latestMessage || selectedThread.lastMessage,
      latestAt: thread.latestAt || selectedThread.updatedAt,
      taskState: thread.taskState || inboxTaskState[selectedThread.id] || "open",
    }
  }, [
    getThreadAssignment,
    getThreadTags,
    inboxTaskState,
    pageManagerSettings.conversations.defaultStatus,
    selectedThread,
  ])

  const runInboxAiAutoReplyForThread = useCallback(async (thread: UnifiedInboxThread, options?: { silent?: boolean }) => {
    if (!selectedPage?.id || !thread) return
    const isSelectedThread = thread.id === selectedThread?.id

    if (!options?.silent || isSelectedThread) {
      setInboxAiLoading(true)
      setInboxAiError("")
      if (isSelectedThread) setInboxAiResult(null)
    }

    try {
      const res = await fetch("/api/page-manager/ai-reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          page_id: selectedPage.id,
          message: thread.lastMessage,
          context: [
            `Page: ${selectedPage.name}`,
            `Inbox source: ${thread.sourceLabel}`,
            `Customer: ${thread.name}`,
            `Queue: ${thread.label}`,
            `Sentiment: ${thread.sentiment}`,
            thread.sourceType === "facebook_comment" && thread.postMessage ? `Facebook comment context: ${thread.postMessage}` : "",
            aiReplyContext,
          ].filter(Boolean).join("\n"),
          customer_name: thread.name,
          settings: pageManagerSettings,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data.error) throw new Error(data.error || "Unable to run inbox AI auto reply.")
      const result = data as AiReplyResult
      if (isSelectedThread) {
        setInboxAiResult(result)
      }

      if (result.action === "send") {
        if (thread.sourceType === "facebook_comment" && thread.commentId) {
          const replyRes = await fetch(`/api/comments/${thread.commentId}/reply`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: result.draftReply, page_id: selectedPage.id }),
          })
          const replyData = await replyRes.json().catch(() => ({}))
          if (!replyRes.ok || replyData.error) throw new Error(replyData.error || "Unable to send AI comment reply.")
          try { sessionStorage.removeItem(`page_manager_comments:${selectedPage.id}`) } catch { }
          setComments(prev => prev.map(comment => (
            comment.id === thread.commentId
              ? { ...comment, is_replied: true, draft_reply: result.draftReply }
              : comment
          )))
        } else if ((thread.sourceType === "messenger" || thread.sourceType === "facebook_comment") && thread.conversationId) {
          const replyRes = await fetch("/api/page-manager/messenger/reply", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              page_id: selectedPage.id,
              conversation_id: thread.conversationId,
              message: result.draftReply,
            }),
          })
          const replyData = await replyRes.json().catch(() => ({}))
          if (!replyRes.ok || replyData.error) throw new Error(replyData.error || "Unable to send AI Messenger reply.")
          await loadMessengerInbox()
        } else {
          const repliedAt = Date.now()
          setInboxAutoReplies(prev => ({
            ...prev,
            [thread.id]: {
              text: result.draftReply,
              action: "auto_sent_preview",
              at: new Date(repliedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
              timestamp: repliedAt,
              responder: "ai",
            },
          }))
        }
        if (pageManagerSettings.conversations.autoMarkRead) {
          setInboxHandledThreads(prev => ({ ...prev, [thread.id]: true }))
        }
        if (pageManagerSettings.conversations.taskManagementEnabled) {
          setInboxTaskState(prev => ({ ...prev, [thread.id]: "closed" }))
        }
        if (isSelectedThread) setInboxReplyText("")
      } else if (result.action === "draft") {
        if (isSelectedThread) {
          setInboxReplyText(result.draftReply)
          setInboxReplyDrafts(prev => ({ ...prev, [thread.id]: result.draftReply }))
        }
      } else if (result.action === "assign") {
        setInboxAssignments(prev => ({
          ...prev,
          [thread.id]: pageManagerSettings.assignmentRules.negativeSentimentQueue || pageManagerSettings.assignmentRules.defaultTeam || "Support",
        }))
        if (isSelectedThread) setInboxReplyText("")
      }
      setInboxAiProcessedThreads(prev => ({ ...prev, [thread.id]: true }))
    } catch (err: unknown) {
      if (!options?.silent || isSelectedThread) {
        setInboxAiError(err instanceof Error ? err.message : "Unable to run inbox AI auto reply.")
      }
      setInboxAiProcessedThreads(prev => ({ ...prev, [thread.id]: true }))
    } finally {
      if (!options?.silent || isSelectedThread) setInboxAiLoading(false)
    }
  }, [aiReplyContext, loadMessengerInbox, pageManagerSettings, selectedPage?.id, selectedPage?.name, selectedThread?.id])

  const runInboxAiAutoReply = useCallback(async () => {
    if (!selectedThread) return
    await runInboxAiAutoReplyForThread(selectedThread)
  }, [runInboxAiAutoReplyForThread, selectedThread])

  const applyQuickReplyTemplate = useCallback((template: QuickReplyTemplate) => {
    if (!selectedThread) return
    let body = template.body

    if (pageManagerSettings.quickReplyTemplates.variablesEnabled) {
      const firstName = selectedThread.name.split(/\s+/)[0] || selectedThread.name
      body = body
        .replaceAll("{full_name}", selectedThread.name)
        .replaceAll("{first_name}", firstName)
        .replaceAll("{gender}", "")
    }

    if (pageManagerSettings.quickReplyTemplates.spinSyntaxEnabled) {
      body = body.replace(/\{([^{}|]+(?:\|[^{}|]+)+)\}/g, (_, choices: string) => {
        const options = choices.split("|").map((part: string) => part.trim()).filter(Boolean)
        return options[0] || ""
      })
    }

    setInboxReplyText(body)
    setInboxReplyDrafts(prev => ({ ...prev, [selectedThread.id]: body }))
    setTemplatePickerOpen(false)
  }, [pageManagerSettings.quickReplyTemplates.spinSyntaxEnabled, pageManagerSettings.quickReplyTemplates.variablesEnabled, selectedThread])

  const markInboxThreadReplied = useCallback((threadId: string, text: string, responder: "ai" | "agent" = "agent") => {
    const repliedAt = Date.now()
    setInboxAutoReplies(prev => ({
      ...prev,
      [threadId]: {
        text,
        action: responder === "ai" ? "auto_sent_preview" : "manual_preview",
        at: new Date(repliedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        timestamp: repliedAt,
        responder,
      },
    }))
    if (pageManagerSettings.conversations.autoMarkRead) {
      setInboxHandledThreads(prev => ({ ...prev, [threadId]: true }))
    }
    if (pageManagerSettings.conversations.taskManagementEnabled) {
      setInboxTaskState(prev => ({ ...prev, [threadId]: "closed" }))
    }
  }, [pageManagerSettings.conversations.autoMarkRead, pageManagerSettings.conversations.taskManagementEnabled])

  const handleReplyInboxThread = useCallback(async () => {
    if (!selectedThread || !selectedPage?.id) return
    const base = inboxReplyText.trim()
    if (!base && !inboxAttachmentNote.trim() && !inboxGifQuery.trim()) return

    const extras = [
      inboxEmotionStatus !== "neutral" ? `[${inboxEmotionStatus}]` : "",
      inboxScheduleAt ? `[Scheduled: ${inboxScheduleAt}]` : "",
      inboxAttachmentNote.trim() ? `[Attachment: ${inboxAttachmentNote.trim()}]` : "",
      inboxGifQuery.trim() ? `[GIF: ${inboxGifQuery.trim()}]` : "",
    ].filter(Boolean)
    const message = [base, ...extras].filter(Boolean).join("\n").trim()
    if (!message) return

    if (inboxScheduleAt) {
      const when = new Date(inboxScheduleAt)
      if (Number.isNaN(when.getTime()) || when.getTime() <= Date.now()) {
        setInboxAiError("Schedule time must be in the future.")
        return
      }
      // ponytail: client-side schedule only until posts/messages schedule worker exists
      setInboxReplyDrafts(prev => ({
        ...prev,
        [selectedThread.id]: `[SCHEDULE ${when.toISOString()}]\n${base}`,
      }))
      setInboxAiError("")
      setInboxReplyText("")
      setInboxScheduleAt("")
      setInboxAttachmentNote("")
      setInboxGifQuery("")
      setInboxEmotionStatus("neutral")
      markInboxThreadReplied(selectedThread.id, `Scheduled: ${when.toLocaleString("en-US")}`, "agent")
      return
    }

    setInboxAiError("")
    let persistedReply = false

    if (selectedThread.sourceType === "facebook_comment" && selectedThread.commentId) {
      setCommentActionLoading(true)
      try {
        const res = await fetch(`/api/comments/${selectedThread.commentId}/reply`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message, page_id: selectedPage.id }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.error || "Unable to reply to comment.")
        try { sessionStorage.removeItem(`page_manager_comments:${selectedPage.id}`) } catch { }
        setComments(prev => prev.map(comment => (
          comment.id === selectedThread.commentId
            ? { ...comment, is_replied: true, draft_reply: message }
            : comment
        )))
        persistedReply = true
      } catch (err: any) {
        setInboxAiError(err?.message || "Unable to reply to comment.")
        setCommentActionLoading(false)
        return
      } finally {
        setCommentActionLoading(false)
      }
    }

    if (selectedThread.sourceType === "messenger" && selectedThread.conversationId) {
      setMessengerLoading(true)
      try {
        const res = await fetch("/api/page-manager/messenger/reply", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            page_id: selectedPage.id,
            conversation_id: selectedThread.conversationId,
            message,
          }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok || data.error) throw new Error(data.error || "Unable to send Messenger reply.")
        await loadMessengerInbox()
        persistedReply = true
      } catch (err: any) {
        setInboxAiError(err?.message || "Unable to send Messenger reply.")
        setMessengerLoading(false)
        return
      } finally {
        setMessengerLoading(false)
      }
    }

    if (!persistedReply) {
      markInboxThreadReplied(selectedThread.id, message, "agent")
    }
    setInboxReplyText("")
    setInboxScheduleAt("")
    setInboxAttachmentNote("")
    setInboxGifQuery("")
    setInboxEmotionStatus("neutral")
    setInboxReplyDrafts(prev => {
      const next = { ...prev }
      delete next[selectedThread.id]
      return next
    })
  }, [
    inboxAttachmentNote,
    inboxEmotionStatus,
    inboxGifQuery,
    inboxReplyText,
    inboxScheduleAt,
    loadMessengerInbox,
    markInboxThreadReplied,
    selectedPage?.id,
    selectedThread,
  ])

  const handleToggleInboxCommentHidden = useCallback(async () => {
    if (!selectedThread?.comment || !selectedThread.commentId || !selectedPage?.id) return

    const nextHidden = !selectedThread.comment.is_hidden
    setCommentActionLoading(true)
    setInboxAiError("")

    try {
      const res = await fetch(`/api/comments/${selectedThread.commentId}/hide`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_hidden: nextHidden, page_id: selectedPage.id }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Unable to update comment visibility.")
      try { sessionStorage.removeItem(`page_manager_comments:${selectedPage.id}`) } catch { }
      setComments(prev => prev.map(comment => (
        comment.id === selectedThread.commentId
          ? { ...comment, is_hidden: nextHidden }
          : comment
      )))
      setInboxHandledThreads(prev => ({ ...prev, [selectedThread.id]: true }))
    } catch (err: any) {
      setInboxAiError(err?.message || "Unable to update comment visibility.")
    } finally {
      setCommentActionLoading(false)
    }
  }, [selectedPage?.id, selectedThread])

  useEffect(() => {
    if (!selectedThread?.id) return
    const draft = inboxReplyDrafts[selectedThread.id] || ""
    setInboxReplyText(draft)
    setInboxAiError("")
    setInboxAiResult(null)
    setInboxScheduleAt("")
    setInboxEmotionStatus("neutral")
    setInboxAttachmentNote("")
    setInboxGifQuery("")
    // Only restore when thread changes — not when drafts map updates from typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedThread?.id])

  useEffect(() => {
    if (!selectedThread?.id) return
    const timer = window.setTimeout(() => {
      setInboxReplyDrafts(prev => {
        if ((prev[selectedThread.id] || "") === inboxReplyText) return prev
        return { ...prev, [selectedThread.id]: inboxReplyText }
      })
    }, 250)
    return () => window.clearTimeout(timer)
  }, [inboxReplyText, selectedThread?.id])

  useEffect(() => {
    if (!selectedPage?.id) return
    const key = `page_manager_inbox_drafts:${selectedPage.id}`
    try {
      const raw = window.localStorage.getItem(key)
      if (raw) {
        const parsed = JSON.parse(raw)
        setInboxReplyDrafts(parsed)
        if (selectedThread?.id) setInboxReplyText(parsed[selectedThread.id] || "")
      }
    } catch { }
  }, [selectedPage?.id, selectedThread?.id])

  useEffect(() => {
    if (!selectedPage?.id) return
    try {
      window.localStorage.setItem(`page_manager_inbox_drafts:${selectedPage.id}`, JSON.stringify(inboxReplyDrafts))
    } catch { }
  }, [inboxReplyDrafts, selectedPage?.id])

  useEffect(() => {
    if (!selectedPage?.id) return
    try {
      const raw = window.localStorage.getItem(`page_manager_inbox_pins:${selectedPage.id}`)
      setInboxPinnedThreads(raw ? JSON.parse(raw) : {})
    } catch {
      setInboxPinnedThreads({})
    }
  }, [selectedPage?.id])

  useEffect(() => {
    if (!selectedPage?.id) return
    try {
      window.localStorage.setItem(`page_manager_inbox_pins:${selectedPage.id}`, JSON.stringify(inboxPinnedThreads))
    } catch { }
  }, [inboxPinnedThreads, selectedPage?.id])

  useEffect(() => {
    if (!selectedPage?.id) return
    try {
      const raw = window.localStorage.getItem(`page_manager_inbox_groups:${selectedPage.id}`)
      setInboxGroups(raw ? JSON.parse(raw) : {})
    } catch {
      setInboxGroups({})
    }
    try {
      const rawCollapse = window.localStorage.getItem(`page_manager_inbox_group_collapsed:${selectedPage.id}`)
      setInboxGroupCollapsed(rawCollapse ? JSON.parse(rawCollapse) : {})
    } catch {
      setInboxGroupCollapsed({})
    }
  }, [selectedPage?.id])

  useEffect(() => {
    if (!selectedPage?.id) return
    try {
      window.localStorage.setItem(`page_manager_inbox_groups:${selectedPage.id}`, JSON.stringify(inboxGroups))
    } catch { }
  }, [inboxGroups, selectedPage?.id])

  useEffect(() => {
    if (!selectedPage?.id) return
    try {
      window.localStorage.setItem(`page_manager_inbox_group_collapsed:${selectedPage.id}`, JSON.stringify(inboxGroupCollapsed))
    } catch { }
  }, [inboxGroupCollapsed, selectedPage?.id])

  useEffect(() => {
    if (!pinnedContextMenu) return
    const close = () => setPinnedContextMenu(null)
    window.addEventListener("click", close)
    window.addEventListener("scroll", close, true)
    return () => {
      window.removeEventListener("click", close)
      window.removeEventListener("scroll", close, true)
    }
  }, [pinnedContextMenu])

  useEffect(() => {
    if (tab !== "inbox") return
    if (selectedThread?.sourceType !== "messenger" && selectedThread?.sourceType !== "facebook_comment") return
    if (!selectedThread.conversationId || !selectedThread.pageId || selectedThread.unread <= 0) return

    void patchMessengerConversation(selectedThread.conversationId, selectedThread.pageId, {
      unread_count: 0,
    })
  }, [
    patchMessengerConversation,
    selectedThread?.conversationId,
    selectedThread?.pageId,
    selectedThread?.sourceType,
    selectedThread?.unread,
    tab,
  ])

  useEffect(() => {
    if (tab !== "inbox") return
    if (!pageManagerSettings.automation.autoReplyEnabled) return
    if (inboxAiLoading) return

    const pendingThreads = pageThreads
      .filter(thread => thread.unread > 0)
      .filter(thread => !inboxAiProcessedThreads[thread.id])
      .filter(thread => !inboxAutoReplies[thread.id])
      .slice(0, 3)

    if (!pendingThreads.length) return

    const timer = window.setTimeout(() => {
      pendingThreads.forEach(thread => {
        void runInboxAiAutoReplyForThread(thread, { silent: thread.id !== selectedThread?.id })
      })
    }, 700)

    return () => window.clearTimeout(timer)
  }, [
    inboxAiLoading,
    inboxAiProcessedThreads,
    inboxAutoReplies,
    pageThreads,
    pageManagerSettings.automation.autoReplyEnabled,
    runInboxAiAutoReplyForThread,
    selectedThread,
    tab,
  ])

  const loadComments = useCallback(async (forceRefresh = false) => {
    const pageId = selectedPage?.id
    if (!pageId) return

    setCommentsLoading(true)
    setCommentsAnalyticsLoading(true)
    setCommentsError("")

    try {
      const cacheKey = `page_manager_comments:${pageId}`
      if (!forceRefresh) {
        const cached = readCachedValue<{ comments: ManagedComment[]; analytics: CommentAnalytics | null }>(
          cacheKey,
          PAGE_MANAGER_COMMENT_CACHE_TTL_MS
        )
        if (cached) {
          setComments(cached.comments || [])
          setCommentsAnalytics(cached.analytics || null)
          setCommentAutomations(prev => prev.length ? prev : [])
          return
        }
      }

      const [commentsRes, analyticsRes] = await Promise.all([
        fetch(`/api/comments?page_id=${encodeURIComponent(pageId)}&limit=200`),
        fetch(`/api/comments/analytics?page_id=${encodeURIComponent(pageId)}&range=last_30d`),
      ])

      const commentsData = await commentsRes.json().catch(() => ({}))
      const analyticsData = await analyticsRes.json().catch(() => ({}))

      if (!commentsRes.ok) {
        throw new Error(commentsData.error || "Unable to load comments.")
      }

      setComments(Array.isArray(commentsData.comments) ? commentsData.comments : [])

      if (analyticsRes.ok && !analyticsData.error) {
        setCommentsAnalytics(analyticsData as CommentAnalytics)
      } else {
        setCommentsAnalytics(null)
      }

      writeCachedValue(cacheKey, {
        comments: Array.isArray(commentsData.comments) ? commentsData.comments : [],
        analytics: analyticsRes.ok && !analyticsData.error ? (analyticsData as CommentAnalytics) : null,
      })
    } catch (err: any) {
      setComments([])
      setCommentsAnalytics(null)
      setCommentAutomations([])
      setCommentsError(err?.message || "Unable to load comments.")
    } finally {
      setCommentsLoading(false)
      setCommentsAnalyticsLoading(false)
    }
  }, [selectedPage?.id])

  const loadCommentAutomations = useCallback(async (forceRefresh = false) => {
    const cacheKey = "page_manager_comment_automations"
    if (!forceRefresh) {
      const cached = readCachedValue<CommentAutomation[]>(cacheKey, PAGE_MANAGER_AUTOMATION_CACHE_TTL_MS)
      if (cached) {
        setCommentAutomations(cached)
        return
      }
    }

    try {
      const res = await fetch("/api/comments/automations")
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Unable to load automations.")
      const automations = Array.isArray(data.automations) ? data.automations : []
      setCommentAutomations(automations)
      writeCachedValue(cacheKey, automations)
    } catch {
      setCommentAutomations([])
    }
  }, [])

  const syncComments = useCallback(async () => {
    const pageId = selectedPage?.id
    if (!pageId || commentsSyncing) return

    // Skip sync for demo/mock page IDs — they cannot be synced from Meta
    if (/^p-\d+$/.test(pageId)) return

    setCommentsSyncing(true)
    setCommentsError("")
    try {
      const res = await fetch("/api/comments/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ page_id: pageId, ad_account_id: selectedAdAccountId || undefined }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        let errorMsg = data.error || "Unable to sync comments."
        if (data.needsReconnect || data.type === "object_unavailable" || data.type === "token") {
          try { sessionStorage.removeItem("page_manager_pages_cache") } catch { }
          errorMsg = "This Page is no longer accessible with the current token. Reconnect Facebook, refresh the Page list, then select the Page again."
        } else if (data.type === "permission" || errorMsg.includes("pages_read_engagement") || errorMsg.includes("Public Content Access")) {
          errorMsg = "Comment sync failed: the Facebook App needs 'pages_read_engagement' to read comments. In Live mode, this needs App Review for users outside app roles."
        }
        throw new Error(errorMsg)
      }
      try { sessionStorage.removeItem(`page_manager_comments:${pageId}`) } catch { }
      await loadComments(true)
    } catch (err: any) {
      setCommentsError(err?.message || "Unable to sync comments.")
    } finally {
      setCommentsSyncing(false)
    }
  }, [commentsSyncing, loadComments, selectedAdAccountId, selectedPage?.id])

  const syncMessenger = useCallback(async () => {
    const pageId = selectedPage?.id
    if (!pageId || messengerSyncing) return

    // Skip sync for demo/mock page IDs — they cannot be synced from Meta
    if (/^p-\d+$/.test(pageId)) return

    setMessengerSyncing(true)
    setMessengerError("")
    try {
      const res = await fetch("/api/page-manager/messenger/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ page_id: pageId, full_history: true }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        let errorMsg = data.error || "Unable to sync Messenger."
        if (data.needsReconnect || data.type === "object_unavailable" || data.type === "token") {
          try { sessionStorage.removeItem("page_manager_pages_cache") } catch { }
          errorMsg = "This Page is no longer accessible with the current token. Reconnect Facebook, refresh the Page list, then select the Page again."
        } else if (data.type === "permission" || data.code === 200 || errorMsg.includes("pages_messaging") || errorMsg.includes("appropriate role")) {
          errorMsg = "Messenger sync failed: the Facebook App needs 'pages_messaging' to read messages. In Live mode, this needs App Review for users outside app roles."
        }
        throw new Error(errorMsg)
      }
      await loadMessengerInbox()
    } catch (err: any) {
      setMessengerError(err?.message || "Unable to sync Messenger.")
    } finally {
      setMessengerSyncing(false)
    }
  }, [messengerSyncing, loadMessengerInbox, selectedPage?.id])

  const subscribeMessengerWebhooks = useCallback(async () => {
    const pageId = selectedPage?.id
    if (!pageId || messengerSubscribing) return false

    if (/^p-\d+$/.test(pageId)) {
      setMessengerWebhookStatus("idle")
      return false
    }

    setMessengerSubscribing(true)
    setMessengerError("")
    try {
      const res = await fetch("/api/page-manager/messenger/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ page_id: pageId }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data.error) {
        let errorMsg = data.error || "Unable to enable Messenger webhooks."
        if (data.needsReconnect || data.type === "object_unavailable" || data.type === "token") {
          try { sessionStorage.removeItem("page_manager_pages_cache") } catch { }
          errorMsg = "This Page is no longer accessible with the current token. Reconnect Facebook, refresh the Page list, then select the Page again."
        } else if (data.type === "permission" || errorMsg.includes("pages_manage_metadata")) {
          errorMsg = "Could not enable webhooks: the Facebook App needs 'pages_manage_metadata' for this Page."
        }
        throw new Error(errorMsg)
      }
      setMessengerWebhookStatus("ready")
      return true
    } catch (err: any) {
      setMessengerWebhookStatus("idle")
      setMessengerError(err?.message || "Unable to enable Messenger webhooks.")
      return false
    } finally {
      setMessengerSubscribing(false)
    }
  }, [messengerSubscribing, selectedPage?.id])

  useEffect(() => {
    setMessengerWebhookStatus("idle")
  }, [selectedPage?.id])

  useEffect(() => {
    if (tab !== "comments" && tab !== "inbox") return
    void loadComments(false)
    void loadCommentAutomations(false)
    if (tab === "inbox") void loadMessengerInbox()
  }, [tab, loadComments, loadCommentAutomations, loadMessengerInbox])

  useEffect(() => {
    if (tab !== "inbox" || !selectedPage?.id) return
    const timer = window.setInterval(() => {
      void loadMessengerInbox()
    }, 15000)
    return () => window.clearInterval(timer)
  }, [loadMessengerInbox, selectedPage?.id, tab])

  const visibleComments = useMemo(() => {
    const search = query.trim().toLowerCase()

    const competitorKeywords = pageManagerSettings.commentModeration.competitorKeywords

    const filtered = comments.filter(comment => {
      if (selectedCommentFilter === "unreplied" && comment.is_replied) return false
      if (selectedCommentFilter === "has_phone" && !commentHasPhone(comment)) return false
      if (selectedCommentFilter === "competitor" && !commentIsCompetitor(comment, competitorKeywords)) return false
      if (selectedCommentFilter === "ad_comments" && !comment.fb_post_id) return false
      if (!["all", "unreplied", "has_phone", "competitor", "ad_comments"].includes(selectedCommentFilter) && comment.sentiment !== selectedCommentFilter) return false

      if (!search) return true

      const haystack = [
        comment.from_name,
        comment.message,
        comment.fb_post_message,
        comment.page_name,
        comment.themes?.join(" "),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()

      return haystack.includes(search)
    })

    const sorted = [...filtered]
    if (commentSort === "oldest") {
      sorted.sort((a, b) => {
        const av = a.fb_created_time ? new Date(a.fb_created_time).getTime() : 0
        const bv = b.fb_created_time ? new Date(b.fb_created_time).getTime() : 0
        return av - bv
      })
    } else if (commentSort === "most-liked") {
      sorted.sort((a, b) => (b.like_count || 0) - (a.like_count || 0))
    } else {
      sorted.sort((a, b) => {
        const av = a.fb_created_time ? new Date(a.fb_created_time).getTime() : 0
        const bv = b.fb_created_time ? new Date(b.fb_created_time).getTime() : 0
        return bv - av
      })
    }

    return sorted
  }, [comments, commentSort, pageManagerSettings.commentModeration.competitorKeywords, query, selectedCommentFilter])

  const selectedComment = useMemo(
    () => visibleComments.find(comment => comment.id === selectedCommentId) || visibleComments[0] || null,
    [visibleComments, selectedCommentId]
  )

  useEffect(() => {
    if (!selectedComment?.id) {
      setReplyText("")
      return
    }
    setSelectedCommentId(selectedComment.id)
    setReplyText(selectedComment.draft_reply || "")
  }, [selectedComment?.id, selectedComment?.draft_reply])

  useEffect(() => {
    if (!visibleComments.length) {
      setSelectedCommentId("")
      return
    }
    if (!selectedCommentId || !visibleComments.some(comment => comment.id === selectedCommentId)) {
      setSelectedCommentId(visibleComments[0].id)
    }
  }, [visibleComments, selectedCommentId])

  const commentCounts = useMemo(() => {
    const competitorKeywords = pageManagerSettings.commentModeration.competitorKeywords
    return {
      all: comments.length,
      unreplied: comments.filter(comment => !comment.is_replied).length,
      positive: comments.filter(comment => comment.sentiment === "positive").length,
      neutral: comments.filter(comment => comment.sentiment === "neutral").length,
      negative: comments.filter(comment => comment.sentiment === "negative").length,
      has_phone: comments.filter(commentHasPhone).length,
      competitor: comments.filter(comment => commentIsCompetitor(comment, competitorKeywords)).length,
      ad_comments: comments.filter(comment => Boolean(comment.fb_post_id)).length,
    }
  }, [comments, pageManagerSettings.commentModeration.competitorKeywords])

  const commentThemes = commentsAnalytics?.themes?.slice(0, 6) || []

  const handleSelectComment = (commentId: string) => {
    setSelectedCommentId(commentId)
    const selected = comments.find(comment => comment.id === commentId)
    setReplyText(selected?.draft_reply || "")
  }

  const handleReplySelectedComment = async () => {
    if (!selectedComment || !selectedPage?.id) return
    const message = replyText.trim()
    if (!message) return

    setReplyLoading(true)
    setCommentActionLoading(true)
    setCommentsError("")
    try {
      const res = await fetch(`/api/comments/${selectedComment.id}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, page_id: selectedPage.id }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Unable to send reply.")
      if (selectedPage?.id) {
        try { sessionStorage.removeItem(`page_manager_comments:${selectedPage.id}`) } catch { }
      }
      await loadComments(true)
    } catch (err: any) {
      setCommentsError(err?.message || "Unable to send reply.")
    } finally {
      setReplyLoading(false)
      setCommentActionLoading(false)
    }
  }

  const handleToggleHideSelectedComment = async () => {
    if (!selectedComment || !selectedPage?.id) return

    setCommentActionLoading(true)
    setCommentsError("")
    try {
      const res = await fetch(`/api/comments/${selectedComment.id}/hide`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_hidden: !selectedComment.is_hidden, page_id: selectedPage.id }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Unable to update comment visibility.")
      if (selectedPage?.id) {
        try { sessionStorage.removeItem(`page_manager_comments:${selectedPage.id}`) } catch { }
      }
      await loadComments(true)
    } catch (err: any) {
      setCommentsError(err?.message || "Unable to update comment visibility.")
    } finally {
      setCommentActionLoading(false)
    }
  }

  const loadPosts = useCallback(async (forceRefresh = false) => {
    const pageId = selectedPage?.id
    if (!pageId) return

    setPageInsightLoading(true)
    setLaunchHistoryLoading(true)
    setMetaDarkPostsLoading(!!selectedAdAccountId)
    setPageInsightError("")
    setPageInsightPermissionRequired(false)
    setLaunchHistoryError("")
    setMetaDarkPostsError("")

    try {
      const cacheKey = `page_manager_posts:v3:${pageId}:${selectedAdAccountId || "no-ad-account"}:${datePreset}:${darkPostPageScope}`
      if (!forceRefresh) {
        const cached = readCachedValue<{
          pageInsightPosts: PageInsightPost[]
          pageInsightTotals: any
          pageInsightError?: string
          pageInsightPermissionRequired?: boolean
          launchBatches: LaunchBatch[]
          metaDarkPosts: DarkPostItem[]
          metaDarkPostsMeta: DarkPostsMeta | null
        }>(cacheKey, PAGE_MANAGER_CACHE_TTL_MS)
        if (cached) {
          setPageInsightPosts(cached.pageInsightPosts || [])
          setPageInsightTotals(cached.pageInsightTotals || null)
          setPageInsightError(cached.pageInsightError || "")
          setPageInsightPermissionRequired(Boolean(cached.pageInsightPermissionRequired))
          setLaunchBatches(cached.launchBatches || [])
          setMetaDarkPosts(cached.metaDarkPosts || [])
          setMetaDarkPostsMeta(cached.metaDarkPostsMeta || null)
          return
        }
      }

      const days = datePresetToDays(datePreset)
      const darkPostParams = new URLSearchParams({
        ad_account_id: selectedAdAccountId,
        date_preset: datePreset,
        limit: "100",
      })
      if (darkPostPageScope === "selected_page") {
        darkPostParams.set("page_id", pageId)
      }

      const [insightsRes, historyRes, metaDarkRes] = await Promise.all([
        fetch(`/api/insights/page-insights?pageId=${encodeURIComponent(pageId)}&days=${days}`),
        fetch("/api/launch-history?limit=50"),
        selectedAdAccountId
          ? fetch(`/api/facebook/dark-posts?${darkPostParams.toString()}`)
          : Promise.resolve(null),
      ])

      const [insightsData, historyData, metaDarkData] = await Promise.all([
        insightsRes.json().catch(() => ({})),
        historyRes.json().catch(() => ({})),
        metaDarkRes ? metaDarkRes.json().catch(() => ({})) : Promise.resolve({}),
      ])

      const nextPageInsightPosts = insightsRes.ok && !insightsData.error && Array.isArray(insightsData.recentPosts)
        ? sortByNewest(insightsData.recentPosts as PageInsightPost[])
        : []
      const nextPageInsightTotals = insightsRes.ok && !insightsData.error ? (insightsData.totals || null) : null
      const nextPageInsightPermissionRequired = Boolean(insightsData.recentPostsPermissionRequired)
      const nextPageInsightError = insightsData.recentPostsError || ""
      const nextLaunchBatches = historyRes.ok && !historyData.error && Array.isArray(historyData.batches)
        ? historyData.batches
        : []
      const selectedAdAccountName = adAccounts.find(account => account.id === selectedAdAccountId)?.name || selectedAdAccountId || null
      const nextMetaDarkPosts = metaDarkRes && metaDarkRes.ok && !metaDarkData.error && Array.isArray(metaDarkData.darkPosts)
        ? metaDarkData.darkPosts.map((item: any) => mapMetaDarkPost(item, pageId, selectedPage?.name, selectedAdAccountName))
        : []
      const nextMetaDarkPostsMeta = metaDarkRes && metaDarkRes.ok && !metaDarkData.error
        ? {
          inspectedAds: Number(metaDarkData.inspectedAds || 0),
          adsWithStoryId: Number(metaDarkData.adsWithStoryId || 0),
          paging: metaDarkData.paging || null,
        }
        : null

      if (insightsRes.ok && !insightsData.error) {
        setPageInsightPosts(nextPageInsightPosts)
        setPageInsightTotals(nextPageInsightTotals)
        setPageInsightError(nextPageInsightError)
        setPageInsightPermissionRequired(nextPageInsightPermissionRequired)
      } else {
        setPageInsightPosts([])
        setPageInsightTotals(null)
        setPageInsightPermissionRequired(false)
        setPageInsightError(insightsData.error || "Unable to load public posts.")
      }

      if (historyRes.ok && !historyData.error) {
        setLaunchBatches(nextLaunchBatches)
      } else {
        setLaunchBatches([])
        setLaunchHistoryError(historyData.error || "Unable to load launch history.")
      }

      if (!selectedAdAccountId) {
        setMetaDarkPosts([])
        setMetaDarkPostsMeta(null)
        setMetaDarkPostsError("Select an ad account to load Meta dark posts.")
      } else if (metaDarkRes && metaDarkRes.ok && !metaDarkData.error) {
        setMetaDarkPosts(nextMetaDarkPosts)
        setMetaDarkPostsMeta(nextMetaDarkPostsMeta)
      } else {
        setMetaDarkPosts([])
        setMetaDarkPostsMeta(null)
        setMetaDarkPostsError(metaDarkData.error || "Unable to load Meta dark posts.")
      }

      writeCachedValue(cacheKey, {
        pageInsightPosts: nextPageInsightPosts,
        pageInsightTotals: nextPageInsightTotals,
        pageInsightError: nextPageInsightError,
        pageInsightPermissionRequired: nextPageInsightPermissionRequired,
        launchBatches: nextLaunchBatches,
        metaDarkPosts: nextMetaDarkPosts,
        metaDarkPostsMeta: nextMetaDarkPostsMeta,
      })
    } catch (err: any) {
      setPageInsightPosts([])
      setPageInsightTotals(null)
      setPageInsightPermissionRequired(false)
      setLaunchBatches([])
      setMetaDarkPosts([])
      setMetaDarkPostsMeta(null)
      const msg = err?.message || "Unable to load post data."
      setPageInsightError(msg)
      setLaunchHistoryError(msg)
      setMetaDarkPostsError(msg)
    } finally {
      setPageInsightLoading(false)
      setLaunchHistoryLoading(false)
      setMetaDarkPostsLoading(false)
    }
  }, [adAccounts, darkPostPageScope, datePreset, selectedAdAccountId, selectedPage?.id, selectedPage?.name])

  const publishPost = useCallback(async () => {
    const pageId = selectedPage?.id
    if (!pageId || /^p-\d+$/.test(pageId)) {
      setComposerError("Select a real connected Page first.")
      return
    }
    const message = composerMessage.trim()
    const imageUrl = composerImageUrl.trim()
    if (!message && !imageUrl) {
      setComposerError("Vui lòng nhập nội dung hoặc link ảnh công khai.")
      return
    }

    setComposerLoading(true)
    setComposerError("")
    setComposerSuccess("")
    try {
      const res = await fetch("/api/page-manager/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          page_id: pageId,
          message: message || undefined,
          image_url: imageUrl || undefined,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data.error) throw new Error(data.error || "Unable to publish post.")

      const postId = data.post_id ? String(data.post_id) : `local:${Date.now()}`
      setPageInsightPosts(prev => [
        {
          id: postId,
          message: message || (imageUrl ? "Photo post" : ""),
          created_time: new Date().toISOString(),
          full_picture: imageUrl || null,
          permalink_url: null,
        },
        ...prev,
      ])
      setComposerSuccess(`Published${data.post_id ? ` · ${data.post_id}` : ""}.`)
      setComposerMessage("")
      setComposerImageUrl("")
      setComposerOpen(false)
      void loadPosts(true)
    } catch (err: any) {
      setComposerError(err?.message || "Unable to publish post.")
    } finally {
      setComposerLoading(false)
    }
  }, [composerImageUrl, composerMessage, loadPosts, selectedPage?.id])

  const loadMoreDarkPosts = useCallback(async () => {
    const pageId = selectedPage?.id
    const after = metaDarkPostsMeta?.paging?.after
    if (!pageId || !selectedAdAccountId || !after || metaDarkPostsLoading) return

    setMetaDarkPostsLoading(true)
    setMetaDarkPostsError("")
    try {
      const params = new URLSearchParams({
        ad_account_id: selectedAdAccountId,
        date_preset: datePreset,
        limit: "100",
        after,
      })
      if (darkPostPageScope === "selected_page") {
        params.set("page_id", pageId)
      }

      const res = await fetch(`/api/facebook/dark-posts?${params.toString()}`)
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data.error) throw new Error(data.error || "Unable to load more dark posts.")

      const selectedAdAccountName = adAccounts.find(account => account.id === selectedAdAccountId)?.name || selectedAdAccountId
      const nextItems = Array.isArray(data.darkPosts)
        ? data.darkPosts.map((item: any) => mapMetaDarkPost(item, pageId, selectedPage?.name, selectedAdAccountName))
        : []

      setMetaDarkPosts(prev => {
        const seen = new Set(prev.map(item => item.postId || item.adId || `${item.source}:${item.batchId}`))
        const merged = [...prev]
        for (const item of nextItems) {
          const key = item.postId || item.adId || `${item.source}:${item.batchId}`
          if (!seen.has(key)) {
            seen.add(key)
            merged.push(item)
          }
        }
        return merged
      })
      setMetaDarkPostsMeta(prev => ({
        inspectedAds: (prev?.inspectedAds || 0) + Number(data.inspectedAds || 0),
        adsWithStoryId: (prev?.adsWithStoryId || 0) + Number(data.adsWithStoryId || 0),
        paging: data.paging || null,
      }))
    } catch (err: any) {
      setMetaDarkPostsError(err?.message || "Unable to load more dark posts.")
    } finally {
      setMetaDarkPostsLoading(false)
    }
  }, [
    adAccounts,
    darkPostPageScope,
    datePreset,
    metaDarkPostsLoading,
    metaDarkPostsMeta?.paging?.after,
    selectedAdAccountId,
    selectedPage?.id,
    selectedPage?.name,
  ])

  useEffect(() => {
    if (tab !== "posts") return
    void loadPosts(false)
  }, [tab, loadPosts])

  const launchHistoryDarkPosts = useMemo(() => {
    return launchBatches
      .filter(batch => {
        const pageOk = darkPostPageScope === "selected_page"
          ? batch.page_id === selectedPage?.id
          : true
        const accountOk = selectedAdAccountId && batch.ad_account_id
          ? normalizeMetaAccountId(batch.ad_account_id) === normalizeMetaAccountId(selectedAdAccountId)
          : true
        return pageOk && accountOk
      })
      .flatMap(batch => {
        const createdAds = Array.isArray(batch.created_ads) ? batch.created_ads : []
        return createdAds.map((ad: any): DarkPostItem => ({
          batchId: batch.id,
          source: "launch_history",
          pageId: batch.page_id || selectedPage?.id || "",
          pageName: batch.page_name || selectedPage?.name || null,
          userName: batch.user_name || null,
          adAccountName: batch.ad_account_name || null,
          launchedAt: batch.created_at,
          status: batch.status,
          adId: ad.adId,
          adSetId: ad.adSetId,
          adSetName: ad.adSetName,
          creativeId: ad.creativeId,
          fileName: ad.fileName,
          thumbnailUrl: ad.thumbnailUrl || null,
          mediaType: ad.mediaType || "image",
          mode: ad.mode,
          postId: ad.postId || null,
          postUrl: ad.postUrl || null,
        }))
      })
  }, [darkPostPageScope, launchBatches, selectedAdAccountId, selectedPage?.id, selectedPage?.name])

  const darkPosts = useMemo(() => {
    const seen = new Set<string>()
    const uniqueItems = [...launchHistoryDarkPosts, ...metaDarkPosts].filter(item => {
      const key = item.postId || item.adId || `${item.source}:${item.batchId}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    return sortByNewest(uniqueItems)
  }, [launchHistoryDarkPosts, metaDarkPosts])

  const visiblePublicPosts = useMemo(
    () => sortByNewest(pageInsightPosts.filter(Boolean)),
    [pageInsightPosts]
  )
  const publicPostDetailItems = useMemo<PostDetailItem[]>(() => {
    return visiblePublicPosts.map(post => ({
      key: `public:${post.id}`,
      scope: "public",
      pageId: selectedPage?.id || "",
      postId: post.id,
      title: post.message || post.story || "Post without text",
      message: post.message || post.story || "",
      time: post.created_time,
      imageUrl: post.full_picture || null,
      mediaType: post.status_type?.includes("video") ? "video" : "image",
      permalink: post.permalink_url || null,
      reactions: post.reactions || 0,
      comments: post.comments || 0,
      shares: post.shares || 0,
      engagement: post.engagement || 0,
      reach: post.reach || 0,
      impressions: post.impressions || 0,
      videoViews: post.video_views || 0,
    }))
  }, [selectedPage?.id, visiblePublicPosts])
  const darkPostDetailItems = useMemo<PostDetailItem[]>(() => {
    return darkPosts.map(item => {
      const insight = item.adId ? darkPostInsights[item.adId] : undefined
      return {
        key: `dark:${item.source}:${item.postId || item.adId || item.batchId}`,
        scope: "dark",
        pageId: item.pageId || selectedPage?.id || "",
        postId: item.postId || null,
        title: item.headline || item.fileName || item.adName || item.adSetName || item.adId || "Dark post",
        message: item.primaryText || item.fileName || item.adName || "",
        time: item.launchedAt || null,
        imageUrl: item.thumbnailUrl || null,
        mediaType: item.mediaType || "image",
        permalink: item.postUrl || null,
        reactions: 0,
        comments: 0,
        shares: 0,
        engagement: insight?.actions ?? item.results ?? 0,
        reach: insight?.reach ?? item.reach ?? null,
        impressions: insight?.impressions ?? item.impressions ?? null,
        videoViews: null,
        adId: item.adId || null,
        adSetId: item.adSetId || null,
        adSetName: item.adSetName || null,
        campaignName: item.campaignName || null,
        adName: item.adName || null,
        adAccountName: item.adAccountName || null,
        source: item.source,
      }
    })
  }, [darkPostInsights, darkPosts, selectedPage?.id])
  const postDetailItems = useMemo(() => {
    if (postScope === "public") return publicPostDetailItems
    if (postScope === "dark") return darkPostDetailItems
    return [...publicPostDetailItems, ...darkPostDetailItems]
  }, [darkPostDetailItems, postScope, publicPostDetailItems])
  const selectedThreadPostPreview = useMemo(
    () => {
      if (selectedThread.sourceType !== "facebook_comment") return null
      const preview = buildFacebookPostPreview(selectedThread, selectedPage, postDetailItems)
      const override = postPreviewOverrides[selectedThread.id]
      return override ? { ...preview, ...override } : preview
    },
    [postDetailItems, postPreviewOverrides, selectedPage, selectedThread]
  )
  const selectedPost = useMemo(
    () => postDetailItems.find(item => item.key === selectedPostKey) || postDetailItems[0] || null,
    [postDetailItems, selectedPostKey]
  )
  const selectedDarkInsight = selectedPost?.adId ? darkPostInsights[selectedPost.adId] : undefined
  const featuredPublicPost = visiblePublicPosts[0]
  const secondaryPublicPosts = visiblePublicPosts.slice(1, 6)

  useEffect(() => {
    if (selectedThread.sourceType !== "facebook_comment") return
    if (!selectedPage?.id || selectedThread.id === "empty-inbox") return
    if (!facebookPostPreviewNeedsHydration(selectedThreadPostPreview)) return
    if (postPreviewHydrationAttempts[selectedThread.id]) return

    const context = getFacebookPostContext(selectedThread)
    const postId = selectedThread.postId || context?.storyFbid
    if (!postId) return

    const commentId = selectedThread.comment?.fb_comment_id || context?.commentId || null
    setPostPreviewHydrationAttempts(prev => ({ ...prev, [selectedThread.id]: true }))

    let cancelled = false
    void (async () => {
      try {
        const res = await fetch("/api/comments/post-preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ page_id: selectedPage.id, post_id: postId, comment_id: commentId }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok || !data.preview || cancelled) return

        setPostPreviewOverrides(prev => ({
          ...prev,
          [selectedThread.id]: {
            message: data.preview.message || undefined,
            createdAt: data.preview.createdAt || undefined,
            mediaUrl: data.preview.mediaUrl || undefined,
            mediaType: data.preview.mediaType === "video" ? "video" : "image",
            permalink: data.preview.permalink || undefined,
            reactions: data.preview.reactions ?? null,
            comments: data.preview.comments ?? null,
            shares: data.preview.shares ?? null,
          },
        }))

        if (data.comment?.id) {
          setComments(prev => prev.map(comment => comment.id === data.comment.id ? { ...comment, ...data.comment } : comment))
        }
      } catch (err) {
        console.error("[page-manager] failed to hydrate Facebook post preview", err)
      }
    })()

    return () => { cancelled = true }
  }, [
    postPreviewHydrationAttempts,
    selectedPage?.id,
    selectedThread,
    selectedThreadPostPreview,
  ])
  const publicPostCount = visiblePublicPosts.length
  const darkPostCount = darkPosts.length
  const totalPostCount = publicPostCount + darkPostCount
  const metaDarkPostCount = metaDarkPosts.length
  const launchHistoryDarkPostCount = launchHistoryDarkPosts.length
  const darkPostsLoading = (launchHistoryLoading || metaDarkPostsLoading) && darkPosts.length === 0
  const darkPostsError = [metaDarkPostsError, launchHistoryError].filter(Boolean).join(" ")
  const darkPostAdIds = useMemo(() => {
    const seen = new Set<string>()
    const ids: string[] = []
    for (const post of darkPosts) {
      if (!post.adId || seen.has(post.adId)) continue
      seen.add(post.adId)
      ids.push(post.adId)
    }
    return ids
  }, [darkPosts])

  useEffect(() => {
    if (!postDetailItems.length) {
      setSelectedPostKey("")
      return
    }
    if (!selectedPostKey || !postDetailItems.some(item => item.key === selectedPostKey)) {
      setSelectedPostKey(postDetailItems[0].key)
    }
  }, [postDetailItems, selectedPostKey])

  useEffect(() => {
    if (tab !== "posts" || darkPostAdIds.length === 0) return
    const missingAdIds = darkPostAdIds.filter(adId => !darkPostInsights[adId]).slice(0, 25)
    if (missingAdIds.length === 0) return

    let active = true
    async function loadVisibleDarkInsights() {
      setDarkPostInsightsLoading(true)
      setDarkPostInsightsError("")
      try {
        const res = await fetch("/api/facebook/ads-insights", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ adIds: missingAdIds, datePreset }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok || data.error) throw new Error(data.error || "Unable to load dark post performance.")
        const insights = Array.isArray(data.insights) ? data.insights : []
        if (active && insights.length) {
          setDarkPostInsights(prev => {
            const next = { ...prev }
            for (const insight of insights) {
              if (insight?.adId) next[insight.adId] = insight
            }
            return next
          })
        }
      } catch (err: any) {
        if (active) setDarkPostInsightsError(err?.message || "Unable to load dark post performance.")
      } finally {
        if (active) setDarkPostInsightsLoading(false)
      }
    }

    void loadVisibleDarkInsights()
    return () => {
      active = false
    }
  }, [darkPostAdIds, darkPostInsights, datePreset, tab])

  useEffect(() => {
    if (tab !== "posts" || selectedPost?.scope !== "dark" || !selectedPost.adId) return
    if (darkPostInsights[selectedPost.adId]) return

    let active = true
    async function loadSelectedDarkInsight() {
      setDarkPostInsightsLoading(true)
      setDarkPostInsightsError("")
      try {
        const res = await fetch("/api/facebook/ads-insights", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ adIds: [selectedPost!.adId], datePreset }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok || data.error) throw new Error(data.error || "Unable to load ad performance.")
        const insight = Array.isArray(data.insights) ? data.insights[0] : null
        if (active && insight?.adId) {
          setDarkPostInsights(prev => ({ ...prev, [insight.adId]: insight }))
        }
      } catch (err: any) {
        if (active) setDarkPostInsightsError(err?.message || "Unable to load ad performance.")
      } finally {
        if (active) setDarkPostInsightsLoading(false)
      }
    }

    void loadSelectedDarkInsight()
    return () => {
      active = false
    }
  }, [darkPostInsights, datePreset, selectedPost, tab])

  const loadSelectedPostComments = useCallback(async (forceRefresh = false) => {
    if (!selectedPost?.postId || !selectedPost.pageId) {
      setPostComments([])
      setSelectedPostCommentId("")
      return
    }

    const cacheKey = `page_manager_post_comments:${selectedPost.pageId}:${selectedPost.postId}`
    setPostCommentsLoading(true)
    setPostCommentsError("")
    try {
      if (!forceRefresh) {
        const cached = readCachedValue<ManagedComment[]>(cacheKey, PAGE_MANAGER_COMMENT_CACHE_TTL_MS)
        if (cached) {
          setPostComments(cached)
          return
        }
      }

      const params = new URLSearchParams({
        page_id: selectedPost.pageId,
        post_id: selectedPost.postId,
        limit: "100",
      })
      const res = await fetch(`/api/comments?${params.toString()}`)
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data.error) throw new Error(data.error || "Unable to load post comments.")
      const nextComments = Array.isArray(data.comments) ? data.comments : []
      setPostComments(nextComments)
      writeCachedValue(cacheKey, nextComments)
    } catch (err: any) {
      setPostComments([])
      setPostCommentsError(err?.message || "Unable to load post comments.")
    } finally {
      setPostCommentsLoading(false)
    }
  }, [selectedPost?.pageId, selectedPost?.postId])

  useEffect(() => {
    if (tab !== "posts") return
    void loadSelectedPostComments(false)
  }, [loadSelectedPostComments, tab])

  const selectedPostComment = useMemo(
    () => postComments.find(comment => comment.id === selectedPostCommentId) || postComments[0] || null,
    [postComments, selectedPostCommentId]
  )

  useEffect(() => {
    if (!selectedPostComment?.id) {
      setSelectedPostCommentId("")
      setPostReplyText("")
      return
    }
    setSelectedPostCommentId(selectedPostComment.id)
    setPostReplyText(selectedPostComment.draft_reply || "")
  }, [selectedPostComment?.id, selectedPostComment?.draft_reply])

  const syncSelectedPostComments = useCallback(async () => {
    if (!selectedPost?.postId || !selectedPost.pageId || postCommentsSyncing) return
    setPostCommentsSyncing(true)
    setPostCommentsError("")
    try {
      const res = await fetch("/api/comments/sync-post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ page_id: selectedPost.pageId, post_id: selectedPost.postId }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data.error) throw new Error(data.error || "Unable to sync post comments.")
      try {
        sessionStorage.removeItem(`page_manager_post_comments:${selectedPost.pageId}:${selectedPost.postId}`)
        sessionStorage.removeItem(`page_manager_comments:${selectedPost.pageId}`)
      } catch { }
      if (Array.isArray(data.comments)) {
        setPostComments(data.comments)
      } else {
        await loadSelectedPostComments(true)
      }
    } catch (err: any) {
      setPostCommentsError(err?.message || "Unable to sync post comments.")
    } finally {
      setPostCommentsSyncing(false)
    }
  }, [loadSelectedPostComments, postCommentsSyncing, selectedPost?.pageId, selectedPost?.postId])

  const replyToSelectedPostComment = useCallback(async () => {
    if (!selectedPostComment || !selectedPost?.pageId) return
    const message = postReplyText.trim()
    if (!message) return
    setPostCommentActionLoading(true)
    setPostCommentsError("")
    try {
      const res = await fetch(`/api/comments/${selectedPostComment.id}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, page_id: selectedPost.pageId }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data.error) throw new Error(data.error || "Unable to reply to comment.")
      try {
        if (selectedPost.postId) sessionStorage.removeItem(`page_manager_post_comments:${selectedPost.pageId}:${selectedPost.postId}`)
        sessionStorage.removeItem(`page_manager_comments:${selectedPost.pageId}`)
      } catch { }
      await loadSelectedPostComments(true)
    } catch (err: any) {
      setPostCommentsError(err?.message || "Unable to reply to comment.")
    } finally {
      setPostCommentActionLoading(false)
    }
  }, [loadSelectedPostComments, postReplyText, selectedPost?.pageId, selectedPost?.postId, selectedPostComment])

  const toggleSelectedPostCommentHidden = useCallback(async () => {
    if (!selectedPostComment || !selectedPost?.pageId) return
    setPostCommentActionLoading(true)
    setPostCommentsError("")
    try {
      const res = await fetch(`/api/comments/${selectedPostComment.id}/hide`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_hidden: !selectedPostComment.is_hidden, page_id: selectedPost.pageId }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data.error) throw new Error(data.error || "Unable to update comment visibility.")
      try {
        if (selectedPost.postId) sessionStorage.removeItem(`page_manager_post_comments:${selectedPost.pageId}:${selectedPost.postId}`)
        sessionStorage.removeItem(`page_manager_comments:${selectedPost.pageId}`)
      } catch { }
      await loadSelectedPostComments(true)
    } catch (err: any) {
      setPostCommentsError(err?.message || "Unable to update comment visibility.")
    } finally {
      setPostCommentActionLoading(false)
    }
  }, [loadSelectedPostComments, selectedPost?.pageId, selectedPost?.postId, selectedPostComment])

  const handleSelectPageOption = (page: PageOption) => {
    setSelectedPageId(page.id)
    setDarkPostPageScope("selected_page")
    setPagePickerOpen(false)
  }

  const openAddPagesModal = () => {
    setPagePickerOpen(false)
    setAddPagesOpen(true)
    setSelectedAvailablePageIds([])
    setAvailablePagesSearch("")
    void loadAvailablePages()
  }

  const openManagePagesModal = () => {
    setPagePickerOpen(false)
    setManagePagesOpen(true)
    setPagesModalError("")
    void loadWorkspacePages(false)
  }

  const toggleAvailablePageSelection = (metaPageId?: string) => {
    if (!metaPageId) return
    setSelectedAvailablePageIds(prev =>
      prev.includes(metaPageId)
        ? prev.filter(id => id !== metaPageId)
        : [...prev, metaPageId]
    )
  }

  const addSelectedPagesToWorkspace = async () => {
    if (!selectedAvailablePageIds.length) return
    setPageActionLoading(true)
    setPagesModalError("")
    try {
      const res = await fetch("/api/workspace/pages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meta_page_ids: selectedAvailablePageIds }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Unable to add selected Pages")
      const pages = Array.isArray(data.pages) ? data.pages.map(mapApiPage) : []
      setPageOptions(pages)
      setSelectedAvailablePageIds([])
      setAddPagesOpen(false)
      if (!selectedPageId && pages[0]) setSelectedPageId(pages[0].id)
      await loadAvailablePages()
    } catch (err: any) {
      setPagesModalError(err?.message || "Unable to add selected Pages.")
    } finally {
      setPageActionLoading(false)
    }
  }

  const updateWorkspacePageActive = async (page: PageOption, isActive: boolean) => {
    if (!page.workspacePageId) return
    setPageActionLoading(true)
    setPagesModalError("")
    try {
      const res = await fetch(`/api/workspace/pages/${page.workspacePageId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: isActive }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Unable to update Page")
      await Promise.all([loadWorkspacePages(true), loadWorkspacePages(false), loadAvailablePages()])
    } catch (err: any) {
      setPagesModalError(err?.message || "Unable to update Page.")
    } finally {
      setPageActionLoading(false)
    }
  }

  const removeWorkspacePage = async (page: PageOption) => {
    if (!page.workspacePageId) return
    setPageActionLoading(true)
    setPagesModalError("")
    try {
      const res = await fetch(`/api/workspace/pages/${page.workspacePageId}`, { method: "DELETE" })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Unable to remove Page")
      await Promise.all([loadWorkspacePages(true), loadWorkspacePages(false), loadAvailablePages()])
    } catch (err: any) {
      setPagesModalError(err?.message || "Unable to remove Page.")
    } finally {
      setPageActionLoading(false)
    }
  }

  const activeSettingsMeta = FANPAGE_SETTINGS_TABS.find(item => item.id === settingsTab) || FANPAGE_SETTINGS_TABS[0]

  const updateTemplate = (id: string, patch: Partial<QuickReplyTemplate>) => {
    updateSettingsSection("quickReplyTemplates", {
      templates: pageManagerSettings.quickReplyTemplates.templates.map(template =>
        template.id === id ? { ...template, ...patch } : template
      ),
    })
  }

  const addTemplate = () => {
    updateSettingsSection("quickReplyTemplates", {
      templates: [
        ...pageManagerSettings.quickReplyTemplates.templates,
        { id: `template-${Date.now()}`, name: "New template", shortcut: "/new", body: "Write a short reusable reply here." },
      ],
    })
  }

  const removeTemplate = (id: string) => {
    updateSettingsSection("quickReplyTemplates", {
      templates: pageManagerSettings.quickReplyTemplates.templates.filter(template => template.id !== id),
    })
  }

  const renderFanpageSettingsFields = () => {
    const s = pageManagerSettings

    if (settingsTab === "general") {
      return (
        <SettingPanel title="General defaults" description="These values control how this Page appears and behaves across Page Manager.">
          <ToggleSetting label="Enable Page Manager" description="Allow this Page to participate in inbox, post, and comment workflows." checked={s.general.enabled} onChange={enabled => updateSettingsSection("general", { enabled })} />
          <ToggleSetting label="Use business hours" description="Apply quiet workflow behavior outside the configured operating window." checked={s.general.businessHoursEnabled} onChange={businessHoursEnabled => updateSettingsSection("general", { businessHoursEnabled })} />
          <TextSetting label="Page nickname" description="Optional internal name shown to operators." value={s.general.pageNickname} onChange={pageNickname => updateSettingsSection("general", { pageNickname })} placeholder={selectedPage?.name || "Internal Page name"} />
          <SelectSetting label="Default language" value={s.general.defaultLanguage} onChange={defaultLanguage => updateSettingsSection("general", { defaultLanguage })} options={[{ value: "en", label: "English" }, { value: "vi", label: "Vietnamese" }, { value: "es", label: "Spanish" }]} />
          <TextSetting label="Timezone" value={s.general.timezone} onChange={timezone => updateSettingsSection("general", { timezone })} placeholder="Asia/Ho_Chi_Minh" />
          <div className="grid gap-3 sm:grid-cols-2">
            <TextSetting label="Open" type="time" value={s.general.businessHoursStart} onChange={businessHoursStart => updateSettingsSection("general", { businessHoursStart })} />
            <TextSetting label="Close" type="time" value={s.general.businessHoursEnd} onChange={businessHoursEnd => updateSettingsSection("general", { businessHoursEnd })} />
          </div>
        </SettingPanel>
      )
    }

    if (settingsTab === "notifications") {
      return (
        <SettingPanel title="Notification routing" description="Control where operational alerts are sent for this Page.">
          <ToggleSetting label="Email notifications" description="Send email alerts for selected Page events." checked={s.notifications.emailEnabled} onChange={emailEnabled => updateSettingsSection("notifications", { emailEnabled })} />
          <ToggleSetting label="Slack notifications" description="Send alerts to the configured Slack webhook." checked={s.notifications.slackEnabled} onChange={slackEnabled => updateSettingsSection("notifications", { slackEnabled })} />
          <ToggleSetting label="Sound notifications" description="Play an operator sound when new messages or high-priority interactions arrive." checked={s.notifications.soundEnabled} onChange={soundEnabled => updateSettingsSection("notifications", { soundEnabled })} />
          <ToggleSetting label="New message alerts" description="Notify when a Page conversation enters the queue." checked={s.notifications.notifyOnNewMessage} onChange={notifyOnNewMessage => updateSettingsSection("notifications", { notifyOnNewMessage })} />
          <ToggleSetting label="Negative comment alerts" description="Notify when sentiment or moderation rules detect risk." checked={s.notifications.notifyOnNegativeComment} onChange={notifyOnNegativeComment => updateSettingsSection("notifications", { notifyOnNegativeComment })} />
          <ToggleSetting label="Failed sync alerts" description="Notify admins when Meta API sync fails." checked={s.notifications.notifyOnFailedSync} onChange={notifyOnFailedSync => updateSettingsSection("notifications", { notifyOnFailedSync })} />
          <SelectSetting label="Sound" value={s.notifications.soundName} onChange={soundName => updateSettingsSection("notifications", { soundName })} options={[{ value: "soft_ping", label: "Soft ping" }, { value: "messenger_pop", label: "Messenger pop" }, { value: "urgent_chime", label: "Urgent chime" }, { value: "silent", label: "Silent" }]} />
          <SelectSetting label="Digest frequency" value={s.notifications.digestFrequency} onChange={digestFrequency => updateSettingsSection("notifications", { digestFrequency })} options={[{ value: "off", label: "Off" }, { value: "hourly", label: "Hourly" }, { value: "daily", label: "Daily" }, { value: "weekly", label: "Weekly" }]} />
          <ListSetting label="Recipients" description="Comma-separated emails or internal handles." value={s.notifications.recipients} onChange={recipients => updateSettingsSection("notifications", { recipients })} placeholder="ops@company.com, sales@company.com" />
        </SettingPanel>
      )
    }

    if (settingsTab === "conversations") {
      return (
        <SettingPanel title="Conversation workflow" description="Configure inbox sync and operator handoff defaults.">
          <ToggleSetting label="Conversation sync" description="Enable Messenger conversation sync when permissions are available." checked={s.conversations.syncEnabled} onChange={syncEnabled => updateSettingsSection("conversations", { syncEnabled })} />
          <ToggleSetting label="Auto-mark handled" description="Mark conversations as handled after an operator sends a reply." checked={s.conversations.autoMarkRead} onChange={autoMarkRead => updateSettingsSection("conversations", { autoMarkRead })} />
          <ToggleSetting label="Unread first" description="Push unread and unreplied conversations to the top of the queue." checked={s.conversations.unreadFirst} onChange={unreadFirst => updateSettingsSection("conversations", { unreadFirst })} />
          <ToggleSetting label="Task management" description="Allow operators to open and close tasks inside each conversation." checked={s.conversations.taskManagementEnabled} onChange={taskManagementEnabled => updateSettingsSection("conversations", { taskManagementEnabled })} />
          <ToggleSetting label="Show assigned staff" description="Display the staff member currently responsible for each conversation." checked={s.conversations.showAssignedStaff} onChange={showAssignedStaff => updateSettingsSection("conversations", { showAssignedStaff })} />
          <ToggleSetting label="Show viewer presence" description="Show who is currently viewing or handling the conversation." checked={s.conversations.showViewerPresence} onChange={showViewerPresence => updateSettingsSection("conversations", { showViewerPresence })} />
          <ToggleSetting label="Ignore sticker-only messages" description="Keep low-value sticker-only messages out of the main waiting queue." checked={s.conversations.ignoreStickerOnlyMessages} onChange={ignoreStickerOnlyMessages => updateSettingsSection("conversations", { ignoreStickerOnlyMessages })} />
          <ToggleSetting label="Sentiment detection" description="Use AI sentiment labels to prioritize risky conversations." checked={s.conversations.sentimentDetection} onChange={sentimentDetection => updateSettingsSection("conversations", { sentimentDetection })} />
          <NumberSetting label="Auto-close after days" value={s.conversations.closeAfterDays} onChange={closeAfterDays => updateSettingsSection("conversations", { closeAfterDays })} min={1} max={365} />
          <SelectSetting label="Default status" value={s.conversations.defaultStatus} onChange={defaultStatus => updateSettingsSection("conversations", { defaultStatus })} options={[{ value: "open", label: "Open" }, { value: "pending", label: "Pending" }, { value: "assigned", label: "Assigned" }]} />
          <div className="space-y-2 md:col-span-2">
            <Label>Handoff message</Label>
            <Textarea value={s.conversations.handoffMessage} onChange={event => updateSettingsSection("conversations", { handoffMessage: event.target.value })} className="min-h-24" />
          </div>
        </SettingPanel>
      )
    }

    if (settingsTab === "automation") {
      return (
        <div className="space-y-4">
          <SettingPanel title="Automation guardrails" description="Configure AI reply behavior and safe fallback actions.">
            <ToggleSetting label="AI draft replies" description="Generate suggested replies without sending automatically." checked={s.automation.aiDraftReplies} onChange={aiDraftReplies => updateSettingsSection("automation", { aiDraftReplies })} />
            <ToggleSetting label="Auto-reply enabled" description="Allow approved rules to send replies automatically." checked={s.automation.autoReplyEnabled} onChange={autoReplyEnabled => updateSettingsSection("automation", { autoReplyEnabled })} />
            <ToggleSetting label="Quiet hours" description="Prevent automated sends during quiet hours." checked={s.automation.quietHoursEnabled} onChange={quietHoursEnabled => updateSettingsSection("automation", { quietHoursEnabled })} />
            <NumberSetting label="Daily auto-replies per user" value={s.automation.maxAutoRepliesPerUserDaily} onChange={maxAutoRepliesPerUserDaily => updateSettingsSection("automation", { maxAutoRepliesPerUserDaily })} min={0} max={25} />
            <NumberSetting label="Confidence threshold" description="Minimum AI confidence required for automation." value={s.automation.confidenceThreshold} onChange={confidenceThreshold => updateSettingsSection("automation", { confidenceThreshold })} min={1} max={100} />
            <SelectSetting label="Fallback action" value={s.automation.fallbackAction} onChange={fallbackAction => updateSettingsSection("automation", { fallbackAction })} options={[{ value: "draft_only", label: "Create draft only" }, { value: "assign", label: "Assign to team" }, { value: "skip", label: "Skip automation" }]} />
            <TextSetting label="Quiet start" type="time" value={s.automation.quietHoursStart} onChange={quietHoursStart => updateSettingsSection("automation", { quietHoursStart })} />
            <TextSetting label="Quiet end" type="time" value={s.automation.quietHoursEnd} onChange={quietHoursEnd => updateSettingsSection("automation", { quietHoursEnd })} />
          </SettingPanel>

          <Card className="border-border/70 shadow-none">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <IconSparkles className="size-4 text-primary" />
                    AI Reply Simulator
                  </CardTitle>
                  <CardDescription>Test how the current Page settings decide draft, send, assign, or ignore.</CardDescription>
                </div>
                <Button size="sm" onClick={() => void generateAiReplyPreview()} disabled={aiReplyLoading || !aiReplyMessage.trim()}>
                  {aiReplyLoading ? <IconLoader2 className="mr-1.5 size-3.5 animate-spin" /> : <IconSparkles className="mr-1.5 size-3.5" />}
                  Generate
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-2">
                  <Label>Customer message</Label>
                  <Textarea
                    value={aiReplyMessage}
                    onChange={event => setAiReplyMessage(event.target.value)}
                    className="min-h-28"
                    placeholder="Paste a customer message or comment..."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Page/product context</Label>
                  <Textarea
                    value={aiReplyContext}
                    onChange={event => setAiReplyContext(event.target.value)}
                    className="min-h-28"
                    placeholder="Product rules, brand tone, shipping policy, escalation notes..."
                  />
                </div>
              </div>

              {aiReplyError ? (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{aiReplyError}</div>
              ) : null}

              {aiReplyResult ? (
                <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
                  <div className="border rounded-xl p-3.5 bg-card space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                        Intent: {aiReplyResult.intent}
                      </span>
                      <span className={cn(
                        "text-xs font-semibold px-2 py-0.5 rounded-full",
                        aiReplyResult.action === "send" && "bg-emerald-50 border border-emerald-200 text-emerald-700 dark:bg-emerald-950/30 dark:border-emerald-900",
                        aiReplyResult.action === "draft" && "bg-blue-50 border border-blue-200 text-blue-700 dark:bg-blue-950/30 dark:border-blue-900",
                        aiReplyResult.action === "assign" && "bg-amber-50 border border-amber-200 text-amber-700 dark:bg-amber-950/30 dark:border-amber-900",
                        aiReplyResult.action === "ignore" && "bg-muted border border-border text-muted-foreground"
                      )}>
                        Action: {aiReplyResult.action}
                      </span>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/5 text-foreground border">
                        Confidence: {aiReplyResult.confidence}%
                      </span>
                      <span className={cn(
                        "text-xs font-semibold px-2 py-0.5 rounded-full",
                        aiReplyResult.riskLevel === "high" && "bg-red-50 border border-red-200 text-red-700 dark:bg-red-950/30 dark:border-red-900",
                        aiReplyResult.riskLevel === "medium" && "bg-amber-50 border border-amber-200 text-amber-700 dark:bg-amber-950/30 dark:border-amber-900",
                        aiReplyResult.riskLevel === "low" && "bg-emerald-50 border border-emerald-200 text-emerald-700 dark:bg-emerald-950/30 dark:border-emerald-900"
                      )}>
                        Risk: {aiReplyResult.riskLevel}
                      </span>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">DRAFT REPLY</p>
                      <p className="mt-2 whitespace-pre-wrap rounded-lg bg-muted/40 border p-3.5 text-sm leading-relaxed">{aiReplyResult.draftReply}</p>
                    </div>
                  </div>
                  <div className="border rounded-xl p-3.5 bg-card text-sm space-y-3">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">DECISION DETAILS</p>
                    <div className="space-y-2 text-muted-foreground text-xs">
                      <p>Model: <span className="font-medium text-foreground">{aiReplyResult.model}</span></p>
                      <p>Threshold: <span className="font-medium text-foreground">{aiReplyResult.guardrails?.threshold ?? s.automation.confidenceThreshold}%</span></p>
                      <p>Auto-reply: <span className="font-medium text-foreground">{aiReplyResult.guardrails?.autoReplyEnabled ? "on" : "off"}</span></p>
                      <p>Fallback: <span className="font-medium text-foreground">{aiReplyResult.guardrails?.fallbackAction || s.automation.fallbackAction}</span></p>
                      <p>Rules: <span className="font-medium text-foreground">{aiReplyResult.matchedRules.length ? aiReplyResult.matchedRules.join(", ") : "none"}</span></p>
                      <p className="border-t pt-2 mt-2 leading-relaxed">{aiReplyResult.reason}</p>
                    </div>
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>
      )
    }

    if (settingsTab === "commentModeration") {
      return (
        <SettingPanel title="Comment moderation rules" description="Define what should be hidden, flagged, or routed for review.">
          <ToggleSetting label="Moderation enabled" description="Apply moderation rules to synced Page comments." checked={s.commentModeration.enabled} onChange={enabled => updateSettingsSection("commentModeration", { enabled })} />
          <ToggleSetting label="Hide all comments" description="Automatically hide every public comment on this Page after sync." checked={s.commentModeration.hideAllComments} onChange={hideAllComments => updateSettingsSection("commentModeration", { hideAllComments })} />
          <ToggleSetting label="Auto-hide spam" description="Hide comments that match spam/toxic intent." checked={s.commentModeration.autoHideSpam} onChange={autoHideSpam => updateSettingsSection("commentModeration", { autoHideSpam })} />
          <ToggleSetting label="Auto-hide phone numbers" description="Hide public phone numbers to reduce lead leakage." checked={s.commentModeration.autoHidePhoneNumbers} onChange={autoHidePhoneNumbers => updateSettingsSection("commentModeration", { autoHidePhoneNumbers })} />
          <ToggleSetting label="Auto-hide competitors" description="Hide comments mentioning competitor brands." checked={s.commentModeration.autoHideCompetitors} onChange={autoHideCompetitors => updateSettingsSection("commentModeration", { autoHideCompetitors })} />
          <ToggleSetting label="Ignore friend tags" description="Skip comments that only tag friends so the queue stays focused." checked={s.commentModeration.ignoreFriendTags} onChange={ignoreFriendTags => updateSettingsSection("commentModeration", { ignoreFriendTags })} />
          <ToggleSetting label="Ignore sticker-only comments" description="Skip comments that only contain stickers or lightweight reactions." checked={s.commentModeration.ignoreStickerOnly} onChange={ignoreStickerOnly => updateSettingsSection("commentModeration", { ignoreStickerOnly })} />
          <ToggleSetting label="Auto-like after reply" description="Like the customer's comment after an operator or automation replies." checked={s.commentModeration.autoLikeAfterReply} onChange={autoLikeAfterReply => updateSettingsSection("commentModeration", { autoLikeAfterReply })} />
          <SelectSetting label="Hide mode" value={s.commentModeration.hideMode} onChange={hideMode => updateSettingsSection("commentModeration", { hideMode })} options={[{ value: "risk_only", label: "Risk only" }, { value: "phone_only", label: "Phone numbers only" }, { value: "before_reply", label: "Before reply" }, { value: "after_reply", label: "After reply" }, { value: "all", label: "All comments" }]} />
          <NumberSetting label="Toxicity threshold" value={s.commentModeration.toxicThreshold} onChange={toxicThreshold => updateSettingsSection("commentModeration", { toxicThreshold })} min={1} max={100} />
          <ListSetting label="Sensitive keywords" value={s.commentModeration.sensitiveKeywords} onChange={sensitiveKeywords => updateSettingsSection("commentModeration", { sensitiveKeywords })} />
          <ListSetting label="Competitor keywords" value={s.commentModeration.competitorKeywords} onChange={competitorKeywords => updateSettingsSection("commentModeration", { competitorKeywords })} />
        </SettingPanel>
      )
    }

    if (settingsTab === "assignmentRules") {
      return (
        <SettingPanel title="Assignment rules" description="Route conversations and comments to the right team.">
          <ToggleSetting label="Assignment rules enabled" description="Use keyword and sentiment routing for this Page." checked={s.assignmentRules.enabled} onChange={enabled => updateSettingsSection("assignmentRules", { enabled })} />
          <ToggleSetting label="Round robin" description="Distribute new items across available staff." checked={s.assignmentRules.roundRobin} onChange={roundRobin => updateSettingsSection("assignmentRules", { roundRobin })} />
          <ToggleSetting label="Self-assign" description="Allow staff to claim unassigned conversations themselves." checked={s.assignmentRules.selfAssignEnabled} onChange={selfAssignEnabled => updateSettingsSection("assignmentRules", { selfAssignEnabled })} />
          <ToggleSetting label="Team assignment" description="Route conversations to a team queue before assigning a specific staff member." checked={s.assignmentRules.teamAssignmentEnabled} onChange={teamAssignmentEnabled => updateSettingsSection("assignmentRules", { teamAssignmentEnabled })} />
          <ToggleSetting label="Online staff only" description="Only assign new conversations to staff marked as online." checked={s.assignmentRules.onlineStaffOnly} onChange={onlineStaffOnly => updateSettingsSection("assignmentRules", { onlineStaffOnly })} />
          <SelectSetting label="Assignment mode" value={s.assignmentRules.assignmentMode} onChange={assignmentMode => updateSettingsSection("assignmentRules", { assignmentMode })} options={[{ value: "manual", label: "Manual" }, { value: "self_assign", label: "Self assign" }, { value: "round_robin", label: "Round robin" }, { value: "team_queue", label: "Team queue" }]} />
          <TextSetting label="Default assignee" value={s.assignmentRules.defaultAssignee} onChange={defaultAssignee => updateSettingsSection("assignmentRules", { defaultAssignee })} placeholder="unassigned or team member name" />
          <TextSetting label="Default team" value={s.assignmentRules.defaultTeam} onChange={defaultTeam => updateSettingsSection("assignmentRules", { defaultTeam })} placeholder="sales, support, fulfillment" />
          <NumberSetting label="Max open per staff" description="Stop assigning new items when a staff member reaches this open workload." value={s.assignmentRules.maxOpenConversationsPerStaff} onChange={maxOpenConversationsPerStaff => updateSettingsSection("assignmentRules", { maxOpenConversationsPerStaff })} min={1} max={500} />
          <TextSetting label="Negative sentiment queue" value={s.assignmentRules.negativeSentimentQueue} onChange={negativeSentimentQueue => updateSettingsSection("assignmentRules", { negativeSentimentQueue })} />
          <ListSetting label="Sales keywords" value={s.assignmentRules.salesKeywords} onChange={salesKeywords => updateSettingsSection("assignmentRules", { salesKeywords })} />
          <ListSetting label="Support keywords" value={s.assignmentRules.supportKeywords} onChange={supportKeywords => updateSettingsSection("assignmentRules", { supportKeywords })} />
        </SettingPanel>
      )
    }

    if (settingsTab === "tags") {
      return (
        <SettingPanel title="Tags" description="Manage labels used by inbox, posts, comments, and automations.">
          <ToggleSetting label="Auto-tagging" description="Apply tags automatically when keywords or sentiment rules match." checked={s.tags.autoTagging} onChange={autoTagging => updateSettingsSection("tags", { autoTagging })} />
          <ListSetting label="Available tags" value={s.tags.availableTags} onChange={availableTags => updateSettingsSection("tags", { availableTags })} />
          <ListSetting label="Tag colors" description="Use Name:#hex format, for example Lead:#2563eb." value={s.tags.tagColors} onChange={tagColors => updateSettingsSection("tags", { tagColors })} placeholder="Lead:#2563eb, Support:#7c3aed" />
          <ListSetting label="Auto-apply rules" description="Use keyword=>Tag format to tag conversations automatically." value={s.tags.autoApplyRules} onChange={autoApplyRules => updateSettingsSection("tags", { autoApplyRules })} placeholder="price=>Lead, refund=>Support" />
          <ListSetting label="VIP keywords" value={s.tags.vipKeywords} onChange={vipKeywords => updateSettingsSection("tags", { vipKeywords })} />
        </SettingPanel>
      )
    }

    if (settingsTab === "quickReplyTemplates") {
      return (
        <SettingPanel title="Quick reply templates" description="Templates are saved per Page and can be used by inbox/comment workflows.">
          <ToggleSetting label="Enable templates" description="Allow operators and automations to use Page templates." checked={s.quickReplyTemplates.enabled} onChange={enabled => updateSettingsSection("quickReplyTemplates", { enabled })} />
          <ToggleSetting label="Personalization variables" description="Allow variables such as {full_name}, {first_name}, and {gender} in template bodies." checked={s.quickReplyTemplates.variablesEnabled} onChange={variablesEnabled => updateSettingsSection("quickReplyTemplates", { variablesEnabled })} />
          <ToggleSetting label="Spin syntax" description="Allow randomized wording such as {Hi|Hello|Hey} to make replies feel natural." checked={s.quickReplyTemplates.spinSyntaxEnabled} onChange={spinSyntaxEnabled => updateSettingsSection("quickReplyTemplates", { spinSyntaxEnabled })} />
          <div className="md:col-span-2 rounded-xl border bg-blue-50/50 p-4">
            <p className="text-sm font-semibold">How to write templates</p>
            <div className="mt-3 grid gap-3 text-sm md:grid-cols-3">
              <div className="rounded-lg bg-background p-3">
                <p className="font-medium">Customer name</p>
                <p className="mt-1 text-xs text-muted-foreground">Use <code>{`{first_name}`}</code> for first name or <code>{`{full_name}`}</code> for full name.</p>
                <p className="mt-2 text-xs text-muted-foreground">Example: Hi <code>{`{first_name}`}</code></p>
              </div>
              <div className="rounded-lg bg-background p-3">
                <p className="font-medium">Random wording</p>
                <p className="mt-1 text-xs text-muted-foreground">Use <code>{`{Hi|Hello|Hey}`}</code>. The app picks one option when inserted.</p>
                <p className="mt-2 text-xs text-muted-foreground">Example: <code>{`{Hi|Hello}`}</code> <code>{`{first_name}`}</code></p>
              </div>
              <div className="rounded-lg bg-background p-3">
                <p className="font-medium">Shortcut</p>
                <p className="mt-1 text-xs text-muted-foreground">Use a short command so staff can find it quickly.</p>
                <p className="mt-2 text-xs text-muted-foreground">Example: <code>/hello</code>, <code>/price</code>, <code>/ship</code></p>
              </div>
            </div>
          </div>
          <div className="md:col-span-2 space-y-3">
            {s.quickReplyTemplates.templates.map(template => (
              <div key={template.id} className="rounded-lg border bg-muted/20 p-3">
                <div className="grid gap-3 md:grid-cols-[180px_140px_auto]">
                  <Input value={template.name} onChange={event => updateTemplate(template.id, { name: event.target.value })} placeholder="Template name" />
                  <Input value={template.shortcut} onChange={event => updateTemplate(template.id, { shortcut: event.target.value })} placeholder="/hello" />
                  <Button variant="outline" size="sm" onClick={() => removeTemplate(template.id)}>Remove</Button>
                </div>
                <Textarea
                  value={template.body}
                  onChange={event => updateTemplate(template.id, { body: event.target.value })}
                  className="mt-3 min-h-20"
                  placeholder="Write the reply template..."
                />
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={addTemplate}>Add template</Button>
          </div>
        </SettingPanel>
      )
    }

    if (settingsTab === "integrations") {
      return (
        <SettingPanel title="Integrations" description="Connect this Page workflow to external systems. URLs are validated before saving.">
          <ToggleSetting label="Meta webhook ready" description="Mark this Page as ready for realtime webhook events." checked={s.integrations.metaWebhooksEnabled} onChange={metaWebhooksEnabled => updateSettingsSection("integrations", { metaWebhooksEnabled })} />
          <ToggleSetting label="Send lead events to Meta" description="Send qualified lead events back to Meta for ads optimization when configured." checked={s.integrations.sendMetaLeadEvents} onChange={sendMetaLeadEvents => updateSettingsSection("integrations", { sendMetaLeadEvents })} />
          <ToggleSetting label="Send order events to Meta" description="Send order or purchase events back to Meta for conversion optimization." checked={s.integrations.sendMetaOrderEvents} onChange={sendMetaOrderEvents => updateSettingsSection("integrations", { sendMetaOrderEvents })} />
          <ToggleSetting label="POS integration" description="Enable order, inventory, and invoice workflows from the chat surface." checked={s.integrations.posIntegrationEnabled} onChange={posIntegrationEnabled => updateSettingsSection("integrations", { posIntegrationEnabled })} />
          <ToggleSetting label="Invite Page likes" description="Invite users who interacted with posts to like the Page, respecting the configured batch limit." checked={s.integrations.invitePageLikeEnabled} onChange={invitePageLikeEnabled => updateSettingsSection("integrations", { invitePageLikeEnabled })} />
          <ToggleSetting label="Auto-save birthdays" description="Detect birthday information from conversations for later customer care workflows." checked={s.integrations.autoSaveBirthday} onChange={autoSaveBirthday => updateSettingsSection("integrations", { autoSaveBirthday })} />
          <SelectSetting label="POS provider" value={s.integrations.posProvider} onChange={posProvider => updateSettingsSection("integrations", { posProvider })} options={[{ value: "none", label: "None" }, { value: "pancake_pos", label: "Pancake POS / Bost" }, { value: "custom", label: "Custom POS" }]} />
          <NumberSetting label="Invite limit per run" description="Keep this below 500 for safer Page-like invite batches." value={s.integrations.inviteLimitPerRun} onChange={inviteLimitPerRun => updateSettingsSection("integrations", { inviteLimitPerRun })} min={1} max={500} />
          <TextSetting label="CRM webhook URL" value={s.integrations.crmWebhookUrl} onChange={crmWebhookUrl => updateSettingsSection("integrations", { crmWebhookUrl })} placeholder="https://crm.example.com/webhook" />
          <TextSetting label="POS API URL" value={s.integrations.posApiUrl} onChange={posApiUrl => updateSettingsSection("integrations", { posApiUrl })} placeholder="https://pos.example.com/api" />
          <TextSetting label="Slack webhook URL" value={s.integrations.slackWebhookUrl} onChange={slackWebhookUrl => updateSettingsSection("integrations", { slackWebhookUrl })} />
          <TextSetting label="Google Sheet URL" value={s.integrations.googleSheetUrl} onChange={googleSheetUrl => updateSettingsSection("integrations", { googleSheetUrl })} />
          <TextSetting label="API key label" value={s.integrations.apiKeyLabel} onChange={apiKeyLabel => updateSettingsSection("integrations", { apiKeyLabel })} placeholder="Production CRM key" />
        </SettingPanel>
      )
    }

    if (settingsTab === "permissions") {
      return (
        <SettingPanel title="Permissions" description="Control what operators can do and track Meta permission dependencies.">
          <ToggleSetting label="Allow non-admin management" description="Let editors manage Page Manager settings for this Page." checked={s.permissions.allowNonAdminManage} onChange={allowNonAdminManage => updateSettingsSection("permissions", { allowNonAdminManage })} />
          <ToggleSetting label="Restrict to assigned conversations" description="Staff can only view or act on conversations assigned to them." checked={s.permissions.restrictToAssignedConversations} onChange={restrictToAssignedConversations => updateSettingsSection("permissions", { restrictToAssignedConversations })} />
          <ToggleSetting label="Approval before auto-hide" description="Require manual approval before hiding comments automatically." checked={s.permissions.requireApprovalForAutoHide} onChange={requireApprovalForAutoHide => updateSettingsSection("permissions", { requireApprovalForAutoHide })} />
          <SelectSetting label="Role model" value={s.permissions.roleMode} onChange={roleMode => updateSettingsSection("permissions", { roleMode })} options={[{ value: "standard", label: "Standard roles" }, { value: "sales_support", label: "Sales / Support split" }, { value: "strict_assigned_only", label: "Assigned only" }, { value: "admin_only", label: "Admin only" }]} />
          <ListSetting label="Required Meta permissions" value={s.permissions.requiredPermissions} onChange={requiredPermissions => updateSettingsSection("permissions", { requiredPermissions })} />
        </SettingPanel>
      )
    }

    return (
      <SettingPanel title="Advanced controls" description="Operational controls for retention, API sync, and safe rollout.">
        <ToggleSetting label="Debug mode" description="Store extra diagnostics for this Page." checked={s.advanced.debugMode} onChange={debugMode => updateSettingsSection("advanced", { debugMode })} />
        <ToggleSetting label="Dry-run mode" description="Preview automation behavior without sending actions." checked={s.advanced.dryRunMode} onChange={dryRunMode => updateSettingsSection("advanced", { dryRunMode })} />
        <ToggleSetting label="Rate-limit guard" description="Throttle sync jobs before Meta rate limits become risky." checked={s.advanced.rateLimitGuard} onChange={rateLimitGuard => updateSettingsSection("advanced", { rateLimitGuard })} />
        <NumberSetting label="Sync interval minutes" value={s.advanced.apiSyncIntervalMinutes} onChange={apiSyncIntervalMinutes => updateSettingsSection("advanced", { apiSyncIntervalMinutes })} min={1} max={1440} />
        <NumberSetting label="Retention days" value={s.advanced.retentionDays} onChange={retentionDays => updateSettingsSection("advanced", { retentionDays })} min={7} max={3650} />
        <NumberSetting label="Archive closed after days" value={s.advanced.archiveClosedAfterDays} onChange={archiveClosedAfterDays => updateSettingsSection("advanced", { archiveClosedAfterDays })} min={1} max={3650} />
      </SettingPanel>
    )
  }

  return (
    <div className="min-h-full bg-gradient-to-b from-background via-background to-muted/20">
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/75">
        <div className="mx-auto max-w-[1600px] px-4 py-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="space-y-2">
              <div className="min-w-max rounded-xl border border-border/40 bg-transparent p-1">
                <div className="flex items-center gap-1">
                  {PAGE_MANAGER_TABS.map(item => {
                    const active = tab === item.id
                    return (
                      <button
                        key={item.id}
                        onClick={() => setTab(item.id)}
                        className={cn(
                          "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                          active
                            ? "bg-primary text-primary-foreground shadow-sm"
                            : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                        )}
                      >
                        {item.label}
                      </button>
                    )
                  })}
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Each tab maps to a real workflow: inbox first, then posts, then comments.
              </p>
            </div>

            <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
              <Popover open={pagePickerOpen} onOpenChange={setPagePickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="h-11 w-full justify-between overflow-hidden rounded-xl border-border/70 bg-background px-3 shadow-sm hover:bg-muted/30 lg:w-[320px]"
                  >
                    <div className="flex min-w-0 items-center gap-2 text-left">
                      <div className="size-8 shrink-0 overflow-hidden rounded-lg border border-border/60 bg-muted">
                        {selectedPage?.picture || selectedPage?.id ? (
                          <img
                            src={selectedPage.picture || `/api/facebook/page-picture?page_id=${selectedPage.id}`}
                            alt={selectedPage.name}
                            className="size-full object-cover"
                          />
                        ) : (
                          <IconBrandFacebook className="m-1.5 size-4 text-[#1877F2]" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium leading-tight">{selectedPage?.name || "No Page selected"}</p>
                        <p className="truncate text-xs leading-tight text-muted-foreground">
                          {selectedPage?.category || "Add a Page to this workspace"}
                        </p>
                      </div>
                    </div>
                    <IconChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  align="end"
                  sideOffset={10}
                  collisionPadding={12}
                  className="w-[min(390px,calc(100vw-24px))] overflow-hidden rounded-xl border-border/70 p-0 shadow-xl"
                >
                  <div className="border-b bg-background p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold">Choose Page</p>
                        <p className="text-xs text-muted-foreground">{pageOptions.length} workspace Pages</p>
                      </div>
                      {pagePickerLoading ? <IconLoader2 className="size-4 animate-spin text-muted-foreground" /> : null}
                    </div>
                    <div className="relative mt-3">
                      <IconSearch className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={pagePickerSearch}
                        onChange={event => setPagePickerSearch(event.target.value)}
                        placeholder="Search working pages"
                        className="h-10 rounded-lg border-border/70 bg-muted/30 pl-9 text-sm shadow-none focus-visible:bg-background focus-visible:ring-2 focus-visible:ring-primary/20"
                      />
                    </div>
                  </div>
                  <div className="max-h-[min(360px,calc(100vh-250px))] overflow-y-auto">
                    <div className="divide-y divide-border/60">
                      {filteredPageOptions.map(page => {
                        const selected = selectedPage?.id === page.id
                        const status = pageStatusMeta(page.status)
                        return (
                          <button
                            key={page.id}
                            onClick={() => handleSelectPageOption(page)}
                            className={cn(
                              "flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors",
                              selected
                                ? "bg-primary/5"
                                : "hover:bg-muted/60"
                            )}
                          >
                            <div className="size-10 shrink-0 overflow-hidden rounded-lg bg-muted ring-1 ring-border/60">
                              {page.picture || page.metaPageId || page.id ? (
                                <img src={page.picture || `/api/facebook/page-picture?page_id=${page.metaPageId || page.id}`} alt={page.name} className="size-full object-cover" />
                              ) : (
                                <div className="flex size-full items-center justify-center bg-slate-100 text-sm font-semibold text-slate-600">
                                  {page.name.charAt(0)}
                                </div>
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <p className="truncate text-sm font-medium leading-5">{page.name}</p>
                                {selected ? <IconCheck className="size-3.5 shrink-0 text-primary" /> : null}
                              </div>
                              <div className="mt-0.5 flex min-w-0 items-center gap-2 text-xs">
                                <span className="flex items-center gap-1.5">
                                  <span className={cn("size-1.5 rounded-full", status.dot)} />
                                  <span className={cn("font-medium", status.text)}>{status.label}</span>
                                </span>
                                <span className="text-muted-foreground">/</span>
                                <span className="truncate text-muted-foreground">{page.category}</span>
                              </div>
                            </div>
                          </button>
                        )
                      })}
                      {!pagePickerLoading && filteredPageOptions.length === 0 && (
                        <div className="px-3 py-10 text-center text-sm text-muted-foreground">
                          <p className="font-medium text-foreground">No pages added yet</p>
                          <p className="mt-1 text-xs">Add Pages to this workspace before using Page Manager.</p>
                          <Button size="sm" className="mt-4 gap-1.5" onClick={openAddPagesModal}>
                            <IconPlus className="size-3.5" />
                            Add Page
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="border-t p-2">
                    <Button variant="ghost" className="w-full justify-start gap-2" onClick={openAddPagesModal}>
                      <IconPlus className="size-4" />
                      Add Page
                    </Button>
                    <Button variant="ghost" className="w-full justify-start gap-2" onClick={openManagePagesModal}>
                      <IconSettings className="size-4" />
                      Manage Pages
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>

              <Dialog open={addPagesOpen} onOpenChange={setAddPagesOpen}>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Add Pages to Workspace</DialogTitle>
                    <DialogDescription>
                      Select Meta Pages that should be available in this workspace. Tokens stay server-side.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-3">
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <div className="relative flex-1">
                        <IconSearch className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          value={availablePagesSearch}
                          onChange={event => setAvailablePagesSearch(event.target.value)}
                          placeholder="Search available pages"
                          className="pl-9"
                        />
                      </div>
                      <Button variant="outline" className="gap-1.5" onClick={() => void syncMetaPages()} disabled={pageActionLoading || availablePagesLoading}>
                        {pageActionLoading ? <IconLoader2 className="size-3.5 animate-spin" /> : <IconRefresh className="size-3.5" />}
                        Sync Meta Pages
                      </Button>
                    </div>
                    {pagesModalError ? (
                      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">{pagesModalError}</div>
                    ) : null}
                    <div className="rounded-xl border">
                      <ScrollArea className="h-[360px]">
                        <div className="divide-y">
                          {availablePagesLoading ? (
                            <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
                              <IconLoader2 className="mr-2 size-4 animate-spin" />
                              Loading available Pages...
                            </div>
                          ) : filteredAvailablePages.length ? (
                            filteredAvailablePages.map(page => {
                              const checked = Boolean(page.metaPageId && selectedAvailablePageIds.includes(page.metaPageId))
                              const status = pageStatusMeta(page.status)
                              return (
                                <label key={page.metaPageId || page.id} className="flex cursor-pointer items-center gap-3 px-3 py-3 hover:bg-muted/50">
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => toggleAvailablePageSelection(page.metaPageId)}
                                    className="size-4 rounded border-border"
                                  />
                                  <div className="size-10 shrink-0 overflow-hidden rounded-lg bg-muted ring-1 ring-border/60">
                                    {page.picture ? (
                                      <img src={page.picture} alt={page.name} className="size-full object-cover" />
                                    ) : (
                                      <div className="flex size-full items-center justify-center text-sm font-semibold">{page.name.charAt(0)}</div>
                                    )}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-medium">{page.name}</p>
                                    <div className="mt-0.5 flex items-center gap-2 text-xs">
                                      <span className={cn("size-1.5 rounded-full", status.dot)} />
                                      <span className={cn("font-medium", status.text)}>{status.label}</span>
                                      <span className="text-muted-foreground">/</span>
                                      <span className="truncate text-muted-foreground">{page.category}</span>
                                    </div>
                                  </div>
                                </label>
                              )
                            })
                          ) : (
                            <div className="px-4 py-12 text-center text-sm text-muted-foreground">
                              <p className="font-medium text-foreground">No available Pages</p>
                              <p className="mt-1">All synced Pages are already in this workspace, or Meta Pages have not been synced yet.</p>
                              <Button variant="outline" size="sm" className="mt-4 gap-1.5" onClick={() => void syncMetaPages()} disabled={pageActionLoading}>
                                {pageActionLoading ? <IconLoader2 className="size-3.5 animate-spin" /> : <IconRefresh className="size-3.5" />}
                                Sync Meta Pages
                              </Button>
                            </div>
                          )}
                        </div>
                      </ScrollArea>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setAddPagesOpen(false)}>Cancel</Button>
                    <Button onClick={() => void addSelectedPagesToWorkspace()} disabled={!selectedAvailablePageIds.length || pageActionLoading}>
                      {pageActionLoading ? <IconLoader2 className="mr-2 size-4 animate-spin" /> : null}
                      Add Selected Pages
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <Dialog open={managePagesOpen} onOpenChange={setManagePagesOpen}>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Manage Workspace Pages</DialogTitle>
                    <DialogDescription>
                      Disable or remove Pages from this workspace without deleting the original Meta Page inventory.
                    </DialogDescription>
                  </DialogHeader>
                  {pagesModalError ? (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">{pagesModalError}</div>
                  ) : null}
                  <div className="rounded-xl border">
                    <ScrollArea className="h-[360px]">
                      <div className="divide-y">
                        {workspacePagesLoading ? (
                          <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
                            <IconLoader2 className="mr-2 size-4 animate-spin" />
                            Loading workspace Pages...
                          </div>
                        ) : workspacePages.length ? (
                          workspacePages.map(page => {
                            const status = pageStatusMeta(page.status)
                            const active = page.isActive !== false
                            return (
                              <div key={page.workspacePageId || page.id} className="flex items-center gap-3 px-3 py-3">
                                <div className="size-10 shrink-0 overflow-hidden rounded-lg bg-muted ring-1 ring-border/60">
                                  {page.picture ? (
                                    <img src={page.picture} alt={page.name} className="size-full object-cover" />
                                  ) : (
                                    <div className="flex size-full items-center justify-center text-sm font-semibold">{page.name.charAt(0)}</div>
                                  )}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-sm font-medium">{page.name}</p>
                                  <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs">
                                    <span className={cn("size-1.5 rounded-full", status.dot)} />
                                    <span className={cn("font-medium", status.text)}>{status.label}</span>
                                    <span className="text-muted-foreground">/</span>
                                    <span className="truncate text-muted-foreground">{page.category}</span>
                                    <Badge variant={active ? "default" : "outline"} className="h-5 rounded-full px-2 text-xs">
                                      {active ? "Active" : "Inactive"}
                                    </Badge>
                                  </div>
                                </div>
                                {page.status !== "connected" ? (
                                  <Button variant="outline" size="sm" onClick={() => void syncMetaPages()} disabled={pageActionLoading}>
                                    Reconnect
                                  </Button>
                                ) : null}
                                <Button variant="outline" size="sm" onClick={() => void updateWorkspacePageActive(page, !active)} disabled={pageActionLoading}>
                                  {active ? "Disable" : "Enable"}
                                </Button>
                                <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700" onClick={() => void removeWorkspacePage(page)} disabled={pageActionLoading}>
                                  Remove
                                </Button>
                              </div>
                            )
                          })
                        ) : (
                          <div className="px-4 py-12 text-center text-sm text-muted-foreground">
                            <p className="font-medium text-foreground">No workspace Pages yet</p>
                            <Button size="sm" className="mt-4 gap-1.5" onClick={openAddPagesModal}>
                              <IconPlus className="size-3.5" />
                              Add Page
                            </Button>
                          </div>
                        )}
                      </div>
                    </ScrollArea>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setManagePagesOpen(false)}>Close</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <Select
                value={selectedAdAccountId || "none"}
                onValueChange={value => {
                  if (value === "none") return
                  setSelectedAdAccountId(value)
                  try {
                    localStorage.setItem("page_manager_selected_ad_account_id", value)
                  } catch { }
                }}
              >
                <SelectTrigger className="w-full rounded-2xl border-border/70 bg-background shadow-sm lg:w-[260px]">
                  <SelectValue placeholder={adAccountsLoading ? "Loading ad accounts..." : "Select ad account"} />
                </SelectTrigger>
                <SelectContent>
                  {adAccounts.length === 0 ? (
                    <SelectItem value="none" disabled>
                      {adAccountsLoading ? "Loading ad accounts..." : adAccountsError || "No ad accounts"}
                    </SelectItem>
                  ) : (
                    adAccounts.map(account => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.name}
                        {account.account_id ? ` - ${account.account_id}` : ""}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>

              <Select value={datePreset} onValueChange={setDatePreset}>
                <SelectTrigger className="w-full lg:w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="last_7d">Last 7 days</SelectItem>
                  <SelectItem value="last_30d">Last 30 days</SelectItem>
                  <SelectItem value="last_90d">Last 90 days</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                className="gap-1.5"
                onClick={async () => {
                  if (tab === "posts") void loadPosts(true)
                  if (tab === "comments" || tab === "inbox") void loadComments(true)
                  if (tab === "inbox") {
                    await subscribeMessengerWebhooks()
                    await Promise.allSettled([syncMessenger(), syncComments(), loadMessengerInbox()])
                  }
                }}
                disabled={pageInsightLoading || launchHistoryLoading || metaDarkPostsLoading || commentsLoading || messengerLoading}
              >
                <IconRefresh className={cn("size-3.5", (pageInsightLoading || launchHistoryLoading || metaDarkPostsLoading || commentsLoading || messengerLoading) && "animate-spin")} />
                Refresh
              </Button>
            </div>
          </div>

        </div>
      </div>

      <div className="mx-auto flex max-w-[1600px] gap-2 px-2 py-2">
        <main className="min-w-0 flex-1 space-y-2">

          {tab === "inbox" && (
            <div className="space-y-4">
              {(messengerError || commentsError) && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50/70 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
                  {messengerError && <p className="font-medium">{messengerError}</p>}
                  {commentsError && <p className={cn("font-medium", messengerError && "mt-2")}>{commentsError}</p>}
                </div>
              )}
              {!selectedPage ? (
                <Card className="border-dashed shadow-none">
                  <CardContent className="flex min-h-[360px] flex-col items-center justify-center text-center">
                    <IconBrandFacebook className="size-10 text-[#1877F2]" />
                    <h2 className="mt-4 text-lg font-semibold">No pages added yet</h2>
                    <p className="mt-2 max-w-md text-sm text-muted-foreground">
                      Add Pages to this workspace before loading Inbox, Posts, Comments, or Page settings.
                    </p>
                    <Button className="mt-5 gap-1.5" onClick={openAddPagesModal}>
                      <IconPlus className="size-4" />
                      Add Page
                    </Button>
                  </CardContent>
                </Card>
              ) : null}
              <div
                className={cn(
                  "flex h-[950px] overflow-hidden rounded-2xl border border-[#E4E6EB] bg-[#F0F2F5] shadow-sm dark:border-border dark:bg-muted/30",
                  !selectedPage && "hidden"
                )}
              >
                <Card
                  className="relative flex h-full min-h-0 shrink-0 flex-col overflow-hidden rounded-none border-0 border-r border-[#E4E6EB] bg-slate-50/50 shadow-none dark:border-border dark:bg-muted/10 transition-[width] duration-300 ease-in-out"
                  style={{ width: isSidebarCollapsed ? 64 : sidebarWidth }}
                >
                  <CardHeader className="shrink-0 border-b border-[#E4E6EB] px-3 py-2 dark:border-border">
                    <div className={cn("flex items-center gap-1", isSidebarCollapsed ? "justify-center" : "justify-between")}>
                      {!isSidebarCollapsed && <span className="text-sm font-bold text-[#050505] dark:text-foreground">Inbox</span>}
                      <div className={cn("flex items-center gap-0.5", isSidebarCollapsed && "flex-col gap-2")}>
                        <Button
                          variant="ghost"
                          size="icon"
                          className={cn("size-7 rounded-full", inboxSearchOpen && "bg-[#E7F3FF] text-[#0084FF]")}
                          title="Search"
                          onClick={() => {
                            if (isSidebarCollapsed) setIsSidebarCollapsed(false)
                            setInboxSearchOpen(open => !open)
                          }}
                        >
                          <IconSearch className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 rounded-full"
                          title="Collapse / Expand"
                          onClick={() => setIsSidebarCollapsed(v => !v)}
                        >
                          <IconLayoutSidebar className="size-3.5" />
                        </Button>
                      </div>
                    </div>
                    {inboxSearchOpen && !isSidebarCollapsed && (
                      <div className="mt-2">
                        <div className="flex items-center gap-1.5 rounded-lg border border-[#E4E6EB] bg-white px-2 py-1.5 dark:border-border dark:bg-background">
                          <IconSearch className="size-3.5 shrink-0 text-[#65676B]" />
                          <input
                            autoFocus
                            value={inboxSearchQuery}
                            onChange={event => setInboxSearchQuery(event.target.value)}
                            placeholder="Search name, keyword, or group…"
                            className="min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-[#65676B]"
                          />
                          {inboxSearchQuery && (
                            <button type="button" onClick={() => setInboxSearchQuery("")} className="shrink-0 text-[#65676B] hover:text-[#050505]">
                              <IconX className="size-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </CardHeader>
                  <CardContent className="min-h-0 flex-1 overflow-y-auto p-1.5">
                    {isSidebarCollapsed && (
                      <div className="flex flex-col items-center gap-1 py-2">
                        <button type="button" title="Your inbox" className="flex size-8 items-center justify-center rounded-lg text-[#050505] hover:bg-[#F0F2F5] dark:text-foreground dark:hover:bg-muted">
                          <IconInbox className="size-4" />
                        </button>
                        <button type="button" title="All" onClick={() => setInboxSourceFilter("all")} className={cn("flex size-8 items-center justify-center rounded-lg", inboxSourceFilter === "all" ? "bg-[#E7F3FF] text-[#0084FF]" : "text-[#050505] hover:bg-[#F0F2F5] dark:text-foreground dark:hover:bg-muted")}>
                          <IconLayoutList className="size-4" />
                        </button>
                      </div>
                    )}
                    {!isSidebarCollapsed && (
                      <>
                        <div className="space-y-0.5">
                          {[
                            { id: "all" as const, label: "Your inbox", count: allPageThreads.filter(thread => thread.assignedTo === "Me").length },
                            { id: "mentions" as const, label: "Mentions", count: allPageThreads.filter(thread => thread.latestMessage.includes("@") || thread.tags.some(tag => tag.toLowerCase() === "mention")).length },
                            { id: "created_by_me" as const, label: "Created by me", count: allPageThreads.filter(thread => thread.latestMessage.startsWith("You:") || thread.responseStatus === "replied").length },
                          ].map(item => (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => setInboxSourceFilter(item.id as typeof inboxSourceFilter)}
                              className={cn(
                                "flex w-full min-w-0 items-center justify-between rounded-lg px-2.5 py-1 text-left text-sm font-medium transition-colors",
                                inboxSourceFilter === item.id
                                  ? "bg-[#E7F3FF] text-[#0084FF] dark:bg-primary/15 dark:text-primary"
                                  : "text-[#050505] hover:bg-[#F0F2F5] dark:text-foreground dark:hover:bg-muted"
                              )}
                            >
                              <span className="truncate mr-1">{item.label}</span>
                              {item.count > 0 ? <span className="shrink-0 text-xs opacity-70">{item.count}</span> : null}
                            </button>
                          ))}
                        </div>

                        <div className="mt-2 space-y-0.5">
                          {[
                            { id: "all", label: "All", count: allPageThreads.length },
                            { id: "unread", label: "Needs action", count: allPageThreads.filter(thread => thread.unread > 0 || thread.responseStatus === "pending").length },
                            { id: "messenger", label: "Messenger", count: allPageThreads.filter(thread => thread.sourceType === "messenger").length },
                            { id: "comments", label: "Comments", count: allPageThreads.filter(thread => thread.sourceType === "facebook_comment" || thread.sourceType === "instagram_comment").length },
                            { id: "ad_comments", label: "Ad comments", count: allPageThreads.filter(thread => (thread.sourceType === "facebook_comment" || thread.sourceType === "instagram_comment") && Boolean(thread.postId)).length },
                            { id: "needs_human", label: "Needs Human", count: allPageThreads.filter(thread => thread.sentiment === "negative" || thread.tags.some(tag => /support|hidden|spam|complaint|medical/i.test(tag))).length },
                            { id: "orders", label: "Orders", count: allPageThreads.filter(thread => thread.tags.some(tag => /order|cod/i.test(tag))).length },
                          ].map(item => (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => setInboxSourceFilter(item.id as typeof inboxSourceFilter)}
                              className={cn(
                                "flex w-full min-w-0 items-center justify-between rounded-lg px-2.5 py-1 text-left text-sm font-medium transition-colors",
                                inboxSourceFilter === item.id
                                  ? "bg-[#E7F3FF] text-[#0084FF] dark:bg-primary/15 dark:text-primary"
                                  : "text-[#050505] hover:bg-[#F0F2F5] dark:text-foreground dark:hover:bg-muted"
                              )}
                            >
                              <span className="truncate mr-1">{item.label}</span>
                              <span className="shrink-0 text-xs opacity-70">{item.count}</span>
                            </button>
                          ))}
                        </div>

                        <div className="mt-2 space-y-0.5 border-t border-[#E4E6EB] pt-2 dark:border-border">
                          {[
                            { id: "spam" as const, label: "Spam", count: allPageThreads.filter(thread => thread.tags.some(tag => /spam/i.test(tag))).length },
                          ].map(item => (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => setInboxSourceFilter(item.id as typeof inboxSourceFilter)}
                              className={cn(
                                "flex w-full min-w-0 items-center justify-between rounded-lg px-2.5 py-1 text-left text-sm font-medium transition-colors",
                                inboxSourceFilter === item.id
                                  ? "bg-[#E7F3FF] text-[#0084FF] dark:bg-primary/15 dark:text-primary"
                                  : "text-[#050505] hover:bg-[#F0F2F5] dark:text-foreground dark:hover:bg-muted"
                              )}
                            >
                              <span className="truncate mr-1">{item.label}</span>
                              {item.count > 0 ? <span className="shrink-0 text-xs opacity-70">{item.count}</span> : null}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </CardContent>
                  {!isSidebarCollapsed && (
                    <div className="mt-auto flex items-center gap-1 border-t border-[#E4E6EB] p-2 dark:border-border">
                      <Button variant="ghost" size="icon" className="size-8 rounded-full" title="More inbox actions">
                        <IconDots className="size-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="size-8 rounded-full" title="New conversation">
                        <IconCirclePlus className="size-4" />
                      </Button>
                    </div>
                  )}
                </Card>

                <div
                  onMouseDown={handleDragResize("sidebar")}
                  className="z-10 hidden w-1 shrink-0 cursor-col-resize bg-transparent transition-colors hover:bg-[#0084FF]/30 lg:block"
                  title="Drag to resize"
                />

                <Card
                  className="flex h-full min-h-0 shrink-0 flex-col overflow-hidden rounded-none border-0 border-r border-[#E4E6EB] bg-white shadow-none dark:border-border dark:bg-background"
                  style={{ width: queueWidth }}
                >
                  <CardHeader className="shrink-0 border-b border-[#E4E6EB] px-3 py-2 dark:border-border">
                    <div className="flex items-center justify-between gap-1.5">
                      <Badge variant="outline" className="h-8 gap-1.5 rounded-full border-emerald-200 bg-emerald-50 px-3 text-xs font-semibold text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/20 dark:text-emerald-400">
                        <span className="size-1.5 rounded-full bg-emerald-500" />
                        {allPageThreads.filter(thread => thread.responseStatus === "pending" || thread.responseStatus === "open").length} Open
                      </Badge>
                      <div className="flex shrink-0 items-center gap-1">
                        <Popover open={inboxSortMenuOpen} onOpenChange={setInboxSortMenuOpen}>
                          <PopoverTrigger asChild>
                            <Button variant="outline" size="icon" className="size-8 rounded-full" title="Sort / filter">
                              <IconFilter className="size-3.5" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent align="end" className="w-56 rounded-2xl p-2">
                            <p className="px-2 pb-1 pt-1 text-xs font-semibold text-muted-foreground">Sort by</p>
                            {([
                              { id: "recent" as const, label: "Last activity" },
                              { id: "alphabet" as const, label: "Name (A → Z)" },
                            ]).map(opt => (
                              <button
                                key={opt.id}
                                type="button"
                                onClick={() => { setInboxSortMode(opt.id); setInboxSortMenuOpen(false) }}
                                className={cn(
                                  "flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-left text-sm hover:bg-muted",
                                  inboxSortMode === opt.id && "bg-muted font-medium"
                                )}
                              >
                                {opt.label}
                                {inboxSortMode === opt.id ? <IconCheck className="size-3.5" /> : null}
                              </button>
                            ))}
                          </PopoverContent>
                        </Popover>
                        <div className="flex items-center gap-0.5 rounded-full border border-[#E4E6EB] p-0.5 dark:border-border">
                          <button
                            type="button"
                            title="Comfortable view"
                            onClick={() => setViewDensity("comfortable")}
                            className={cn(
                              "flex size-7 items-center justify-center rounded-full transition-colors",
                              viewDensity === "comfortable" ? "bg-[#E7F3FF] text-[#0084FF] dark:bg-primary/15 dark:text-primary" : "text-[#65676B] hover:bg-[#F0F2F5]"
                            )}
                          >
                            <IconLayoutList className="size-4" />
                          </button>
                          <button
                            type="button"
                            title="Compact view"
                            onClick={() => setViewDensity("compact")}
                            className={cn(
                              "flex size-7 items-center justify-center rounded-full transition-colors",
                              viewDensity === "compact" ? "bg-[#E7F3FF] text-[#0084FF] dark:bg-primary/15 dark:text-primary" : "text-[#65676B] hover:bg-[#F0F2F5]"
                            )}
                          >
                            <IconList className="size-4" />
                          </button>
                        </div>
                      </div>
                    </div>

                  </CardHeader>

                  <CardContent className="flex min-h-0 flex-1 flex-col p-0">
                    <div
                      className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain"
                      onScroll={event => setInboxListScrollTop(event.currentTarget.scrollTop)}
                    >
                      <div className="max-w-full overflow-x-hidden p-2">
                        {pageThreads.length === 0 ? (
                          <div className="rounded-2xl border border-dashed bg-muted/20 px-4 py-8 text-center">
                            <p className="text-sm font-medium">No inbox items for this Page</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              Messenger requires `pages_messaging`. Ad comments will appear here after comment sync returns data for the selected Page.
                            </p>
                            {messengerError ? (
                              <p className="mt-2 text-xs text-amber-700">{messengerError}</p>
                            ) : null}
                            <div className="mt-4 flex flex-wrap justify-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                className="gap-1.5 rounded-full"
                                onClick={() => void subscribeMessengerWebhooks()}
                                disabled={!selectedPage?.id || messengerSubscribing || /^p-\d+$/.test(selectedPage?.id || "")}
                              >
                                {messengerSubscribing ? <IconLoader2 className="size-3.5 animate-spin" /> : <IconCheck className="size-3.5" />}
                                {messengerWebhookStatus === "ready" ? "Connected" : "Connect"}
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="gap-1.5 rounded-full"
                                onClick={async () => {
                                  await subscribeMessengerWebhooks()
                                  await Promise.allSettled([syncMessenger(), syncComments()])
                                }}
                                disabled={commentsLoading || commentsSyncing || messengerLoading || messengerSyncing || messengerSubscribing}
                              >
                                <IconRefresh className={cn("size-3.5", (commentsLoading || commentsSyncing || messengerLoading || messengerSyncing || messengerSubscribing) && "animate-spin")} />
                                Sync inbox
                              </Button>
                            </div>
                          </div>
                        ) : null}
                        {pageThreads.length > 0 ? (
                          <div className="space-y-2">
                            <div
                              className={cn(
                                "flex flex-wrap items-center gap-2 rounded-xl border px-3 py-2 transition-colors",
                                draggingThreadId
                                  ? "border-dashed border-[#0084FF] bg-[#E7F3FF]"
                                  : pinnedPageThreads.length
                                    ? "border-border/70 bg-muted/20"
                                    : "border-dashed border-border/70 bg-muted/20 text-muted-foreground"
                              )}
                              onDragOver={event => {
                                if (draggingThreadId) event.preventDefault()
                              }}
                              onDrop={event => {
                                event.preventDefault()
                                const draggedId = event.dataTransfer.getData("text/plain") || draggingThreadId
                                if (!draggedId) return
                                setInboxPinnedThreads(prev => ({ ...prev, [draggedId]: true }))
                                setDraggingThreadId(null)
                              }}
                            >
                              {pinnedPageThreads.map(thread => renderPinnedAvatar(thread))}
                            </div>

                            {groupedPageThreads.map(item => {
                              if (item.kind === "thread") return renderInboxThreadCard(item.thread)

                              const collapsed = Boolean(inboxGroupCollapsed[item.groupId])
                              const unread = item.members.reduce((sum, member) => sum + member.unread, 0)
                              const anyPinned = item.members.some(member => inboxPinnedThreads[member.id])

                              return (
                                <div
                                  key={`group-${item.groupId}`}
                                  className={cn(
                                    "rounded-2xl border border-[#E4E6EB] bg-white p-2 dark:border-border dark:bg-background",
                                    anyPinned && "ring-1 ring-[#0084FF]/20"
                                  )}
                                  onDragOver={event => {
                                    if (draggingThreadId) event.preventDefault()
                                  }}
                                  onDrop={event => {
                                    event.preventDefault()
                                    const draggedId = event.dataTransfer.getData("text/plain") || draggingThreadId
                                    if (draggedId) mergeThreadInto(draggedId, item.groupId)
                                    setDraggingThreadId(null)
                                  }}
                                >
                                  <div className="flex items-center gap-2 px-1 py-1">
                                    <button
                                      type="button"
                                      className="flex min-w-0 flex-1 items-center gap-2 text-left"
                                      onClick={() => setInboxGroupCollapsed(prev => ({ ...prev, [item.groupId]: !collapsed }))}
                                    >
                                      <span className="text-sm font-semibold text-[#050505] dark:text-foreground">
                                        Group · {item.members.length}
                                      </span>
                                      {unread > 0 ? (
                                        <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-[#0084FF] text-xs font-bold text-white">{unread}</span>
                                      ) : null}
                                      <Badge variant="outline" className="h-5 whitespace-nowrap rounded-full px-2 text-xs">
                                        {collapsed ? "Collapsed" : "Expanded"}
                                      </Badge>
                                    </button>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 rounded-full px-2 text-xs"
                                      onClick={() => dismissGroup(item.groupId)}
                                    >
                                      Ungroup
                                    </Button>
                                  </div>
                                  {!collapsed ? (
                                    <div className="mt-1 space-y-1">
                                      {item.members.map(member => renderInboxThreadCard(member))}
                                    </div>
                                  ) : (
                                    <button
                                      type="button"
                                      className="mt-1 w-full rounded-xl bg-muted/40 px-3 py-2 text-left text-xs text-muted-foreground"
                                      onClick={() => setSelectedThreadId(item.lead.id)}
                                    >
                                      {item.members.map(member => member.name).join(" · ")}
                                    </button>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        ) : null}
                      </div>
                    </div>
                    {pinnedContextMenu ? (
                      <div
                        className="fixed z-50 min-w-[180px] rounded-xl border bg-background p-1 shadow-lg"
                        style={{ left: pinnedContextMenu.x, top: pinnedContextMenu.y }}
                        onClick={event => event.stopPropagation()}
                      >
                        <button
                          type="button"
                          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-muted"
                          onClick={() => togglePinThread(pinnedContextMenu.threadId)}
                        >
                          <IconPin className="size-3.5" />
                          {inboxPinnedThreads[pinnedContextMenu.threadId] ? "Unpin" : "Pin to top"}
                        </button>
                        {threadGroupId(pinnedContextMenu.threadId) ? (
                          <button
                            type="button"
                            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-muted"
                            onClick={() => {
                              removeThreadFromGroup(pinnedContextMenu.threadId)
                              setPinnedContextMenu(null)
                            }}
                          >
                            Remove from group
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </CardContent>
                </Card>

                <div
                  onMouseDown={handleDragResize("queue")}
                  className="z-10 hidden w-1 shrink-0 cursor-col-resize bg-transparent transition-colors hover:bg-[#0084FF]/30 lg:block"
                  title="Drag to resize"
                />

                <Card className="flex h-full min-w-0 flex-1 flex-col overflow-hidden rounded-none border-0 border-r border-[#E4E6EB] bg-white shadow-none dark:border-border dark:bg-background">
                  <CardHeader className="shrink-0 border-b border-[#E4E6EB] px-3 py-2 dark:border-border">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex min-w-0 items-center gap-3">
                        <InboxAvatar
                          name={selectedThread.name}
                          src={selectedThread.customerProfilePic || (selectedThread.sourceType === "facebook_comment" ? (selectedPage?.picture || (selectedPage?.id ? `/api/facebook/page-picture?page_id=${selectedPage.id}` : null)) : null)}
                          online={selectedThread.responseStatus === "pending" || selectedThread.unread > 0}
                        />
                        <div className="min-w-0">
                          <CardTitle className="truncate text-sm font-semibold text-[#050505] dark:text-foreground">{selectedThread.name}</CardTitle>
                          <CardDescription className="truncate text-xs text-[#65676B]">
                            {selectedThread.sourceType === "facebook_comment"
                              ? selectedThread.postId ? "Ad comment" : "Comment"
                              : "Messenger"}
                            {` · ${selectedThread.updatedAt}`}
                          </CardDescription>
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <Badge
                              variant="outline"
                              className={cn(
                                "rounded-full text-xs px-2.5 py-0.5",
                                selectedThread.sourceType === "facebook_comment"
                                  ? selectedThread.postId
                                    ? "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/20 dark:text-purple-300 dark:border-purple-900"
                                    : "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/20 dark:text-violet-300 dark:border-violet-900"
                                  : "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/20 dark:text-blue-300 dark:border-blue-900"
                              )}
                            >
                              {selectedThread.sourceType === "facebook_comment"
                                ? selectedThread.postId ? "Ad Comment" : "Comment"
                                : "Messenger"}
                            </Badge>
                            {selectedThread.label && (
                              <Badge
                                variant="outline"
                                className="rounded-full text-xs px-2.5 py-0.5 bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/20 dark:text-blue-300 dark:border-blue-900"
                              >
                                {selectedThread.label === "Lead" ? "Pricing" : selectedThread.label}
                              </Badge>
                            )}
                            <Badge
                              variant="outline"
                              className="rounded-full text-xs px-2.5 py-0.5 gap-1 bg-muted/50 text-muted-foreground"
                            >
                              <IconUsers className="size-3" />
                              {selectedThread.assignedTo && selectedThread.assignedTo !== "Unassigned" ? selectedThread.assignedTo : "Unassigned"}
                            </Badge>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <Select
                          value={selectedThreadMeta.taskState === "closed" ? "closed" : selectedThreadMeta.status === "replied" ? "replied" : "pending"}
                          onValueChange={(val: "pending" | "replied" | "closed") => {
                            setInboxTaskState(prev => ({
                              ...prev,
                              [selectedThread.id]: val === "closed" ? "closed" : "open",
                            }))
                            if (val === "replied" || val === "closed") {
                              setInboxHandledThreads(prev => ({ ...prev, [selectedThread.id]: true }))
                            } else {
                              setInboxHandledThreads(prev => ({ ...prev, [selectedThread.id]: false }))
                            }
                            if (selectedThread.sourceType === "messenger" && selectedThread.conversationId) {
                              void patchMessengerConversation(selectedThread.conversationId, selectedThread.pageId, {
                                status: val,
                                unread_count: val === "closed" ? 0 : selectedThread.unread,
                              })
                            }
                          }}
                        >
                          <SelectTrigger className="h-8 w-auto px-3 text-xs font-semibold rounded-full border-[#E4E6EB] bg-white dark:border-border dark:bg-background">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="replied">Replied</SelectItem>
                            <SelectItem value="closed">Closed</SelectItem>
                          </SelectContent>
                        </Select>

                        <Button
                          variant="outline"
                          size="sm"
                          className={cn("h-8 gap-1.5 rounded-full text-xs", inboxContextOpen && "border-primary bg-primary/5 text-primary")}
                          onClick={() => setInboxContextOpen(open => !open)}
                          title={inboxContextOpen ? "Hide context panel" : "Show context panel"}
                        >
                          <IconColumns3 className="size-3.5" />
                          Context
                        </Button>

                        {selectedThread.sourceType === "facebook_comment" && selectedThread.comment?.fb_post_permalink ? (
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8 rounded-full"
                            onClick={() => window.open(selectedThread.comment!.fb_post_permalink!, "_blank")}
                            title="Open on Facebook"
                          >
                            <IconExternalLink className="size-3.5" />
                          </Button>
                        ) : null}

                        <Button
                          variant="secondary"
                          size="sm"
                          className="h-8 gap-1.5 rounded-full bg-[#F0F2F5] text-xs text-[#050505] hover:bg-[#E4E6EB] dark:bg-muted dark:text-foreground"
                          onClick={() => void runInboxAiAutoReply()}
                          disabled={inboxAiLoading || !selectedThread?.lastMessage || selectedThread.id === "empty-inbox"}
                        >
                          {inboxAiLoading ? <IconLoader2 className="size-3.5 animate-spin" /> : <IconSparkles className="size-3.5" />}
                          AI Auto Reply
                        </Button>
                      </div>
                    </div>
                  </CardHeader>

                  {activeAgents[selectedThread.id]?.length > 1 && (
                    <div className="flex items-center gap-2 bg-amber-50 px-4 py-2 text-xs font-medium text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                      <IconAlertTriangle className="size-3.5" />
                      <span>{activeAgents[selectedThread.id]?.join(", ")} đang xem hội thoại này</span>
                    </div>
                  )}

                  <CardContent className="flex min-h-0 flex-1 flex-col p-0">
                    <ScrollArea className="min-h-0 flex-1">
                      <div className="space-y-2 p-3 pb-4">
                        {selectedThread.id !== "empty-inbox" ? (
                          <div className="mb-20 mt-4 flex flex-col items-center text-center">
                            <InboxAvatar
                              name={selectedThread.name}
                              src={selectedThread.customerProfilePic || selectedPage?.picture || (selectedPage?.id ? `/api/facebook/page-picture?page_id=${selectedPage.id}` : undefined)}
                              size="lg"
                            />
                            <p className="mt-3 text-base font-semibold text-[#050505] dark:text-foreground">{selectedThread.name}</p>
                            <p className="text-xs text-[#65676B]">{selectedThread.sourceLabel}</p>
                          </div>
                        ) : null}
                        <div className="space-y-3">
                          {selectedThread.sourceType === "facebook_comment" ? (
                            <div className="rounded-2xl border bg-violet-50/60 p-3 text-sm">
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge variant="outline" className="rounded-full bg-white text-violet-700">
                                  Facebook Comment
                                </Badge>
                                {selectedThread.postId ? (
                                  <span className="text-xs text-muted-foreground">Post ID: {selectedThread.postId}</span>
                                ) : null}
                              </div>
                              {selectedThreadPostPreview ? (
                                <div className="mt-2">
                                  <FacebookPostPreviewCard preview={selectedThreadPostPreview} />
                                </div>
                              ) : null}
                            </div>
                          ) : null}

                          {(selectedThread.sourceType === "messenger" || selectedThread.sourceType === "facebook_comment") && getConversationDisplayMessages(selectedThread).length ? (
                            getConversationDisplayMessages(selectedThread).map(message => (
                              <div
                                key={message.id}
                                className={cn(
                                  "max-w-[78%] rounded-[18px] px-3.5 py-2 text-sm leading-5 shadow-sm",
                                  message.direction === "outbound"
                                    ? "ml-auto bg-[#0084FF] text-white"
                                    : "bg-[#F0F2F5] text-[#050505] dark:bg-muted dark:text-foreground"
                                )}
                              >
                                <MessengerAttachmentContent message={message} />
                                <p className={cn(
                                  "mt-1 text-xs",
                                  message.direction === "outbound" ? "text-white/75" : "text-[#65676B]"
                                )}>
                                  {message.fb_created_time ? postDate(message.fb_created_time) : postDate(message.created_at)}
                                </p>
                              </div>
                            ))
                          ) : (
                            <div className="max-w-[78%] rounded-[18px] bg-[#F0F2F5] px-3.5 py-2 text-[#050505] dark:bg-muted dark:text-foreground">
                              <p className="text-sm leading-5">{selectedThread.lastMessage}</p>
                              <p className="mt-1 text-xs text-[#65676B]">{selectedThread.updatedAt}</p>
                            </div>
                          )}

                          {selectedThread.sourceType === "facebook_comment" && selectedThread.comment?.draft_reply ? (
                            <div className="ml-auto max-w-[78%] rounded-[18px] bg-[#0084FF] px-3.5 py-2 text-white shadow-sm">
                              <p className="whitespace-pre-wrap text-sm leading-5">{selectedThread.comment.draft_reply}</p>
                              <p className="mt-1 text-xs text-white/75">Reply</p>
                            </div>
                          ) : null}

                          {shouldShowSelectedThreadAutoReply && selectedThreadAutoReply ? (
                            <div className="ml-auto max-w-[78%] rounded-[18px] bg-[#0084FF] px-3.5 py-2 text-white shadow-sm">
                              <p className="whitespace-pre-wrap text-sm leading-5">{selectedThreadAutoReply.text}</p>
                              <p className="mt-1 text-xs text-white/75">
                                {selectedThreadAutoReply.action === "auto_sent_preview" ? "AI auto reply preview" : "Reply"} - {selectedThreadAutoReply.at}
                              </p>
                            </div>
                          ) : null}

                          {selectedThread.sourceType === "messenger" && !selectedThread.conversation ? (
                            <div className="max-w-[78%] rounded-[18px] bg-[#F0F2F5] px-3.5 py-2 text-[#050505] dark:bg-muted dark:text-foreground">
                              <p className="text-sm leading-5">Let me know if you want a quick bundle recommendation too.</p>
                              <p className="mt-1 text-xs text-[#65676B]">Suggested follow-up</p>
                            </div>
                          ) : null}
                        </div>

                        {inboxAiError ? (
                          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{inboxAiError}</div>
                        ) : null}

                        <div className="mt-6 rounded-2xl border border-dashed bg-background p-3">
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <IconAlertTriangle className="size-3.5" />
                            {selectedThread.sourceType === "facebook_comment"
                              ? "Comment replies and hide/unhide use Page comment APIs when the Page has the required permissions."
                              : selectedThread.conversation
                                ? "Messenger messages are loaded from webhook storage. Replies are sent with the selected Page token."
                                : "Messenger sync requires `pages_messaging`, Page webhook subscription, and the messenger tables migration."}
                          </div>
                        </div>

                      </div>
                    </ScrollArea>

                    {inboxAiLoading || inboxAiResult ? (
                      <div className="shrink-0 border-t border-[#E4E6EB] bg-white px-3 pt-3 dark:border-border dark:bg-background">
                        <div className="rounded-2xl border border-primary/30 bg-primary/5 p-3">
                          <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                            <IconSparkles className="size-4" />
                            Suggested reply from FAQ
                            {inboxAiLoading ? <IconLoader2 className="size-3.5 animate-spin" /> : null}
                          </div>

                          {inboxAiLoading && !inboxAiResult ? (
                            <p className="mt-2 text-sm text-muted-foreground">Generating suggestion…</p>
                          ) : inboxAiResult ? (
                            <>
                              <div className="mt-2 rounded-xl border border-border/60 bg-white p-3 text-sm leading-relaxed whitespace-pre-wrap dark:bg-background">
                                {inboxAiResult.draftReply || "No draft available."}
                              </div>

                              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                                <Badge variant="outline" className="rounded-full text-[11px] font-semibold">
                                  Intent: {inboxAiResult.intent}
                                </Badge>
                                <Badge variant="outline" className="rounded-full text-[11px] font-semibold">
                                  Confidence: {Math.round(inboxAiResult.confidence || 0)}%
                                </Badge>
                                {(inboxAiResult.evidence || []).map(item => (
                                  <Badge
                                    key={`${item.kind}-${item.id}`}
                                    variant="outline"
                                    className="rounded-full border-violet-200 bg-violet-50 text-[11px] font-semibold text-violet-700"
                                  >
                                    {item.kind === "template" ? "FAQ" : "Rule"}: {item.shortcut || item.title}
                                  </Badge>
                                ))}
                                {inboxAiResult.riskLevel === "low" ? (
                                  <Badge variant="outline" className="rounded-full border-emerald-200 bg-emerald-50 text-[11px] font-semibold text-emerald-700">
                                    Safe
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="rounded-full border-amber-200 bg-amber-50 text-[11px] font-semibold text-amber-700">
                                    Needs human
                                  </Badge>
                                )}
                              </div>

                              <div className="mt-3 flex flex-wrap items-center gap-2">
                                <Button
                                  size="sm"
                                  className="gap-1.5 rounded-full bg-[#0084FF] text-white hover:bg-[#0077E6]"
                                  disabled={!inboxAiResult.draftReply || inboxAiResult.riskLevel === "high"}
                                  onClick={() => {
                                    if (!inboxAiResult?.draftReply || !selectedThread) return
                                    setInboxReplyText(inboxAiResult.draftReply)
                                    setInboxReplyDrafts(prev => ({ ...prev, [selectedThread.id]: inboxAiResult.draftReply }))
                                    void handleReplyInboxThread()
                                  }}
                                >
                                  <IconSend className="size-3.5" />
                                  {selectedThread.sourceType === "facebook_comment" ? "Private reply" : "Send"}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="rounded-full"
                                  disabled={!inboxAiResult.draftReply}
                                  onClick={() => {
                                    if (!inboxAiResult?.draftReply || !selectedThread) return
                                    setInboxReplyText(inboxAiResult.draftReply)
                                    setInboxReplyDrafts(prev => ({ ...prev, [selectedThread.id]: inboxAiResult.draftReply }))
                                  }}
                                >
                                  Insert
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="rounded-full"
                                  disabled={inboxAiLoading}
                                  onClick={() => void runInboxAiAutoReply()}
                                >
                                  Rewrite
                                </Button>
                                {selectedThread.sourceType === "facebook_comment" && selectedThread.comment ? (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="gap-1.5 rounded-full"
                                    disabled={commentActionLoading}
                                    onClick={() => void handleToggleInboxCommentHidden()}
                                  >
                                    <IconEyeOff className="size-3.5" />
                                    {selectedThread.comment.is_hidden ? "Unhide comment" : "Hide comment"}
                                  </Button>
                                ) : null}
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="ml-auto rounded-full text-muted-foreground"
                                  onClick={() => setInboxAiResult(null)}
                                >
                                  Dismiss
                                </Button>
                              </div>
                            </>
                          ) : null}
                        </div>
                      </div>
                    ) : null}

                    <div className="border-t border-[#E4E6EB] bg-white p-3 dark:border-border dark:bg-background">
                      <div className="rounded-[20px] border border-[#E4E6EB] bg-white p-3 shadow-sm dark:border-border dark:bg-background">
                        <Textarea
                          placeholder="Enter to send, Shift+Enter for newline"
                          value={inboxReplyText}
                          onChange={event => {
                            const val = event.target.value
                            setInboxReplyText(val)
                            if (val.endsWith("/")) {
                              setTemplatePickerOpen(true)
                            }
                          }}
                          onKeyDown={event => {
                            if (event.key === "/") {
                              setTemplatePickerOpen(true)
                            }
                            if (!["Tab", "Enter", " "].includes(event.key)) return
                            const lastToken = inboxReplyText.split(/\s+/).at(-1)?.trim()
                            if (!lastToken?.startsWith("/")) return
                            const template = pageManagerSettings.quickReplyTemplates.templates.find(item => item.shortcut === lastToken)
                            if (!template) return
                            event.preventDefault()
                            applyQuickReplyTemplate(template)
                          }}
                          className="min-h-14 resize-none border-0 bg-transparent p-0 text-sm shadow-none focus-visible:ring-0"
                        />

                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <button type="button" onClick={() => setInboxReplyText(prev => prev + " Product price is 599k. ")} className="rounded-md border border-blue-200 bg-blue-50/50 px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50 dark:border-blue-900/50 dark:bg-blue-950/20 dark:text-blue-400">/price</button>
                          <button type="button" onClick={() => setInboxReplyText(prev => prev + " We offer free shipping nationwide. ")} className="rounded-md border border-blue-200 bg-blue-50/50 px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50 dark:border-blue-900/50 dark:bg-blue-950/20 dark:text-blue-400">/ship</button>
                          <button type="button" onClick={() => setInboxReplyText(prev => prev + " This item is currently in stock in all sizes. ")} className="rounded-md border border-blue-200 bg-blue-50/50 px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50 dark:border-blue-900/50 dark:bg-blue-950/20 dark:text-blue-400">/stock</button>
                          <button type="button" onClick={() => setInboxReplyText(prev => prev + " 100% refund policy for manufacturer defects. ")} className="rounded-md border border-blue-200 bg-blue-50/50 px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50 dark:border-blue-900/50 dark:bg-blue-950/20 dark:text-blue-400">/refund</button>
                          <Popover open={templatePickerOpen} onOpenChange={setTemplatePickerOpen}>
                            <PopoverTrigger asChild>
                              <button type="button" className="rounded-md border border-blue-200 bg-blue-50/50 px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50 dark:border-blue-900/50 dark:bg-blue-950/20 dark:text-blue-400">+ Template</button>
                            </PopoverTrigger>
                            <PopoverContent align="start" className="w-80 rounded-2xl p-2">
                              <div className="px-2 pb-2 pt-1">
                                <p className="text-sm font-semibold">Quick replies</p>
                                <p className="text-xs text-muted-foreground">Saved per Page in Settings.</p>
                              </div>
                              <div className="space-y-1">
                                {pageManagerSettings.quickReplyTemplates.templates.length > 0 ? (
                                  pageManagerSettings.quickReplyTemplates.templates.map(template => (
                                    <button
                                      key={template.id}
                                      type="button"
                                      onClick={() => applyQuickReplyTemplate(template)}
                                      className="w-full rounded-xl px-3 py-2 text-left hover:bg-muted"
                                    >
                                      <div className="flex items-center justify-between gap-2">
                                        <span className="text-sm font-medium">{template.name}</span>
                                        <span className="text-xs text-muted-foreground">{template.shortcut}</span>
                                      </div>
                                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{template.body}</p>
                                    </button>
                                  ))
                                ) : (
                                  <div className="rounded-xl bg-muted/50 px-3 py-4 text-sm text-muted-foreground">
                                    No templates yet. Add some in Settings.
                                  </div>
                                )}
                              </div>
                            </PopoverContent>
                          </Popover>

                          <div className="ml-auto flex flex-wrap items-center gap-1">
                            <Button variant="ghost" size="icon" className="size-8 rounded-full text-[#0084FF] hover:bg-[#E7F3FF] hover:text-[#0084FF]">
                              <IconMicrophone className="size-4" />
                            </Button>
                            <label
                              className="inline-flex size-8 cursor-pointer items-center justify-center rounded-full text-[#0084FF] hover:bg-[#E7F3FF]"
                              title="Attach file / voice note (<100MB)"
                            >
                              <IconPaperclip className="size-4" />
                              <input
                                type="file"
                                className="hidden"
                                onChange={event => {
                                  const file = event.target.files?.[0]
                                  if (!file) return
                                  if (file.size > 100 * 1024 * 1024) {
                                    setInboxAiError("Attachment must be under 100MB.")
                                    event.target.value = ""
                                    return
                                  }
                                  setInboxAttachmentNote(file.name)
                                  setInboxAiError("")
                                }}
                              />
                            </label>
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button variant="ghost" size="icon" className="size-8 rounded-full text-[#0084FF] hover:bg-[#E7F3FF] hover:text-[#0084FF]">
                                  <IconPhoto className="size-4" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent align="start" className="w-72 rounded-2xl p-3">
                                <p className="px-1 pb-2 text-sm font-semibold">Send photo / attachment</p>
                                <input
                                  type="url"
                                  placeholder="https://..."
                                  className="mb-2 w-full rounded-lg border px-2 py-1.5 text-sm"
                                  onChange={event => setInboxAttachmentNote(event.target.value)}
                                />
                                <p className="text-xs text-muted-foreground">Ponytail: stores the filename/url as a note. Once real media upload exists, attach sends the file via Graph API.</p>
                              </PopoverContent>
                            </Popover>
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button variant="ghost" size="icon" className="size-8 rounded-full text-[#0084FF] hover:bg-[#E7F3FF] hover:text-[#0084FF]">
                                  <IconGif className="size-4" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent align="start" className="w-64 rounded-2xl p-3">
                                <p className="px-1 pb-2 text-sm font-semibold">Search GIF</p>
                                <input
                                  type="text"
                                  placeholder="e.g. thank you"
                                  className="w-full rounded-lg border px-2 py-1.5 text-sm"
                                  value={inboxGifQuery}
                                  onChange={event => setInboxGifQuery(event.target.value)}
                                />
                                <p className="mt-2 text-xs text-muted-foreground">Ponytail: inserts a [GIF: …] tag. Tenor/GIPHY integration comes later.</p>
                              </PopoverContent>
                            </Popover>
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button variant="ghost" size="icon" className="size-8 rounded-full text-[#0084FF] hover:bg-[#E7F3FF] hover:text-[#0084FF]">
                                  <IconMoodSmile className="size-4" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent align="end" className="w-56 rounded-2xl p-2">
                                <p className="px-2 pb-1 pt-1 text-sm font-semibold">Emotion status</p>
                                <div className="space-y-0.5">
                                  {([
                                    { id: "neutral", label: "Neutral" },
                                    { id: "happy", label: "Happy" },
                                    { id: "concerned", label: "Concerned" },
                                    { id: "urgent", label: "Urgent" },
                                  ] as const).map(opt => (
                                    <button
                                      key={opt.id}
                                      type="button"
                                      onClick={() => setInboxEmotionStatus(opt.id)}
                                      className={cn(
                                        "w-full rounded-lg px-3 py-1.5 text-left text-sm hover:bg-muted",
                                        inboxEmotionStatus === opt.id && "bg-muted font-medium"
                                      )}
                                    >
                                      {opt.label}
                                    </button>
                                  ))}
                                </div>
                              </PopoverContent>
                            </Popover>
                          </div>
                        </div>

                        <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-[#E4E6EB] pt-2 dark:border-border">
                          <div className="flex flex-1 items-center gap-1.5 text-xs text-muted-foreground">
                            <IconShield className="size-3.5" />
                            <span>AI must not invent prices, stock, discounts, or refund promises.</span>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 gap-1.5 rounded-full bg-[#F8F9FA] text-[#050505] border-[#E4E6EB] hover:bg-[#E4E6EB] dark:bg-muted/50 dark:text-foreground dark:hover:bg-muted"
                            onClick={() => {
                              const current = inboxAssignments[selectedThread.id]
                              const selfLabel = "Me"
                              const next = current === selfLabel
                                ? (pageManagerSettings.assignmentRules.defaultTeam || "Sales")
                                : selfLabel
                              setInboxAssignments(prev => ({
                                ...prev,
                                [selectedThread.id]: next,
                              }))
                              if (selectedThread.sourceType === "messenger" && selectedThread.conversationId) {
                                void patchMessengerConversation(selectedThread.conversationId, selectedThread.pageId, {
                                  assigned_to: next,
                                })
                              }
                            }}
                            disabled={!pageManagerSettings.assignmentRules.enabled}
                            title={pageManagerSettings.assignmentRules.selfAssignEnabled ? "Click to self-assign / reassign" : "Enable assignment in Settings"}
                          >
                            <IconUsers className="size-3.5" />
                            {inboxAssignments[selectedThread.id] === "Me"
                              ? "Assigned to me"
                              : inboxAssignments[selectedThread.id] || "Assign"}
                          </Button>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button variant="outline" size="sm" className="h-8 gap-1.5 rounded-full bg-[#F8F9FA] text-[#050505] border-[#E4E6EB] hover:bg-[#E4E6EB] dark:bg-muted/50 dark:text-foreground dark:hover:bg-muted">
                                <IconCalendarTime className="size-3.5" />
                                Schedule
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent align="start" className="w-64 rounded-2xl p-3">
                              <p className="px-1 pb-2 text-sm font-semibold">Schedule reply</p>
                              <input
                                type="datetime-local"
                                className="w-full rounded-lg border px-2 py-1.5 text-sm"
                                value={inboxScheduleAt}
                                onChange={event => setInboxScheduleAt(event.target.value)}
                              />
                              <p className="mt-2 text-xs text-muted-foreground">Ponytail: stores a local scheduled draft. Real timed send needs a scheduled_messages worker later.</p>
                            </PopoverContent>
                          </Popover>
                          <Button
                            variant="outline"
                            className="h-8 rounded-full px-4 text-xs"
                            onClick={() => alert("Mock: Local draft saved")}
                          >
                            Save draft
                          </Button>
                          <Button
                            className="h-8 gap-1.5 rounded-full bg-[#2548D8] px-4 text-xs text-white hover:bg-[#1C36A3]"
                            disabled={(!inboxReplyText.trim() && !inboxAttachmentNote.trim() && !inboxGifQuery.trim()) || commentActionLoading || messengerLoading || selectedThread.id === "empty-inbox"}
                            onClick={() => void handleReplyInboxThread()}
                          >
                            {commentActionLoading || messengerLoading ? <IconLoader2 className="size-3.5 animate-spin" /> : <IconSend className="size-3.5" />}
                            Send
                          </Button>
                        </div>
                        {(inboxAttachmentNote || inboxGifQuery || inboxScheduleAt || inboxEmotionStatus !== "neutral") && (
                          <div className="mt-2 flex flex-wrap gap-1.5 text-xs text-muted-foreground">
                            {inboxEmotionStatus !== "neutral" ? <span className="rounded-full bg-amber-50 px-2 py-0.5 text-amber-700">Emotion: {inboxEmotionStatus}</span> : null}
                            {inboxScheduleAt ? <span className="rounded-full bg-blue-50 px-2 py-0.5 text-blue-700">Scheduled: {new Date(inboxScheduleAt).toLocaleString("en-US")}</span> : null}
                            {inboxAttachmentNote ? <span className="rounded-full bg-muted px-2 py-0.5">Attachment: {inboxAttachmentNote}</span> : null}
                            {inboxGifQuery ? <span className="rounded-full bg-muted px-2 py-0.5">GIF: {inboxGifQuery}</span> : null}
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {inboxContextOpen ? (
                  <Card className="flex h-full min-h-0 flex-col overflow-hidden rounded-none border-0 border-l border-[#E4E6EB] bg-white shadow-none dark:border-border dark:bg-background">
                    <CardHeader className="shrink-0 border-b border-[#E4E6EB] p-3 dark:border-border">
                      <CardTitle className="text-sm font-semibold">Context</CardTitle>
                      <CardDescription className="text-xs">Thread details beside chat</CardDescription>
                    </CardHeader>
                    <CardContent className="min-h-0 flex-1 space-y-4 overflow-y-auto p-3 text-sm">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-muted-foreground">Source</span>
                          <Badge variant="outline" className="rounded-full text-xs">{selectedThread.sourceLabel}</Badge>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-muted-foreground">Status</span>
                          <span className="font-medium capitalize">{selectedThreadMeta.taskState || selectedThread.responseStatus}</span>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-muted-foreground">Assignee</span>
                          <span className="font-medium">{selectedThread.assignedTo || "Unassigned"}</span>
                        </div>
                        {selectedThread.sentiment ? (
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-muted-foreground">Sentiment</span>
                            <span className="font-medium capitalize">{selectedThread.sentiment}</span>
                          </div>
                        ) : null}
                      </div>

                      {inboxAiResult ? (
                        <div className="rounded-xl border border-border/70 bg-muted/30 p-3 space-y-2">
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                            <IconSparkles className="size-3.5" />
                            AI suggestion
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            <Badge variant="outline" className="rounded-full text-[11px]">Intent: {inboxAiResult.intent}</Badge>
                            <Badge variant="outline" className="rounded-full text-[11px]">Confidence: {Math.round(inboxAiResult.confidence || 0)}%</Badge>
                            <Badge
                              variant="outline"
                              className={cn(
                                "rounded-full text-[11px]",
                                inboxAiResult.riskLevel === "high" ? "border-rose-200 bg-rose-50 text-rose-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"
                              )}
                            >
                              Risk: {inboxAiResult.riskLevel}
                            </Badge>
                          </div>
                          {inboxAiResult.draftReply ? (
                            <p className="text-xs leading-relaxed text-muted-foreground line-clamp-6">{inboxAiResult.draftReply}</p>
                          ) : null}
                        </div>
                      ) : (
                        <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 p-3 text-xs text-muted-foreground">
                          Run AI Auto Reply to populate intent, confidence, and draft here.
                        </div>
                      )}

                      {selectedThread.sourceType === "facebook_comment" || selectedThread.sourceType === "instagram_comment" ? (
                        <div className="rounded-xl border border-border/70 p-3 space-y-2">
                          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Post context</div>
                          <p className="text-sm font-medium line-clamp-3">
                            {selectedThread.comment?.fb_post_message || selectedThread.lastMessage || "Comment on Page post"}
                          </p>
                          {selectedThread.comment?.fb_post_permalink ? (
                            <a
                              href={selectedThread.comment.fb_post_permalink}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                            >
                              <IconExternalLink className="size-3.5" />
                              Open on Facebook
                            </a>
                          ) : null}
                        </div>
                      ) : null}

                      {selectedThread.tags?.length ? (
                        <div className="space-y-2">
                          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tags</div>
                          <div className="flex flex-wrap gap-1.5">
                            {selectedThread.tags.map(tag => (
                              <Badge key={tag} variant="outline" className="rounded-full text-[11px]">{tag}</Badge>
                            ))}
                          </div>
                        </div>
                      ) : null}

                      {/* Mock Stripe Widget */}
                      <div className="rounded-xl border border-border/70 p-3 space-y-3 bg-slate-50/50 dark:bg-muted/10">
                        <div className="flex items-center justify-between">
                          <div className="text-xs font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-400">Stripe Billing</div>
                          <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700 rounded-full text-[10px]">Active</Badge>
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Last payment</span>
                            <span className="font-medium">$120.00</span>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">Card</span>
                            <span>Visa ending in •••• 4242</span>
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full text-xs h-8 border-indigo-200 text-indigo-700 hover:bg-indigo-50 dark:border-indigo-900 dark:text-indigo-400 dark:hover:bg-indigo-950"
                          onClick={() => alert("Mock Action: Refund flow would start here.")}
                        >
                          Issue Refund
                        </Button>
                      </div>

                      {/* Mock Shopify Widget */}
                      <div className="rounded-xl border border-border/70 p-3 space-y-3 bg-emerald-50/50 dark:bg-emerald-950/10">
                        <div className="flex items-center justify-between">
                          <div className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">Shopify Orders</div>
                          <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700 rounded-full text-[10px]">2 Orders</Badge>
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Order #10294</span>
                            <span className="font-medium">In Transit</span>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">Updated</span>
                            <span>2 hours ago</span>
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full text-xs h-8 border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900 dark:text-emerald-400 dark:hover:bg-emerald-950"
                          onClick={() => window.open("https://shopify.com", "_blank")}
                        >
                          Track Package
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ) : null}
              </div>
            </div>
          )}

          {tab === "posts" && (
            <div className="space-y-4">
              <div className="grid gap-4 xl:grid-cols-[240px_minmax(0,1fr)_320px]">
                <Card className="border-border/70 shadow-none">
                  <CardHeader className="border-b pb-4">
                    <CardTitle className="text-sm">Post scope</CardTitle>
                    <CardDescription>Public and dark posts default to the selected Page. Use ad account scope only for audits.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {[
                      { id: "all", label: "All posts", count: totalPostCount },
                      { id: "public", label: "Public posts", count: publicPostCount },
                      { id: "dark", label: "Dark posts", count: darkPostCount },
                    ].map(item => (
                      <button
                        key={item.id}
                        onClick={() => setPostScope(item.id as "all" | "public" | "dark")}
                        className={cn(
                          "flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left transition-colors",
                          postScope === item.id ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                        )}
                      >
                        <span className="text-sm font-medium">{item.label}</span>
                        <span className="text-xs text-muted-foreground">{item.count}</span>
                      </button>
                    ))}
                    <div className="mt-4 rounded-xl border bg-muted/20 p-3 text-xs text-muted-foreground">
                      <p className="font-medium text-foreground">Active sources</p>
                      <p className="mt-1">Public posts: `/api/insights/page-insights`</p>
                      <p className="mt-1">Dark posts: ads → creative → story id</p>
                      <p className="mt-1">Ad account: {selectedAdAccount?.name || "Not selected"}</p>
                      <p className="mt-1">Scope: {darkPostPageScope === "ad_account" ? "All ad account Pages" : selectedPage?.name || "Selected Page"}</p>
                    </div>
                  </CardContent>
                </Card>

                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Button variant={postScope === "all" ? "default" : "outline"} size="sm" onClick={() => setPostScope("all")}>All</Button>
                    <Button variant={postScope === "public" ? "default" : "outline"} size="sm" onClick={() => setPostScope("public")}>Public</Button>
                    <Button variant={postScope === "dark" ? "default" : "outline"} size="sm" onClick={() => setPostScope("dark")}>Dark</Button>
                    {postScope !== "public" && (
                      <div className="flex items-center gap-1 rounded-full border bg-background p-1">
                        <Button
                          variant={darkPostPageScope === "selected_page" ? "default" : "ghost"}
                          size="sm"
                          className="h-7 rounded-full px-3 text-xs"
                          onClick={() => setDarkPostPageScope("selected_page")}
                        >
                          This Page
                        </Button>
                        <Button
                          variant={darkPostPageScope === "ad_account" ? "default" : "ghost"}
                          size="sm"
                          className="h-7 rounded-full px-3 text-xs"
                          onClick={() => setDarkPostPageScope("ad_account")}
                        >
                          All ad account
                        </Button>
                      </div>
                    )}
                    <div className="ml-auto flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        onClick={() => void loadPosts(true)}
                        disabled={pageInsightLoading || launchHistoryLoading || metaDarkPostsLoading}
                      >
                        <IconRefresh className={cn("size-3.5", (pageInsightLoading || launchHistoryLoading || metaDarkPostsLoading) && "animate-spin")} />
                        Sync
                      </Button>
                      <Button size="sm" className="gap-1.5" onClick={() => setComposerOpen(true)} disabled={!selectedPage?.id || /^p-\d+$/.test(selectedPage?.id || "")} title="Publish a post to this Page">
                        <IconPlus className="size-3.5" />
                        New post
                      </Button>
                    </div>
                  </div>

                  {(postScope !== "dark") && (
                    <Card className="border-border/70 shadow-none overflow-hidden">
                      <CardHeader className="border-b pb-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <CardTitle className="text-sm">Recent Page Posts</CardTitle>
                            <CardDescription>Synced from `page-insights` for the selected Page.</CardDescription>
                          </div>
                          <Badge
                            variant="outline"
                            className={cn(
                              "h-6",
                              pageInsightPermissionRequired
                                ? "border-amber-200 bg-amber-50 text-amber-700"
                                : "border-blue-200 bg-blue-50 text-blue-700"
                            )}
                          >
                            {pageInsightPermissionRequired ? "permission required" : `${publicPostCount} posts`}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="p-0">
                        {pageInsightLoading ? (
                          <div className="flex items-center justify-center py-16">
                            <IconLoader2 className="size-5 animate-spin text-muted-foreground" />
                          </div>
                        ) : pageInsightError ? (
                          <div className="p-4">
                            <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300">
                              {pageInsightPermissionRequired ? (
                                <div className="space-y-1">
                                  <p className="font-medium">Public Page posts are blocked by Meta permissions.</p>
                                  <p>
                                    This Page needs `pages_read_engagement` or Page Public Content Access before
                                    `/PAGE_ID/posts` can return public posts. Dark posts can still load from ad
                                    account ads and creatives.
                                  </p>
                                </div>
                              ) : (
                                pageInsightError
                              )}
                            </div>
                          </div>
                        ) : visiblePublicPosts.length > 0 ? (
                          <div className="grid lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
                            <div className="p-4 border-b lg:border-b-0 lg:border-r">
                              <div
                                role="button"
                                tabIndex={0}
                                onClick={() => featuredPublicPost?.id && setSelectedPostKey(`public:${featuredPublicPost.id}`)}
                                onKeyDown={event => {
                                  if ((event.key === "Enter" || event.key === " ") && featuredPublicPost?.id) {
                                    setSelectedPostKey(`public:${featuredPublicPost.id}`)
                                  }
                                }}
                                className={cn(
                                  "w-full cursor-pointer overflow-hidden rounded-lg border bg-muted/20 text-left transition-colors hover:bg-muted/40",
                                  featuredPublicPost?.id && selectedPostKey === `public:${featuredPublicPost.id}` && "border-primary ring-1 ring-primary/30"
                                )}
                              >
                                <div className="aspect-[16/9] bg-muted flex items-center justify-center overflow-hidden">
                                  {featuredPublicPost?.full_picture ? (
                                    <img src={featuredPublicPost.full_picture} alt="" className="size-full object-cover" />
                                  ) : (
                                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                                      <IconPhoto className="size-8" />
                                      <span className="text-xs">No image returned</span>
                                    </div>
                                  )}
                                </div>
                                <div className="p-4">
                                  <p className="text-sm font-medium leading-5 line-clamp-3">
                                    {featuredPublicPost?.message || featuredPublicPost?.story || "Post without text"}
                                  </p>
                                  <div className="mt-3 flex items-center justify-between gap-3">
                                    <p className="text-xs text-muted-foreground">
                                      {featuredPublicPost?.created_time ? new Date(featuredPublicPost.created_time).toLocaleString("en-US", {
                                        month: "short",
                                        day: "numeric",
                                        hour: "2-digit",
                                        minute: "2-digit",
                                      }) : "No timestamp"}
                                    </p>
                                    {featuredPublicPost?.permalink_url && (
                                      <a
                                        href={featuredPublicPost.permalink_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        onClick={event => event.stopPropagation()}
                                        className="text-xs font-medium text-primary hover:underline shrink-0"
                                      >
                                        View post
                                      </a>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                            <div className="divide-y">
                              {secondaryPublicPosts.length > 0 ? secondaryPublicPosts.map((post) => (
                                <div
                                  key={post.id}
                                  role="button"
                                  tabIndex={0}
                                  onClick={() => setSelectedPostKey(`public:${post.id}`)}
                                  onKeyDown={event => {
                                    if (event.key === "Enter" || event.key === " ") setSelectedPostKey(`public:${post.id}`)
                                  }}
                                  className={cn(
                                    "flex w-full cursor-pointer gap-3 p-3 text-left transition-colors hover:bg-muted/40",
                                    selectedPostKey === `public:${post.id}` && "bg-primary/5"
                                  )}
                                >
                                  <div className="size-16 rounded-lg border bg-muted shrink-0 overflow-hidden flex items-center justify-center">
                                    {post.full_picture ? (
                                      <img src={post.full_picture} alt="" className="size-full object-cover" />
                                    ) : (
                                      <IconPhoto className="size-5 text-muted-foreground" />
                                    )}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <p className="text-sm leading-5 line-clamp-2">
                                      {post.message || post.story || "Post without text"}
                                    </p>
                                    <div className="mt-1.5 flex items-center justify-between gap-2">
                                      <p className="text-xs text-muted-foreground truncate">
                                        {post.created_time ? new Date(post.created_time).toLocaleString("en-US", {
                                          month: "short",
                                          day: "numeric",
                                          hour: "2-digit",
                                          minute: "2-digit",
                                        }) : "No timestamp"}
                                      </p>
                                      {post.permalink_url && (
                                        <a
                                          href={post.permalink_url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          onClick={event => event.stopPropagation()}
                                          className="text-xs text-primary hover:underline shrink-0"
                                        >
                                          View
                                        </a>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              )) : (
                                <div className="p-4 text-sm text-muted-foreground">Only one recent post was returned by Meta.</div>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                            No recent Page posts returned for this Page.
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}

                  {(postScope !== "public") && (
                    <Card className="border-border/70 shadow-none overflow-hidden">
                      <CardHeader className="border-b pb-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <CardTitle className="text-sm">Dark Posts</CardTitle>
                            <CardDescription>
                              Ad account → ads → creative → `object_story_id` / `effective_object_story_id`.
                            </CardDescription>
                          </div>
                          <Badge variant="outline" className="h-6 bg-slate-50 text-slate-700 border-slate-200">
                            {darkPostCount} items
                          </Badge>
                        </div>
                        <div className="mt-4 grid gap-2 text-xs text-muted-foreground sm:grid-cols-4">
                          <div className="rounded-xl border bg-muted/20 p-2">
                            <p className="text-xs uppercase text-muted-foreground/70">Ads inspected</p>
                            <p className="mt-1 font-medium text-foreground">{metaDarkPostsMeta?.inspectedAds ?? 0}</p>
                          </div>
                          <div className="rounded-xl border bg-muted/20 p-2">
                            <p className="text-xs uppercase text-muted-foreground/70">Story IDs</p>
                            <p className="mt-1 font-medium text-foreground">{metaDarkPostsMeta?.adsWithStoryId ?? 0}</p>
                          </div>
                          <div className="rounded-xl border bg-muted/20 p-2">
                            <p className="text-xs uppercase text-muted-foreground/70">From Meta</p>
                            <p className="mt-1 font-medium text-foreground">{metaDarkPostCount}</p>
                          </div>
                          <div className="rounded-xl border bg-muted/20 p-2">
                            <p className="text-xs uppercase text-muted-foreground/70">Launch history</p>
                            <p className="mt-1 font-medium text-foreground">{launchHistoryDarkPostCount}</p>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="p-0">
                        {darkPostsLoading ? (
                          <div className="flex items-center justify-center py-16">
                            <IconLoader2 className="size-5 animate-spin text-muted-foreground" />
                          </div>
                        ) : darkPostsError && darkPosts.length === 0 ? (
                          <div className="p-4">
                            <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300">
                              {darkPostsError}
                            </div>
                          </div>
                        ) : darkPosts.length > 0 ? (
                          <>
                            <div className="divide-y">
                              {darkPosts.map(item => {
                                const itemKey = `dark:${item.source}:${item.postId || item.adId || item.batchId}`
                                const insight = item.adId ? darkPostInsights[item.adId] : undefined
                                const spend = insight?.spend ?? item.spend ?? null
                                const impressions = insight?.impressions ?? item.impressions ?? null
                                return (
                                  <div
                                    key={`${item.source}-${item.batchId}-${item.adId || item.creativeId || item.postId || item.fileName}`}
                                    role="button"
                                    tabIndex={0}
                                    onClick={() => setSelectedPostKey(itemKey)}
                                    onKeyDown={event => {
                                      if (event.key === "Enter" || event.key === " ") setSelectedPostKey(itemKey)
                                    }}
                                    className={cn(
                                      "p-4 text-left transition-colors hover:bg-muted/30",
                                      selectedPostKey === itemKey && "bg-primary/5"
                                    )}
                                  >
                                    <div className="flex gap-3">
                                      <div className="size-16 shrink-0 overflow-hidden rounded-xl border bg-muted">
                                        {item.thumbnailUrl ? (
                                          <img src={item.thumbnailUrl} alt={item.fileName || item.adName || "Dark post"} className="size-full object-cover" />
                                        ) : (
                                          <div className="flex size-full items-center justify-center text-muted-foreground">
                                            {item.mediaType === "video" ? <IconVideo className="size-5" /> : <IconPhoto className="size-5" />}
                                          </div>
                                        )}
                                      </div>
                                      <div className="min-w-0 flex-1">
                                        <div className="flex items-start justify-between gap-3">
                                          <div className="min-w-0">
                                            <p className="truncate text-sm font-medium">
                                              {item.headline || item.fileName || item.adName || item.adSetName || item.adId || "Dark post"}
                                            </p>
                                            <p className="mt-1 text-xs text-muted-foreground truncate">
                                              {item.campaignName ? `Campaign: ${item.campaignName}` : item.adSetName ? `Ad set: ${item.adSetName}` : "Campaign unavailable"}
                                              {item.adAccountName ? ` - ${item.adAccountName}` : ""}
                                            </p>
                                          </div>
                                          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                                            <Badge variant="outline" className={cn("h-6", item.source === "meta" ? "bg-violet-50 text-violet-700 border-violet-200" : "bg-blue-50 text-blue-700 border-blue-200")}>
                                              {item.source === "meta" ? "Meta" : "Launch history"}
                                            </Badge>
                                            {item.status && (
                                              <Badge variant="outline" className="h-6 bg-emerald-50 text-emerald-700 border-emerald-200">
                                                {item.status}
                                              </Badge>
                                            )}
                                          </div>
                                        </div>
                                        {item.primaryText ? (
                                          <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">
                                            {item.primaryText}
                                          </p>
                                        ) : null}
                                        <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2 xl:grid-cols-4">
                                          <div className="rounded-lg border bg-muted/20 p-2">
                                            <p className="text-xs uppercase tracking-wide text-muted-foreground/70">Linked ad</p>
                                            <p className="mt-1 truncate text-foreground">{item.adId || "—"}</p>
                                          </div>
                                          <div className="rounded-lg border bg-muted/20 p-2">
                                            <p className="text-xs uppercase tracking-wide text-muted-foreground/70">Launched by</p>
                                            <p className="mt-1 truncate text-foreground">{item.userName || "Unknown"}</p>
                                          </div>
                                          <div className="rounded-lg border bg-muted/20 p-2">
                                            <p className="text-xs uppercase tracking-wide text-muted-foreground/70">Spend</p>
                                            <p className="mt-1 truncate text-foreground">{money(spend)}</p>
                                          </div>
                                          <div className="rounded-lg border bg-muted/20 p-2">
                                            <p className="text-xs uppercase tracking-wide text-muted-foreground/70">Impressions</p>
                                            <p className="mt-1 truncate text-foreground">{fullNumber(impressions)}</p>
                                          </div>
                                        </div>
                                        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                                          {item.launchedAt ? (
                                            <span>{new Date(item.launchedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                                          ) : null}
                                          {item.postUrl ? (
                                            <a href={item.postUrl} target="_blank" rel="noopener noreferrer" onClick={event => event.stopPropagation()} className="font-medium text-primary hover:underline">
                                              Open post
                                            </a>
                                          ) : null}
                                          {item.postId ? <span>Post ID: {item.postId}</span> : null}
                                          {item.storyIdSource ? <span>Story source: {item.storyIdSource}</span> : null}
                                          {item.adId ? <span>Ad ID: {item.adId}</span> : null}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                            {metaDarkPostsMeta?.paging?.after ? (
                              <div className="border-t p-3 text-center">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="gap-1.5"
                                  onClick={() => void loadMoreDarkPosts()}
                                  disabled={metaDarkPostsLoading}
                                >
                                  <IconRefresh className={cn("size-3.5", metaDarkPostsLoading && "animate-spin")} />
                                  Load more Meta ads
                                </Button>
                              </div>
                            ) : null}
                          </>
                        ) : (
                          <div className="px-4 py-10 text-center">
                            <p className="text-sm font-medium text-foreground">No dark posts found</p>
                            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                              {darkPostPageScope === "selected_page"
                                ? `No dark post matched ${selectedPage?.name || "the selected Page"} in this ad account. Switch to All ad account to inspect dark posts across every Page in this ad account.`
                                : "No ad creative with object_story_id or effective_object_story_id was returned for this ad account/page scope."}
                            </p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}
                </div>

                <div className="space-y-4">
                  <Card className="border-border/70 shadow-none">
                    <CardHeader className="border-b pb-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <CardTitle className="text-sm">Post detail</CardTitle>
                          <CardDescription>
                            {selectedPost
                              ? selectedPost.scope === "dark"
                                ? "Dark post linked to campaign, ad set, and ad."
                                : "Public Page post with organic metrics."
                              : "Select a post to inspect it."}
                          </CardDescription>
                        </div>
                        {selectedPost ? (
                          <Badge variant="outline" className={cn("h-6", selectedPost.scope === "dark" ? "bg-violet-50 text-violet-700 border-violet-200" : "bg-blue-50 text-blue-700 border-blue-200")}>
                            {selectedPost.scope === "dark" ? "Dark" : "Public"}
                          </Badge>
                        ) : null}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4 pt-4">
                      {!selectedPost ? (
                        <div className="rounded-xl border bg-muted/20 p-4 text-sm text-muted-foreground">No post selected.</div>
                      ) : (
                        <>
                          <div className="overflow-hidden rounded-xl border bg-muted/20">
                            <div className="aspect-[16/10] bg-muted">
                              {selectedPost.imageUrl ? (
                                <img src={selectedPost.imageUrl} alt="" className="size-full object-cover" />
                              ) : (
                                <div className="flex size-full items-center justify-center text-muted-foreground">
                                  {selectedPost.mediaType === "video" ? <IconVideo className="size-8" /> : <IconPhoto className="size-8" />}
                                </div>
                              )}
                            </div>
                            <div className="space-y-2 p-3">
                              <p className="line-clamp-3 text-sm font-medium leading-5">{selectedPost.title}</p>
                              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                <span>{postDate(selectedPost.time)}</span>
                                {selectedPost.permalink ? (
                                  <a href={selectedPost.permalink} target="_blank" rel="noopener noreferrer" className="font-medium text-primary hover:underline">
                                    Open post
                                  </a>
                                ) : null}
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div className="rounded-xl border bg-background p-3">
                              <p className="text-xs text-muted-foreground">Engagement</p>
                              <p className="mt-1 text-lg font-semibold">{compactNumber(selectedPost.scope === "dark" ? selectedDarkInsight?.actions ?? selectedPost.engagement : selectedPost.engagement)}</p>
                            </div>
                            <div className="rounded-xl border bg-background p-3">
                              <p className="text-xs text-muted-foreground">Reach</p>
                              <p className="mt-1 text-lg font-semibold">{compactNumber(selectedPost.scope === "dark" ? selectedDarkInsight?.reach ?? selectedPost.reach : selectedPost.reach)}</p>
                            </div>
                            <div className="rounded-xl border bg-background p-3">
                              <p className="text-xs text-muted-foreground">Impressions</p>
                              <p className="mt-1 text-lg font-semibold">{compactNumber(selectedPost.scope === "dark" ? selectedDarkInsight?.impressions ?? selectedPost.impressions : selectedPost.impressions)}</p>
                            </div>
                            <div className="rounded-xl border bg-background p-3">
                              <p className="text-xs text-muted-foreground">{selectedPost.scope === "dark" ? "Spend" : "Comments"}</p>
                              <p className="mt-1 text-lg font-semibold">{selectedPost.scope === "dark" ? money(selectedDarkInsight?.spend) : compactNumber(selectedPost.comments)}</p>
                            </div>
                          </div>

                          {selectedPost.scope === "dark" ? (
                            <div className="space-y-2 rounded-xl border bg-muted/20 p-3 text-xs">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-muted-foreground">Campaign</span>
                                <span className="truncate font-medium">{selectedPost.campaignName || "-"}</span>
                              </div>
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-muted-foreground">Ad set</span>
                                <span className="truncate font-medium">{selectedPost.adSetName || selectedPost.adSetId || "-"}</span>
                              </div>
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-muted-foreground">Ad</span>
                                <span className="truncate font-medium">{selectedPost.adName || selectedPost.adId || "-"}</span>
                              </div>
                              <div className="grid grid-cols-2 gap-2 pt-2">
                                <div className="rounded-lg border bg-background p-2">
                                  <p className="text-muted-foreground">Clicks</p>
                                  <p className="font-semibold">{fullNumber(selectedDarkInsight?.clicks)}</p>
                                </div>
                                <div className="rounded-lg border bg-background p-2">
                                  <p className="text-muted-foreground">CTR</p>
                                  <p className="font-semibold">{selectedDarkInsight?.ctr != null ? `${selectedDarkInsight.ctr.toFixed(2)}%` : "-"}</p>
                                </div>
                              </div>
                              {darkPostInsightsLoading ? (
                                <div className="flex items-center gap-2 text-muted-foreground">
                                  <IconLoader2 className="size-3.5 animate-spin" />
                                  Loading selected ad performance...
                                </div>
                              ) : darkPostInsightsError ? (
                                <p className="text-amber-700">{darkPostInsightsError}</p>
                              ) : null}
                            </div>
                          ) : (
                            <div className="grid grid-cols-3 gap-2 text-center text-xs">
                              <div className="rounded-xl border bg-muted/20 p-2">
                                <p className="font-semibold">{fullNumber(selectedPost.reactions)}</p>
                                <p className="text-muted-foreground">Reactions</p>
                              </div>
                              <div className="rounded-xl border bg-muted/20 p-2">
                                <p className="font-semibold">{fullNumber(selectedPost.shares)}</p>
                                <p className="text-muted-foreground">Shares</p>
                              </div>
                              <div className="rounded-xl border bg-muted/20 p-2">
                                <p className="font-semibold">{fullNumber(selectedPost.videoViews)}</p>
                                <p className="text-muted-foreground">Video views</p>
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </CardContent>
                  </Card>

                  <Card className="border-border/70 shadow-none">
                    <CardHeader className="border-b pb-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <CardTitle className="text-sm">Post comments</CardTitle>
                          <CardDescription>Sync, reply, and hide comments for the selected post.</CardDescription>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5"
                          disabled={!selectedPost?.postId || postCommentsSyncing}
                          onClick={() => void syncSelectedPostComments()}
                        >
                          {postCommentsSyncing ? <IconLoader2 className="size-3.5 animate-spin" /> : <IconRefresh className="size-3.5" />}
                          Sync
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3 pt-4">
                      {!selectedPost?.postId ? (
                        <div className="rounded-xl border bg-muted/20 p-3 text-xs text-muted-foreground">
                          This post does not expose a Page post ID yet, so comments cannot be synced.
                        </div>
                      ) : postCommentsLoading ? (
                        <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                          <IconLoader2 className="mr-2 size-4 animate-spin" />
                          Loading comments...
                        </div>
                      ) : postCommentsError ? (
                        <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-800">
                          {postCommentsError}
                        </div>
                      ) : postComments.length ? (
                        <>
                          <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                            {postComments.map(comment => (
                              <button
                                key={comment.id}
                                type="button"
                                onClick={() => setSelectedPostCommentId(comment.id)}
                                className={cn(
                                  "w-full rounded-xl border p-3 text-left transition-colors hover:bg-muted/40",
                                  selectedPostComment?.id === comment.id && "border-primary bg-primary/5"
                                )}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <p className="truncate text-xs font-medium">{comment.from_name || "Unknown"}</p>
                                  <Badge variant="outline" className={cn("h-5 text-xs", comment.is_hidden ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-emerald-50 text-emerald-700 border-emerald-200")}>
                                    {comment.is_hidden ? "hidden" : "visible"}
                                  </Badge>
                                </div>
                                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{comment.message}</p>
                              </button>
                            ))}
                          </div>

                          <div className="space-y-2 rounded-xl border bg-muted/20 p-3">
                            <Textarea
                              value={postReplyText}
                              onChange={event => setPostReplyText(event.target.value)}
                              placeholder="Write a reply to the selected comment..."
                              className="min-h-20 resize-none bg-background"
                            />
                            <div className="flex flex-wrap items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={!selectedPostComment || postCommentActionLoading}
                                onClick={() => void toggleSelectedPostCommentHidden()}
                              >
                                {selectedPostComment?.is_hidden ? <IconEye className="mr-1.5 size-3.5" /> : <IconEyeOff className="mr-1.5 size-3.5" />}
                                {selectedPostComment?.is_hidden ? "Unhide" : "Hide"}
                              </Button>
                              <Button
                                size="sm"
                                className="ml-auto gap-1.5"
                                disabled={!selectedPostComment || !postReplyText.trim() || postCommentActionLoading}
                                onClick={() => void replyToSelectedPostComment()}
                              >
                                {postCommentActionLoading ? <IconLoader2 className="size-3.5 animate-spin" /> : <IconSend className="size-3.5" />}
                                Reply
                              </Button>
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="rounded-xl border bg-muted/20 p-3 text-xs text-muted-foreground">
                          No stored comments for this post yet. Click Sync to fetch comments from Meta for this post.
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card className="border-border/70 shadow-none">
                    <CardHeader className="border-b pb-4">
                      <CardTitle className="text-sm">Post analytics</CardTitle>
                      <CardDescription>Read-only summary from the selected Page and ad account.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Recent public posts</span>
                        <span className="font-medium">{publicPostCount}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Dark posts</span>
                        <span className="font-medium">{darkPostCount}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Post engagements</span>
                        <span className="font-medium">
                          {pageInsightTotals?.post_engagements != null ? pageInsightTotals.post_engagements.toLocaleString() : "—"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Reach</span>
                        <span className="font-medium">{pageInsightTotals?.reach != null ? pageInsightTotals.reach.toLocaleString() : "—"}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Impressions</span>
                        <span className="font-medium">{pageInsightTotals?.impressions != null ? pageInsightTotals.impressions.toLocaleString() : "—"}</span>
                      </div>
                      <div className="rounded-xl border bg-muted/20 p-3 text-xs text-muted-foreground">
                        Public posts are read from `page-insights`. Dark posts are resolved from Meta ads/creatives and merged with stored launch history.
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-border/70 shadow-none">
                    <CardHeader className="border-b pb-4">
                      <CardTitle className="text-sm">Available APIs</CardTitle>
                      <CardDescription>What the app can already use in this screen.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <div className="rounded-xl border bg-muted/20 p-3">
                        <p className="font-medium">`/api/insights/page-insights`</p>
                        <p className="mt-1 text-xs text-muted-foreground">Public posts, post engagement totals, reach, impressions.</p>
                      </div>
                      <div className="rounded-xl border bg-muted/20 p-3">
                        <p className="font-medium">`/api/launch-history`</p>
                        <p className="mt-1 text-xs text-muted-foreground">Launch batches and stored created ads for dark post history.</p>
                      </div>
                      <div className="rounded-xl border bg-muted/20 p-3">
                        <p className="font-medium">`/api/facebook/dark-posts`</p>
                        <p className="mt-1 text-xs text-muted-foreground">Reads ads/creatives from the selected ad account and resolves `object_story_id` / `effective_object_story_id`.</p>
                      </div>
                      <div className="rounded-xl border bg-muted/20 p-3">
                        <p className="font-medium">`launch_batches.created_ads`</p>
                        <p className="mt-1 text-xs text-muted-foreground">Ad / ad set / creative linkage already stored in Supabase.</p>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>

              <Dialog open={composerOpen} onOpenChange={setComposerOpen}>
                <DialogContent className="sm:max-w-lg">
                  <DialogHeader>
                    <DialogTitle>New post</DialogTitle>
                    <DialogDescription>
                      Publish directly to {selectedPage?.name || "the selected Page"}. Text and/or one photo.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-3">
                    <Textarea
                      placeholder="Write your post…"
                      value={composerMessage}
                      onChange={e => setComposerMessage(e.target.value)}
                      rows={5}
                    />
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">Image URL (optional, must be public)</label>
                      <Input
                        placeholder="https://…"
                        value={composerImageUrl}
                        onChange={e => setComposerImageUrl(e.target.value)}
                      />
                    </div>
                    {composerError ? <p className="text-sm text-red-600">{composerError}</p> : null}
                    {composerSuccess ? <p className="text-sm text-green-600">{composerSuccess}</p> : null}
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setComposerOpen(false)} disabled={composerLoading}>Cancel</Button>
                    <Button onClick={() => void publishPost()} disabled={composerLoading}>
                      {composerLoading ? <IconLoader2 className="mr-2 size-4 animate-spin" /> : null}
                      Publish
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          )}

          {tab === "comments" && (
            <div className="space-y-4">
              <div className="flex flex-col gap-3 rounded-2xl border bg-card px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">Comments</p>
                    <Badge variant="outline" className="h-6 bg-muted/40 text-muted-foreground">
                      {visibleComments.length} shown
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Review Page comments, reply, hide, and run moderation rules from one queue.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-2 rounded-xl border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                    <IconInfoCircle className="size-3.5" />
                    {selectedPage?.name || "No page selected"}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void syncComments()}
                    disabled={!selectedPage?.id || commentsSyncing}
                    className="gap-1.5"
                  >
                    {commentsSyncing ? <IconLoader2 className="size-3.5 animate-spin" /> : <IconRefresh className="size-3.5" />}
                    Sync comments
                  </Button>
                </div>
              </div>

              {commentsError ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50/70 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
                  {commentsError}
                </div>
              ) : null}

              <div className="grid gap-4 xl:grid-cols-[220px_minmax(0,1fr)_360px]">
                <Card className="border-border/70 shadow-none">
                  <CardHeader className="border-b pb-4">
                    <CardTitle className="text-sm">Filters</CardTitle>
                    <CardDescription>Quick queue filters for moderation.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2 pt-4">
                    {[
                      { id: "all", label: "All comments", count: commentCounts.all },
                      { id: "unreplied", label: "Unreplied", count: commentCounts.unreplied },
                      { id: "negative", label: "Negative", count: commentCounts.negative },
                      { id: "has_phone", label: "Has phone", count: commentCounts.has_phone },
                      { id: "competitor", label: "Competitor / spam", count: commentCounts.competitor },
                      { id: "ad_comments", label: "Ad comments", count: commentCounts.ad_comments },
                    ].map(item => (
                      <button
                        key={item.id}
                        onClick={() => setSelectedCommentFilter(item.id as CommentFilter)}
                        className={cn(
                          "flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left transition-colors",
                          selectedCommentFilter === item.id ? "border-primary bg-primary/5 text-primary" : "hover:bg-muted/50"
                        )}
                      >
                        <span className="text-sm font-medium">{item.label}</span>
                        <span className="text-xs text-muted-foreground">{item.count}</span>
                      </button>
                    ))}

                    <div className="rounded-xl border bg-muted/20 p-3 text-xs text-muted-foreground">
                      Live comment sync still depends on `pages_read_engagement` or Page Public Content Access. Once approved, this queue can auto-sync.
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-border/70 shadow-none">
                  <CardHeader className="border-b pb-4">
                    <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                      <div>
                        <CardTitle className="text-sm">Comment queue</CardTitle>
                        <CardDescription>Search, filter, and open a comment to moderate it.</CardDescription>
                      </div>
                      <div className="flex w-full flex-col gap-2 sm:flex-row xl:max-w-xl xl:items-center">
                        <div className="relative flex-1">
                          <IconSearch className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground/50" />
                          <Input
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                            placeholder="Search comments, names, themes..."
                            className="h-10 pl-9"
                          />
                        </div>
                        <Select value={commentSort} onValueChange={value => setCommentSort(value as CommentSort)}>
                          <SelectTrigger className="w-full sm:w-[150px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="newest">Newest</SelectItem>
                            <SelectItem value="oldest">Oldest</SelectItem>
                            <SelectItem value="most-liked">Most liked</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <ScrollArea className="h-[700px]">
                      {commentsLoading ? (
                        <div className="flex h-[320px] items-center justify-center text-sm text-muted-foreground">
                          <IconLoader2 className="mr-2 size-4 animate-spin" />
                          Loading comments...
                        </div>
                      ) : visibleComments.length ? (
                        <div className="divide-y">
                          {visibleComments.map(comment => {
                            const isActive = selectedComment?.id === comment.id
                            const timeLabel = comment.fb_created_time
                              ? new Date(comment.fb_created_time).toLocaleString("en-US", {
                                month: "short",
                                day: "numeric",
                                hour: "numeric",
                                minute: "2-digit",
                              })
                              : "Unknown time"

                            return (
                              <button
                                key={comment.id}
                                onClick={() => handleSelectComment(comment.id)}
                                className={cn(
                                  "flex w-full items-start gap-3 px-4 py-4 text-left transition-colors hover:bg-muted/40",
                                  isActive && "bg-primary/5"
                                )}
                              >
                                <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-xs font-semibold text-primary">
                                  {(comment.from_name || "?")
                                    .split(" ")
                                    .map(word => word[0])
                                    .join("")
                                    .slice(0, 2)
                                    .toUpperCase()}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <p className="truncate text-sm font-medium">{comment.from_name || "Unknown"}</p>
                                        <Badge
                                          variant="outline"
                                          className={cn(
                                            "h-5 border text-xs",
                                            comment.sentiment === "positive"
                                              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                              : comment.sentiment === "negative"
                                                ? "border-rose-200 bg-rose-50 text-rose-700"
                                                : "border-slate-200 bg-slate-50 text-slate-600"
                                          )}
                                        >
                                          {comment.sentiment}
                                        </Badge>
                                        {comment.is_replied ? (
                                          <Badge variant="outline" className="h-5 border-blue-200 bg-blue-50 text-xs text-blue-700">
                                            Replied
                                          </Badge>
                                        ) : null}
                                        {comment.is_hidden ? (
                                          <Badge variant="outline" className="h-5 border-slate-200 bg-slate-50 text-xs text-slate-600">
                                            Hidden
                                          </Badge>
                                        ) : null}
                                      </div>
                                      <p className="mt-1 line-clamp-2 text-sm text-foreground/80">
                                        {comment.message}
                                      </p>
                                    </div>
                                    <div className="text-right text-xs text-muted-foreground">
                                      <div>{timeLabel}</div>
                                      {comment.like_count ? (
                                        <div className="mt-1 flex items-center justify-end gap-1">
                                          <IconThumbUp className="size-3" /> {comment.like_count}
                                        </div>
                                      ) : null}
                                    </div>
                                  </div>

                                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                    {comment.fb_post_message ? (
                                      <span className="truncate rounded-full border bg-muted/30 px-2 py-1">
                                        On: {comment.fb_post_message}
                                      </span>
                                    ) : null}
                                    {comment.themes?.slice(0, 3).map(theme => (
                                      <span key={theme} className="rounded-full border bg-muted/30 px-2 py-1">
                                        {theme}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              </button>
                            )
                          })}
                        </div>
                      ) : (
                        <div className="flex h-[320px] flex-col items-center justify-center gap-2 px-4 text-center text-sm text-muted-foreground">
                          <IconMessage className="size-5" />
                          <p>No comments found for this page and filter.</p>
                          <Button variant="outline" size="sm" onClick={() => void syncComments()} disabled={!selectedPage?.id || commentsSyncing}>
                            {commentsSyncing ? "Syncing..." : "Sync comments"}
                          </Button>
                        </div>
                      )}
                    </ScrollArea>
                  </CardContent>
                </Card>

                <div className="space-y-4">
                  <Card className="border-border/70 shadow-none">
                    <CardHeader className="border-b pb-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <CardTitle className="text-sm">Selected comment</CardTitle>
                          <CardDescription>Reply or hide the currently selected item.</CardDescription>
                        </div>
                        {selectedComment ? (
                          <Badge
                            variant="outline"
                            className={cn(
                              "h-6",
                              selectedComment.sentiment === "positive"
                                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                : selectedComment.sentiment === "negative"
                                  ? "border-rose-200 bg-rose-50 text-rose-700"
                                  : "border-slate-200 bg-slate-50 text-slate-600"
                            )}
                          >
                            {selectedComment.sentiment}
                          </Badge>
                        ) : null}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4 pt-4">
                      {selectedComment ? (
                        <>
                          <div className="rounded-2xl border bg-muted/20 p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-sm font-medium">{selectedComment.from_name || "Unknown"}</p>
                                <p className="text-xs text-muted-foreground">
                                  {selectedComment.fb_created_time
                                    ? new Date(selectedComment.fb_created_time).toLocaleString("en-US", {
                                      month: "short",
                                      day: "numeric",
                                      hour: "numeric",
                                      minute: "2-digit",
                                    })
                                    : "Unknown time"}
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                <Button variant="outline" size="sm" onClick={() => void handleToggleHideSelectedComment()} disabled={commentsLoading || commentActionLoading}>
                                  {selectedComment.is_hidden ? "Show" : "Hide"}
                                </Button>
                              </div>
                            </div>
                            <p className="mt-3 text-sm leading-relaxed text-foreground/80">{selectedComment.message}</p>
                            {selectedComment.fb_post_message ? (
                              <p className="mt-3 rounded-xl border bg-background px-3 py-2 text-xs text-muted-foreground">
                                From post: {selectedComment.fb_post_message}
                              </p>
                            ) : null}
                          </div>

                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <p className="text-sm font-medium">Reply</p>
                              {selectedComment.is_replied ? (
                                <Badge variant="outline" className="h-6 border-blue-200 bg-blue-50 text-xs text-blue-700">
                                  Already replied
                                </Badge>
                              ) : null}
                            </div>
                            <Textarea
                              value={replyText}
                              onChange={e => setReplyText(e.target.value)}
                              placeholder="Write a reply that sounds like the page."
                              className="min-h-[140px] resize-none"
                            />
                            <div className="flex items-center justify-between gap-2">
                              <div className="text-xs text-muted-foreground">
                                Reply uses the selected Page access token.
                              </div>
                              <Button onClick={() => void handleReplySelectedComment()} disabled={replyLoading || commentActionLoading || !replyText.trim()}>
                                {replyLoading ? <IconLoader2 className="mr-2 size-3.5 animate-spin" /> : <IconSend className="mr-2 size-3.5" />}
                                Send reply
                              </Button>
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="rounded-2xl border border-dashed bg-muted/10 px-4 py-10 text-center text-sm text-muted-foreground">
                          Select a comment from the queue to inspect and moderate it.
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card className="border-border/70 shadow-none">
                    <CardHeader className="border-b pb-4">
                      <CardTitle className="text-sm">Comment analytics</CardTitle>
                      <CardDescription>Page-level moderation summary for the selected page.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4 pt-4">
                      {commentsAnalyticsLoading ? (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <IconLoader2 className="size-4 animate-spin" />
                          Loading analytics...
                        </div>
                      ) : (
                        <>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="rounded-xl border bg-muted/20 p-3">
                              <p className="text-xs text-muted-foreground">Total</p>
                              <p className="mt-1 text-lg font-semibold">{commentsAnalytics?.total ?? commentCounts.all}</p>
                            </div>
                            <div className="rounded-xl border bg-muted/20 p-3">
                              <p className="text-xs text-muted-foreground">Unreplied</p>
                              <p className="mt-1 text-lg font-semibold">{commentCounts.unreplied}</p>
                            </div>
                            <div className="rounded-xl border bg-muted/20 p-3">
                              <p className="text-xs text-muted-foreground">Avg sentiment</p>
                              <p className="mt-1 text-lg font-semibold">{commentsAnalytics ? commentsAnalytics.avgSentiment.toFixed(2) : "�"}</p>
                            </div>
                            <div className="rounded-xl border bg-muted/20 p-3">
                              <p className="text-xs text-muted-foreground">Reactions</p>
                              <p className="mt-1 text-lg font-semibold">{commentsAnalytics?.totalReactions ?? 0}</p>
                            </div>
                          </div>

                          {commentThemes.length ? (
                            <div className="space-y-2">
                              <p className="text-sm font-medium">Top themes</p>
                              <div className="flex flex-wrap gap-2">
                                {commentThemes.map(theme => (
                                  <Badge key={theme.theme} variant="outline" className="h-6 bg-muted/40 text-xs">
                                    {theme.theme} � {theme.count}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          ) : null}

                          {commentsAnalytics?.trend ? (
                            <div className="rounded-xl border bg-muted/20 p-3 text-xs text-muted-foreground">
                              Trend vs previous period: {commentsAnalytics.trend.total >= 0 ? "+" : ""}
                              {commentsAnalytics.trend.total.toFixed(1)}% volume, {commentsAnalytics.trend.sentiment >= 0 ? "+" : ""}
                              {commentsAnalytics.trend.sentiment.toFixed(1)}% sentiment.
                            </div>
                          ) : null}
                        </>
                      )}
                    </CardContent>
                  </Card>

                  <Card className="border-border/70 shadow-none">
                    <CardHeader className="border-b pb-4">
                      <CardTitle className="text-sm">Automation rules</CardTitle>
                      <CardDescription>Active moderation presets already stored in the workspace.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3 pt-4">
                      {commentAutomations.length ? (
                        commentAutomations.slice(0, 4).map(rule => (
                          <div key={rule.id} className="rounded-xl border bg-muted/20 p-3">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-sm font-medium">{rule.name}</p>
                              <Badge variant="outline" className={cn("h-6", stateTone(rule.is_active ? "ready" : "draft"))}>
                                {rule.is_active ? "active" : "draft"}
                              </Badge>
                            </div>
                            <p className="mt-1 text-xs text-muted-foreground">{rule.description || "No description"}</p>
                            <div className="mt-2 grid gap-2 text-xs text-muted-foreground">
                              <div className="rounded-lg border bg-background px-2 py-1.5">
                                Trigger: {rule.trigger_type}{rule.trigger_value ? ` � ${rule.trigger_value}` : ""}
                              </div>
                              <div className="rounded-lg border bg-background px-2 py-1.5">
                                Action: {rule.action_type}{rule.action_value ? ` � ${rule.action_value}` : ""}
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="rounded-xl border bg-muted/20 p-3 text-sm text-muted-foreground">
                          No automation rules saved yet.
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          )}
          {tab === "statistics" && (
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
              <Card className="border-border/70 shadow-none">
                <CardHeader className="border-b pb-4">
                  <CardTitle className="text-sm">Page performance</CardTitle>
                  <CardDescription>Shared stats layer for the selected page.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  <StatCard label="Total posts" value={`${selectedPageMock.posts}`} desc="Public + dark posts in scope" icon={IconPhoto} />
                  <StatCard label="Inbox volume" value={`${selectedPageMock.inbox}`} desc="Open conversation threads" icon={IconMessage} />
                  <StatCard label="Comment volume" value={`${selectedPageMock.comments}`} desc="Moderation queue size" icon={IconFilter} />
                  <StatCard label="Auto replies" value="12" desc="Replies triggered this week" icon={IconSend} />
                  <StatCard label="Hidden comments" value="9" desc="Filtered by rule engine" icon={IconEye} />
                  <StatCard label="Assigned staff" value="3" desc="Users handling the queue" icon={IconUsers} />
                </CardContent>
              </Card>

              <div className="space-y-4">
                <Card className="border-border/70 shadow-none">
                  <CardHeader className="border-b pb-4">
                    <CardTitle className="text-sm">Sync health</CardTitle>
                    <CardDescription>What is available now and what still needs permission.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex items-center justify-between rounded-xl border bg-muted/20 px-3 py-2">
                      <span className="text-sm">Page list</span>
                      <Badge variant="outline" className={cn("h-6", stateTone("ready"))}>Ready</Badge>
                    </div>
                    <div className="flex items-center justify-between rounded-xl border bg-muted/20 px-3 py-2">
                      <span className="text-sm">Comment sync</span>
                      <Badge variant="outline" className={cn("h-6", stateTone("ready"))}>Ready</Badge>
                    </div>
                    <div className="flex items-center justify-between rounded-xl border bg-muted/20 px-3 py-2">
                      <span className="text-sm">Inbox sync</span>
                      <Badge variant="outline" className={cn("h-6", stateTone("planned"))}>Planned</Badge>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-border/70 shadow-none">
                  <CardHeader className="border-b pb-4">
                    <CardTitle className="text-sm">Settings</CardTitle>
                    <CardDescription>Shared configuration for this page.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="rounded-xl border bg-muted/20 p-3 text-sm">Default assignment queue</div>
                    <div className="rounded-xl border bg-muted/20 p-3 text-sm">Auto-reply template set</div>
                    <div className="rounded-xl border bg-muted/20 p-3 text-sm">Moderation keyword list</div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {tab === "settings" && (
            <div className="grid gap-4 xl:grid-cols-[260px_minmax(0,1fr)_320px]">
              <Card className="border-border/70 shadow-none">
                <CardHeader className="border-b pb-4">
                  <CardTitle className="text-sm">Fanpage Settings</CardTitle>
                  <CardDescription>Configuration is saved per selected Page.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-1">
                  {FANPAGE_SETTINGS_TABS.map(item => (
                    <button
                      key={item.id}
                      onClick={() => setSettingsTab(item.id)}
                      className={cn(
                        "flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors",
                        settingsTab === item.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                      )}
                    >
                      <span>{item.label}</span>
                      {settingsTab === item.id ? <IconCheck className="size-3.5" /> : null}
                    </button>
                  ))}
                </CardContent>
              </Card>

              <Card className="border-border/70 shadow-none">
                <CardHeader className="border-b pb-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <CardTitle className="text-sm">{activeSettingsMeta.label}</CardTitle>
                      <CardDescription>{activeSettingsMeta.description}</CardDescription>
                      <p className="mt-2 text-xs text-muted-foreground">
                        Page: <span className="font-medium text-foreground">{selectedPage?.name}</span>
                        {settingsUpdatedAt ? ` - Last saved ${new Date(settingsUpdatedAt).toLocaleString()}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => void loadPageManagerSettings()} disabled={settingsLoading || settingsSaving}>
                        <IconRefresh className={cn("mr-1 size-3.5", settingsLoading && "animate-spin")} />
                        Reload
                      </Button>
                      <Button size="sm" onClick={() => void savePageManagerSettings()} disabled={settingsLoading || settingsSaving}>
                        {settingsSaving ? <IconLoader2 className="mr-1 size-3.5 animate-spin" /> : <IconCheck className="mr-1 size-3.5" />}
                        Save
                      </Button>
                    </div>
                  </div>
                  {settingsError ? (
                    <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{settingsError}</div>
                  ) : null}
                  {settingsSetupRequired && !settingsError ? (
                    <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                      Settings are being saved in fallback storage. Apply the Page Manager settings migration to enable the dedicated settings and audit-log tables.
                    </div>
                  ) : null}
                  {settingsSuccess ? (
                    <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{settingsSuccess}</div>
                  ) : null}
                </CardHeader>
                <CardContent className="space-y-4">
                  {settingsLoading ? (
                    <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
                      <IconLoader2 className="mr-2 size-4 animate-spin" />
                      Loading Page settings...
                    </div>
                  ) : (
                    renderFanpageSettingsFields()
                  )}
                </CardContent>
              </Card>

              <div className="space-y-4">
                <Card className="border-border/70 shadow-none">
                  <CardHeader className="border-b pb-4">
                    <CardTitle className="text-sm">Copy Settings</CardTitle>
                    <CardDescription>Copy this Page configuration to another connected Page.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Select value={copyTargetPageId || "none"} onValueChange={value => setCopyTargetPageId(value === "none" ? "" : value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Target Page" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none" disabled>Select target Page</SelectItem>
                        {copyTargetPages.map(page => (
                          <SelectItem key={page.id} value={page.id}>{page.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button className="w-full" variant="outline" onClick={() => void copyPageManagerSettings()} disabled={!copyTargetPageId || settingsCopying}>
                      {settingsCopying ? <IconLoader2 className="mr-1 size-3.5 animate-spin" /> : null}
                      Copy to Page
                    </Button>
                  </CardContent>
                </Card>

                <Card className="border-border/70 shadow-none">
                  <CardHeader className="border-b pb-4">
                    <CardTitle className="text-sm">Audit Log</CardTitle>
                    <CardDescription>Recent changes for this Page.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {settingsAuditLogs.length > 0 ? settingsAuditLogs.slice(0, 8).map(log => (
                      <div key={log.id} className="rounded-lg border bg-muted/20 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium capitalize">{log.action}</p>
                          <Badge variant="outline" className="h-6">{log.section || "all"}</Badge>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">{new Date(log.created_at).toLocaleString()}</p>
                        <p className="mt-2 text-xs text-muted-foreground">
                          {Array.isArray(log.changes) ? `${log.changes.length} field(s) changed` : "Settings copied"}
                        </p>
                      </div>
                    )) : (
                      <div className="rounded-lg border bg-muted/20 p-3 text-sm text-muted-foreground">No setting changes recorded yet.</div>
                    )}
                  </CardContent>
                </Card>

                <Card className="border-border/70 shadow-none">
                  <CardHeader className="border-b pb-4">
                    <CardTitle className="text-sm">Permission Checklist</CardTitle>
                    <CardDescription>Meta access required by Page Manager.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {PERMISSIONS.map(permission => (
                      <div key={permission.key} className="flex items-center justify-between rounded-lg border bg-muted/20 px-3 py-2">
                        <span className="text-sm">{permission.label}</span>
                        <Badge variant="outline" className={cn("h-6", stateTone(permission.state))}>{permission.state}</Badge>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

