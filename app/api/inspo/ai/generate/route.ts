import { NextRequest, NextResponse } from "next/server"
import OpenAI from "openai"
import { GoogleGenerativeAI } from "@google/generative-ai"
import { GoogleAIFileManager, FileState } from "@google/generative-ai/server"
import { getAuthContext } from "@/lib/auth"
import { getOpenAIApiKey, getGeminiApiKey } from "@/lib/get-ai-key"
import fs from "fs"
import path from "path"
import os from "os"

export const maxDuration = 300

const OUTPUT_SCHEMA = `{
  "product_name": "name of the product/service",
  "target_audience": "who this is for",
  "primary_texts": [
    { "angle": "Pain-Solution", "text": "full primary text variation 1" },
    { "angle": "Social Proof", "text": "full primary text variation 2" },
    { "angle": "Transformation", "text": "full primary text variation 3" }
  ],
  "headlines": [
    "headline variation 1 (max 40 chars)",
    "headline variation 2 (max 40 chars)",
    "headline variation 3 (max 40 chars)"
  ],
  "descriptions": [
    "description variation 1 (max 30 chars)",
    "description variation 2 (max 30 chars)"
  ],
  "cta": "SHOP_NOW"
}`

const CTA_OPTIONS = "SHOP_NOW, LEARN_MORE, SIGN_UP, GET_QUOTE, CONTACT_US, BOOK_NOW, DOWNLOAD, SUBSCRIBE, WATCH_MORE, APPLY_NOW, GET_OFFER"

function buildUrlPrompt(content: string, url: string) {
  return `You are an expert Meta/Facebook direct response copywriter.

Based on this landing page content, write high-converting Facebook/Meta ad copy.

URL: ${url}
Page content:
${content}

Write in the SAME LANGUAGE as the page content (Vietnamese if Vietnamese, English if English).

Return ONLY valid JSON (no markdown, no code blocks):
${OUTPUT_SCHEMA}

CTA options: ${CTA_OPTIONS}
Rules:
- Primary texts: 100-300 words each, hook in first line, include benefits and CTA
- Headlines: punchy, benefit-driven, max 40 characters
- Descriptions: short supporting copy, max 30 characters
- Pick the most relevant CTA from the options`
}

function buildVideoPrompt() {
  return `You are an expert Meta/Facebook direct response copywriter.

Watch this product/brand video carefully and write high-converting Facebook/Meta ad copy based on what you see and hear.

Write in the SAME LANGUAGE as the video (Vietnamese if Vietnamese, English if English).

Return ONLY valid JSON (no markdown, no code blocks):
${OUTPUT_SCHEMA}

CTA options: ${CTA_OPTIONS}
Rules:
- Primary texts: 100-300 words each, hook in first line, reference what's shown in the video
- Headlines: punchy, benefit-driven, max 40 characters
- Descriptions: short supporting copy, max 30 characters
- Pick the most relevant CTA based on video content`
}

function buildCombinedPrompt(urlContent: string, url: string, transcript: string) {
  return `You are an expert Meta/Facebook direct response copywriter.

You have access to BOTH the landing page content AND the video transcript for this product/service.
Synthesize insights from both sources to create the most compelling, accurate ad copy.

Landing Page URL: ${url}
Landing Page Content:
${urlContent}

Video Transcript:
${transcript}

Write in the SAME LANGUAGE as the content (Vietnamese if Vietnamese, English if English).

Return ONLY valid JSON (no markdown, no code blocks):
${OUTPUT_SCHEMA}

CTA options: ${CTA_OPTIONS}
Rules:
- Primary texts: 100-300 words each, combine messaging from BOTH landing page and video
- Headlines: punchy, benefit-driven, max 40 characters
- Descriptions: short supporting copy, max 30 characters
- Pick the most relevant CTA`
}

function buildTranscriptPrompt(transcript: string) {
  return `You are an expert Meta/Facebook direct response copywriter.

Based on this video transcript, write high-converting Facebook/Meta ad copy.

Transcript:
${transcript}

Write in the SAME LANGUAGE as the transcript (Vietnamese if Vietnamese, English if English).

Return ONLY valid JSON (no markdown, no code blocks):
${OUTPUT_SCHEMA}

CTA options: ${CTA_OPTIONS}
Rules:
- Primary texts: 100-300 words each, hook in first line, reference product/service from transcript
- Headlines: punchy, benefit-driven, max 40 characters
- Descriptions: short supporting copy, max 30 characters
- Pick the most relevant CTA based on content`
}

function extractTextFromHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/\s{2,}/g, " ")
    .trim()
    .slice(0, 6000)
}

