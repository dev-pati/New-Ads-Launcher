"use client"

import { Suspense, useEffect, useState } from "react"
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

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState("")
  const [otp, setOtp] = useState("")
  const [password, setPassword] = useState("")
  const [step, setStep] = useState<1 | 2>(1)
  const [usePassword, setUsePassword] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const errQuery = searchParams.get("error")
    if (errQuery) {
      setError("Unable to sign in. Please try again.")
    }
  }, [searchParams])

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email }),
    })

    setLoading(false)
    if (!res.ok) {
      const data = await res.json().catch(() => null)
      setError(data?.error || "Unable to send code")
      return
    }
    setStep(2)
  }

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    const res = await fetch("/api/auth/verify-otp", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, otp }),
    })

    if (!res.ok) {
      const data = await res.json().catch(() => null)
      setError(data?.error || "Unable to sign in")
      setLoading(false)
      return
    }

    router.push("/projects")
    router.refresh()
  }

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    })

    if (!res.ok) {
      const data = await res.json().catch(() => null)
      setError(data?.error || "Unable to sign in")
      setLoading(false)
      return
    }

    router.push("/projects")
    router.refresh()
  }

  const switchMode = (mode: "otp" | "password") => {
    setUsePassword(mode === "password")
    setStep(1)
    setError("")
    setOtp("")
    setPassword("")
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex items-center justify-center gap-2">
          <Image src="/applogo.webp" alt="Auto Launch Ads" width={32} height={32} className="bg-white" />
          <h1 className="font-heading text-xl font-semibold">AdLauncher</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>
              {usePassword
                ? "Sign in with password"
                : step === 1 ? "Login" : "Enter code"}
            </CardTitle>
            <CardDescription>
              {usePassword
                ? "Enter your email and password."
                : step === 1
                  ? "We'll send a login code to your email."
                  : `A 6-digit code was sent to ${email}.`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {usePassword ? (
              <form onSubmit={handlePasswordLogin} className="space-y-4">
                {error && (
                  <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                    {error}
                  </div>
                )}
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
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Signing in..." : "Sign in"}
                </Button>
                <button
                  type="button"
                  onClick={() => switchMode("otp")}
                  className="w-full text-xs text-muted-foreground underline-offset-4 hover:underline"
                >
                  Use a login code instead
                </button>
              </form>
            ) : (
              <form onSubmit={step === 1 ? handleSendOtp : handleVerifyOtp} className="space-y-4">
                {error && (
                  <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                    {error}
                  </div>
                )}
                {step === 1 ? (
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
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor="otp">Login code</Label>
                    <Input
                      id="otp"
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      placeholder="123456"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      required
                      minLength={6}
                      maxLength={6}
                    />
                    <button
                      type="button"
                      onClick={() => { setStep(1); setError(""); setOtp("") }}
                      className="text-xs text-muted-foreground underline-offset-4 hover:underline"
                    >
                      Use a different email
                    </button>
                  </div>
                )}
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading
                    ? step === 1 ? "Sending code..." : "Verifying..."
                    : step === 1 ? "Send code" : "Sign in"}
                </Button>
              </form>
            )}

            {!usePassword && (
              <>
                <div className="mt-4 flex items-center gap-3">
                  <div className="h-px flex-1 bg-border" />
                  <span className="text-xs text-muted-foreground">or</span>
                  <div className="h-px flex-1 bg-border" />
                </div>
                <a
                  href="/api/auth/lark"
                  className="mt-3 flex w-full items-center justify-center gap-2.5 rounded-md border border-border bg-background py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                >
                  <svg width="18" height="18" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M24 4C12.954 4 4 12.954 4 24s8.954 20 20 20 20-8.954 20-20S35.046 4 24 4z" fill="#00D6B2"/>
                    <path d="M15 24l6 6 12-12" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Sign in with Lark
                </a>
                <button
                  type="button"
                  onClick={() => switchMode("password")}
                  className="mt-2 w-full text-sm text-muted-foreground underline-offset-4 hover:underline"
                >
                  Sign in with password
                </button>
              </>
            )}

            <p className="mt-4 text-center text-sm text-muted-foreground">
              Don&apos;t have an account?{" "}
              <Link
                href="/auth/register"
                className="text-primary underline-offset-4 hover:underline"
              >
                Register
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
