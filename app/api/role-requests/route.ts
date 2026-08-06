import { NextResponse } from "next/server"
import { getAuthContext } from "@/lib/auth"
import { sendEmail } from "@/lib/send-email"

const REASONS = new Set([
  "Need to edit campaigns",
  "Need to manage integrations or workspace settings",
  "Need to manage team access",
  "Other business need",
])

export async function POST(request: Request) {
  const ctx = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (ctx.role === "admin") return NextResponse.json({ error: "Admins already manage roles" }, { status: 400 })

  const { reason } = await request.json()
  if (!REASONS.has(reason)) return NextResponse.json({ error: "Choose a request reason" }, { status: 400 })

  const { ok, error } = await sendEmail({
    to: "thanhtin@patigroup.com",
    replyTo: ctx.user.email,
    subject: `[AdLauncher] Role request from ${ctx.user.email}`,
    text: `User: ${ctx.user.email}\nCurrent role: ${ctx.role}\nOrganization ID: ${ctx.orgId}\nReason: ${reason}`,
  })

  if (!ok) return NextResponse.json({ error: error || "Failed to send request" }, { status: 502 })
  return NextResponse.json({ success: true })
}