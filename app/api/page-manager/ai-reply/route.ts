import { NextRequest, NextResponse } from "next/server"
import OpenAI from "openai"
import { getAuthContext } from "@/lib/auth"
import { getOpenAIApiKey } from "@/lib/get-ai-key"
import { normalizePageManagerSettings, type QuickReplyTemplate } from "@/lib/page-manager-settings"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 30

type RiskLevel = "low" | "medium" | "high"

type GuardrailResult = {
  intent: string
  riskLevel: RiskLevel
  matchedRules: string[]
  customerLanguage: "vi" | "en"
}

function clampConfidence(value: unknown, fallback = 70) {
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.max(1, Math.min(100, Math.round(n)))
}

function normalizeForRules(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\u0111/g, "d")
}

function detectCustomerLanguage(message: string, defaultLanguage: string): "vi" | "en" {
  const text = normalizeForRules(message)
  if (defaultLanguage === "vi") return "vi"
  if (/\b(gia|bao nhieu|con hang|het hang|giao hang|van chuyen|tu van|mua|ship|cho minh|minh muon|cam on|xin chao|chao)\b/i.test(text)) {
    return "vi"
  }
  return "en"
}

function detectGuardrails(message: string, defaultLanguage: string): GuardrailResult {
  const text = normalizeForRules(message)
  const matchedRules: string[] = []
  let intent = "general_question"
  let riskLevel: RiskLevel = "low"

  if (/(price|cost|bundle|discount|bao nhieu|gia|combo|ship)/i.test(text)) {
    intent = "pricing"
    matchedRules.push("pricing_keyword")
  }
  if (/(shipping|delivery|ship|giao hang|van chuyen|may ngay|bao lau)/i.test(text)) {
    intent = "shipping"
    matchedRules.push("shipping_keyword")
  }
  if (/(stock|available|con hang|het hang|in stock)/i.test(text)) {
    intent = "availability"
    matchedRules.push("availability_keyword")
  }
  if (/(refund|return|chargeback|complaint|scam|fake|lua|hoan tien|tra hang|khieu nai)/i.test(text)) {
    intent = "support_escalation"
    riskLevel = "high"
    matchedRules.push("support_or_complaint_keyword")
  }
  if (/(\+?\d[\d\s().-]{7,}\d)/.test(message)) {
    riskLevel = riskLevel === "high" ? "high" : "medium"
    matchedRules.push("phone_number_detected")
  }
  if (/(allergic|side effect|medical|doctor|pregnant|disease|di ung|tac dung phu|bac si|mang thai|benh|thuoc|chua benh)/i.test(text)) {
    intent = "medical_sensitive"
    riskLevel = "high"
    matchedRules.push("medical_sensitive_keyword")
  }
  if (/^(hi|hello|hey|xin chao|chao|alo)\b/i.test(text.trim())) {
    intent = "greeting"
    matchedRules.push("greeting")
  }

  return {
    intent,
    riskLevel,
    matchedRules: Array.from(new Set(matchedRules)),
    customerLanguage: detectCustomerLanguage(message, defaultLanguage),
  }
}

function decideAction(params: {
  confidence: number
  riskLevel: RiskLevel
  autoReplyEnabled: boolean
  aiDraftReplies: boolean
  threshold: number
  fallbackAction: string
  quietHoursActive?: boolean
}) {
  if (params.riskLevel === "high") return "assign"
  if (params.quietHoursActive) return params.aiDraftReplies ? "draft" : "assign"
  if (!params.autoReplyEnabled) return params.aiDraftReplies ? "draft" : "assign"
  if (params.confidence >= params.threshold && params.riskLevel === "low") return "send"
  if (params.fallbackAction === "assign") return "assign"
  if (params.fallbackAction === "skip") return "ignore"
  return "draft"
}

function timeToMinutes(value: string) {
  const [hour, minute] = value.split(":").map(Number)
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null
  return hour * 60 + minute
}

function isQuietHoursActive(start: string, end: string, now = new Date()) {
  const startMinutes = timeToMinutes(start)
  const endMinutes = timeToMinutes(end)
  if (startMinutes == null || endMinutes == null) return false
  const current = now.getHours() * 60 + now.getMinutes()

  if (startMinutes === endMinutes) return false
  if (startMinutes < endMinutes) return current >= startMinutes && current < endMinutes
  return current >= startMinutes || current < endMinutes
}

