import { NextRequest, NextResponse } from "next/server"
import { getAuthContext, getFacebookConnection } from "@/lib/auth"
import { getProductSets, getCatalogProducts } from "@/lib/facebook"
import { getCachedFacebookMetadata } from "../_cache"

const PRODUCT_SETS_TTL_MS = 10 * 60 * 1000 // 10 min — product sets change infrequently

export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const catalogId = request.nextUrl.searchParams.get("catalog_id")
    if (!catalogId) return NextResponse.json({ error: "catalog_id required" }, { status: 400 })

    const connection = await getFacebookConnection(ctx.orgId)
    if (!connection) return NextResponse.json({ error: "No Facebook connection" }, { status: 400 })

    const cacheKey = `fb:product-sets:${ctx.orgId}:${catalogId}`

    const result = await getCachedFacebookMetadata(
      cacheKey,
      PRODUCT_SETS_TTL_MS,
      async () => {
        const [productSets, products] = await Promise.all([
          getProductSets(catalogId, connection.access_token),
          getCatalogProducts(catalogId, connection.access_token, 6),
        ])
        return { productSets, products }
      }
    )

    return NextResponse.json(result)
  } catch (err: any) {
    console.error("[product-sets] error:", err)
    return NextResponse.json({ error: err.message || "Failed to fetch product sets" }, { status: 500 })
  }
}
