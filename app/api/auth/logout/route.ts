import { NextResponse } from "next/server"
import { clearSession } from "@/lib/custom-auth"

export async function POST() {
  await clearSession()
  return NextResponse.json({ ok: true })
}
