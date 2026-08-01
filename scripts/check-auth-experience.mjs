import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"

const [loginPage, registerPage, registerRoute, smtpSender, landingPage] = await Promise.all([
  readFile(new URL("../app/auth/login/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/auth/register/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/api/auth/register/route.ts", import.meta.url), "utf8"),
  readFile(new URL("../lib/smtp-email.ts", import.meta.url), "utf8"),
  readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
])

assert.match(loginPage, /"one-time-code"/)
assert.match(loginPage, /Resend in \$\{cooldown\}s/)
assert.match(smtpSender, /pool: true/)
assert.match(landingPage, /\/api\/auth\/logout/)
assert.doesNotMatch(landingPage, /href="\/auth\/register"/)
assert.match(registerPage, /registered: "1"/)
assert.doesNotMatch(registerRoute, /createSession/)
