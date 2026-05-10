import { NextRequest, NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import { getAuthContext } from "@/lib/auth"

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM = `You are an expert Meta/Facebook advertiser and direct response copywriter with 15+ years analyzing high-performing ads. Return ONLY valid JSON — no markdown, no explanation outside the JSON.`

function buildPrompt(body: string, title?: string) {
  return `Analyze this Facebook/Meta ad:
${title ? `\nHeadline: ${title}` : ""}
Body:
${body}

Return ONLY this JSON (no code blocks):
{
  "hook": {
    "text": "the opening hook sentence or phrase",
    "type": "curiosity|fear|social_proof|transformation|urgency|humor|authority",
    "why_works": "1-2 sentences why this hook is effective"
  },
  "framework": {
    "name": "PAS|AIDA|BAB|PASTOR|DIC|4Ps|other",
    "explanation": "how this framework is applied in the ad"
  },
  "audience": "specific target audience description",
  "emotion": "primary emotion triggered",
  "cta": "CTA strategy analysis",
  "strengths": ["strength 1", "strength 2", "strength 3"],
  "weaknesses": ["weakness 1", "weakness 2"],
  "score": 7,
  "score_reason": "one sentence explaining the score",
  "variations": [
    { "hook": "variation 1 hook", "angle": "the angle used" },
    { "hook": "variation 2 hook", "angle": "the angle used" },
    { "hook": "variation 3 hook", "angle": "the angle used" }
  ]
}`
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: "AI service not configured" }, { status: 503 })
    }

    const body = await request.json()
    const { ad_body, ad_title } = body

    if (!ad_body?.trim()) {
      return NextResponse.json({ error: "Ad copy is required" }, { status: 400 })
    }

    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1500,
      system: SYSTEM,
      messages: [{ role: "user", content: buildPrompt(ad_body.trim(), ad_title) }],
    })

    const text = message.content[0].type === "text" ? message.content[0].text : ""
    const cleaned = text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim()
    const analysis = JSON.parse(cleaned)

    return NextResponse.json({ analysis })
  } catch (err) {
    console.error("AI analyze error:", err)
    if (err instanceof SyntaxError) {
      return NextResponse.json({ error: "Failed to parse AI response. Please try again." }, { status: 500 })
    }
    return NextResponse.json({ error: "Analysis failed. Please try again." }, { status: 500 })
  }
}
