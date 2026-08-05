export const NOTIFICATION_CATEGORIES = ["business", "ads", "profiles", "apps"] as const

export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number]

export function notificationCategoryForType(type: string): NotificationCategory {
  if (/^(ad|campaign|adset)\./.test(type)) return "ads"
  if (type.startsWith("member.")) return "profiles"
  if (/^(asset|media|creative|automation)\./.test(type)) return "apps"
  return "business"
}
