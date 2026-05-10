import { NextRequest, NextResponse } from "next/server"
import { GoogleGenerativeAI } from "@google/generative-ai"
import { getAuthContext } from "@/lib/auth"

function buildPrompt(body: string, title?: string) {
  return `You are an expert Meta/Facebook advertiser and direct response copywriter with 15+ years analyzing high-performing ads.

Analyze this Facebook/Meta ad:
${title ? `\nHeadline: ${title}` : ""}
Body:
${body}

Return ONLY valid JSON (no markdown, no code blocks, no explanation):
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

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: "AI service not configured" }, { status: 503 })
    }

    const body = await request.json()
    const { ad_body, ad_title } = body

    if (!ad_body?.trim()) {
      return NextResponse.json({ error: "Ad copy is required" }, { status: 400 })
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      generationConfig: { responseMimeType: "application/json" },
    })

    const result = await model.generateContent(buildPrompt(ad_body.trim(), ad_title))
    const text = result.response.text()

    const analysis = JSON.parse(text)
    return NextResponse.json({ analysis })
  } catch (err) {
    console.error("AI analyze error:", err)
    if (err instanceof SyntaxError) {
      return NextResponse.json({ error: "Failed to parse AI response. Please try again." }, { status: 500 })
    }
    return NextResponse.json({ error: "Analysis failed. Please try again." }, { status: 500 })
  }
}
