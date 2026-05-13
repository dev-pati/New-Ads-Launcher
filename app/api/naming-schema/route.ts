import { NextRequest, NextResponse } from "next/server"
import { getAuthContext } from "@/lib/auth"
import { createAdminClient } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"

export interface SchemaOption {
  id: string
  value: string
}

export interface SchemaCategory {
  id: string
  name: string
  description: string
  isAI: boolean
  autoDetect: boolean
  options: SchemaOption[]
}

const DEFAULT_CATEGORIES: SchemaCategory[] = [
  {
    id: "style",
    name: "Style",
    description: "Content style (decision hierarchy: Founder > Influencer > Testimonial...)",
    isAI: false,
    autoDetect: false,
    options: [
      { id: "founder", value: "Founder" },
      { id: "influencer", value: "Influencer" },
      { id: "testimonial", value: "Testimonial" },
      { id: "ugc", value: "UGC" },
      { id: "comparison", value: "Comparison" },
      { id: "reviews", value: "Reviews" },
      { id: "socialproof", value: "SocialProof" },
      { id: "question", value: "Question" },
      { id: "product", value: "Product" },
      { id: "informative", value: "Informative" },
      { id: "other", value: "Other" },
    ],
  },
  {
    id: "asset_type",
    name: "AssetType",
    description: "Format of the asset",
    isAI: false,
    autoDetect: false,
    options: [
      { id: "static", value: "Static" },
      { id: "video", value: "Video" },
    ],
  },
  {
    id: "length",
    name: "Length",
    description: "Duration for video content (n/a for images)",
    isAI: false,
    autoDetect: true,
    options: [
      { id: "na", value: "n/a" },
      { id: "under10s", value: "Under10s" },
      { id: "10_20s", value: "10-20s" },
      { id: "20_30s", value: "20-30s" },
      { id: "30_45s", value: "30-45s" },
      { id: "45s_1m", value: "45s-1m" },
      { id: "1m_1m30s", value: "1m-1m30s" },
      { id: "1m30s_plus", value: "1m30s+" },
    ],
  },
  {
    id: "creator_age",
    name: "CreatorAge",
    description: "Estimated age range of primary on-screen person",
    isAI: false,
    autoDetect: false,
    options: [
      { id: "na", value: "n/a" },
      { id: "20_30", value: "20-30" },
      { id: "30_40", value: "30-40" },
      { id: "40_50", value: "40-50" },
      { id: "50_60", value: "50-60" },
      { id: "60_70", value: "60-70" },
      { id: "70_plus", value: "70+" },
      { id: "mixed", value: "Mixed" },
    ],
  },
  {
    id: "hook",
    name: "Hook",
    description: "Short descriptive label for creative concept (PascalCase, e.g., CrashHasCause)",
    isAI: true,
    autoDetect: false,
    options: [],
  },
  {
    id: "dimensions",
    name: "Dimensions",
    description: "Aspect ratio detected from pixel ratio (always last in filename)",
    isAI: false,
    autoDetect: true,
    options: [
      { id: "9x16", value: "9x16" },
      { id: "4x5", value: "4x5" },
      { id: "1x1", value: "1x1" },
      { id: "16x9", value: "16x9" },
      { id: "nonstandard", value: "NonStandard" },
    ],
  },
]

export async function GET() {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const db = createAdminClient()
    const { data, error } = await db
      .from("naming_schemas")
      .select("id, categories, updated_at")
      .eq("org_id", ctx.orgId)
      .single()

    // PGRST116 = no rows found → return default
    if (error && error.code !== "PGRST116") throw error

    return NextResponse.json({
      categories: (data?.categories as SchemaCategory[]) || DEFAULT_CATEGORIES,
      updatedAt: data?.updated_at ?? null,
      isDefault: !data,
    })
  } catch (err: any) {
    console.error("[naming-schema GET]", err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { categories } = await request.json()
    if (!Array.isArray(categories)) {
      return NextResponse.json({ error: "categories must be an array" }, { status: 400 })
    }

    const db = createAdminClient()
    const { data, error } = await db
      .from("naming_schemas")
      .upsert({ org_id: ctx.orgId, categories }, { onConflict: "org_id" })
      .select("id, updated_at")
      .single()

    if (error) throw error

    return NextResponse.json({ ok: true, updatedAt: data.updated_at })
  } catch (err: any) {
    console.error("[naming-schema PUT]", err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
