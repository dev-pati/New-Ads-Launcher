import { NextRequest, NextResponse } from "next/server"
import { GoogleGenerativeAI } from "@google/generative-ai"
import { YoutubeTranscript } from "youtube-transcript"
import OpenAI from "openai"
import { getAuthContext } from "@/lib/auth"
import { getOpenAIApiKey, getGeminiApiKey } from "@/lib/get-ai-key"

// ─── Text extraction from HTML ───────────────────────────────────────────────

function extractTextFromHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s{2,}/g, " ")
    .trim()
    .slice(0, 6000)
}

function extractYoutubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ]
  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match) return match[1]
  }
  return null
}

// ─── Prompts ─────────────────────────────────────────────────────────────────

const ANALYSIS_SCHEMA = `{
  "hook": {
    "text": "the opening hook sentence or phrase",
    "type": "curiosity|fear|social_proof|transformation|urgency|humor|authority",
    "why_works": "1-2 sentences why this hook is effective"
  },
  "framework": {
    "name": "PAS|AIDA|BAB|PASTOR|DIC|4Ps|other",
    "explanation": "how this framework is applied"
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

function buildTextPrompt(body: string, title?: string) {
  return `You are an expert Meta/Facebook advertiser and direct response copywriter.

Analyze this Facebook/Meta ad:
${title ? `Headline: ${title}\n` : ""}Body:
${body}

Return ONLY valid JSON (no markdown, no code blocks):
${ANALYSIS_SCHEMA}`
}

function buildUrlPrompt(content: string, url: string) {
  return `You are an expert Meta/Facebook advertiser and direct response copywriter.

Analyze this landing page/website content and evaluate it as an ad creative — assess its value proposition, hook, messaging, and persuasion effectiveness.

URL: ${url}
Content:
${content}

Return ONLY valid JSON (no markdown, no code blocks):
${ANALYSIS_SCHEMA}`
}

function buildVideoPrompt(transcript: string, videoUrl: string) {
  return `You are an expert Meta/Facebook advertiser and direct response copywriter.

Analyze this video ad transcript and evaluate its hook, messaging framework, and persuasion effectiveness.

Video URL: ${videoUrl}
Transcript:
${transcript}

Return ONLY valid JSON (no markdown, no code blocks):
${ANALYSIS_SCHEMA}`
}

// ─── Route ───────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await request.json()
    const { type = "text", ad_body, ad_title, url } = body

    let prompt: string

    if (type === "url") {
      if (!url?.trim()) return NextResponse.json({ error: "URL is required" }, { status: 400 })
      let fetchUrl = url.trim()
      if (!fetchUrl.startsWith("http")) fetchUrl = "https://" + fetchUrl
      let content: string
      try {
        const res = await fetch(fetchUrl, {
          headers: { "User-Agent": "Mozilla/5.0 (compatible; AdLauncher/1.0)", "Accept": "text/html" },
          signal: AbortSignal.timeout(10000),
        })
        content = extractTextFromHtml(await res.text())
        if (!content || content.length < 50) return NextResponse.json({ error: "Could not extract content from this URL. The site may block automated access." }, { status: 400 })
      } catch {
        return NextResponse.json({ error: "Failed to fetch URL. Make sure it's publicly accessible." }, { status: 400 })
      }
      prompt = buildUrlPrompt(content, fetchUrl)
    } else if (type === "video") {
      if (!url?.trim()) return NextResponse.json({ error: "Video URL is required" }, { status: 400 })
      const videoUrl = url.trim()
      const youtubeId = extractYoutubeId(videoUrl)
      if (!youtubeId) return NextResponse.json({ error: "Only YouTube URLs are supported. Supported: youtube.com/watch?v=..., youtu.be/..., Shorts." }, { status: 400 })
      let transcript: string
      try {
        const segments = await YoutubeTranscript.fetchTranscript(youtubeId, { lang: "vi" })
          .catch(() => YoutubeTranscript.fetchTranscript(youtubeId))
        transcript = segments.map(s => s.text).join(" ").trim()
        if (!transcript) throw new Error("Empty transcript")
      } catch {
        return NextResponse.json({ error: "Could not get transcript. Make sure the video has captions enabled." }, { status: 400 })
      }
      prompt = buildVideoPrompt(transcript.slice(0, 6000), videoUrl)
    } else {
      if (!ad_body?.trim()) return NextResponse.json({ error: "Ad copy is required" }, { status: 400 })
      prompt = buildTextPrompt(ad_body.trim(), ad_title)
    }

    // OpenAI preferred for text tasks
    const openaiKey = await getOpenAIApiKey(ctx.orgId)
    if (openaiKey) {
      const openai = new OpenAI({ apiKey: openaiKey })
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        response_format: { type: "json_object" },
        messages: [{ role: "user", content: prompt }],
      })
      const analysis = JSON.parse(completion.choices[0].message.content || "{}")
      return NextResponse.json({ analysis })
    }

    // Fallback to Gemini
    const geminiKey = await getGeminiApiKey(ctx.orgId)
    if (!geminiKey) return NextResponse.json({ error: "No AI key configured. Add one in Settings → AI Keys." }, { status: 503 })
    const genAI = new GoogleGenerativeAI(geminiKey)
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash", generationConfig: { responseMimeType: "application/json" } })
    const result = await model.generateContent(prompt)
    const analysis = JSON.parse(result.response.text())
    return NextResponse.json({ analysis })
  } catch (err) {
    console.error("AI analyze error:", err)
    if (err instanceof SyntaxError) {
      return NextResponse.json({ error: "Failed to parse AI response. Please try again." }, { status: 500 })
    }
    const msg = err instanceof Error ? err.message : ""
    if (msg.includes("429") || msg.includes("Too Many Requests") || msg.includes("quota")) {
      return NextResponse.json({ error: "Gemini API quota exceeded. Please add billing at aistudio.google.com or wait until tomorrow." }, { status: 429 })
    }
    return NextResponse.json({ error: "Analysis failed. Please try again." }, { status: 500 })
  }
}
