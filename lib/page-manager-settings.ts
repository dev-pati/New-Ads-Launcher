export const PAGE_MANAGER_SETTING_SECTIONS = [
  "general",
  "notifications",
  "conversations",
  "automation",
  "commentModeration",
  "assignmentRules",
  "tags",
  "quickReplyTemplates",
  "integrations",
  "permissions",
  "advanced",
] as const

export type PageManagerSettingSection = typeof PAGE_MANAGER_SETTING_SECTIONS[number]

export type QuickReplyTemplate = {
  id: string
  name: string
  shortcut: string
  body: string
}

export type PageManagerSettings = {
  general: {
    enabled: boolean
    pageNickname: string
    defaultLanguage: string
    timezone: string
    businessHoursEnabled: boolean
    businessHoursStart: string
    businessHoursEnd: string
  }
  notifications: {
    emailEnabled: boolean
    slackEnabled: boolean
    soundEnabled: boolean
    soundName: string
    digestFrequency: string
    notifyOnNewMessage: boolean
    notifyOnNegativeComment: boolean
    notifyOnFailedSync: boolean
    recipients: string[]
  }
  conversations: {
    syncEnabled: boolean
    autoMarkRead: boolean
    unreadFirst: boolean
    taskManagementEnabled: boolean
    showAssignedStaff: boolean
    showViewerPresence: boolean
    ignoreStickerOnlyMessages: boolean
    closeAfterDays: number
    sentimentDetection: boolean
    defaultStatus: string
    handoffMessage: string
  }
  automation: {
    aiDraftReplies: boolean
    autoReplyEnabled: boolean
    maxAutoRepliesPerUserDaily: number
    quietHoursEnabled: boolean
    quietHoursStart: string
    quietHoursEnd: string
    confidenceThreshold: number
    fallbackAction: string
  }
  commentModeration: {
    enabled: boolean
    hideAllComments: boolean
    autoHideSpam: boolean
    autoHidePhoneNumbers: boolean
    autoHideCompetitors: boolean
    ignoreFriendTags: boolean
    ignoreStickerOnly: boolean
    autoLikeAfterReply: boolean
    hideMode: string
    toxicThreshold: number
    sensitiveKeywords: string[]
    competitorKeywords: string[]
  }
  assignmentRules: {
    enabled: boolean
    assignmentMode: string
    defaultAssignee: string
    defaultTeam: string
    selfAssignEnabled: boolean
    teamAssignmentEnabled: boolean
    onlineStaffOnly: boolean
    maxOpenConversationsPerStaff: number
    salesKeywords: string[]
    supportKeywords: string[]
    negativeSentimentQueue: string
    roundRobin: boolean
  }
  tags: {
    autoTagging: boolean
    availableTags: string[]
    tagColors: string[]
    autoApplyRules: string[]
    vipKeywords: string[]
  }
  quickReplyTemplates: {
    enabled: boolean
    variablesEnabled: boolean
    spinSyntaxEnabled: boolean
    templates: QuickReplyTemplate[]
  }
  integrations: {
    metaWebhooksEnabled: boolean
    sendMetaLeadEvents: boolean
    sendMetaOrderEvents: boolean
    posIntegrationEnabled: boolean
    posProvider: string
    posApiUrl: string
    invitePageLikeEnabled: boolean
    inviteLimitPerRun: number
    autoSaveBirthday: boolean
    crmWebhookUrl: string
    slackWebhookUrl: string
    googleSheetUrl: string
    apiKeyLabel: string
  }
  permissions: {
    allowNonAdminManage: boolean
    roleMode: string
    restrictToAssignedConversations: boolean
    requireApprovalForAutoHide: boolean
    requiredPermissions: string[]
  }
  advanced: {
    apiSyncIntervalMinutes: number
    retentionDays: number
    debugMode: boolean
    dryRunMode: boolean
    rateLimitGuard: boolean
    archiveClosedAfterDays: number
  }
}

