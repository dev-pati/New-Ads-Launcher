import { NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(_request: NextRequest) {
  return NextResponse.json(
    { error: "hub_managed", hub: "https://ai.patigroup.com" },
    { status: 405 }
  )
}
