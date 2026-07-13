import { NextRequest, NextResponse } from "next/server"
import { getAuthContext } from "@/lib/auth"
import { getGeminiApiKey } from "@/lib/get-ai-key"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 30

const GEMINI_API = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent"

export async function POST(request: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { devices, summary, datePreset } = await request.json()
    if (!devices?.length) return NextResponse.json({ error: "No device data" }, { status: 400 })

    const apiKey = await getGeminiApiKey(ctx.orgId)
    if (!apiKey) return NextResponse.json({ error: "No Gemini key configured. Add one in Settings → AI Keys." }, { status: 503 })

    const totalSpend = summary?.totalSpend || 0
    const topDevice  = summary?.topDevice
    const avgCpa     = summary?.avgCpa

    const deviceSummary = devices
      .slice(0, 7)
      .map((d: any) => {
        const pct = totalSpend > 0 ? ((d.spend / totalSpend) * 100).toFixed(1) : "0"
        return `${d.label}: $${d.spend.toFixed(2)} (${pct}%), CTR ${d.ctr.toFixed(2)}%, CPA ${d.cpa > 0 ? "$" + d.cpa.toFixed(2) : "N/A"}`
      })
      .join("; ")

    const prompt = `You are a Meta Ads performance analyst. Analyze this device breakdown data for a Meta Ads account.

Period: ${datePreset?.replace(/_/g, " ")}
Top device: ${topDevice?.label || "N/A"} (${topDevice?.pct?.toFixed(1) || 0}% of spend)
Average CPA: ${avgCpa > 0 ? "$" + avgCpa.toFixed(2) : "N/A"}
Device breakdown: ${deviceSummary}

Write exactly 2 sentences: first, a brief observation about the spend distribution and which device dominates; second, one concrete actionable recommendation (e.g. budget reallocation or test to run). Be specific with numbers. Return plain text only, no markdown, no bullet points.`

    const geminiRes = await fetch(`${GEMINI_API}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.4, maxOutputTokens: 150 },
      }),
    })

    const geminiData = await geminiRes.json()

    if (!geminiRes.ok) {
      const apiMsg = geminiData?.error?.message || `Gemini request failed (${geminiRes.status})`
      if (geminiRes.status === 429 || /quota|rate limit/i.test(apiMsg)) {
        return NextResponse.json({ error: "AI quota exceeded. Check your Gemini API key billing." }, { status: 429 })
      }
      return NextResponse.json({ error: apiMsg }, { status: 502 })
    }

    const insight = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || ""

    if (!insight) return NextResponse.json({ error: "No insight generated" }, { status: 500 })

    return NextResponse.json({ insight })
  } catch (err: any) {
    console.error("[device/analyze]", err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
