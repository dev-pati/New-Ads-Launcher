"use client"

import { Suspense, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import Image from "next/image"

function RegisterForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const inviteToken = searchParams.get("invite_token")

  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const signupEnabled = process.env.NODE_ENV !== "production"
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, fullName, password: password || undefined }),
    })

    if (!res.ok) {
      const data = await res.json().catch(() => null)
      setError(data?.error || "Unable to create account")
      setLoading(false)
      return
    }

    const params = new URLSearchParams({
      registered: "1",
      email: email.trim().toLowerCase(),
    })
    if (inviteToken) params.set("redirect", `/invite?token=${inviteToken}`)
    router.push(`/auth/login?${params.toString()}`)
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex items-center justify-center gap-2">
          <Image src="/icon.png" alt="Auto Launch Ads" width={32} height={32} className="bg-white" />
          <h1 className="font-heading text-xl font-semibold">AdLauncher</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{signupEnabled ? "Create an account" : "Sign up is disabled"}</CardTitle>
            <CardDescription>
              {signupEnabled
                ? "Create your account, then verify your email to sign in."
                : "Registration is restricted to authorized company members."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {signupEnabled ? (
              <form onSubmit={handleRegister} className="space-y-4">
                {error && (
                  <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                    {error}
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name</Label>
                  <Input
                    id="fullName"
                    type="text"
                    placeholder="Your name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password (Optional)</Label>
                    <span className="text-xs text-muted-foreground">For Meta App Review</span>
                  </div>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    minLength={6}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Creating account..." : "Create account"}
                </Button>
              </form>
            ) : (
              <div className="py-4 text-center">
                <Button asChild className="w-full">
                  <Link href="/auth/login">Go to Login</Link>
                </Button>
              </div>
            )}
            <p className="mt-4 text-center text-sm text-muted-foreground">
              {signupEnabled ? "Already have an account? " : null}
              {signupEnabled && (
                <Link
                  href={inviteToken ? `/auth/login?redirect=${encodeURIComponent(`/invite?token=${inviteToken}`)}` : "/auth/login"}
                  className="text-primary underline-offset-4 hover:underline"
                >
                  Sign in
                </Link>
              )}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterForm />
    </Suspense>
  )
}