export const DEFAULT_PAGE_MANAGER_SETTINGS: PageManagerSettings = {
  general: {
    enabled: true,
    pageNickname: "",
    defaultLanguage: "en",
    timezone: "Asia/Ho_Chi_Minh",
    businessHoursEnabled: false,
    businessHoursStart: "09:00",
    businessHoursEnd: "18:00",
  },
  notifications: {
    emailEnabled: true,
    slackEnabled: false,
    soundEnabled: true,
    soundName: "soft_ping",
    digestFrequency: "daily",
    notifyOnNewMessage: true,
    notifyOnNegativeComment: true,
    notifyOnFailedSync: true,
    recipients: [],
  },
  conversations: {
    syncEnabled: false,
    autoMarkRead: false,
    unreadFirst: true,
    taskManagementEnabled: true,
    showAssignedStaff: true,
    showViewerPresence: true,
    ignoreStickerOnlyMessages: true,
    closeAfterDays: 7,
    sentimentDetection: true,
    defaultStatus: "open",
    handoffMessage: "Thanks for reaching out. A team member will follow up shortly.",
  },
  automation: {
    aiDraftReplies: true,
    autoReplyEnabled: false,
    maxAutoRepliesPerUserDaily: 3,
    quietHoursEnabled: true,
    quietHoursStart: "22:00",
    quietHoursEnd: "08:00",
    confidenceThreshold: 80,
    fallbackAction: "draft_only",
  },
  commentModeration: {
    enabled: true,
    hideAllComments: false,
    autoHideSpam: true,
    autoHidePhoneNumbers: true,
    autoHideCompetitors: false,
    ignoreFriendTags: true,
    ignoreStickerOnly: true,
    autoLikeAfterReply: false,
    hideMode: "risk_only",
    toxicThreshold: 75,
    sensitiveKeywords: ["refund", "scam", "fake"],
    competitorKeywords: [],
  },
  assignmentRules: {
    enabled: true,
    assignmentMode: "round_robin",
    defaultAssignee: "unassigned",
    defaultTeam: "sales",
    selfAssignEnabled: true,
    teamAssignmentEnabled: true,
    onlineStaffOnly: true,
    maxOpenConversationsPerStaff: 50,
    salesKeywords: ["price", "bundle", "shipping", "order"],
    supportKeywords: ["broken", "refund", "where is my order"],
    negativeSentimentQueue: "support",
    roundRobin: false,
  },
  tags: {
    autoTagging: true,
    availableTags: ["Lead", "Support", "VIP", "Spam", "Follow-up"],
    tagColors: ["Lead:#2563eb", "Support:#7c3aed", "VIP:#ca8a04", "Spam:#dc2626", "Follow-up:#059669"],
    autoApplyRules: ["price=>Lead", "refund=>Support", "wholesale=>VIP"],
    vipKeywords: ["wholesale", "bulk order", "returning customer"],
  },
  quickReplyTemplates: {
    enabled: true,
    variablesEnabled: true,
    spinSyntaxEnabled: true,
    templates: [
      {
        id: "hello",
        name: "Chào khách",
        shortcut: "/hello",
        body: "Dạ chào {first_name}, shop có thể tư vấn sản phẩm/combo phù hợp cho mình ngay ạ. Mình đang quan tâm sản phẩm nào bên shop ạ?",
      },
      {
        id: "pricing",
        name: "Giá combo",
        shortcut: "/price",
        body: "Dạ combo PATI Premium Bundle đang có giá 599k ạ, gồm 2 sản phẩm full-size. Bạn để lại SĐT shop tư vấn thêm và gửi mã free ship HCM cho mình nhé 💙",
      },
      {
        id: "shipping",
        name: "Phí ship / thời gian giao",
        shortcut: "/ship",
        body: "Dạ shop hỗ trợ giao hàng toàn quốc. Nội thành HCM thường 1–2 ngày, tỉnh/thành khác khoảng 2–5 ngày tuỳ khu vực. Bạn gửi giúp shop tỉnh/thành và SĐT để kiểm tra phí ship chính xác nha.",
      },
      {
        id: "phone",
        name: "Xin SĐT",
        shortcut: "/phone",
        body: "Dạ bạn cho shop xin SĐT để tư vấn nhanh và giữ ưu đãi combo cho mình nha.",
      },
      {
        id: "cod",
        name: "COD",
        shortcut: "/cod",
        body: "Dạ shop có hỗ trợ thanh toán khi nhận hàng (COD) ở hầu hết khu vực. Bạn gửi SĐT + địa chỉ, shop kiểm tra tuyến giao cho mình ngay ạ.",
      },
      {
        id: "safe",
        name: "An toàn",
        shortcut: "/safe",
        body: "Dạ sản phẩm dùng theo hướng dẫn trên bao bì. Nếu bạn đang mang thai, đang điều trị bệnh, dị ứng thành phần hoặc dùng thuốc đặc trị, shop khuyên mình hỏi thêm ý kiến bác sĩ trước khi sử dụng ạ.",
      },
      {
        id: "complaint",
        name: "Khiếu nại",
        shortcut: "/support",
        body: "Dạ shop xin lỗi vì trải nghiệm chưa tốt của mình. Bạn gửi giúp shop SĐT/ mã đơn + hình ảnh tình trạng sản phẩm, bên shop kiểm tra và hỗ trợ hướng xử lý sớm nhất ạ.",
      },
    ],
  },
  integrations: {
    metaWebhooksEnabled: false,
    sendMetaLeadEvents: false,
    sendMetaOrderEvents: false,
    posIntegrationEnabled: false,
    posProvider: "none",
    posApiUrl: "",
    invitePageLikeEnabled: false,
    inviteLimitPerRun: 300,
    autoSaveBirthday: false,
    crmWebhookUrl: "",
    slackWebhookUrl: "",
    googleSheetUrl: "",
    apiKeyLabel: "",
  },
  permissions: {
    allowNonAdminManage: false,
    roleMode: "standard",
    restrictToAssignedConversations: false,
    requireApprovalForAutoHide: true,
    requiredPermissions: [
      "pages_show_list",
      "pages_read_engagement",
      "pages_manage_engagement",
      "pages_messaging",
    ],
  },
  advanced: {
    apiSyncIntervalMinutes: 15,
    retentionDays: 180,
    debugMode: false,
    dryRunMode: true,
    rateLimitGuard: true,
    archiveClosedAfterDays: 30,
  },
}

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value)
}

