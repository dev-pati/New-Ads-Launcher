import { NextRequest, NextResponse } from "next/server"
import { GoogleGenerativeAI } from "@google/generative-ai"
import { getAuthContext } from "@/lib/auth"
import { getGeminiApiKey } from "@/lib/get-ai-key"

function buildPrompt(text: string, headline?: string) {
  return `You are an expert Meta/Facebook direct response copywriter. Generate 5 high-converting variations of this ad primary text, each using a different persuasion angle.

Original primary text:
${text}
${headline ? `\nHeadline context: ${headline}` : ""}

Return ONLY valid JSON (no markdown, no code blocks):
{
  "variations": [
    { "angle": "Urgency", "text": "..." },
    { "angle": "Social Proof", "text": "..." },
    { "angle": "Curiosity", "text": "..." },
    { "angle": "Fear of Missing Out", "text": "..." },
    { "angle": "Transformation", "text": "..." }
  ]
}

Rules:
- Keep similar length to the original
- Maintain the same language (Vietnamese if original is Vietnamese, English if English)
- Each variation must feel natural and ready to publish
- Use the exact persuasion angle specified`
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const geminiKey = await getGeminiApiKey(ctx.orgId)
    if (!geminiKey) {
      return NextResponse.json({ error: "Gemini API key not configured. Add it in Settings → AI Keys." }, { status: 503 })
    }

    const body = await request.json()
    const { text, headline } = body

    if (!text?.trim()) {
      return NextResponse.json({ error: "Primary text is required" }, { status: 400 })
    }

    const genAI = new GoogleGenerativeAI(geminiKey)
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      generationConfig: { responseMimeType: "application/json" },
    })

    const result = await model.generateContent(buildPrompt(text.trim(), headline))
    const data = JSON.parse(result.response.text())

    return NextResponse.json({ variations: data.variations || [] })
  } catch (err) {
    console.error("AI variations error:", err)
    const msg = err instanceof Error ? err.message : ""
    if (msg.includes("429") || msg.includes("Too Many Requests") || msg.includes("quota")) {
      return NextResponse.json({ error: "Gemini API quota exceeded. Please add billing at aistudio.google.com or wait until tomorrow." }, { status: 429 })
    }
    return NextResponse.json({ error: "Failed to generate variations. Please try again." }, { status: 500 })
  }
}
