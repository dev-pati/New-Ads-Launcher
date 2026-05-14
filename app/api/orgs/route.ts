import { NextRequest, NextResponse } from "next/server"
import { getAuthUser } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

// List user's organizations
export async function GET() {
  try {
    const user = await getAuthUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const supabase = createAdminClient()
    const { data } = await supabase
      .from("org_members")
      .select("role, org:organizations(id, name, slug, created_at)")
      .eq("user_id", user.id)

    const orgs = (data || []).map((m: any) => ({
      ...m.org,
      role: m.role,
    }))

    return NextResponse.json({ orgs })
  } catch (err) {
    console.error("Failed to fetch orgs:", err)
    return NextResponse.json({ error: "Failed to fetch organizations" }, { status: 500 })
  }
}

// Create a new organization
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { name } = await request.json()
    if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 })

    const supabase = createAdminClient()
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + "-" + Date.now()

    const { data: org, error: orgError } = await supabase
      .from("organizations")
      .insert({ name, slug, created_by: user.id })
      .select()
      .single()

    if (orgError) {
      console.error("Failed to create org:", orgError)
      return NextResponse.json({ error: "Failed to create organization" }, { status: 500 })
    }

    // Add creator as admin
    await supabase.from("org_members").insert({
      org_id: org.id,
      user_id: user.id,
      role: "admin",
    })

    return NextResponse.json({ org }, { status: 201 })
  } catch (err) {
    console.error("Failed to create org:", err)
    return NextResponse.json({ error: "Failed to create organization" }, { status: 500 })
  }
}
