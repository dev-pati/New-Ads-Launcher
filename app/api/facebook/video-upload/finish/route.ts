import { NextRequest, NextResponse } from "next/server"

export async function POST(_request: NextRequest) {
  return NextResponse.json({ error: "Chunked video upload is deprecated. Use direct storage upload instead." }, { status: 410 })
}
