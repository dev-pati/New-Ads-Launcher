import { NextRequest, NextResponse } from "next/server"
import { GoogleGenerativeAI } from "@google/generative-ai"
import { getAuthContext, getFacebookConnection } from "@/lib/auth"
import { getGeminiApiKey } from "@/lib/get-ai-key"
import { getDarkPostAds } from "@/lib/facebook"
import { resolveOrgPageAccessToken } from "@/lib/facebook-page-token"
import { normalizeMetaError } from "@/lib/meta-error"
import { createAdminClient } from "@/lib/supabase/admin"
import { adAccountBelongsToOrg } from "@/app/api/facebook/_utils"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

const GRAPH = "https://graph.facebook.com/v25.0"
const GEMINI_API = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent"
const MAX_POSTS_TO_SCAN = 25
const MAX_COMMENTS_PER_POST = 100
const MAX_ADS_TO_SCAN = 100

async function fetchMetaJson(url: string, fallback: string, context: { pageId: string; permission: string }) {
  const res = await fetch(url)
  const data = await res.json().catch(() => ({}))
  if (!res.ok || data.error) {
    throw normalizeMetaError(data, fallback, context)
  }
  return data
}

async function batchSentiment(messages: string[], apiKey: string): Promise<Array<{ sentiment: string; score: number; themes: string[] }>> {
  if (!messages.length) return []
  const numbered = messages.map((m, i) => `${i + 1}. "${m.replace(/"/g, "'").slice(0, 200)}"`).join("\n")
  const prompt = `Analyze the sentiment of these Facebook ad comments. Return a JSON array (same length, same order).
Each element: {"sentiment":"positive"|"neutral"|"negative","score":-1.0 to 1.0,"themes":["theme1"]}

Comments:
${numbered}

Return ONLY a JSON array, no markdown.`

  try {
    const genAI = new GoogleGenerativeAI(apiKey)
    const gModel = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      generationConfig: { temperature: 0.1, maxOutputTokens: 2000, responseMimeType: "application/json" },
    })
    const result = await gModel.generateContent(prompt)
    const raw = result.response.text() || "[]"
    const parsed = JSON.parse(raw)
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

    const { page_id, ad_account_id } = await request.json()
    if (!page_id) return NextResponse.json({ error: "page_id required" }, { status: 400 })

    // Reject mock/demo page IDs early
    if (/^p-\d+$/.test(page_id)) {
      return NextResponse.json({
        error: "Cannot sync a demo page. Please select a real Facebook Page from the page picker.",
        isMockPage: true,
      }, { status: 400 })
    }

    const supabase = createAdminClient()
    const pageToken = await resolveOrgPageAccessToken(supabase, ctx.orgId, ctx.user.id, page_id)
    if (!pageToken?.token) {
      return NextResponse.json({
        error: "Page token not found. Please reconnect Facebook and select this Page again.",
      }, { status: 400 })
    }

    const accessToken = pageToken.token
    const apiKey  = (await getGeminiApiKey(ctx.orgId)) ?? undefined
    const postFields = "id,message,story,created_time,permalink_url,full_picture,reactions.summary(true),comments.summary(true),shares"
    const commentFields = "id,message,from,created_time,can_hide,is_hidden,like_count,comment_count"

    const postsById = new Map<string, any>()
    try {
      const postsUrl = `${GRAPH}/${page_id}/posts?fields=${encodeURIComponent(postFields)}&limit=${MAX_POSTS_TO_SCAN}&access_token=${encodeURIComponent(accessToken)}`
      const postsData = await fetchMetaJson(postsUrl, "Unable to load Page posts.", {
        pageId: page_id,
        permission: "pages_read_engagement",
      })
      for (const post of Array.isArray(postsData.data) ? postsData.data : []) {
        if (post?.id) postsById.set(post.id, { ...post, source: "page_posts" })
      }
    } catch (err: any) {
      return NextResponse.json(err?.error ? err : normalizeMetaError(err, "Unable to load Page posts.", {
        pageId: page_id,
        permission: "pages_read_engagement",
      }), { status: 400 })
    }

    let adsScanned = 0
    let adPostsFound = 0
    if (ad_account_id) {
      const connection = await getFacebookConnection(ctx.orgId)
      if (!connection?.access_token) {
        return NextResponse.json({
          error: "Facebook connection not found. Reconnect Facebook to scan ad post comments.",
          needsReconnect: true,
          type: "token",
        }, { status: 400 })
      }

      const allowed = await adAccountBelongsToOrg(ctx.orgId, ad_account_id, connection.access_token)
      if (!allowed) {
        return NextResponse.json({ error: "Ad account is not available for the connected Meta user." }, { status: 403 })
      }

      try {
        const darkAds = await getDarkPostAds(ad_account_id, connection.access_token, { limit: MAX_ADS_TO_SCAN })
        adsScanned = darkAds.ads.length
        for (const ad of darkAds.ads) {
          if (!ad.post_id) continue
          const adPageId = ad.page_id || (ad.post_id.includes("_") ? ad.post_id.split("_")[0] : "")
          if (adPageId && adPageId !== page_id) continue
          postsById.set(ad.post_id, {
            id: ad.post_id,
            message: ad.primaryText || ad.headline || ad.description || ad.name || "",
            story: ad.name || "",
            created_time: ad.date_created || null,
            permalink_url: ad.post_url || null,
            full_picture: ad.thumb_url || (ad as any).thumbnail_url || (ad as any).image_url || null,
            reactions: { summary: { total_count: 0 } },
            comments: { summary: { total_count: 0 } },
            shares: { count: 0 },
            source: "ad_creative",
            ad_id: ad.id,
            ad_name: ad.name,
          })
          adPostsFound++
        }
      } catch (err: any) {
        return NextResponse.json(
          normalizeMetaError(err, "Unable to resolve ad post IDs from the selected ad account.", {
            pageId: page_id,
            permission: "ads_read",
          }),
          { status: 400 }
        )
      }
    }

    const posts = Array.from(postsById.values())

    // Collect all raw comments
    const rawComments: any[] = []
    for (const post of posts) {
      const postMessage = (post.message || post.story || "").slice(0, 100)
      const postReactions = post.reactions?.summary?.total_count ?? 0
      const postComments = post.comments?.summary?.total_count ?? 0
      const postShares = post.shares?.count ?? 0
      let commentsForPost: any[] = []

      try {
        const commentsUrl = `${GRAPH}/${post.id}/comments?fields=${encodeURIComponent(commentFields)}&filter=stream&limit=${MAX_COMMENTS_PER_POST}&access_token=${encodeURIComponent(accessToken)}`
        const commentsData = await fetchMetaJson(commentsUrl, "Unable to load Page post comments.", {
          pageId: page_id,
          permission: "pages_read_engagement",
        })
        commentsForPost = Array.isArray(commentsData.data) ? commentsData.data : []
      } catch (err: any) {
        return NextResponse.json(err?.error ? {
          ...err,
          postId: post.id,
        } : normalizeMetaError(err, "Unable to load Page post comments.", {
          pageId: page_id,
          permission: "pages_read_engagement",
        }), { status: 400 })
      }

      for (const c of commentsForPost) {
        rawComments.push({
          fb_comment_id:   c.id,
          fb_post_id:      post.id,
          fb_post_message: postMessage,
          fb_post_permalink: post.permalink_url || null,
          fb_post_full_picture: post.full_picture || null,
          fb_post_reactions: postReactions,
          fb_post_comments: postComments,
          fb_post_shares: postShares,
          page_id:         page_id,
          page_name:       pageToken.pageName ?? null,
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

    if (!newRaw.length) {
      return NextResponse.json({
        new_count: 0,
        total_fetched: rawComments.length,
        posts_scanned: posts.length,
        ads_scanned: adsScanned,
        ad_posts_found: adPostsFound,
      })
    }

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
      await runAutomations(ctx.orgId, inserted, accessToken, supabase, apiKey)
    }

    return NextResponse.json({
      new_count: inserted?.length || 0,
      total_fetched: rawComments.length,
      posts_scanned: posts.length,
      ads_scanned: adsScanned,
      ad_posts_found: adPostsFound,
    })
  } catch (err: any) {
    console.error("[comments/sync]", err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
