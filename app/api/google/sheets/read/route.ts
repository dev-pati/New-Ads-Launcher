import { NextRequest, NextResponse } from "next/server"
import { getAuthContext } from "@/lib/auth"
import { saReadSheet } from "@/lib/google-sheets-sa"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

// GET /api/google/sheets/read?spreadsheet_id=xxx&sheet_name=Sheet1
// Returns headers + rows using Google Sheets Service Account (no OAuth needed)
export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { searchParams } = request.nextUrl
    const spreadsheetId = searchParams.get("spreadsheet_id")
    const sheetName     = searchParams.get("sheet_name") ?? "Sheet1"

    if (!spreadsheetId) {
      return NextResponse.json({ error: "Missing spreadsheet_id" }, { status: 400 })
    }

    if (!process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
      return NextResponse.json({ error: "Google Sheets service account not configured" }, { status: 503 })
    }

    const { headers, rows } = await saReadSheet(spreadsheetId, sheetName)
    return NextResponse.json({ headers, rows, total: rows.length })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
