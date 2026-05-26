import { NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "adlauncher",
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV || "development",
  })
}