function applySpinSyntax(value: string) {
  return value.replace(/\{([^{}|]+(?:\|[^{}|]+)+)\}/g, (_, choices: string) => {
    const options = choices.split("|").map(part => part.trim()).filter(Boolean)
    return options[0] || ""
  })
}

function personalizeTemplate(value: string, customerName: string) {
  const firstName = customerName.split(/\s+/)[0] || customerName
  return value
    .replaceAll("{full_name}", customerName)
    .replaceAll("{first_name}", firstName)
    .replaceAll("{gender}", "")
}

function chooseTemplate(intent: string, templates: QuickReplyTemplate[]) {
  const keywords: Record<string, string[]> = {
    greeting: ["hello", "xin chao", "chao", "welcome"],
    pricing: ["price", "pricing", "gia", "bundle"],
    shipping: ["ship", "shipping", "delivery", "giao hang"],
    availability: ["stock", "available", "con hang"],
  }
  const wanted = keywords[intent] || []
  if (!wanted.length) return null

  return templates.find(template => {
    const haystack = normalizeForRules(`${template.id} ${template.name} ${template.shortcut} ${template.body}`)
    return wanted.some(keyword => haystack.includes(keyword))
  }) || null
}

function fallbackReply(intent: string, language: "vi" | "en", handoffMessage: string) {
  if (intent === "support_escalation" || intent === "medical_sensitive") {
    return handoffMessage || (language === "vi"
      ? "Cam on ban da nhan tin. Minh se chuyen hoi thoai nay cho nhan su phu trach de ho tro chinh xac hon."
      : "Thanks for reaching out. I will route this conversation to the right team member for accurate support.")
  }

  if (language === "vi") {
    if (intent === "pricing") return "Cam on ban da quan tam. Ban muon xem gia cua san pham hoac combo nao de minh gui thong tin phu hop?"
    if (intent === "shipping") return "Cam on ban. Thoi gian giao hang tuy thuoc vao khu vuc. Ban cho minh xin tinh/thanh pho hoac ma ZIP de minh ho tro uoc tinh nhe."
    if (intent === "availability") return "Cam on ban. Ban cho minh biet san pham hoac phien ban nao ban dang quan tam de minh kiem tra tinh trang con hang nhe."
    if (intent === "greeting") return "Xin chao, cam on ban da nhan tin. Minh co the ho tro gi cho ban hom nay?"
    return "Cam on ban da nhan tin. Ban cho minh them mot chut thong tin de minh ho tro dung nhu cau nhe."
  }

  if (intent === "pricing") return "Thanks for reaching out. Which product or bundle are you interested in? I can send the right pricing details."
  if (intent === "shipping") return "Thanks for your message. Shipping time depends on your location. Please send your city or ZIP code and I can help estimate delivery."
  if (intent === "availability") return "Thanks for checking. Please tell me which product or variant you want, and I can confirm availability for you."
  if (intent === "greeting") return "Hi, thanks for reaching out. How can I help you today?"
  return "Thanks for reaching out. I can help with that. Could you share a little more detail?"
}

