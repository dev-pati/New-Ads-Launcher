"use client"

import { Suspense, useEffect, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
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
      <main className="relative flex min-h-svh items-center justify-center overflow-hidden bg-[#10203e] px-5 py-20">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,.045)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.045)_1px,transparent_1px)] bg-[size:40px_40px]" />
        <div className="absolute -bottom-64 -left-52 size-[620px] rounded-full bg-[#176bff] blur-2xl" />
        <div className="absolute -right-48 -top-56 size-[520px] rounded-full bg-[#72e3c4]/70 blur-3xl" />
        <Link href="/" className="absolute left-6 top-6 z-10 flex items-center gap-2 text-lg font-bold text-white md:left-12 md:top-10">
          <Image src="/icon.png" alt="" width={38} height={38} className="rounded-lg bg-white p-1" />
          AdLauncher
        </Link>

        <section className="relative z-10 w-full max-w-[570px] rounded-[26px] bg-white p-7 shadow-2xl md:p-12">
          <button type="button" onClick={() => { setStep(1); setOtp(""); setError("") }} className="flex items-center gap-1 text-xs font-extrabold uppercase tracking-wide text-[#176bff]">
            <IconArrowLeft className="size-4" /> Use a different email
          </button>
          <div className="mt-8 flex size-14 items-center justify-center rounded-2xl bg-[#eaf1ff] text-[#176bff]">
            <IconMail className="size-6" />
          </div>
          <h1 className="mt-5 text-4xl font-extrabold tracking-[-0.04em] text-[#13213d]">Check your inbox</h1>
          <p className="mt-3 leading-6 text-[#68758c]">Enter the 6-digit code sent to<br /><strong className="break-all text-[#25344f]">{email}</strong></p>

          <form onSubmit={handleVerifyOtp}>
            <label className="mt-8 block text-xs font-extrabold tracking-[.12em] text-[#4c5a73]">VERIFICATION CODE</label>
            <div className="mt-3 grid grid-cols-6 gap-2 md:gap-3">
              {Array.from({ length: 6 }, (_, index) => (
                <input
                  key={index}
                  ref={(element) => { otpRefs.current[index] = element }}
                  aria-label={`Digit ${index + 1}`}
                  inputMode="numeric"
                  autoComplete={index === 0 ? "one-time-code" : "off"}
                  value={otp[index] || ""}
                  onChange={(event) => updateOtpDigit(index, event.target.value)}
                  onKeyDown={(event) => handleOtpKeyDown(index, event)}
                  onPaste={handleOtpPaste}
                  className="h-14 min-w-0 rounded-xl border border-[#cbd5e5] bg-[#f9fbff] text-center text-2xl font-extrabold text-[#176bff] outline-none transition focus:border-[#176bff] focus:ring-4 focus:ring-[#176bff]/10 md:h-[66px]"
                />
              ))}
            </div>
            {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-medium text-red-700">{error}</p>}
            <button disabled={loading || !/^\d{6}$/.test(otp)} className="mt-5 flex h-[58px] w-full items-center justify-center gap-2 rounded-[13px] bg-[#176bff] font-extrabold text-white shadow-lg shadow-blue-500/20 transition hover:bg-[#0d5ae0] disabled:cursor-not-allowed disabled:opacity-50">
              {loading ? "Verifying..." : "Verify & sign in"} <IconArrowRight className="size-4" />
            </button>
          </form>

          <div className="mt-5 text-center text-sm text-[#6c7890]">
            Didn&apos;t receive it?{" "}
            <button type="button" disabled={cooldown > 0 || loading} onClick={sendOtp} className="font-bold text-[#25344f] disabled:cursor-not-allowed">
              {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
            </button>
          </div>
          <div className="mt-7 flex items-center gap-2 rounded-xl bg-[#e9fbf5] px-4 py-3 text-sm font-bold text-[#16795f]">
            <IconCheck className="size-4" /> Code sent successfully. It expires in 10 minutes.
          </div>
        </section>
      </main>
    )
  }

  return (
    <main className="min-h-svh bg-[#e8edf8] p-3 md:p-6">
      <div className="mx-auto grid min-h-[calc(100svh-24px)] max-w-[1392px] overflow-hidden rounded-[28px] border border-[#cbd5e8] bg-white shadow-2xl md:min-h-[calc(100svh-48px)] md:grid-cols-[1.08fr_.92fr]">
        <section className="relative hidden overflow-hidden bg-[#10203e] p-12 text-white md:block">
          <div className="absolute -bottom-72 -left-64 size-[650px] rounded-full bg-[#176bff]" />
          <div className="absolute -right-56 -top-64 size-[500px] rounded-full border-[90px] border-[#72e3c4]" />
          <Link href="/" className="relative z-10 flex items-center gap-3 text-xl font-extrabold">
            <Image src="/icon.png" alt="" width={42} height={42} className="rounded-xl bg-white p-1" /> AdLauncher
          </Link>
          <p className="relative z-10 mt-24 text-xs font-extrabold tracking-[.22em] text-[#72e3c4]">PATI MEDIA OPERATIONS</p>
          <h1 className="relative z-10 mt-5 text-6xl font-extrabold leading-[.98] tracking-[-.055em] xl:text-7xl">Launch smarter.<br /><span className="text-[#8cb6ff]">Move faster.</span></h1>
          <p className="relative z-10 mt-7 max-w-xl text-lg leading-8 text-[#cbd8ef]">One workspace for creative operations, campaign setup, and high-volume publishing to Meta.</p>
          <div className="absolute bottom-12 left-12 right-12 z-10 rounded-2xl border border-white/15 bg-white/5 p-6 backdrop-blur">
            <div className="flex justify-between text-sm"><strong>Launch velocity</strong><span className="text-[#aebdda]">LAST 7 DAYS · +28%</span></div>
            <div className="mt-5 flex h-24 items-end gap-3">
              {[34, 52, 45, 72, 60, 88, 100].map((height, index) => <i key={index} className="flex-1 rounded-t-md bg-gradient-to-b from-[#72e3c4] to-[#176bff]" style={{ height: `${height}%` }} />)}
            </div>
          </div>
        </section>

        <section className="flex items-center justify-center bg-gradient-to-br from-white to-[#f6f8fd] px-6 py-16 md:px-14">
          <div className="w-full max-w-[440px]">
            <Link href="/" className="mb-16 flex items-center gap-2 text-lg font-extrabold text-[#13213d] md:hidden">
              <Image src="/icon.png" alt="" width={38} height={38} className="rounded-lg bg-white p-1" /> AdLauncher
            </Link>
            <p className="text-xs font-extrabold tracking-[.16em] text-[#176bff]">WELCOME BACK</p>
            <h1 className="mt-4 text-4xl font-extrabold tracking-[-.045em] text-[#13213d]">{usePassword ? "Sign in with password" : "Sign in to AdLauncher"}</h1>
            <p className="mt-3 text-[#66738b]">{usePassword ? "Enter your email and password." : "Use your work email. We’ll send a secure 6-digit code."}</p>
            {searchParams.get("registered") === "1" && (
              <div className="mt-5 flex items-center gap-2 rounded-xl bg-[#e9fbf5] px-4 py-3 text-sm font-bold text-[#16795f]">
                <IconCheck className="size-4" /> Account created. Verify your email to continue.
              </div>
            )}

            <form onSubmit={usePassword ? handlePasswordLogin : handleSendOtp} className="mt-9">
              <label htmlFor="email" className="block text-xs font-extrabold tracking-[.1em] text-[#4c5a73]">WORK EMAIL</label>
              <div className="mt-3 flex h-[58px] items-center gap-3 rounded-[13px] border border-[#cbd5e5] bg-white px-4 focus-within:border-[#176bff] focus-within:ring-4 focus-within:ring-[#176bff]/10">
                <IconMail className="size-5 text-[#8995aa]" />
                <input id="email" type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@company.com" className="min-w-0 flex-1 bg-transparent text-[#25344f] outline-none placeholder:text-[#9aa5b8]" />
              </div>
              {usePassword && (
                <>
                  <label htmlFor="password" className="mt-5 block text-xs font-extrabold tracking-[.1em] text-[#4c5a73]">PASSWORD</label>
                  <div className="mt-3 flex h-[58px] items-center gap-3 rounded-[13px] border border-[#cbd5e5] bg-white px-4 focus-within:border-[#176bff]">
                    <IconLock className="size-5 text-[#8995aa]" />
                    <input id="password" type="password" required autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} className="min-w-0 flex-1 bg-transparent outline-none" />
                  </div>
                </>
              )}
              {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-medium text-red-700">{error}</p>}
              <button disabled={loading} className="mt-5 flex h-[58px] w-full items-center justify-center gap-2 rounded-[13px] bg-[#176bff] font-extrabold text-white shadow-lg shadow-blue-500/20 hover:bg-[#0d5ae0] disabled:opacity-60">
                {loading ? (usePassword ? "Signing in..." : "Sending code...") : (usePassword ? "Sign in" : "Send login code")} <IconArrowRight className="size-4" />
              </button>
            </form>

            {!usePassword && (
              <>
                <div className="my-7 flex items-center gap-3 text-xs text-[#9aa4b5] before:h-px before:flex-1 before:bg-[#dce2ec] after:h-px after:flex-1 after:bg-[#dce2ec]">OR</div>
                <a href="/api/auth/lark" className="flex h-[52px] items-center justify-center gap-2 rounded-[13px] border border-[#cbd5e5] bg-white text-sm font-bold text-[#25344f] hover:bg-[#f8faff]"><span className="size-3 rounded-full bg-[#00b99d]" /> Sign in with Lark</a>
              </>
            )}
            <div className="mt-5 flex justify-between text-sm text-[#64718a]">
              <button type="button" onClick={() => switchMode(!usePassword)}>{usePassword ? "Use login code instead" : "Use password instead"}</button>
              <Link href="/auth/register" className="font-bold text-[#176bff]">Create account</Link>
            </div>
            <p className="mt-10 flex items-center gap-2 text-xs text-[#8792a7]"><IconLock className="size-4" /> Secure access · Code expires after 10 minutes</p>
          </div>
        </section>
      </div>
    </main>
  )
}

export default function LoginPage() {
  return <Suspense><LoginForm /></Suspense>
}
