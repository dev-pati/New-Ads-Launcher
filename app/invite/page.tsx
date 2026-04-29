"use client"

import { useEffect, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { IconLoader2, IconCheck, IconX } from "@tabler/icons-react"

export default function AcceptInvitePage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const token = searchParams.get("token")
  const [status, setStatus] = useState<"loading" | "success" | "error" | "login_required">("loading")
  const [message, setMessage] = useState("")

  useEffect(() => {
    if (!token) {
      setStatus("error")
      setMessage("Invalid invitation link.")
      return
    }

    async function acceptInvite() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        // Not logged in - redirect to register with invite token
        setStatus("login_required")
        return
      }

      try {
        const res = await fetch(`/api/invitations/accept?token=${token}`)
        const data = await res.json()

        if (!res.ok) {
          setStatus("error")
          setMessage(data.error || "Failed to accept invitation")
          return
        }

        setStatus("success")
        setMessage(data.orgName || "Organization")

        if (data.orgId) {
          document.cookie = `active_org_id=${data.orgId}; path=/; max-age=${60 * 60 * 24 * 365}`
        }
      } catch {
        setStatus("error")
        setMessage("Failed to accept invitation")
      }
    }

    acceptInvite()
  }, [token])

  if (status === "loading") {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <IconLoader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (status === "login_required") {
    return (
      <div className="flex min-h-svh items-center justify-center px-4">
        <Card className="w-full max-w-sm">
          <CardHeader className="text-center">
            <CardTitle>Join Organization</CardTitle>
            <CardDescription>
              You need an account to accept this invitation.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button
              className="w-full"
              onClick={() => router.push(`/auth/register?invite_token=${token}`)}
            >
              Create Account
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => router.push(`/auth/login?redirect=/invite?token=${token}`)}
            >
              I already have an account
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex min-h-svh items-center justify-center px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          {status === "success" ? (
            <>
              <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-green-100">
                <IconCheck className="size-6 text-green-600" />
              </div>
              <CardTitle>Welcome!</CardTitle>
              <CardDescription>
                You&apos;ve joined <strong>{message}</strong> successfully.
              </CardDescription>
            </>
          ) : (
            <>
              <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-red-100">
                <IconX className="size-6 text-red-600" />
              </div>
              <CardTitle>Invitation Error</CardTitle>
              <CardDescription>{message}</CardDescription>
            </>
          )}
        </CardHeader>
        <CardContent>
          <Button className="w-full" onClick={() => router.push("/projects")}>
            Go to Dashboard
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
