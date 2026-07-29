import { NextResponse } from "next/server"
import { createSession, verifyOtp } from "@/lib/custom-auth"

export async function POST(request: Request) {
  try {
    const { email, otp } = await request.json()
    if (!email || !otp) {
      return NextResponse.json({ error: "Email and OTP are required" }, { status: 400 })
    }

    const account = await verifyOtp(email, otp)
    if (!account) {
      return NextResponse.json({ error: "Invalid or expired code" }, { status: 401 })
    }

    await createSession(account)
    return NextResponse.json({ user: account })
  } catch (err: any) {
    // SEC-011: lockout signal from the rate limiter
    if (err?.message?.includes("locked")) {
      return NextResponse.json({ error: err.message }, { status: 429 })
    }
    console.error("[verify-otp] unexpected error:", err)
    return NextResponse.json({ error: err?.message || "Verification failed" }, { status: 500 })
  }
}
