import { NextRequest, NextResponse } from "next/server"
import { GoogleGenerativeAI } from "@google/generative-ai"
import { GoogleAIFileManager, FileState } from "@google/generative-ai/server"
import { getAuthContext } from "@/lib/auth"
import fs from "fs"
import path from "path"
import os from "os"

const ANALYSIS_SCHEMA = `{
  "hook": {
    "text": "the opening hook (first 3 seconds visual/audio)",
    "type": "curiosity|fear|social_proof|transformation|urgency|humor|authority",
    "why_works": "1-2 sentences why this hook is effective"
  },
  "framework": {
    "name": "PAS|AIDA|BAB|PASTOR|DIC|4Ps|other",
    "explanation": "how this framework is applied in the video"
  },
  "audience": "specific target audience description",
  "emotion": "primary emotion triggered",
  "cta": "CTA strategy analysis",
  "strengths": ["strength 1", "strength 2", "strength 3"],
  "weaknesses": ["weakness 1", "weakness 2"],
  "score": 7,
  "score_reason": "one sentence explaining the score",
  "variations": [
    { "hook": "alternative script hook 1", "angle": "the angle used" },
    { "hook": "alternative script hook 2", "angle": "the angle used" },
    { "hook": "alternative script hook 3", "angle": "the angle used" }
  ]
}`

const VIDEO_PROMPT = `You are an expert Meta/Facebook video ad analyst and direct response copywriter.

Analyze this video ad in detail:
- Pay close attention to the first 3 seconds (the hook)
- Identify the copywriting/storytelling framework used
- Evaluate visuals, pacing, voiceover, on-screen text, music, and CTA
- Note what makes it effective or not for paid social

Return ONLY valid JSON (no markdown, no code blocks):
${ANALYSIS_SCHEMA}`

async function fetchAndWriteTemp(videoUrl: string): Promise<{ tmpPath: string; mimeType: string }> {
  const res = await fetch(videoUrl, { signal: AbortSignal.timeout(30000) })
  if (!res.ok) throw new Error(`Failed to fetch video: ${res.status}`)

  const contentType = res.headers.get("content-type") || "video/mp4"
  const ext = contentType.includes("quicktime") ? "mov"
    : contentType.includes("webm") ? "webm"
    : "mp4"

  const buffer = Buffer.from(await res.arrayBuffer())
  const tmpPath = path.join(os.tmpdir(), `inspo_video_${Date.now()}.${ext}`)
  fs.writeFileSync(tmpPath, buffer)

  return { tmpPath, mimeType: contentType }
}

async function analyzeVideoFile(tmpPath: string, mimeType: string) {
  const fileManager = new GoogleAIFileManager(process.env.GEMINI_API_KEY!)

  const uploadResult = await fileManager.uploadFile(tmpPath, {
    mimeType,
    displayName: path.basename(tmpPath),
  })

  // Wait for Gemini to process
  let geminiFile = await fileManager.getFile(uploadResult.file.name)
  let attempts = 0
  while (geminiFile.state === FileState.PROCESSING && attempts < 30) {
    await new Promise(r => setTimeout(r, 3000))
    geminiFile = await fileManager.getFile(uploadResult.file.name)
    attempts++
  }

  if (geminiFile.state === FileState.FAILED) {
    throw new Error("Video processing failed. Try MP4 format.")
  }
  if (geminiFile.state === FileState.PROCESSING) {
    throw new Error("Video processing timed out. Try a shorter video.")
  }

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
    generationConfig: { responseMimeType: "application/json" },
  })

  const result = await model.generateContent([
    { fileData: { fileUri: geminiFile.uri, mimeType: geminiFile.mimeType } },
    { text: VIDEO_PROMPT },
  ])

  await fileManager.deleteFile(geminiFile.name).catch(() => {})

  return JSON.parse(result.response.text())
}

export async function POST(request: NextRequest) {
  let tmpPath: string | null = null

  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: "AI service not configured" }, { status: 503 })
    }

    const contentType = request.headers.get("content-type") || ""

    let mimeType = "video/mp4"

    if (contentType.includes("application/json")) {
      // Analyze from existing uploaded asset URL
      const { url } = await request.json()
      if (!url) return NextResponse.json({ error: "Video URL is required" }, { status: 400 })

      const result = await fetchAndWriteTemp(url)
      tmpPath = result.tmpPath
      mimeType = result.mimeType
    } else {
      // Direct file upload
      const formData = await request.formData()
      const file = formData.get("video") as File | null
      if (!file) return NextResponse.json({ error: "No video provided" }, { status: 400 })

      const maxSize = 50 * 1024 * 1024
      if (file.size > maxSize) {
        return NextResponse.json({ error: "Video too large. Maximum 50MB." }, { status: 400 })
      }

      const buffer = Buffer.from(await file.arrayBuffer())
      const ext = file.name.split(".").pop() || "mp4"
      tmpPath = path.join(os.tmpdir(), `inspo_video_${Date.now()}.${ext}`)
      fs.writeFileSync(tmpPath, buffer)
      mimeType = file.type || "video/mp4"
    }

    const analysis = await analyzeVideoFile(tmpPath, mimeType)
    return NextResponse.json({ analysis })
  } catch (err: unknown) {
    console.error("Video analyze error:", err)
    const msg = err instanceof Error ? err.message : "Video analysis failed."
    return NextResponse.json({ error: msg }, { status: 500 })
  } finally {
    if (tmpPath) {
      try { fs.unlinkSync(tmpPath) } catch { }
    }
  }
}
