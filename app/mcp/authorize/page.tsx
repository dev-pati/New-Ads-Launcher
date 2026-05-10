"use client"

import { useEffect, useState, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import {
  IconBolt,
  IconLoader2,
  IconAlertCircle,
  IconShield,
  IconEye,
  IconEdit,
} from "@tabler/icons-react"

function AuthorizeContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [authorizing, setAuthorizing] = useState(false)
  const [error, setError] = useState("")

  const clientId = searchParams.get("client_id") || ""
  const redirectUri = searchParams.get("redirect_uri") || ""
  const codeChallenge = searchParams.get("code_challenge") || ""
  const codeChallengeMethod = searchParams.get("code_challenge_method") || "S256"
  const state = searchParams.get("state") || ""
  const scope = searchParams.get("scope") || "ads:read ads:write"
  const responseType = searchParams.get("response_type") || "code"

  const redirectHost = (() => {
    try { return new URL(redirectUri).hostname } catch { return redirectUri }
  })()

  useEffect(() => {
    async function checkAuth() {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        const returnUrl = encodeURIComponent(window.location.href)
        router.push(`/auth/login?redirect=${returnUrl}`)
        return
      }
      setUser(session.user)
      setLoading(false)
    }
    checkAuth()
  }, [router])

  function deny() {
    if (!redirectUri) return
    try {
      const url = new URL(redirectUri)
      url.searchParams.set("error", "access_denied")
      if (state) url.searchParams.set("state", state)
      window.location.href = url.toString()
    } catch {
      router.back()
    }
  }

  async function authorize() {
    setAuthorizing(true)
    setError("")
    try {
      const res = await fetch("/api/mcp/oauth/authorize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: clientId,
          redirect_uri: redirectUri,
          code_challenge: codeChallenge,
          code_challenge_method: codeChallengeMethod,
          scope,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error_description || data.error || "Authorization failed")
        return
      }
      const url = new URL(redirectUri)
      url.searchParams.set("code", data.code)
      if (state) url.searchParams.set("state", state)
      window.location.href = url.toString()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setAuthorizing(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <IconLoader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!clientId || !redirectUri || !codeChallenge || responseType !== "code") {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <div className="text-center max-w-sm">
          <IconAlertCircle className="size-12 text-destructive mx-auto mb-4" />
          <h1 className="text-xl font-semibold mb-2">Invalid Request</h1>
          <p className="text-muted-foreground text-sm">Missing required OAuth parameters. This link may be invalid or expired.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="size-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
            <IconBolt className="size-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">AdLauncher</h1>
          <p className="text-muted-foreground text-sm mt-1">MCP Server Authorization</p>
        </div>

        <div className="border rounded-2xl overflow-hidden shadow-sm bg-card">
          {/* Header */}
          <div className="p-6 border-b bg-muted/20">
            <div className="flex items-start gap-3">
              <div className="size-10 rounded-xl bg-background border flex items-center justify-center shrink-0">
                <IconShield className="size-5 text-primary" />
              </div>
              <div>
                <h2 className="font-semibold">Authorize Access</h2>
                <p className="text-sm text-muted-foreground mt-0.5">
                  <strong className="text-foreground font-medium">{redirectHost}</strong> wants to connect to your AdLauncher workspace
                </p>
              </div>
            </div>
          </div>

          {/* Permissions */}
          <div className="p-6 space-y-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">This will allow</p>
              <div className="space-y-2.5">
                <div className="flex items-center gap-3 text-sm">
                  <div className="size-7 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                    <IconEye className="size-3.5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <span>Read ad accounts, campaigns, ad sets & performance metrics</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <div className="size-7 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                    <IconEye className="size-3.5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <span>Browse media library and automation rules</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <div className="size-7 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                    <IconEdit className="size-3.5 text-amber-600 dark:text-amber-400" />
                  </div>
                  <span>Pause / resume campaigns and adjust budgets</span>
                </div>
              </div>
            </div>

            <div className="rounded-lg border bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
              Authorizing as: <strong className="text-foreground">{user?.email}</strong>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg p-3">
                <IconAlertCircle className="size-4 shrink-0" />
                {error}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="p-6 pt-0 flex gap-3">
            <Button variant="outline" className="flex-1" onClick={deny} disabled={authorizing}>
              Deny
            </Button>
            <Button className="flex-1" onClick={authorize} disabled={authorizing}>
              {authorizing && <IconLoader2 className="size-4 animate-spin mr-2" />}
              Authorize
            </Button>
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-4">
          You'll be redirected to <strong>{redirectHost}</strong> after authorizing.
        </p>
      </div>
    </div>
  )
}

export default function AuthorizePage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <IconLoader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <AuthorizeContent />
    </Suspense>
  )
}
