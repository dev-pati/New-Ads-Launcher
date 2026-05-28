import { NextRequest, NextResponse } from "next/server"
import { getAuthContext } from "@/lib/auth"
import { saReadCell } from "@/lib/google-sheets-sa"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

// GET /api/google/sheets/test?spreadsheet_id=xxx&sheet_name=Sheet1&cell=C5
// Reads a single cell value using the Google Sheets Service Account
export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { searchParams } = request.nextUrl
    const spreadsheetId = searchParams.get("spreadsheet_id")
    const sheetName     = searchParams.get("sheet_name") ?? "Sheet1"
    const cell          = searchParams.get("cell") ?? "A1"

    if (!spreadsheetId) {
      return NextResponse.json({ error: "Missing spreadsheet_id" }, { status: 400 })
    }

    if (!process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
      return NextResponse.json({ error: "Google Sheets service account not configured" }, { status: 503 })
    }

    const value = await saReadCell(spreadsheetId, sheetName, cell)
    return NextResponse.json({ value, range: `${sheetName}!${cell}` })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
