import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { hashPassword } from "@/lib/custom-auth"

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

export async function POST(request: Request) {
  try {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json({ error: "Sign up is disabled in production." }, { status: 403 })
    }

    const { email, fullName, password } = await request.json()
    if (!email || !fullName) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const db = createAdminClient()
    const normalizedEmail = String(email).trim().toLowerCase()


    const { data: existing } = await db
      .from("accounts")
      .select("id")
      .eq("email", normalizedEmail)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ error: "Email is already registered" }, { status: 409 })
    }

    const encrypted_password = password ? await hashPassword(password) : null

    const { data: account, error: accountError } = await db
      .from("accounts")
      .insert({
        email: normalizedEmail,
        encrypted_password,
        full_name: fullName,
        raw_user_meta_data: { full_name: fullName },
        email_confirmed_at: new Date().toISOString(),
      })
      .select("id,email,full_name,avatar_url")
      .single()

    if (accountError) {
      console.error("[register] accounts insert error:", accountError)
      return NextResponse.json({ error: accountError.message }, { status: 500 })
    }

    const orgName = `${fullName}'s Workspace`
    const baseSlug = slugify(orgName) || "workspace"
    const slug = `${baseSlug}-${account.id.slice(0, 8)}`

    const { data: org, error: orgError } = await db
      .from("organizations")
      .insert({ name: orgName, slug, created_by: account.id })
      .select("id")
      .single()

    if (orgError) {
      console.error("[register] organizations insert error:", orgError)
      return NextResponse.json({ error: orgError.message }, { status: 500 })
    }

    await db.from("profiles").insert({
      id: account.id,
      full_name: fullName,
      avatar_url: account.avatar_url,
    })

    await db.from("org_members").insert({
      org_id: org.id,
      user_id: account.id,
      role: "admin",
    })

    return NextResponse.json({ user: account })
  } catch (err: unknown) {
    console.error("[register] unexpected error:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 },
    )
  }
}
