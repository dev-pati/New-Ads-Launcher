import { NextResponse } from "next/server"
import { createSession, verifyPassword } from "@/lib/custom-auth"

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json()
    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 })
    }

    const account = await verifyPassword(email, password)
    if (!account) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 })
    }

    await createSession(account)
    return NextResponse.json({ user: account })
  } catch (err: any) {
    console.error("[login] unexpected error:", err)
    return NextResponse.json({ error: err?.message || "Login failed" }, { status: 500 })
  }
}
