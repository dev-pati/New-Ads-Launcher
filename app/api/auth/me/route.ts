import { NextResponse } from "next/server"
import { getSessionAccount } from "@/lib/custom-auth"

export async function GET() {
  const user = await getSessionAccount()
  if (!user) return NextResponse.json({ user: null }, { status: 401 })
  return NextResponse.json({ user })
}
