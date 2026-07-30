export type ManagedComment = {
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

export type CommentAutomation = {
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

export type CommentAnalytics = {
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

/** Row shape of `automation_runs`, as read by the History section (`GET /api/comments/history`). */
export type AutomationRun = {
  id: string
  automation_name: string
  action_taken: string
  result: string
  status: "success" | "skipped" | "failed" | string
  run_at: string
}

export type CommentFilter =
  | "all"
  | "unreplied"
  | "needs"
  | "positive"
  | "neutral"
  | "negative"
  | "has_phone"
  | "competitor"
  | "ad_comments"

export type CommentSort = "newest" | "oldest" | "most-liked" | "positive-to-negative" | "negative-to-positive"

export const COMMENT_PHONE_RE = /(?:\+?84|0)\d[\d\s.()-]{7,14}\d|\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/

export function commentHasPhone(comment: { message?: string | null; has_phone?: boolean | null }) {
  if (comment.has_phone) return true
  return COMMENT_PHONE_RE.test(comment.message || "")
}

export function commentIsCompetitor(
  comment: { message?: string | null; themes?: string[] | null },
  keywords: string[]
) {
  const msg = (comment.message || "").toLowerCase()
  if (!msg) return false
  if (/(?:inbox\s+mình|shop\s+bán\s+bên|zalo\s*:|liên\s*hệ\s*zalo)/i.test(msg)) return true
  const fromSettings = (keywords || []).map(k => k.trim().toLowerCase()).filter(Boolean)
  return fromSettings.some(k => msg.includes(k)) || (comment.themes || []).some(t => /competitor|spam|đối thủ/i.test(t))
}
