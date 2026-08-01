import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"

const [loginPage, smtpSender, landingPage] = await Promise.all([
  readFile(new URL("../app/auth/login/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../lib/smtp-email.ts", import.meta.url), "utf8"),
  readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
])

assert.match(loginPage, /"one-time-code"/)
assert.match(loginPage, /Resend in \$\{cooldown\}s/)
assert.match(smtpSender, /pool: true/)
assert.match(landingPage, /\/api\/auth\/logout/)
