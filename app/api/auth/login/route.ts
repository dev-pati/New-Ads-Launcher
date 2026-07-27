import { NextResponse } from "next/server"
import { createSession, generateAndSendOtp, verifyPassword } from "@/lib/custom-auth"

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json()
    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 })
    }

    // Password login (Meta App Review path — no email access required)
    if (password) {
      const account = await verifyPassword(email, password)
      if (!account) {
        return NextResponse.json({ error: "Invalid email or password" }, { status: 401 })
      }
      await createSession(account)
      return NextResponse.json({ user: account })
    }

    // Default path: send OTP
    const result = await generateAndSendOtp(email)
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status ?? 500 })
    }

    return NextResponse.json({ message: "OTP sent" })
  } catch (err: any) {
    console.error("[login] unexpected error:", err)
    return NextResponse.json({ error: err?.message || "Login failed" }, { status: 500 })
  }
}
