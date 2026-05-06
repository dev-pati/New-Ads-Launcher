import { NextRequest, NextResponse } from "next/server"
import { getAuthContext, getFacebookConnection } from "@/lib/auth"
import { getProductSets, getCatalogProducts } from "@/lib/facebook"

export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const catalogId = request.nextUrl.searchParams.get("catalog_id")
    if (!catalogId) return NextResponse.json({ error: "catalog_id required" }, { status: 400 })

    const connection = await getFacebookConnection(ctx.orgId)
    if (!connection) return NextResponse.json({ error: "No Facebook connection" }, { status: 400 })

    const [productSets, products] = await Promise.all([
      getProductSets(catalogId, connection.access_token),
      getCatalogProducts(catalogId, connection.access_token, 6),
    ])
    return NextResponse.json({ productSets, products })
  } catch (err: any) {
    console.error("[product-sets] error:", err)
    return NextResponse.json({ error: err.message || "Failed to fetch product sets" }, { status: 500 })
  }
}