function parseJsonObject(raw: string) {
  try {
    return JSON.parse(raw)
  } catch {
    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) return null
    try {
      return JSON.parse(match[0])
    } catch {
      return null
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await request.json()
    const pageId = typeof body.page_id === "string" ? body.page_id : ""
    const message = typeof body.message === "string" ? body.message.trim() : ""
    const context = typeof body.context === "string" ? body.context.trim() : ""
    const customerName = typeof body.customer_name === "string" ? body.customer_name.trim() : "customer"
    const settings = normalizePageManagerSettings(body.settings)

    if (!pageId) return NextResponse.json({ error: "page_id required" }, { status: 400 })
    if (!message || message.length < 2) return NextResponse.json({ error: "Customer message is required" }, { status: 400 })
    if (message.length > 2000) return NextResponse.json({ error: "Customer message is too long" }, { status: 400 })

    const guardrails = detectGuardrails(message, settings.general.defaultLanguage)
    const threshold = settings.automation.confidenceThreshold
    const template = settings.quickReplyTemplates.enabled
      ? chooseTemplate(guardrails.intent, settings.quickReplyTemplates.templates)
      : null

    let intent = guardrails.intent
    let confidence = template ? 82 : guardrails.riskLevel === "high" ? 58 : 74
    let draftReply = template
      ? personalizeTemplate(settings.quickReplyTemplates.spinSyntaxEnabled ? applySpinSyntax(template.body) : template.body, customerName)
      : fallbackReply(intent, guardrails.customerLanguage, settings.conversations.handoffMessage)
    let reason = template
      ? `Matched quick reply template: ${template.name}.`
      : "Rule-based fallback generated a safe draft."
    let model = "rule_fallback"

    const openaiKey = await getOpenAIApiKey(ctx.orgId)
    if (openaiKey) {
      try {
        const openai = new OpenAI({ apiKey: openaiKey })
        const completion = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          temperature: 0.25,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content: [
                "You are an AI customer support assistant inside a Fanpage Manager inbox.",
                "Return strict JSON only.",
                "Write a short, natural, operator-ready reply in the customer's language.",
                "Use only facts from page_context or quick_reply_templates. Never invent exact prices, shipping time, stock status, discounts, refund promises, medical claims, legal claims, or payment commitments.",
                "If the customer asks about pricing/shipping/stock and the exact answer is not provided, ask one clear follow-up question.",
                "If the message is complaint, refund, scam/fake accusation, medical/health-sensitive, legal, payment risk, or unsafe, recommend escalation and draft a calm handoff reply.",
                "Do not mention internal policy, confidence, model, or automation.",
              ].join(" "),
            },
            {
              role: "user",
              content: JSON.stringify({
                customer_message: message,
                detected_intent: guardrails.intent,
                detected_risk: guardrails.riskLevel,
                customer_name: customerName,
                customer_language: guardrails.customerLanguage,
                page_context: context || "No additional product context provided.",
                handoff_message: settings.conversations.handoffMessage,
                quick_reply_templates: settings.quickReplyTemplates.templates.slice(0, 12),
                preferred_template: template,
                required_json_shape: {
                  intent: "pricing|shipping|availability|support_escalation|medical_sensitive|greeting|general_question",
                  confidence: "number 1-100",
                  draftReply: "short customer-facing reply text",
                  reason: "short internal reason",
                },
              }),
            },
          ],
        })

        const parsed = parseJsonObject(completion.choices[0]?.message?.content || "")
        if (parsed) {
          intent = typeof parsed.intent === "string" ? parsed.intent : intent
          confidence = clampConfidence(parsed.confidence, confidence)
          draftReply = typeof parsed.draftReply === "string" && parsed.draftReply.trim()
            ? parsed.draftReply.trim().slice(0, 1200)
            : draftReply
          reason = typeof parsed.reason === "string" ? parsed.reason.slice(0, 300) : "AI generated a safe customer reply."
          model = "gpt-4o-mini"
        }
      } catch (err) {
        reason = `AI provider failed; using safe fallback. ${err instanceof Error ? err.message : ""}`.trim()
      }
    } else {
      reason = template
        ? `No OpenAI key configured; using matched template: ${template.name}.`
        : "No OpenAI key configured; using rule fallback."
    }

    const riskLevel = guardrails.riskLevel
    const quietHoursActive = settings.automation.quietHoursEnabled
      ? isQuietHoursActive(settings.automation.quietHoursStart, settings.automation.quietHoursEnd)
      : false
    const action = decideAction({
      confidence,
      riskLevel,
      autoReplyEnabled: settings.automation.autoReplyEnabled,
      aiDraftReplies: settings.automation.aiDraftReplies,
      threshold,
      fallbackAction: settings.automation.fallbackAction,
      quietHoursActive,
    })

    return NextResponse.json({
      pageId,
      model,
      intent,
      confidence,
      riskLevel,
      action,
      draftReply,
      reason,
      matchedRules: guardrails.matchedRules,
      matchedTemplate: template ? { id: template.id, name: template.name, shortcut: template.shortcut } : null,
      customerLanguage: guardrails.customerLanguage,
      guardrails: {
        threshold,
        autoReplyEnabled: settings.automation.autoReplyEnabled,
        aiDraftReplies: settings.automation.aiDraftReplies,
        fallbackAction: settings.automation.fallbackAction,
        quietHoursActive,
      },
    })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to generate AI reply" }, { status: 500 })
  }
}
