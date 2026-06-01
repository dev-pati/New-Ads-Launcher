"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import {
  IconRocket,
  IconBolt,
  IconUsers,
  IconChartBar,
  IconBrandFacebook,
  IconArrowRight,
  IconCheck,
  IconPlayerPlay,
} from "@tabler/icons-react"
import { WavyBackground } from "@/components/ui/wavy-background"
import { CanvasText } from "@/components/ui/canvas-text"

export default function LandingPage() {
  const router = useRouter()
  const [isSignedIn, setIsSignedIn] = useState<boolean | null>(null)

  useEffect(() => {
    async function checkAuth() {
      const res = await fetch("/api/auth/me")
      const { user } = res.ok ? await res.json() : { user: null }
      setIsSignedIn(!!user)
    }
    checkAuth()
  }, [])

  return (
    <div className="min-h-svh bg-background">
      {/* Navbar */}
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-lg">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <Image src="/applogo.webp" alt="AdLauncher" width={32} height={32} className="bg-white" />
            <span className="font-heading text-lg font-bold">AdLauncher</span>
          </Link>
          <nav className="hidden items-center gap-8 md:flex">
            <a href="#features" className="text-sm text-muted-foreground transition-colors hover:text-foreground">Features</a>
            <a href="#how-it-works" className="text-sm text-muted-foreground transition-colors hover:text-foreground">How it works</a>
            <a href="#pricing" className="text-sm text-muted-foreground transition-colors hover:text-foreground">Pricing</a>
            <Link href="/privacy-policy" className="text-sm text-muted-foreground transition-colors hover:text-foreground">Privacy Policy</Link>
          </nav>
          <div>
            {isSignedIn === null ? (
              <div className="h-9 w-24" />
            ) : isSignedIn ? (
              <Button onClick={() => router.push("/launch")} size="sm">
                <IconRocket className="size-4" />
                Dashboard
              </Button>
            ) : (
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/auth/login">Sign In</Link>
                </Button>
                <Button size="sm" asChild>
                  <Link href="/auth/register">Get Started</Link>
                </Button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <WavyBackground
          colors={["#0064E0", "#47A5FA", "#6441D2", "#A121CE", "#1877F2"]}
          waveOpacity={0.4}
          blur={14}
          speed="slow"
          className="max-w-4xl mx-auto pb-20"
          containerClassName=""
        >
          <div className="mx-auto max-w-6xl px-6 py-16 md:py-24">
            <div className="mx-auto max-w-3xl text-center">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border/50 bg-background/70 backdrop-blur-sm px-4 py-1.5 text-sm">
                <IconBrandFacebook className="size-4 text-[#1877F2]" />
                <span className="text-muted-foreground">Powered by Meta Marketing API</span>
              </div>
              <h1 className="font-heading text-4xl font-extrabold tracking-tight text-foreground drop-shadow-sm md:text-6xl">
                Launch Facebook Ads
                <br />

                <CanvasText
          text="10x Faster"
          backgroundClassName="bg-[#0064e0] dark:bg-[#47a5fa]"
          colors={[
            "rgba(0, 153, 255, 1)",
            "rgba(0, 153, 255, 0.9)",
            "rgba(0, 153, 255, 0.8)",
            "rgba(0, 153, 255, 0.7)",
            "rgba(0, 153, 255, 0.6)",
            "rgba(0, 153, 255, 0.5)",
            "rgba(0, 153, 255, 0.4)",
            "rgba(0, 153, 255, 0.3)",
            "rgba(0, 153, 255, 0.2)",
            "rgba(0, 153, 255, 0.1)",
          ]}
          lineGap={4}
          animationDuration={20}
        />
              </h1>
              <p className="mx-auto mt-6 max-w-xl text-lg text-foreground/70">
                Create, manage, and launch Facebook ad campaigns at scale.
                Spreadsheet-style editing, real-time collaboration,
                and one-click publishing to Meta.
              </p>
              <div className="mt-10 flex items-center justify-center gap-4">
                {isSignedIn ? (
                  <Button size="lg" onClick={() => router.push("/launch")} className="gap-2 px-8">
                    Go to Dashboard
                    <IconArrowRight className="size-4" />
                  </Button>
                ) : (
                  <>
                    <Button size="lg" asChild className="gap-2 px-8">
                      <Link href="/auth/register">
                        Start Free
                        <IconArrowRight className="size-4" />
                      </Link>
                    </Button>
                    <Button size="lg" variant="outline" asChild className="gap-2 bg-background/70 backdrop-blur-sm">
                      <a href="#how-it-works">
                        <IconPlayerPlay className="size-4" />
                        See How It Works
                      </a>
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        </WavyBackground>
      </section>

      {/* Social proof */}
      <section className="border-y bg-muted/30">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-center gap-8 px-6 py-8 text-center text-sm text-muted-foreground md:gap-16">
          <div>
            <p className="font-heading text-2xl font-bold text-foreground">500+</p>
            <p>Campaigns Launched</p>
          </div>
          <div>
            <p className="font-heading text-2xl font-bold text-foreground">50+</p>
            <p>Active Teams</p>
          </div>
          <div>
            <p className="font-heading text-2xl font-bold text-foreground">10x</p>
            <p>Faster Than Ads Manager</p>
          </div>
          <div>
            <p className="font-heading text-2xl font-bold text-foreground">24/7</p>
            <p>Real-time Collaboration</p>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl px-6 py-24">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-heading text-3xl font-bold md:text-4xl">Everything you need to scale ads</h2>
          <p className="mt-4 text-muted-foreground">
            Built for agencies and teams who manage multiple Facebook ad accounts.
          </p>
        </div>
        <div className="mt-16 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {[
            {
              icon: IconBolt,
              title: "Spreadsheet-Style Editor",
              desc: "Edit ad creatives like a spreadsheet. Copy, paste, bulk-edit headlines, descriptions, and CTAs across rows.",
            },
            {
              icon: IconUsers,
              title: "Real-Time Collaboration",
              desc: "See who's editing what in real-time. Work together with your team without conflicts or overwrites.",
            },
            {
              icon: IconBrandFacebook,
              title: "One-Click Meta Publishing",
              desc: "Push creatives directly to Facebook Ads Manager. Auto-upload images, videos, and configure targeting.",
            },
            {
              icon: IconChartBar,
              title: "Multi-Account Management",
              desc: "Manage multiple ad accounts, business managers, and pages from a single dashboard.",
            },
            {
              icon: IconRocket,
              title: "Bulk Creative Upload",
              desc: "Upload hundreds of creatives at once. Auto-hash images and upload videos to Meta servers.",
            },
            {
              icon: IconCheck,
              title: "Team & Organization",
              desc: "Invite team members, assign roles, and manage permissions across your organization.",
            },
          ].map((feature) => (
            <div key={feature.title} className="group rounded-xl border bg-card p-6 transition-all hover:shadow-md hover:border-primary/30">
              <div className="flex size-11 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                <feature.icon className="size-5" />
              </div>
              <h3 className="mt-4 font-heading text-lg font-semibold">{feature.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{feature.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="border-y bg-muted/20 py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-heading text-3xl font-bold md:text-4xl">How it works</h2>
            <p className="mt-4 text-muted-foreground">From zero to launched in three simple steps.</p>
          </div>
          <div className="mt-16 grid gap-8 md:grid-cols-3">
            {[
              { step: "01", title: "Connect Facebook", desc: "Link your Facebook Business Manager and ad accounts in one click." },
              { step: "02", title: "Create Creatives", desc: "Upload images and videos, write copy in a spreadsheet-style editor with your team." },
              { step: "03", title: "Launch Campaigns", desc: "Configure targeting and budget, then publish directly to Facebook with one click." },
            ].map((item) => (
              <div key={item.step} className="relative rounded-xl border bg-card p-8">
                <span className="font-heading text-5xl font-black text-primary/10">{item.step}</span>
                <h3 className="mt-2 font-heading text-xl font-semibold">{item.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section id="pricing" className="mx-auto max-w-6xl px-6 py-24">
        <div className="relative overflow-hidden rounded-2xl bg-primary px-8 py-16 text-center text-primary-foreground md:px-16">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(255,255,255,0.1),transparent_60%)]" />
          <div className="relative">
            <h2 className="font-heading text-3xl font-bold md:text-4xl">
              Ready to scale your Facebook Ads?
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-primary-foreground/80">
              Join teams who are launching campaigns 10x faster.
              Free to start, no credit card required.
            </p>
            <div className="mt-8">
              {isSignedIn ? (
                <Button size="lg" variant="secondary" onClick={() => router.push("/launch")} className="gap-2 px-8">
                  Go to Dashboard
                  <IconArrowRight className="size-4" />
                </Button>
              ) : (
                <Button size="lg" variant="secondary" asChild className="gap-2 px-8">
                  <Link href="/auth/register">
                    Get Started Free
                    <IconArrowRight className="size-4" />
                  </Link>
                </Button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-8">
          <div className="flex items-center gap-2">
            <Image src="/applogo.webp" alt="Logo" width={24} height={24} />
            <span className="font-heading text-sm font-semibold">AdLauncher</span>
          </div>
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} AdLauncher. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  )
}
