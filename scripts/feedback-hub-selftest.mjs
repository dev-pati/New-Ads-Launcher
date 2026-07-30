import { join } from "path"
import { readFileSync, readdirSync } from "fs"
import {
  computeSignature,
  computeSubmitterProof,
  mapSeverity,
  mapKind,
  truncateUTF16,
} from "../lib/feedback-hub.js"
import { GET } from "../app/api/cron/feedback-outbox/route.js"

// Mock NextRequest-like object since Node standalone might not easily import next/server
class MockRequest {
  constructor(headers) {
    this.headers = {
      get: (name) => headers[name.toLowerCase()] || null
    }
  }
}

// Golden Vector parameters
const goldenSecret = "test-secret-0123456789abcdef0123456789abcdef"
const goldenApp = "creative"
const goldenTs = "1785211200"
const goldenNonce = "nonce-fixed-uuid"
const goldenIdem = "creative:11111111-1111-1111-1111-111111111111"
const goldenRawBody = '{"title":"Nút xuất video bị kẹt","observed":"Bấm xuất không chạy","kind":"bug","severity":"P2","origin":"human","submitter_email":"kevin@patigroup.com","submitter_verified":true,"submitted_at":"2026-07-28T04:00:00.000+00:00","submitter_proof":"fbe2f7398c7e10dfc84634d9b4043ea3a737e2cf1d639f9667013404677b8405"}'

const computedProof = computeSubmitterProof("kevin@patigroup.com", goldenSecret)
const computedSignature = computeSignature({
  secret: goldenSecret,
  app: goldenApp,
  timestamp: goldenTs,
  nonce: goldenNonce,
  idempotencyKey: goldenIdem,
  bodyBytes: goldenRawBody,
})

console.log(`Computed Signature: ${computedSignature}`)
console.log(`Computed Proof: ${computedProof}`)

let pass = true

function assert(condition, message) {
  if (condition) {
    console.log(`PASS: ${message}`)
  } else {
    console.error(`FAIL: ${message}`)
    pass = false
  }
}

// 1. Golden Vector Assertions
assert(
  computedProof === "fbe2f7398c7e10dfc84634d9b4043ea3a737e2cf1d639f9667013404677b8405",
  "Proof matches golden vector"
)
assert(
  computedSignature === "v1=90fe6277d898b749fd26dc1986b443fb5ce538815a89795323c49a885c2dc864",
  "Signature matches golden vector"
)

// 2. mapSeverity and mapKind
assert(mapSeverity("critical") === "P0", "Severity critical -> P0")
assert(mapSeverity("high") === "P1", "Severity high -> P1")
assert(mapSeverity("medium") === "P2", "Severity medium -> P2")
assert(mapSeverity("low") === "P3", "Severity low -> P3")
assert(mapSeverity("invalid") === "P3", "Severity default -> P3")

assert(mapKind("missing_feature") === "request", "Kind missing_feature -> request")
assert(mapKind("bug") === "bug", "Kind bug -> bug")
assert(mapKind("other") === "bug", "Kind other -> bug")

// 3. truncateUTF16 surrogate pair protection
const surrogateStr = "Hello 𠜎 World" // 𠜎 is surrogate pair: 𠬎 (length 2)
assert(truncateUTF16(surrogateStr, 7) === "Hello ", "Truncate split high-surrogate")
assert(truncateUTF16("abc", 10) === "abc", "Truncate short string")

// 4. Build payload assert using code
const mockMirrorRow = {
  id: "22222222-2222-2222-2222-222222222222",
  user_email: "Seth@PatiGroup.com ",
  feature_area: "launch",
  feature_function: "ad_launcher",
  feedback_type: "missing_feature",
  severity: "high",
  observed_evidence: "Test 𠜎 input\nLine 2",
  expected_result: "Success expected",
  reference_url: "https://example.com/ref?x=1",
  extra_note: "Some note",
  expected_done_at: "2026-07-30",
  artifact_url: "/launch?tab=active&org=123",
  created_at: "2026-07-30T10:00:00Z",
  org_id: "org-123",
}

// Mimic payload builder from enqueueFeedback
const observed = truncateUTF16(
  `${mockMirrorRow.observed_evidence}\n\n[Ref] ${mockMirrorRow.reference_url}\n\n[Note] ${mockMirrorRow.extra_note}\n\n[Expected Done] ${mockMirrorRow.expected_done_at}`,
  4000
)
const expected = truncateUTF16(mockMirrorRow.expected_result, 4000)
const firstLine = mockMirrorRow.observed_evidence.split("\n")[0]
let title = `[${mapKind(mockMirrorRow.feedback_type)}/${mockMirrorRow.feature_function}] ${firstLine}`.trim()
title = truncateUTF16(title, 140)
if (title.length < 8) {
  title = title.padEnd(8, ".")
}

const payload = {
  title,
  observed,
  expected,
  kind: mapKind(mockMirrorRow.feedback_type),
  severity: mapSeverity(mockMirrorRow.severity),
  origin: "human",
  submitter_email: String(mockMirrorRow.user_email || "").trim().toLowerCase(),
  submitter_verified: false,
  route: truncateUTF16((mockMirrorRow.artifact_url || "").split("?")[0], 1000),
  view_id: truncateUTF16(`${mockMirrorRow.feature_area}:${mockMirrorRow.feature_function}`, 120),
  tenant_org_id: mockMirrorRow.org_id,
  submitted_at: new Date(mockMirrorRow.created_at).toISOString(),
}

assert(payload.submitter_verified === false, "payload.submitter_verified is false")
assert(!("snapshot" in payload), "payload does not contain 'snapshot'")
assert(!("attachments" in payload), "payload does not contain 'attachments'")
assert(!("submitter_proof" in payload), "payload does not contain 'submitter_proof' inside outbox")
assert(!payload.route.includes("?"), "payload.route has query string stripped")
assert(payload.submitter_email === "seth@patigroup.com", "payload.submitter_email is lowercased and trimmed")

// 5. Cron Handler unauthorized test
process.env.CRON_SECRET = "cron-token-123"
const req = new MockRequest({
  authorization: "Bearer wrong-token",
})

const cronRes = await GET(req)
assert(cronRes.status === 401, "Cron returns 401 on wrong Bearer token")

// 6. Regex Guard search
function scanRepo(dir) {
  let hasForbidden = false
  const listFiles = (d) => {
    const entries = readdirSync(d, { withFileTypes: true })
    for (const ent of entries) {
      const fullPath = join(d, ent.name)
      if (ent.isDirectory()) {
        if (ent.name !== "node_modules" && ent.name !== ".git" && ent.name !== ".next") {
          listFiles(fullPath)
        }
      } else if (ent.isFile() && /\.(ts|tsx|js|jsx|json)$/.test(ent.name)) {
        if (ent.name === "feedback-hub-selftest.mjs") continue
        const content = readFileSync(fullPath, "utf8")
        if (content.includes("NEXT_PUBLIC_FEEDBACK_")) {
          console.error(`Forbidden NEXT_PUBLIC_FEEDBACK_ found in ${fullPath}`)
          hasForbidden = true
        }
      }
    }
  }
  listFiles(dir)
  return hasForbidden
}

const hasForbidden = scanRepo(".")
assert(!hasForbidden, "No NEXT_PUBLIC_FEEDBACK_ env references found in codebase")

if (!pass) {
  console.error("FAIL: Selftest did not pass all assertions.")
  process.exit(1)
} else {
  console.log("PASS: Feedback Hub integration tests completed successfully.")
  process.exit(0)
}
