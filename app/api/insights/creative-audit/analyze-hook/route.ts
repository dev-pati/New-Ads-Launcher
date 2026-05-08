import { NextRequest, NextResponse } from "next/server"
import { getAuthContext } from "@/lib/auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 30

const GEMINI_API = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent"

export async function POST(request: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { thumbnailUrl, adName, hookRate } = await request.json()
    if (!thumbnailUrl) return NextResponse.json({ error: "thumbnailUrl required" }, { status: 400 })

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) return NextResponse.json({ error: "GEMINI_API_KEY not configured" }, { status: 500 })

    // Fetch image and convert to base64
    const imgRes = await fetch(thumbnailUrl)
    if (!imgRes.ok) return NextResponse.json({ error: "Failed to fetch image" }, { status: 400 })
    const contentType = imgRes.headers.get("content-type") || "image/jpeg"
    const mimeType    = contentType.split(";")[0] || "image/jpeg"
    const arrayBuffer = await imgRes.arrayBuffer()
    const base64      = Buffer.from(arrayBuffer).toString("base64")

    const prompt = `You are a Meta Ads creative strategist. Analyze this video ad's opening frame (hook frame).

Ad name: ${adName || "Unknown"}
Hook Rate: ${hookRate ? hookRate.toFixed(1) + "%" : "Unknown"} (% of people who watched 3+ seconds)

Give exactly 2 short bullet points (max 15 words each) explaining what specific visual elements make this opening frame effective at stopping the scroll. Be concrete and specific — mention what you actually see in the image.

Format: Return ONLY a JSON array of 2 strings, no markdown, no extra text.
Example: ["Bold close-up face with direct eye contact creates immediate personal connection", "High contrast text overlay with emotional trigger word stops scroll instantly"]`

    const geminiRes = await fetch(`${GEMINI_API}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          parts: [
            { inline_data: { mime_type: mimeType, data: base64 } },
            { text: prompt },
          ],
        }],
        generationConfig: {
          temperature:     0.4,
          maxOutputTokens: 200,
        },
      }),
    })

    const geminiData = await geminiRes.json()
    const raw = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || ""

    // Parse JSON array from response
    let bullets: string[] = []
    try {
      // Strip markdown code fences if present
      const cleaned = raw.replace(/```json?\n?/g, "").replace(/```/g, "").trim()
      bullets = JSON.parse(cleaned)
      if (!Array.isArray(bullets)) bullets = [String(bullets)]
    } catch {
      // Fallback: split by newline or bullet chars
      bullets = raw
        .split(/\n|•|-/)
        .map((s: string) => s.trim())
        .filter((s: string) => s.length > 10)
        .slice(0, 2)
    }

    if (!bullets.length) {
      return NextResponse.json({ error: "No analysis generated" }, { status: 500 })
    }

    return NextResponse.json({ bullets: bullets.slice(0, 2) })
  } catch (err: any) {
    console.error("[creative-audit/analyze-hook]", err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
