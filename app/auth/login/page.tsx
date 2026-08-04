"use client"

import { Suspense, useEffect, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  IconArrowLeft,
  IconArrowRight,
  IconCheck,
  IconLock,
  IconMail,
} from "@tabler/icons-react"

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const requestedRedirect = searchParams.get("redirect")
  const redirectTo = requestedRedirect?.startsWith("/") && !requestedRedirect.startsWith("//")
    ? requestedRedirect
    : "/projects"
  const otpRefs = useRef<Array<HTMLInputElement | null>>([])
  const [email, setEmail] = useState(() => searchParams.get("email") || "")
  const [otp, setOtp] = useState("")
  const [password, setPassword] = useState("")
  const [step, setStep] = useState<1 | 2>(1)
  const [usePassword, setUsePassword] = useState(false)
  const [error, setError] = useState(() => searchParams.get("error") ? "Unable to sign in. Please try again." : "")
  const [loading, setLoading] = useState(false)
  const [cooldown, setCooldown] = useState(0)

  useEffect(() => {
    if (cooldown <= 0) return
    const timer = window.setInterval(() => setCooldown((value) => Math.max(0, value - 1)), 1000)
    return () => window.clearInterval(timer)
  }, [cooldown])

  const sendOtp = async () => {
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
      return false
    }
    setStep(2)
    setOtp("")
    setCooldown(60)
    window.setTimeout(() => otpRefs.current[0]?.focus(), 0)
    return true
  }

  const handleSendOtp = async (event: React.FormEvent) => {
    event.preventDefault()
    await sendOtp()
  }

  const handleVerifyOtp = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!/^\d{6}$/.test(otp)) return
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
    router.push(redirectTo)
    router.refresh()
  }

  const handlePasswordLogin = async (event: React.FormEvent) => {
    event.preventDefault()
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
    router.push(redirectTo)
    router.refresh()
  }

  const updateOtpDigit = (index: number, value: string) => {
    const digit = value.replace(/\D/g, "").slice(-1)
    const next = otp.padEnd(6).split("")
    next[index] = digit
    setOtp(next.join("").trimEnd())
    if (digit && index < 5) otpRefs.current[index + 1]?.focus()
  }

  const handleOtpKeyDown = (index: number, event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Backspace" && !otp[index] && index > 0) otpRefs.current[index - 1]?.focus()
  }

  const handleOtpPaste = (event: React.ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault()
    const code = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6)
    setOtp(code)
    otpRefs.current[Math.min(code.length, 5)]?.focus()
  }

  const switchMode = (passwordMode: boolean) => {
    setUsePassword(passwordMode)
    setStep(1)
    setOtp("")
    setPassword("")
    setError("")
  }

  if (step === 2 && !usePassword) {
    return (
      <main className="relative flex min-h-svh items-center justify-center overflow-hidden bg-background px-5 py-20 text-foreground">
        <div className="absolute inset-0 bg-[linear-gradient(var(--line-soft)_1px,transparent_1px),linear-gradient(90deg,var(--line-soft)_1px,transparent_1px)] bg-[size:40px_40px]" />
        <div className="absolute -bottom-64 -left-52 size-[620px] rounded-full bg-primary/15 blur-2xl" />
        <div className="absolute -right-48 -top-56 size-[520px] rounded-full bg-[var(--cyan)]/10 blur-3xl" />
        <Link href="/" className="absolute left-6 top-6 z-10 flex items-center gap-2 font-heading text-lg font-bold text-foreground md:left-12 md:top-10">
          <Image src="/icon.png" alt="" width={38} height={38} className="rounded-lg bg-card p-1" />
          AdLauncher
        </Link>

        <Card className="relative z-10 w-full max-w-[570px] gap-0 rounded-2xl p-7 shadow-[var(--sh-md)] md:p-12">
          <button type="button" onClick={() => { setStep(1); setOtp(""); setError("") }} className="flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-link">
            <IconArrowLeft className="size-4" /> Use a different email
          </button>
          <div className="mt-8 flex size-14 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
            <IconMail className="size-6" />
          </div>
          <h1 className="mt-5 font-heading text-4xl font-bold tracking-[-0.04em] text-foreground">Check your inbox</h1>
          <p className="mt-3 leading-6 text-muted-foreground">Enter the 6-digit code sent to<br /><strong className="break-all font-medium text-foreground">{email}</strong></p>

          <form onSubmit={handleVerifyOtp}>
            <Label className="mt-8 text-xs tracking-[.12em]">VERIFICATION CODE</Label>
            <div className="mt-3 grid grid-cols-6 gap-2 md:gap-3">
              {Array.from({ length: 6 }, (_, index) => (
                <Input
                  key={index}
                  ref={(element) => { otpRefs.current[index] = element }}
                  aria-label={`Digit ${index + 1}`}
                  inputMode="numeric"
                  autoComplete={index === 0 ? "one-time-code" : "off"}
                  value={otp[index] || ""}
                  onChange={(event) => updateOtpDigit(index, event.target.value)}
                  onKeyDown={(event) => handleOtpKeyDown(index, event)}
                  onPaste={handleOtpPaste}
                  className="h-14 min-w-0 rounded-xl bg-muted/40 px-0 text-center text-2xl font-bold text-foreground md:h-[66px]"
                />
              ))}
            </div>
            {error && <p role="alert" className="mt-4 rounded-xl bg-destructive/10 p-3 text-sm font-medium text-destructive">{error}</p>}
            <Button size="lg" disabled={loading || !/^\d{6}$/.test(otp)} className="mt-5 h-[58px] w-full rounded-xl">
              {loading ? "Verifying..." : "Verify & sign in"} <IconArrowRight className="size-4" />
            </Button>
          </form>

          <div className="mt-5 text-center text-sm text-muted-foreground">
            Didn&apos;t receive it?{" "}
            <button type="button" disabled={cooldown > 0 || loading} onClick={sendOtp} className="font-medium text-link disabled:cursor-not-allowed disabled:text-muted-foreground">
              {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
            </button>
          </div>
          <div className="mt-7 flex items-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-medium text-accent-foreground">
            <IconCheck className="size-4" /> Code sent successfully. It expires in 10 minutes.
          </div>
        </Card>
      </main>
    )
  }

  return (
    <main className="min-h-svh bg-background p-3 text-foreground md:p-6">
      <div className="mx-auto grid min-h-[calc(100svh-24px)] max-w-[1392px] overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--sh-md)] md:min-h-[calc(100svh-48px)] md:grid-cols-[1.08fr_.92fr]">
        <section className="relative hidden overflow-hidden border-r border-border bg-sidebar p-12 text-sidebar-foreground md:block">
          <div className="absolute -bottom-72 -left-64 size-[650px] rounded-full bg-primary/15" />
          <div className="absolute -right-56 -top-64 size-[500px] rounded-full border-[90px] border-[var(--cyan)]/10" />
          <Link href="/" className="relative z-10 flex items-center gap-3 font-heading text-xl font-bold">
            <Image src="/icon.png" alt="" width={42} height={42} className="rounded-xl bg-card p-1" /> AdLauncher
          </Link>
          <p className="relative z-10 mt-24 text-xs font-medium tracking-[.22em] text-link">PATI MEDIA OPERATIONS</p>
          <h1 className="relative z-10 mt-5 font-heading text-6xl font-bold leading-[.98] tracking-[-.055em] xl:text-7xl">Launch smarter.<br /><span className="text-link">Move faster.</span></h1>
          <p className="relative z-10 mt-7 max-w-xl text-lg leading-8 text-muted-foreground">One workspace for creative operations, campaign setup, and high-volume publishing to Meta.</p>
          <div className="absolute bottom-12 left-12 right-12 z-10 rounded-2xl border border-border bg-card/70 p-6 shadow-[var(--sh)] backdrop-blur">
            <div className="flex justify-between text-sm"><strong className="font-medium">Launch velocity</strong><span className="text-muted-foreground">LAST 7 DAYS · +28%</span></div>
            <div className="mt-5 flex h-24 items-end gap-3">
              {[34, 52, 45, 72, 60, 88, 100].map((height, index) => <i key={index} className="flex-1 rounded-t-md bg-[image:var(--grad)]" style={{ height: `${height}%` }} />)}
            </div>
          </div>
        </section>

        <section className="flex items-center justify-center bg-card px-6 py-16 md:px-14">
          <div className="w-full max-w-[440px]">
            <Link href="/" className="mb-16 flex items-center gap-2 font-heading text-lg font-bold text-foreground md:hidden">
              <Image src="/icon.png" alt="" width={38} height={38} className="rounded-lg bg-card p-1" /> AdLauncher
            </Link>
            <p className="text-xs font-medium tracking-[.16em] text-link">WELCOME BACK</p>
            <h1 className="mt-4 font-heading text-4xl font-bold tracking-[-.045em] text-foreground">{usePassword ? "Sign in with password" : "Sign in to AdLauncher"}</h1>
            <p className="mt-3 text-muted-foreground">{usePassword ? "Enter your email and password." : "Use your work email. We’ll send a secure 6-digit code."}</p>
            {searchParams.get("registered") === "1" && (
              <div className="mt-5 flex items-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-medium text-accent-foreground">
                <IconCheck className="size-4" /> Account created. Verify your email to continue.
              </div>
            )}

            <form onSubmit={usePassword ? handlePasswordLogin : handleSendOtp} className="mt-9">
              <Label htmlFor="email" className="text-xs tracking-[.1em]">WORK EMAIL</Label>
              <div className="relative mt-3">
                <IconMail className="pointer-events-none absolute left-4 top-1/2 z-10 size-5 -translate-y-1/2 text-muted-foreground" />
                <Input id="email" type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@company.com" className="h-[58px] rounded-xl pl-11" />
              </div>
              {usePassword && (
                <>
                  <Label htmlFor="password" className="mt-5 text-xs tracking-[.1em]">PASSWORD</Label>
                  <div className="relative mt-3">
                    <IconLock className="pointer-events-none absolute left-4 top-1/2 z-10 size-5 -translate-y-1/2 text-muted-foreground" />
                    <Input id="password" type="password" required autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} className="h-[58px] rounded-xl pl-11" />
                  </div>
                </>
              )}
              {error && <p role="alert" className="mt-4 rounded-xl bg-destructive/10 p-3 text-sm font-medium text-destructive">{error}</p>}
              <Button size="lg" disabled={loading} className="mt-5 h-[58px] w-full rounded-xl">
                {loading ? (usePassword ? "Signing in..." : "Sending code...") : (usePassword ? "Sign in" : "Send login code")} <IconArrowRight className="size-4" />
              </Button>
            </form>

            {!usePassword && (
              <>
                <div className="my-7 flex items-center gap-3 text-xs text-muted-foreground before:h-px before:flex-1 before:bg-border after:h-px after:flex-1 after:bg-border">OR</div>
                <Button asChild variant="outline" size="lg" className="h-[52px] w-full rounded-xl">
                  <a href="/api/auth/lark"><span className="size-3 rounded-full bg-[var(--emerald)]" /> Sign in with Lark</a>
                </Button>
              </>
            )}
            <div className="mt-5 flex justify-between text-sm text-muted-foreground">
              <button type="button" onClick={() => switchMode(!usePassword)} className="hover:text-foreground">{usePassword ? "Use login code instead" : "Use password instead"}</button>
              {process.env.NODE_ENV !== "production" && <Link href="/auth/register" className="font-medium text-link">Create account</Link>}
            </div>
            <p className="mt-10 flex items-center gap-2 text-xs text-muted-foreground"><IconLock className="size-4" /> Secure access · Code expires after 10 minutes</p>
          </div>
        </section>
      </div>
    </main>
  )
}

export default function LoginPage() {
  return <Suspense><LoginForm /></Suspense>
}