function cleanString(value: unknown, fallback = "", max = 500) {
  return typeof value === "string" ? value.trim().slice(0, max) : fallback
}

function cleanBool(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback
}

function cleanNumber(value: unknown, fallback: number, min: number, max: number) {
  const n = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, Math.round(n)))
}

function cleanList(value: unknown, fallback: string[] = [], maxItems = 50) {
  const source = Array.isArray(value) ? value : typeof value === "string" ? value.split(",") : fallback
  return Array.from(new Set(source.map(item => cleanString(item, "", 80)).filter(Boolean))).slice(0, maxItems)
}

function cleanUrl(value: unknown) {
  const raw = cleanString(value, "", 1000)
  if (!raw) return ""
  try {
    const url = new URL(raw)
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : ""
  } catch {
    return ""
  }
}

function cleanTemplates(value: unknown): QuickReplyTemplate[] {
  const source = Array.isArray(value) ? value : DEFAULT_PAGE_MANAGER_SETTINGS.quickReplyTemplates.templates
  return source
    .map((item, index) => {
      const record = isObject(item) ? item : {}
      const name = cleanString(record.name, "", 80)
      const shortcut = cleanString(record.shortcut, "", 40)
      const body = cleanString(record.body, "", 1200)
      if (!name || !body) return null
      return {
        id: cleanString(record.id, `template-${index + 1}`, 80) || `template-${index + 1}`,
        name,
        shortcut,
        body,
      }
    })
    .filter(Boolean)
    .slice(0, 30) as QuickReplyTemplate[]
}

