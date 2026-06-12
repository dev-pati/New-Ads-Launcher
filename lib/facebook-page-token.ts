import { getFacebookConnection } from "@/lib/auth"
import { getFacebookPages } from "@/lib/facebook"

export type ResolvedPageAccessToken = {
  token: string
  pageName?: string | null
}

export async function resolveOrgPageAccessToken(
  supabase: any,
  orgId: string,
  userId: string,
  pageId: string
): Promise<ResolvedPageAccessToken | null> {
  const connection = await getFacebookConnection(orgId)

  if (connection?.access_token) {
    try {
      const pages = await getFacebookPages(connection.access_token)
      const metaPage = pages.find(page => page.id === pageId)

      if (metaPage?.access_token) {
        await supabase.from("pages").upsert(
          {
            org_id: orgId,
            user_id: userId,
            fb_page_id: metaPage.id,
            name: metaPage.name,
            category: metaPage.category,
            picture_url: metaPage.picture?.data?.url,
            page_access_token: metaPage.access_token,
            is_active: true,
          },
          { onConflict: "org_id,fb_page_id" }
        )

        return { token: metaPage.access_token, pageName: metaPage.name }
      }
    } catch (err) {
      console.warn("[page-token] unable to refresh page token from Meta", err)
    }
  }

  const { data: page } = await supabase
    .from("pages")
    .select("name, page_access_token")
    .eq("org_id", orgId)
    .eq("fb_page_id", pageId)
    .maybeSingle()

  if (!page?.page_access_token) return null
  return { token: page.page_access_token, pageName: page.name }
}
