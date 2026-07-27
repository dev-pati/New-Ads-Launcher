# AdLauncher Hosting Proposal

**For:** Seth
**Date:** 2026-07-26
**Goal:** Decide how `ads.patigroup.com` reaches the Mac mini safely, without exposing the office network and without breaking other services on `patigroup.com`.

---

## 1. Where we are today

- AdLauncher backend already runs in Docker on Seth's Mac mini (`bills-mac-mini`, Tailscale IP `100.111.189.41`), replacing the old Vercel deploy.
- Auto-deploy is live: cron pulls + rebuilds the container every 2 minutes; app listens on `127.0.0.1:3000` (localhost-only, not exposed to the internet yet).
- DNS for `ads.patigroup.com` still points to Vercel (`c75b509f40b40332.vercel-dns-017.com`).
- **Vercel has NOT been paused.** If we pause it now, `ads.patigroup.com` goes to a dead domain immediately, because DNS still resolves there. Vercel stays on purely as a placeholder until the new path is live — it is not serving meaningful traffic, it's just holding the name.
- **We are not changing `patigroup.com` nameservers.** That domain's DNS also routes `ai.patigroup.com`, `advault.patigroup.com`, and `creative.patigroup.com` (Creative Portal). A nameserver migration (e.g. GoDaddy → Cloudflare) is a blast-radius change across every one of those apps at once — any mistake takes down services that have nothing to do with AdLauncher. We only need to touch **one A/CNAME record** for `ads`, not migrate the whole domain.

So the real question isn't "how do we host AdLauncher" — that's solved (Docker on the Mac mini). The question is **how traffic from the internet reaches that Mac mini safely**, since the office network was never designed to be a public server.

---

## 2. The three options

### Option A — VPS gateway + WireGuard tunnel + Caddy (Recommended)

A cheap VPS (DigitalOcean/Hetzner, ~$5-6/mo) holds the public IP. `ads.patigroup.com` DNS points to the VPS, not the office. A private WireGuard tunnel connects the VPS to the Mac mini. Caddy on the VPS terminates HTTPS and forwards traffic through the tunnel — plus an optional SSO/access gate in front.

- Office router/IP is never exposed. Mac mini stays private.
- One DNS record change only (`ads` CNAME/A → VPS IP) — zero touch to other `patigroup.com` subdomains.
- Real `https://ads.patigroup.com` with a proper cert, works from anywhere.
- Vercel switches off cleanly once this is live and verified.

### Option B — Hybrid: keep Vercel as front door, Mac mini for background jobs

Vercel keeps serving the public web app + domain + request logs as today. Mac mini only runs heavy/long-running work — cron jobs, batch launches, video processing — that Vercel's serverless limits can't handle well, called via internal API/webhook.

- Zero DNS change, zero new infra to secure, ships fastest.
- Vercel bill doesn't go away — the thing Seth is trying to eliminate stays.
- Two runtimes for one app = split-brain risk: which system is "production," where do logs live, what happens if Mac mini is asleep when Vercel calls it. Debugging gets harder, not easier.
- Doesn't solve the actual goal (own end-to-end, drop Vercel).

### Option C — Tailscale Funnel (fast fallback / internal testing only)

Tailscale Funnel exposes the Mac mini's `localhost:3000` on a public HTTPS URL instantly, no router config, no DNS change, no VPS. Good for "let me test this from my phone right now."

- Live in minutes, secure by default (Tailscale-managed cert + tunnel), no infra to maintain.
- URL is `something.ts.net`, **not** `ads.patigroup.com** — not presentable to clients/team as the real product URL.
- Funnel has bandwidth/connection ceilings not meant for sustained production traffic.
- Treat as a bridge/testing tool, not the long-term answer.

---

## 3. Comparison

| | **A. VPS + WireGuard + Caddy** | **B. Hybrid (Vercel + Mac mini)** | **C. Tailscale Funnel** |
|---|---|---|---|
| Real domain (`ads.patigroup.com`) | Yes | Yes (unchanged) | No (`.ts.net` only) |
| Office network exposed | No | No | No |
| Touches other `patigroup.com` apps | No (1 record) | No | No |
| Drops Vercel cost/dependency | Yes | No | Yes |
| Setup effort | Medium (VPS + tunnel + Caddy config) | Low | Very low |
| Production-ready long term | Yes | Partial (adds complexity, not a real fix) | No (fallback only) |
| Ongoing cost | ~$5-6/mo VPS | Vercel bill continues | Free |
| Risk | VPS is a new box to patch/monitor | Split-brain between two runtimes | Not durable for real traffic |

---

## 4. Recommendation

**Go with Option A (VPS + WireGuard + Caddy).** It's the only option that gets the real domain live, fully removes Vercel, and never exposes the office router — for a $5-6/mo VPS. Option B just delays the goal and adds a second system to maintain. Option C is genuinely useful as a fast, secure way to test the Mac mini deploy right now, but shouldn't become the permanent answer.

## 5. Next steps

1. Spin up a small VPS (DigitalOcean/Hetzner droplet, cheapest tier).
2. Set up WireGuard tunnel between VPS and Mac mini.
3. Install Caddy on VPS, point it at the tunnel, issue cert for `ads.patigroup.com`.
4. (Optional, while building) Use Tailscale Funnel to sanity-check the Mac mini app is reachable and stable before the VPS path goes live.
5. Update the single `ads` DNS record at the registrar to the VPS IP — no nameserver change, no impact to `ai`/`advault`/`creative`.
6. Verify `https://ads.patigroup.com` end-to-end (login, Meta connect, launch flow) through the new path.
7. Update OAuth redirect URIs (Meta/Lark/Google) to the live domain if not already done.
8. Pause Vercel once DNS has fully propagated and the new path is confirmed stable.