export function normalizePageManagerSettings(input: unknown): PageManagerSettings {
  const root = isObject(input) ? input : {}
  const d = DEFAULT_PAGE_MANAGER_SETTINGS
  const section = (key: PageManagerSettingSection): Record<string, unknown> =>
    isObject(root[key]) ? root[key] as Record<string, unknown> : {}

  const general = section("general")
  const notifications = section("notifications")
  const conversations = section("conversations")
  const automation = section("automation")
  const commentModeration = section("commentModeration")
  const assignmentRules = section("assignmentRules")
  const tags = section("tags")
  const quickReplyTemplates = section("quickReplyTemplates")
  const integrations = section("integrations")
  const permissions = section("permissions")
  const advanced = section("advanced")

  return {
    general: {
      enabled: cleanBool(general.enabled, d.general.enabled),
      pageNickname: cleanString(general.pageNickname, d.general.pageNickname, 80),
      defaultLanguage: cleanString(general.defaultLanguage, d.general.defaultLanguage, 16),
      timezone: cleanString(general.timezone, d.general.timezone, 64),
      businessHoursEnabled: cleanBool(general.businessHoursEnabled, d.general.businessHoursEnabled),
      businessHoursStart: cleanString(general.businessHoursStart, d.general.businessHoursStart, 8),
      businessHoursEnd: cleanString(general.businessHoursEnd, d.general.businessHoursEnd, 8),
    },
    notifications: {
      emailEnabled: cleanBool(notifications.emailEnabled, d.notifications.emailEnabled),
      slackEnabled: cleanBool(notifications.slackEnabled, d.notifications.slackEnabled),
      soundEnabled: cleanBool(notifications.soundEnabled, d.notifications.soundEnabled),
      soundName: cleanString(notifications.soundName, d.notifications.soundName, 40),
      digestFrequency: cleanString(notifications.digestFrequency, d.notifications.digestFrequency, 20),
      notifyOnNewMessage: cleanBool(notifications.notifyOnNewMessage, d.notifications.notifyOnNewMessage),
      notifyOnNegativeComment: cleanBool(notifications.notifyOnNegativeComment, d.notifications.notifyOnNegativeComment),
      notifyOnFailedSync: cleanBool(notifications.notifyOnFailedSync, d.notifications.notifyOnFailedSync),
      recipients: cleanList(notifications.recipients, d.notifications.recipients),
    },
    conversations: {
      syncEnabled: cleanBool(conversations.syncEnabled, d.conversations.syncEnabled),
      autoMarkRead: cleanBool(conversations.autoMarkRead, d.conversations.autoMarkRead),
      unreadFirst: cleanBool(conversations.unreadFirst, d.conversations.unreadFirst),
      taskManagementEnabled: cleanBool(conversations.taskManagementEnabled, d.conversations.taskManagementEnabled),
      showAssignedStaff: cleanBool(conversations.showAssignedStaff, d.conversations.showAssignedStaff),
      showViewerPresence: cleanBool(conversations.showViewerPresence, d.conversations.showViewerPresence),
      ignoreStickerOnlyMessages: cleanBool(conversations.ignoreStickerOnlyMessages, d.conversations.ignoreStickerOnlyMessages),
      closeAfterDays: cleanNumber(conversations.closeAfterDays, d.conversations.closeAfterDays, 1, 365),
      sentimentDetection: cleanBool(conversations.sentimentDetection, d.conversations.sentimentDetection),
      defaultStatus: cleanString(conversations.defaultStatus, d.conversations.defaultStatus, 30),
      handoffMessage: cleanString(conversations.handoffMessage, d.conversations.handoffMessage, 500),
    },
    automation: {
      aiDraftReplies: cleanBool(automation.aiDraftReplies, d.automation.aiDraftReplies),
      autoReplyEnabled: cleanBool(automation.autoReplyEnabled, d.automation.autoReplyEnabled),
      maxAutoRepliesPerUserDaily: cleanNumber(automation.maxAutoRepliesPerUserDaily, d.automation.maxAutoRepliesPerUserDaily, 0, 25),
      quietHoursEnabled: cleanBool(automation.quietHoursEnabled, d.automation.quietHoursEnabled),
      quietHoursStart: cleanString(automation.quietHoursStart, d.automation.quietHoursStart, 8),
      quietHoursEnd: cleanString(automation.quietHoursEnd, d.automation.quietHoursEnd, 8),
      confidenceThreshold: cleanNumber(automation.confidenceThreshold, d.automation.confidenceThreshold, 1, 100),
      fallbackAction: cleanString(automation.fallbackAction, d.automation.fallbackAction, 40),
    },
    commentModeration: {
      enabled: cleanBool(commentModeration.enabled, d.commentModeration.enabled),
      hideAllComments: cleanBool(commentModeration.hideAllComments, d.commentModeration.hideAllComments),
      autoHideSpam: cleanBool(commentModeration.autoHideSpam, d.commentModeration.autoHideSpam),
      autoHidePhoneNumbers: cleanBool(commentModeration.autoHidePhoneNumbers, d.commentModeration.autoHidePhoneNumbers),
      autoHideCompetitors: cleanBool(commentModeration.autoHideCompetitors, d.commentModeration.autoHideCompetitors),
      ignoreFriendTags: cleanBool(commentModeration.ignoreFriendTags, d.commentModeration.ignoreFriendTags),
      ignoreStickerOnly: cleanBool(commentModeration.ignoreStickerOnly, d.commentModeration.ignoreStickerOnly),
      autoLikeAfterReply: cleanBool(commentModeration.autoLikeAfterReply, d.commentModeration.autoLikeAfterReply),
      hideMode: cleanString(commentModeration.hideMode, d.commentModeration.hideMode, 40),
      toxicThreshold: cleanNumber(commentModeration.toxicThreshold, d.commentModeration.toxicThreshold, 1, 100),
      sensitiveKeywords: cleanList(commentModeration.sensitiveKeywords, d.commentModeration.sensitiveKeywords),
      competitorKeywords: cleanList(commentModeration.competitorKeywords, d.commentModeration.competitorKeywords),
    },
    assignmentRules: {
      enabled: cleanBool(assignmentRules.enabled, d.assignmentRules.enabled),
      assignmentMode: cleanString(assignmentRules.assignmentMode, d.assignmentRules.assignmentMode, 40),
      defaultAssignee: cleanString(assignmentRules.defaultAssignee, d.assignmentRules.defaultAssignee, 80),
      defaultTeam: cleanString(assignmentRules.defaultTeam, d.assignmentRules.defaultTeam, 80),
      selfAssignEnabled: cleanBool(assignmentRules.selfAssignEnabled, d.assignmentRules.selfAssignEnabled),
      teamAssignmentEnabled: cleanBool(assignmentRules.teamAssignmentEnabled, d.assignmentRules.teamAssignmentEnabled),
      onlineStaffOnly: cleanBool(assignmentRules.onlineStaffOnly, d.assignmentRules.onlineStaffOnly),
      maxOpenConversationsPerStaff: cleanNumber(assignmentRules.maxOpenConversationsPerStaff, d.assignmentRules.maxOpenConversationsPerStaff, 1, 500),
      salesKeywords: cleanList(assignmentRules.salesKeywords, d.assignmentRules.salesKeywords),
      supportKeywords: cleanList(assignmentRules.supportKeywords, d.assignmentRules.supportKeywords),
      negativeSentimentQueue: cleanString(assignmentRules.negativeSentimentQueue, d.assignmentRules.negativeSentimentQueue, 80),
      roundRobin: cleanBool(assignmentRules.roundRobin, d.assignmentRules.roundRobin),
    },
    tags: {
      autoTagging: cleanBool(tags.autoTagging, d.tags.autoTagging),
      availableTags: cleanList(tags.availableTags, d.tags.availableTags),
      tagColors: cleanList(tags.tagColors, d.tags.tagColors),
      autoApplyRules: cleanList(tags.autoApplyRules, d.tags.autoApplyRules),
      vipKeywords: cleanList(tags.vipKeywords, d.tags.vipKeywords),
    },
    quickReplyTemplates: {
      enabled: cleanBool(quickReplyTemplates.enabled, d.quickReplyTemplates.enabled),
      variablesEnabled: cleanBool(quickReplyTemplates.variablesEnabled, d.quickReplyTemplates.variablesEnabled),
      spinSyntaxEnabled: cleanBool(quickReplyTemplates.spinSyntaxEnabled, d.quickReplyTemplates.spinSyntaxEnabled),
      templates: cleanTemplates(quickReplyTemplates.templates),
    },
    integrations: {
      metaWebhooksEnabled: cleanBool(integrations.metaWebhooksEnabled, d.integrations.metaWebhooksEnabled),
      sendMetaLeadEvents: cleanBool(integrations.sendMetaLeadEvents, d.integrations.sendMetaLeadEvents),
      sendMetaOrderEvents: cleanBool(integrations.sendMetaOrderEvents, d.integrations.sendMetaOrderEvents),
      posIntegrationEnabled: cleanBool(integrations.posIntegrationEnabled, d.integrations.posIntegrationEnabled),
      posProvider: cleanString(integrations.posProvider, d.integrations.posProvider, 40),
      posApiUrl: cleanUrl(integrations.posApiUrl),
      invitePageLikeEnabled: cleanBool(integrations.invitePageLikeEnabled, d.integrations.invitePageLikeEnabled),
      inviteLimitPerRun: cleanNumber(integrations.inviteLimitPerRun, d.integrations.inviteLimitPerRun, 1, 500),
      autoSaveBirthday: cleanBool(integrations.autoSaveBirthday, d.integrations.autoSaveBirthday),
      crmWebhookUrl: cleanUrl(integrations.crmWebhookUrl),
      slackWebhookUrl: cleanUrl(integrations.slackWebhookUrl),
      googleSheetUrl: cleanUrl(integrations.googleSheetUrl),
      apiKeyLabel: cleanString(integrations.apiKeyLabel, d.integrations.apiKeyLabel, 80),
    },
    permissions: {
      allowNonAdminManage: cleanBool(permissions.allowNonAdminManage, d.permissions.allowNonAdminManage),
      roleMode: cleanString(permissions.roleMode, d.permissions.roleMode, 40),
      restrictToAssignedConversations: cleanBool(permissions.restrictToAssignedConversations, d.permissions.restrictToAssignedConversations),
      requireApprovalForAutoHide: cleanBool(permissions.requireApprovalForAutoHide, d.permissions.requireApprovalForAutoHide),
      requiredPermissions: cleanList(permissions.requiredPermissions, d.permissions.requiredPermissions, 20),
    },
    advanced: {
      apiSyncIntervalMinutes: cleanNumber(advanced.apiSyncIntervalMinutes, d.advanced.apiSyncIntervalMinutes, 1, 1440),
      retentionDays: cleanNumber(advanced.retentionDays, d.advanced.retentionDays, 7, 3650),
      debugMode: cleanBool(advanced.debugMode, d.advanced.debugMode),
      dryRunMode: cleanBool(advanced.dryRunMode, d.advanced.dryRunMode),
      rateLimitGuard: cleanBool(advanced.rateLimitGuard, d.advanced.rateLimitGuard),
      archiveClosedAfterDays: cleanNumber(advanced.archiveClosedAfterDays, d.advanced.archiveClosedAfterDays, 1, 3650),
    },
  }
}

export function diffSettings(before: PageManagerSettings, after: PageManagerSettings) {
  const changes: Array<{ path: string; before: unknown; after: unknown }> = []

  function walk(prefix: string, left: unknown, right: unknown) {
    if (JSON.stringify(left) === JSON.stringify(right)) return
    if (isObject(left) && isObject(right)) {
      const keys = new Set([...Object.keys(left), ...Object.keys(right)])
      keys.forEach(key => walk(prefix ? `${prefix}.${key}` : key, left[key], right[key]))
      return
    }
    changes.push({ path: prefix, before: left, after: right })
  }

  walk("", before, after)
  return changes
}
