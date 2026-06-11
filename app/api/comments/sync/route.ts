import { NextRequest, NextResponse } from "next/server"
import { getAuthContext } from "@/lib/auth"
import { createAdminClient } from "@/lib/supabase/admin"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

const GRAPH = "https://graph.facebook.com/v25.0"
const GEMINI_API = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent"

async function batchSentiment(messages: string[], apiKey: string): Promise<Array<{ sentiment: string; score: number; themes: string[] }>> {
  if (!messages.length) return []
  const numbered = messages.map((m, i) => `${i + 1}. "${m.replace(/"/g, "'").slice(0, 200)}"`).join("\n")
  const prompt = `Analyze the sentiment of these Facebook ad comments. Return a JSON array (same length, same order).
Each element: {"sentiment":"positive"|"neutral"|"negative","score":-1.0 to 1.0,"themes":["theme1"]}

Comments:
${numbered}

Return ONLY a JSON array, no markdown.`

  try {
    const res = await fetch(`${GEMINI_API}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 2000 },
      }),
    })
    const data = await res.json()
    const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text || "[]"
    const cleaned = raw.replace(/```json?\n?/g, "").replace(/```/g, "").trim()
    const parsed = JSON.parse(cleaned)
    if (Array.isArray(parsed)) return parsed
  } catch {}
  return messages.map(() => ({ sentiment: "neutral", score: 0, themes: [] }))
}

async function runAutomations(
  orgId: string,
  newComments: any[],
  token: string,
  supabase: any,
  apiKey: string | undefined
) {
  if (!newComments.length) return
  const { data: automations } = await supabase
    .from("comment_automations")
    .select("*")
    .eq("org_id", orgId)
    .eq("is_active", true)

  if (!automations?.length) return

  for (const comment of newComments) {
    for (const auto of automations) {
      let matched = false

      if (auto.trigger_type === "sentiment_positive"  && comment.sentiment === "positive")  matched = true
      if (auto.trigger_type === "sentiment_negative"  && comment.sentiment === "negative")  matched = true
      if (auto.trigger_type === "sentiment_neutral"   && comment.sentiment === "neutral")   matched = true
      if (auto.trigger_type === "question"            && comment.message.includes("?"))      matched = true
      if (auto.trigger_type === "keyword" && auto.trigger_value) {
        const keywords = auto.trigger_value.split(",").map((k: string) => k.trim().toLowerCase())
        matched = keywords.some((k: string) => comment.message.toLowerCase().includes(k))
      }

      if (!matched) continue

      let actionResult = ""
      let status: "success" | "failed" | "skipped" = "success"

      try {
        if (auto.action_type === "hide") {
          await fetch(`${GRAPH}/${comment.fb_comment_id}?is_hidden=true&access_token=${token}`, { method: "POST" })
          await supabase.from("comments").update({ is_hidden: true }).eq("id", comment.id)
          actionResult = "Hidden"
        } else if ((auto.action_type === "ai_reply" || auto.action_type === "draft_reply") && apiKey) {
          const replyPrompt = `You are a helpful social media manager. Write a short, friendly ${auto.action_type === "ai_reply" ? "reply" : "draft reply"} to this comment on a Facebook ad: "${comment.message}". Keep it under 100 words, professional but warm. Return only the reply text.`
          const geminiRes = await fetch(`${GEMINI_API}?key=${apiKey}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: replyPrompt }] }],
              generationConfig: { temperature: 0.6, maxOutputTokens: 150 },
            }),
          })
          const geminiData = await geminiRes.json()
          const reply = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || ""
          if (reply) {
            if (auto.action_type === "ai_reply") {
              await fetch(`${GRAPH}/${comment.fb_comment_id}/comments`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: reply, access_token: token }),
              })
              await supabase.from("comments").update({ is_replied: true, draft_reply: reply }).eq("id", comment.id)
              actionResult = `Replied: ${reply.slice(0, 80)}...`
            } else {
              await supabase.from("comments").update({ draft_reply: reply }).eq("id", comment.id)
              actionResult = `Draft saved: ${reply.slice(0, 80)}...`
            }
          }
        } else if (auto.action_type === "custom_reply" && auto.action_value) {
          await fetch(`${GRAPH}/${comment.fb_comment_id}/comments`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: auto.action_value, access_token: token }),
          })
          await supabase.from("comments").update({ is_replied: true }).eq("id", comment.id)
          actionResult = `Custom reply sent`
        } else {
          status = "skipped"
        }
      } catch (e: any) {
        status = "failed"
        actionResult = e.message
      }

      await supabase.from("automation_runs").insert({
        org_id: orgId,
        automation_id: auto.id,
        comment_id: comment.id,
        automation_name: auto.name,
        trigger_matched: auto.trigger_type,
        action_taken: auto.action_type,
        result: actionResult,
        status,
      })
      await supabase.from("comment_automations").update({ run_count: (auto.run_count || 0) + 1 }).eq("id", auto.id)
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { page_id } = await request.json()
    if (!page_id) return NextResponse.json({ error: "page_id required" }, { status: 400 })

    // Reject mock/demo page IDs early
    if (/^p-\d+$/.test(page_id)) {
      return NextResponse.json({
        error: "Cannot sync a demo page. Please select a real Facebook Page from the page picker.",
        isMockPage: true,
      }, { status: 400 })
    }

    const supabase = createAdminClient()
    let token: string | null = null
    let pageName: string | undefined

    // Try to get page-specific access token from pages table
    const { data: page } = await supabase
      .from("pages")
      .select("fb_page_id, name, page_access_token")
      .eq("org_id", ctx.orgId)
      .eq("fb_page_id", page_id)
      .maybeSingle()

    if (page?.page_access_token) {
      token = page.page_access_token
      pageName = page.name
    } else {
      // Fallback: use the org's Facebook connection user token.
      // This works for pages where the user has admin access.
      const { getFacebookConnection } = await import("@/lib/auth")
      const connection = await getFacebookConnection(ctx.orgId)
      if (!connection?.access_token) {
        return NextResponse.json({
          error: "No Facebook access token found. Please reconnect your Facebook account at /connect.",
        }, { status: 400 })
      }
      token = connection.access_token
    }

    const apiKey  = process.env.GEMINI_API_KEY
    const fields  = "id,message,story,created_time,comments{id,message,from,created_time,can_hide,is_hidden,like_count,comment_count}"

    const feedRes = await fetch(
      `${GRAPH}/${page_id}/posts?fields=${fields}&limit=10&access_token=${token}`
    )
    const feedData = await feedRes.json()
    if (feedData.error) return NextResponse.json({ error: feedData.error.message }, { status: 400 })

    const posts: any[] = feedData.data || []

    // Collect all raw comments
    const rawComments: any[] = []
    for (const post of posts) {
      const postMessage = (post.message || post.story || "").slice(0, 100)
      for (const c of post.comments?.data || []) {
        rawComments.push({
          fb_comment_id:   c.id,
          fb_post_id:      post.id,
          fb_post_message: postMessage,
          page_id:         page_id,
          page_name:       pageName ?? null,
          message:         c.message || "",
          from_name:       c.from?.name || "Unknown",
          from_id:         c.from?.id || "",
          like_count:      c.like_count || 0,
          comment_count:   c.comment_count || 0,
          is_hidden:       c.is_hidden || false,
          fb_created_time: c.created_time,
        })
      }
    }

    // Find which are new (not in DB yet)
    const fbIds = rawComments.map(c => c.fb_comment_id)
    const { data: existing } = await supabase
      .from("comments")
      .select("fb_comment_id")
      .eq("org_id", ctx.orgId)
      .in("fb_comment_id", fbIds.length ? fbIds : ["__none__"])

    const existingIds = new Set((existing || []).map((e: any) => e.fb_comment_id))
    const newRaw = rawComments.filter(c => !existingIds.has(c.fb_comment_id))

    if (!newRaw.length) return NextResponse.json({ new_count: 0, total_fetched: rawComments.length })

    // Batch sentiment analysis
    const sentiments = apiKey
      ? await batchSentiment(newRaw.map(c => c.message), apiKey)
      : newRaw.map(() => ({ sentiment: "neutral", score: 0, themes: [] as string[] }))

    const toInsert = newRaw.map((c, i) => ({
      org_id:          ctx.orgId,
      ...c,
      sentiment:       sentiments[i]?.sentiment || "neutral",
      sentiment_score: sentiments[i]?.score     || 0,
      themes:          sentiments[i]?.themes    || [],
    }))

    const { data: inserted, error: insertErr } = await supabase
      .from("comments")
      .insert(toInsert)
      .select()

    if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 })

    // Run automations on new comments
    if (inserted?.length) {
      await runAutomations(ctx.orgId, inserted, token, supabase, apiKey)
    }

    return NextResponse.json({ new_count: inserted?.length || 0, total_fetched: rawComments.length })
  } catch (err: any) {
    console.error("[comments/sync]", err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
