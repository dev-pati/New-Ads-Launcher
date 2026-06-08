import { NextRequest, NextResponse } from "next/server"
import { getAuthContext } from "@/lib/auth"

export async function POST(req: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { accessToken, spreadsheetId } = await req.json()
    if (!accessToken || !spreadsheetId) {
      return NextResponse.json({ error: "Missing accessToken or spreadsheetId" }, { status: 400 })
    }

    const metaRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=properties.title,sheets.properties.title`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )
    if (!metaRes.ok) {
      const err = await metaRes.json().catch(() => ({}))
      return NextResponse.json(
        { error: (err as any).error?.message || "Failed to fetch spreadsheet" },
        { status: metaRes.status }
      )
    }
    const meta = await metaRes.json()
    const sheetTitle: string = meta.sheets?.[0]?.properties?.title || "Sheet1"
    const spreadsheetTitle: string = meta.properties?.title || "Untitled"

    const valRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetTitle)}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )
    if (!valRes.ok) {
      const err = await valRes.json().catch(() => ({}))
      return NextResponse.json(
        { error: (err as any).error?.message || "Failed to read sheet data" },
        { status: valRes.status }
      )
    }
    const data = await valRes.json()
    const values: string[][] = data.values || []

    if (values.length === 0) {
      return NextResponse.json({ headers: [], rows: [], sheetTitle, spreadsheetTitle })
    }

    const headers = values[0].map((h) => String(h ?? "").trim())
    const rows = values.slice(1).filter((r) => r.some((c) => String(c ?? "").trim()))

    return NextResponse.json({ headers, rows, sheetTitle, spreadsheetTitle })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 })
  }
}