export async function POST(request: NextRequest) {
  let tmpPath: string | null = null

  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await request.json()
    const { type, url, videoUrl } = body

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
        if (!content || content.length < 50) {
          return NextResponse.json({ error: "Could not extract content from this URL." }, { status: 400 })
        }
      } catch {
        return NextResponse.json({ error: "Failed to fetch URL. Make sure it's publicly accessible." }, { status: 400 })
      }

      // OpenAI preferred for text tasks
      const openaiKey = await getOpenAIApiKey(ctx.orgId)
      if (openaiKey) {
        const openai = new OpenAI({ apiKey: openaiKey })
        const completion = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          response_format: { type: "json_object" },
          messages: [{ role: "user", content: buildUrlPrompt(content, fetchUrl) }],
        })
        const generated = JSON.parse(completion.choices[0].message.content || "{}")
        return NextResponse.json({ generated })
      }

      // Fallback to Gemini
      const geminiKey = await getGeminiApiKey(ctx.orgId)
      if (!geminiKey) return NextResponse.json({ error: "No AI key configured. Add one in Settings → AI Keys." }, { status: 503 })
      const genAI = new GoogleGenerativeAI(geminiKey)
      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash", generationConfig: { responseMimeType: "application/json" } })
      const result = await model.generateContent(buildUrlPrompt(content, fetchUrl))
      const generated = JSON.parse(result.response.text())
      return NextResponse.json({ generated })

    } else if (type === "video") {
      if (!url?.trim()) return NextResponse.json({ error: "Video URL is required" }, { status: 400 })

      const [openaiKey, geminiKey] = await Promise.all([
        getOpenAIApiKey(ctx.orgId),
        getGeminiApiKey(ctx.orgId),
      ])
      if (!openaiKey && !geminiKey) {
        return NextResponse.json({ error: "AI key required for video. Add OpenAI or Gemini key in Settings → AI Keys." }, { status: 503 })
      }

      // Download video to temp file
      const videoRes = await fetch(url, { signal: AbortSignal.timeout(120000) })
      if (!videoRes.ok) return NextResponse.json({ error: "Failed to fetch video." }, { status: 400 })

      const rawContentType = videoRes.headers.get("content-type") || "video/mp4"
      const contentType = rawContentType.split(";")[0].trim() || "video/mp4"
      const ext = contentType.includes("quicktime") ? "mov" : contentType.includes("webm") ? "webm" : "mp4"
      const buffer = Buffer.from(await videoRes.arrayBuffer())
      tmpPath = path.join(os.tmpdir(), `gen_video_${Date.now()}.${ext}`)
      fs.writeFileSync(tmpPath, buffer)

      // OpenAI path: Whisper transcription + GPT-4o-mini
      if (openaiKey) {
        const openai = new OpenAI({ apiKey: openaiKey })
        const transcription = await openai.audio.transcriptions.create({
          file: fs.createReadStream(tmpPath) as Parameters<typeof openai.audio.transcriptions.create>[0]["file"],
          model: "whisper-1",
        })
        const transcript = transcription.text?.trim()
        if (!transcript) return NextResponse.json({ error: "Could not transcribe video audio. Make sure the video has speech." }, { status: 400 })
        const completion = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          response_format: { type: "json_object" },
          messages: [{ role: "user", content: buildTranscriptPrompt(transcript) }],
        })
        const generated = JSON.parse(completion.choices[0].message.content || "{}")
        return NextResponse.json({ generated })
      }

      // Gemini path: native video file upload
      const fileManager = new GoogleAIFileManager(geminiKey!)
      const uploadResult = await fileManager.uploadFile(tmpPath, { mimeType: contentType, displayName: "ad_video" })

      let geminiFile = await fileManager.getFile(uploadResult.file.name)
      let attempts = 0
      while (geminiFile.state === FileState.PROCESSING && attempts < 30) {
        await new Promise(r => setTimeout(r, 3000))
        geminiFile = await fileManager.getFile(uploadResult.file.name)
        attempts++
      }

      if (geminiFile.state !== FileState.ACTIVE) {
        return NextResponse.json({ error: "Video processing failed. Try MP4 format." }, { status: 500 })
      }

      const genAI = new GoogleGenerativeAI(geminiKey!)
      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash", generationConfig: { responseMimeType: "application/json" } })
      const result = await model.generateContent([
        { fileData: { fileUri: geminiFile.uri, mimeType: geminiFile.mimeType } },
        { text: buildVideoPrompt() },
      ])
      await fileManager.deleteFile(geminiFile.name).catch(() => {})
      const generated = JSON.parse(result.response.text())
      return NextResponse.json({ generated })

    } else if (type === "both") {
      if (!url?.trim()) return NextResponse.json({ error: "URL is required" }, { status: 400 })
      if (!videoUrl?.trim()) return NextResponse.json({ error: "Video URL is required" }, { status: 400 })

      const [openaiKey, geminiKey] = await Promise.all([
        getOpenAIApiKey(ctx.orgId),
        getGeminiApiKey(ctx.orgId),
      ])
      if (!openaiKey && !geminiKey) {
        return NextResponse.json({ error: "No AI key configured. Add one in Settings → AI Keys." }, { status: 503 })
      }

      // Fetch URL content + download video in parallel
      let fetchUrl = url.trim()
      if (!fetchUrl.startsWith("http")) fetchUrl = "https://" + fetchUrl

      const [pageRes, videoRes] = await Promise.all([
        fetch(fetchUrl, {
          headers: { "User-Agent": "Mozilla/5.0 (compatible; AdLauncher/1.0)", "Accept": "text/html" },
          signal: AbortSignal.timeout(10000),
        }).catch(() => null),
        fetch(videoUrl, { signal: AbortSignal.timeout(120000) }),
      ])

      const urlContent = pageRes?.ok ? extractTextFromHtml(await pageRes.text()) : ""

      if (!videoRes.ok) return NextResponse.json({ error: "Failed to fetch video." }, { status: 400 })
      const rawContentType = videoRes.headers.get("content-type") || "video/mp4"
      const contentType = rawContentType.split(";")[0].trim() || "video/mp4"
      const ext = contentType.includes("quicktime") ? "mov" : contentType.includes("webm") ? "webm" : "mp4"
      const buffer = Buffer.from(await videoRes.arrayBuffer())
      tmpPath = path.join(os.tmpdir(), `gen_both_${Date.now()}.${ext}`)
      fs.writeFileSync(tmpPath, buffer)

      // Transcribe video then combine with URL content
      if (openaiKey) {
        const openai = new OpenAI({ apiKey: openaiKey })
        const transcription = await openai.audio.transcriptions.create({
          file: fs.createReadStream(tmpPath) as Parameters<typeof openai.audio.transcriptions.create>[0]["file"],
          model: "whisper-1",
        })
        const transcript = transcription.text?.trim() || ""
        const prompt = urlContent
          ? buildCombinedPrompt(urlContent, fetchUrl, transcript)
          : buildTranscriptPrompt(transcript)
        const completion = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          response_format: { type: "json_object" },
          messages: [{ role: "user", content: prompt }],
        })
        const generated = JSON.parse(completion.choices[0].message.content || "{}")
        return NextResponse.json({ generated })
      }

      // Gemini fallback — native video + URL content in prompt
      const fileManager = new GoogleAIFileManager(geminiKey!)
      const uploadResult = await fileManager.uploadFile(tmpPath, { mimeType: contentType, displayName: "ad_video" })
      let geminiFile = await fileManager.getFile(uploadResult.file.name)
      let attempts = 0
      while (geminiFile.state === FileState.PROCESSING && attempts < 30) {
        await new Promise(r => setTimeout(r, 3000))
        geminiFile = await fileManager.getFile(uploadResult.file.name)
        attempts++
      }
      if (geminiFile.state !== FileState.ACTIVE) {
        return NextResponse.json({ error: "Video processing failed. Try MP4 format." }, { status: 500 })
      }
      const genAI = new GoogleGenerativeAI(geminiKey!)
      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash", generationConfig: { responseMimeType: "application/json" } })
      const urlNote = urlContent ? `\n\nAdditional context from landing page (${fetchUrl}):\n${urlContent}` : ""
      const result = await model.generateContent([
        { fileData: { fileUri: geminiFile.uri, mimeType: geminiFile.mimeType } },
        { text: buildVideoPrompt() + urlNote },
      ])
      await fileManager.deleteFile(geminiFile.name).catch(() => {})
      const generated = JSON.parse(result.response.text())
      return NextResponse.json({ generated })

    } else {
      return NextResponse.json({ error: "Invalid type. Use 'url', 'video', or 'both'." }, { status: 400 })
    }
  } catch (err) {
    console.error("AI generate error:", err)
    if (err instanceof SyntaxError) return NextResponse.json({ error: "Failed to parse AI response. Please try again." }, { status: 500 })
    const msg = err instanceof Error ? err.message : ""
    if (msg.includes("429") || msg.includes("quota")) return NextResponse.json({ error: "AI quota exceeded. Check your API key billing." }, { status: 429 })
    if (msg.includes("API_KEY_INVALID") || msg.includes("API key not valid")) return NextResponse.json({ error: "Gemini API key is invalid. Update it in Settings → AI Keys." }, { status: 400 })
    return NextResponse.json({ error: msg || "Generation failed. Please try again." }, { status: 500 })
  } finally {
    if (tmpPath) { try { fs.unlinkSync(tmpPath) } catch { } }
  }
}
