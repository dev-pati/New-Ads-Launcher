import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { createSession, hashPassword } from "@/lib/custom-auth"

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

export async function POST(request: Request) {
  try {
    const { email, password, fullName } = await request.json()
    if (!email || !password || !fullName) {
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

    const { data: account, error: accountError } = await db
      .from("accounts")
      .insert({
        email: normalizedEmail,
        encrypted_password: await hashPassword(password),
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

    await createSession(account)
    return NextResponse.json({ user: account })
  } catch (err: any) {
    console.error("[register] unexpected error:", err)
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 500 })
  }
}
