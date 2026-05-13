import { NextRequest, NextResponse } from "next/server"
import OpenAI from "openai"
import { GoogleGenerativeAI } from "@google/generative-ai"
import { getAuthContext } from "@/lib/auth"
import { getOpenAIApiKey, getGeminiApiKey } from "@/lib/get-ai-key"
import type { SchemaCategory } from "@/app/api/naming-schema/route"

export const dynamic = "force-dynamic"

// Given a filename and schema, generate PascalCase values for AI categories (Hook, Benefit).
function buildPrompt(filename: string, aiCategories: SchemaCategory[]): string {
  const catDescs = aiCategories
    .map(c => `- ${c.name}: ${c.description}`)
    .join("\n")

  return `You are an expert ad creative naming assistant.

Given the asset filename and naming categories below, generate a short PascalCase value for each AI-powered category.

Filename: "${filename}"

AI Categories:
${catDescs}

Rules:
- Values must be PascalCase (e.g., "CrashHasCause", "SavesTime")
- Each value should be 1-4 words max, combined into one PascalCase token
- Infer meaning from the filename — don't make up unrelated concepts
- If you truly cannot infer a value, return "Unknown"

Return ONLY valid JSON (no markdown, no code blocks):
{
  "values": {
    "CategoryName": "GeneratedValue"
  }
}`
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { filename, aiCategories } = (await request.json()) as {
      filename: string
      aiCategories: SchemaCategory[]
    }

    if (!filename?.trim()) return NextResponse.json({ error: "filename required" }, { status: 400 })
    if (!aiCategories?.length) return NextResponse.json({ values: {} })

    const prompt = buildPrompt(filename.trim(), aiCategories)

    const openaiKey = await getOpenAIApiKey(ctx.orgId)
    if (openaiKey) {
      const openai = new OpenAI({ apiKey: openaiKey })
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        response_format: { type: "json_object" },
        messages: [{ role: "user", content: prompt }],
      })
      const data = JSON.parse(completion.choices[0].message.content || "{}")
      return NextResponse.json({ values: data.values || {} })
    }

    const geminiKey = await getGeminiApiKey(ctx.orgId)
    if (!geminiKey) {
      return NextResponse.json(
        { error: "No AI key configured. Add one in Settings → AI Keys." },
        { status: 503 }
      )
    }
    const genAI = new GoogleGenerativeAI(geminiKey)
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      generationConfig: { responseMimeType: "application/json" },
    })
    const result = await model.generateContent(prompt)
    const data = JSON.parse(result.response.text())
    return NextResponse.json({ values: data.values || {} })
  } catch (err: any) {
    console.error("[naming/generate]", err)
    return NextResponse.json({ error: err.message || "Failed" }, { status: 500 })
  }
}
