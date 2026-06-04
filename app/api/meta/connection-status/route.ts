/**
 * GET /api/meta/connection-status
 * Checks if the Facebook connection is valid and returns the status.
 */
import { NextResponse }                          from "next/server"
import { getAuthContext, getFacebookConnection } from "@/lib/auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const GRAPH = "https://graph.facebook.com/v25.0"

const ERROR_MESSAGES: Record<number, string> = {
  190:  "Token hết hạn hoặc bị thu hồi — cần đăng nhập lại Facebook",
  200:  "Không đủ quyền truy cập",
  294:  "Thiếu quyền manage_pages",
  368:  "Tài khoản Facebook bị hạn chế hoặc bị khóa",
  100:  "Tham số không hợp lệ",
  4:    "Đạt giới hạn gọi API — thử lại sau",
  17:   "Đạt giới hạn gọi API — thử lại sau",
  341:  "Đạt giới hạn quảng cáo",
  2500: "Lỗi xác thực — cần đăng nhập lại Facebook",
}

export async function GET() {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const connection = await getFacebookConnection(ctx.orgId)
    if (!connection) {
      return NextResponse.json({
        connected: false,
        status: "disconnected",
        message: "Chưa kết nối tài khoản Facebook",
        accountName: null,
      })
    }

    // Ping Meta API to check token validity
    const res  = await fetch(
      `${GRAPH}/me?fields=id,name&access_token=${encodeURIComponent(connection.access_token)}`,
      { cache: "no-store" }
    )
    const data = await res.json()

    if (data.error) {
      const code    = data.error.code as number
      const subcode = data.error.error_subcode as number
      const message = ERROR_MESSAGES[code] ?? ERROR_MESSAGES[subcode]
        ?? data.error.message
        ?? "Tài khoản Facebook gặp sự cố"

      // Classify severity
      const isBlocked  = [368, 190, 2500].includes(code)
      const isExpired  = code === 190
      const isRestricted = code === 368

      return NextResponse.json({
        connected:   false,
        status:      isBlocked ? "blocked" : isExpired ? "expired" : "error",
        message,
        accountName: connection.fb_user_name ?? null,
        errorCode:   code,
        isBlocked,
        isExpired,
        isRestricted,
      })
    }

    return NextResponse.json({
      connected:   true,
      status:      "ok",
      message:     null,
      accountName: data.name ?? connection.fb_user_name ?? null,
    })
  } catch (err: any) {
    return NextResponse.json({
      connected:   false,
      status:      "error",
      message:     "Không thể kiểm tra kết nối Facebook",
      accountName: null,
    })
  }
}
