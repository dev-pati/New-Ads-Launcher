import { google } from "googleapis"

function getAuth() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
  if (!raw) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is not configured")

  let credentials: object
  try {
    credentials = JSON.parse(raw)
  } catch {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON")
  }

  return new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  })
}

export async function saReadRange(spreadsheetId: string, range: string): Promise<string[][]> {
  const sheets = google.sheets({ version: "v4", auth: getAuth() })
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range })
  return (res.data.values as string[][] | null) ?? []
}

export async function saReadCell(spreadsheetId: string, sheetName: string, cell: string): Promise<string> {
  const values = await saReadRange(spreadsheetId, `${sheetName}!${cell}`)
  return values?.[0]?.[0] ?? ""
}

export async function saReadSheet(
  spreadsheetId: string,
  sheetName: string
): Promise<{ headers: string[]; rows: string[][] }> {
  const values = await saReadRange(spreadsheetId, sheetName)
  if (!values.length) return { headers: [], rows: [] }
  const headers = values[0].map(h => String(h ?? "").trim())
  const rows    = values.slice(1).filter(r => r.some(c => String(c ?? "").trim()))
  return { headers, rows }
}

export function sheetsServiceAccountEmail(): string {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
  if (!raw) return ""
  try {
    const parsed = JSON.parse(raw) as { client_email?: string }
    return parsed.client_email ?? ""
  } catch {
    return ""
  }
}
