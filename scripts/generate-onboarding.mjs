import { access, mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import process from "node:process"
import { fileURLToPath, pathToFileURL } from "node:url"

import { chromium } from "playwright"

const REQUIRED_SCENARIO_FIELDS = ["slug", "title", "audience", "summary"]
const DEFAULT_OUTPUT_DIRECTORY = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "onboarding-output")
const SYSTEM_BROWSER_PATHS = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
]

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;")
}

function formatBody(value) {
  return escapeHtml(value)
    .replaceAll("\n", "<br>")
    .replace(
      /https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/commit\/[a-f0-9]{7,40}/g,
      (url) => `<a href="${url}" target="_blank" rel="noreferrer">${url}</a>`,
    )
}

export function validateScenario(scenario) {
  const valid = scenario
    && REQUIRED_SCENARIO_FIELDS.every((field) => typeof scenario[field] === "string" && scenario[field].trim())
    && typeof scenario.run === "function"

  if (!valid) {
    throw new Error("Scenario must export slug, title, audience, summary, and run")
  }

  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(scenario.slug)) {
    throw new Error("Scenario slug must be lowercase kebab-case")
  }
}

export async function launchOnboardingBrowser(options = {}) {
  try {
    return await chromium.launch(options)
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes("Executable doesn't exist")) throw error
  }

  const candidates = [process.env.ONBOARDING_BROWSER_PATH, ...SYSTEM_BROWSER_PATHS].filter(Boolean)
  for (const executablePath of candidates) {
    try {
      await access(executablePath)
      return await chromium.launch({ ...options, executablePath })
    } catch {
      // Try the next known browser path.
    }
  }

  throw new Error("No Chromium browser found. Run `npx playwright install chromium` or set ONBOARDING_BROWSER_PATH")
}

export async function installOnboardingSafeMode(context) {
  let blockedMutations = 0
  await context.route("**/*", async (route) => {
    const request = route.request()
    if (!["GET", "HEAD", "OPTIONS"].includes(request.method())) {
      blockedMutations += 1
      return route.abort("blockedbyclient")
    }
    return route.fallback()
  })
  return { blockedMutations: () => blockedMutations }
}

export async function installScenarioMocks(page, mocks = []) {
  for (const mock of mocks) {
    if (!mock || typeof mock.url !== "string" || mock.method && mock.method !== "GET") {
      throw new Error("Scenario mocks must declare a URL and may only mock GET requests")
    }
    await page.route(mock.url, (route) => {
      if (route.request().method() !== "GET") return route.abort("blockedbyclient")
      return route.fulfill({
        status: mock.status || 200,
        contentType: "application/json",
        body: JSON.stringify(mock.body ?? {}),
      })
    })
  }
}

function createScenarioPage(page) {
  const blocked = new Set(["route", "unroute", "context", "request", "evaluate", "evaluateHandle", "addInitScript"])
  return new Proxy(page, {
    get(target, property) {
      if (blocked.has(property)) throw new Error(`Scenario page.${String(property)} is disabled by onboarding safe mode`)
      const value = Reflect.get(target, property, target)
      return typeof value === "function" ? value.bind(target) : value
    },
  })
}

function validateStep(step) {
  if (!step || !["target", "title", "body"].every((field) => typeof step[field] === "string" && step[field].trim())) {
    throw new Error("Each capture requires target, title, and body")
  }

  if (step.redact !== undefined && (!Array.isArray(step.redact) || step.redact.some((value) => typeof value !== "string"))) {
    throw new Error("capture.redact must be an array of CSS selectors")
  }
}

export async function captureOnboardingStep(page, step, stepNumber) {
  validateStep(step)

  const target = page.locator(step.target).first()
  await target.waitFor({ state: "visible", timeout: 10_000 })
  await target.scrollIntoViewIfNeeded()

  const maskId = `onboarding-${Date.now()}-${stepNumber}`
  const redaction = await page.evaluate(({ extraSelectors, maskId }) => {
    const selectors = [
      "[data-onboarding-redact]",
      "[data-onboarding-member]",
      "[data-onboarding-spend]",
      "[data-onboarding-id]",
      ...extraSelectors,
    ]
    const marked = new Set()
    const mark = (element) => {
      if (!(element instanceof HTMLElement) || marked.has(element)) return
      element.setAttribute("data-onboarding-mask", maskId)
      marked.add(element)
    }

    for (const selector of selectors) {
      for (const element of document.querySelectorAll(selector)) mark(element)
    }

    const sensitiveText = [
      /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
      /(?<![A-Za-z0-9_])(?:\+?\d[\d .()-]{8,}\d)(?![A-Za-z0-9_])/,
      /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i,
      /\b(?:ad|adset|campaign|creative|rule|org|user|member|team|workspace|project)[_-][A-Za-z0-9_-]+\b/i,
      /\b(?:ad|ad set|campaign|creative|rule|org|user|member|team|workspace|project)\s*id\b\s*[:#-]?\s*[A-Za-z0-9_-]{4,}\b/i,
    ]
    const memberContext = /\b(?:member|email|e-mail|phone|telephone|mobile|assignee|owner|created by|updated by)\b/i
    const actualSpentText = /\bamount spent\b\s*:?\s*(?:[$€£¥₫]\s*)?\d[\d.,]*/i
    const idContext = /\b(?:ad|ad set|campaign|creative|rule|org|user|member|team|workspace|project)\s*id\b/i

    for (const control of document.querySelectorAll("input, textarea, select, [contenteditable='true']")) {
      const selectedText = control instanceof HTMLSelectElement
        ? Array.from(control.selectedOptions, (option) => option.textContent || "").join(" ")
        : ""
      const ownContext = [
        control.getAttribute("name"),
        control.getAttribute("aria-label"),
        control.getAttribute("placeholder"),
        control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement ? control.value : "",
        selectedText,
      ].filter(Boolean).join(" ")
      if (memberContext.test(ownContext) || idContext.test(ownContext) || sensitiveText.some((pattern) => pattern.test(ownContext))) {
        mark(control)
        continue
      }
    }

    for (const table of document.querySelectorAll("table")) {
      const idColumns = Array.from(table.querySelectorAll("thead th"))
        .map((header, index) => {
          const text = header.textContent || ""
          return /\bid\b/i.test(text) && !/\bad\s*account\b|\baccount\b/i.test(text) ? index : -1
        })
        .filter((index) => index >= 0)
      for (const row of table.querySelectorAll("tbody tr")) {
        const cells = row.querySelectorAll("th, td")
        for (const index of idColumns) if (cells[index]) mark(cells[index])
      }
    }

    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    let node = walker.nextNode()
    while (node) {
      const parent = node.parentElement
      if (parent && !["SCRIPT", "STYLE", "NOSCRIPT"].includes(parent.tagName)) {
        const text = node.nodeValue || ""
        if (sensitiveText.some((pattern) => pattern.test(text)) || actualSpentText.test(text)) mark(parent)
      }
      node = walker.nextNode()
    }

    let overlayCount = 0
    for (const element of marked) {
      const rect = element.getBoundingClientRect()
      if (rect.width <= 0 || rect.height <= 0) continue
      const visibleElement = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2)
      if (!visibleElement || !element.contains(visibleElement) && !visibleElement.contains(element)) continue
      const overlay = document.createElement("div")
      overlay.setAttribute("data-onboarding-redaction-overlay", maskId)
      Object.assign(overlay.style, {
        position: "fixed",
        left: `${rect.left}px`,
        top: `${rect.top}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`,
        background: "#6b7280",
        borderRadius: "4px",
        boxShadow: "inset 0 0 0 1px rgba(255,255,255,.35)",
        pointerEvents: "none",
        zIndex: "2147483645",
      })
      document.body.append(overlay)
      overlayCount += 1
    }
    return {
      count: overlayCount,
      overlayCount,
    }
  }, { extraSelectors: step.redact || [], maskId })

  const box = await target.boundingBox()
  if (!box) {
    await removeCaptureDecorations(page, maskId)
    throw new Error(`Target has no visible bounding box: ${step.target}`)
  }

  try {
    const image = await page.screenshot({ type: "png", animations: "disabled" })
    const viewport = page.viewportSize()
    if (!viewport) throw new Error("A fixed viewport is required for screenshot annotations")

    return {
      title: step.title,
      body: step.body,
      imageBase64: image.toString("base64"),
      redactedCount: redaction.count,
      redactionOverlaysApplied: redaction.overlayCount,
      annotation: {
        left: Math.max(0, (box.x / viewport.width) * 100),
        top: Math.max(0, (box.y / viewport.height) * 100),
        width: Math.min(100, (box.width / viewport.width) * 100),
        height: Math.min(100, (box.height / viewport.height) * 100),
      },
    }
  } finally {
    await removeCaptureDecorations(page, maskId)
  }
}

async function removeCaptureDecorations(page, maskId) {
  await page.evaluate((maskId) => {
    for (const overlay of document.querySelectorAll(`[data-onboarding-redaction-overlay="${maskId}"]`)) {
      overlay.remove()
    }
    for (const element of document.querySelectorAll(`[data-onboarding-mask="${maskId}"]`)) {
      element.removeAttribute("data-onboarding-mask")
    }
  }, maskId)
}

export function renderOnboardingHtml(scenario, steps) {
  const toc = steps.map((step, index) => `
    <a href="#s${index + 1}"><span class="i">${index + 1}</span><span>${escapeHtml(step.title)}</span><span class="s">ảnh ${String(index + 1).padStart(2, "0")}</span></a>
  `).join("")
  const sections = steps.map((step, index) => {
    const annotation = step.annotation || { left: 8, top: 8, width: 24, height: 12 }
    const body = formatBody(step.body)
    return `
      <h2 id="s${index + 1}"><span class="num">${index + 1}</span>${escapeHtml(step.title)}</h2>
      <p>${body}</p>
      <figure class="shot">
        <img src="data:image/png;base64,${step.imageBase64}" alt="Bước ${index + 1}: ${escapeHtml(step.title)}">
        <span class="z" style="left:${annotation.left.toFixed(2)}%;top:${annotation.top.toFixed(2)}%;width:${annotation.width.toFixed(2)}%;height:${annotation.height.toFixed(2)}%"></span>
        <span class="p" style="left:${annotation.left.toFixed(2)}%;top:${annotation.top.toFixed(2)}%">${index + 1}</span>
      </figure>
      <div class="cap">Ảnh ${String(index + 1).padStart(2, "0")} — ${escapeHtml(step.title)} · ${step.redactedCount} vùng đã che</div>
      <ul class="pins"><li><span class="k">${index + 1}</span>${body}</li></ul>
    `
  }).join("")
  const checklist = steps.map((step) => `<li>${escapeHtml(step.title)}</li>`).join("")
  const redactionTotal = steps.reduce((total, step) => total + step.redactedCount, 0)

  return `<!doctype html>
<html lang="${escapeHtml(scenario.language || "vi")}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(scenario.title)} - AdLauncher</title>
  <style>
    :root{--paper:#fbfaf8;--ink:#14161c;--ink-2:#4a4f5c;--ink-3:#7b8190;--line:#e3e0da;--line-2:#cfcbc3;--card:#fff;--red:#d92d20;--red-bg:#fef3f2;--amber:#b54708;--amber-bg:#fffaeb;--green:#067647;--green-bg:#ecfdf3;--blue:#175cd3;--mono:ui-monospace,"Cascadia Mono","Consolas",monospace;--sans:"Segoe UI Variable Text","Segoe UI",sans-serif}
    @media(prefers-color-scheme:dark){:root{--paper:#101216;--ink:#e8e9ec;--ink-2:#a8adb8;--ink-3:#767c8a;--line:#262a33;--line-2:#363b46;--card:#171a20;--red:#ff6b5e;--red-bg:#2a1614;--amber:#f0a03c;--amber-bg:#291d0e;--green:#4ec98a;--green-bg:#0f2419;--blue:#6bb0ff}}
    *{box-sizing:border-box}html{scroll-behavior:smooth;scroll-padding-top:1.5rem}body{margin:0;background:var(--paper);color:var(--ink);font-family:var(--sans);font-size:16px;line-height:1.62;-webkit-font-smoothing:antialiased}.wrap{max-width:940px;margin:0 auto;padding:2.5rem 1.25rem 6rem}
    .mast{border-bottom:3px solid var(--ink);padding-bottom:1.1rem;margin-bottom:1.6rem}.eyebrow{font-size:.72rem;letter-spacing:.16em;text-transform:uppercase;color:var(--red);font-weight:700}h1{font-size:clamp(1.9rem,5vw,2.7rem);line-height:1.12;margin:.5rem 0;letter-spacing:-.02em;text-wrap:balance}.dek{color:var(--ink-2);font-size:1.02rem;margin:0}.meta{display:flex;flex-wrap:wrap;gap:.5rem;margin-top:.9rem;font-size:.8rem;color:var(--ink-3)}.meta span{border:1px solid var(--line-2);border-radius:99px;padding:.15rem .6rem}
    h2{font-size:1.5rem;letter-spacing:-.015em;margin:3rem 0 .3rem;padding-top:1rem;border-top:1px solid var(--line);text-wrap:balance}h2 .num{color:var(--red);font-variant-numeric:tabular-nums;margin-right:.45rem}p{margin:.6rem 0}strong{font-weight:650}
    .rule{background:var(--red-bg);border:1px solid var(--red);border-left-width:5px;border-radius:8px;padding:.9rem 1.1rem;margin:1.4rem 0}.rule .t{font-weight:700;color:var(--red);font-size:.8rem;letter-spacing:.08em;text-transform:uppercase}.rule .f{font-family:var(--mono);font-size:1.02rem;font-weight:700;margin:.4rem 0}
    .toc{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:.4rem .3rem;margin:1.6rem 0 0}.toc a{display:flex;gap:.7rem;align-items:baseline;padding:.42rem .8rem;text-decoration:none;color:var(--ink);border-radius:6px;font-size:.94rem}.toc a:hover{background:var(--red-bg)}.toc a .i{color:var(--red);font-weight:700;min-width:1.4rem}.toc a .s{margin-left:auto;color:var(--ink-3);font-size:.78rem;font-family:var(--mono);white-space:nowrap}
    .shot{position:relative;display:block;margin:1.1rem 0 .5rem;border-radius:10px;overflow:hidden;border:1px solid var(--line-2);background:var(--card)}.shot img{width:100%;display:block}.shot .z{position:absolute;border:2.5px solid #ff3b30;border-radius:5px;pointer-events:none}.shot .p{position:absolute;width:23px;height:23px;border-radius:50%;background:#ff3b30;color:#fff;font:700 13px/23px var(--sans);text-align:center;transform:translate(-50%,-50%);box-shadow:0 0 0 2px #fff,0 1px 5px rgba(0,0,0,.45);pointer-events:none;z-index:2}.cap{font-size:.7rem;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-3);margin:.15rem 0 .7rem}.pins{list-style:none;padding:0;margin:.2rem 0 1.6rem;font-size:.94rem}.pins li{margin:.3rem 0;padding-left:2rem;position:relative}.pins .k{position:absolute;left:0;top:.12rem;display:inline-block;min-width:1.45rem;height:1.45rem;border-radius:50%;background:var(--red);color:#fff;font:700 .78rem/1.45rem var(--sans);text-align:center}
    .note{border-radius:8px;padding:.75rem 1rem;margin:1.1rem 0;border:1px solid;font-size:.95rem}.note.warn{background:var(--amber-bg);border-color:var(--amber)}ul.check{list-style:none;padding:0;margin:1rem 0}ul.check li{padding-left:1.9rem;position:relative;margin:.35rem 0}ul.check li::before{content:"";position:absolute;left:0;top:.35rem;width:1.05rem;height:1.05rem;border:2px solid var(--line-2);border-radius:4px}.foot{margin-top:3.5rem;padding-top:1rem;border-top:1px solid var(--line);font-size:.82rem;color:var(--ink-3)}@media(max-width:560px){.pins li{padding-left:1.7rem}body{font-size:15px}.toc a .s{display:none}}
  </style>
</head>
<body>
  <div class="wrap">
    <header class="mast">
      <div class="eyebrow">AdLauncher · Hướng dẫn tính năng</div>
      <h1>${escapeHtml(scenario.title)}</h1>
      <p class="dek">${escapeHtml(scenario.summary)}</p>
      <div class="meta">
        <span>Cho: ${escapeHtml(scenario.audience)}</span>
        <span>${steps.length} ảnh chụp app thật</span>
        <span>${redactionTotal} vùng dữ liệu đã che</span>
        <span>HTML mở offline</span>
      </div>
    </header>
    <div class="rule"><div class="t">Quy tắc trước khi gửi</div><div class="f">Mở file → kiểm tra từng ảnh → mới chia sẻ</div><div>Chỉ che thông tin thành viên, amount spent và ID không thuộc Ad Account. Budget setting và Ad Account giữ nguyên. Mask tự động không đọc được chữ nằm trong ảnh, video, canvas hoặc iframe khác domain.</div></div>
    <nav class="toc">${toc}<a href="#check"><span class="i">✓</span><span>Checklist hoàn tất</span><span class="s">cuối trang</span></a></nav>
    ${sections}
    <h2 id="check"><span class="num">✓</span>Checklist hoàn tất</h2>
    <ul class="check">${checklist}<li>Đã xem lại mọi vùng nhạy cảm trước khi gửi file.</li></ul>
    <div class="note warn"><p><b>Giới hạn masking.</b> Chỉ khai báo selector <code>redact</code> cho thông tin thành viên, amount spent hoặc ID không thuộc Ad Account chưa được nhận diện tự động. Budget setting, Ad Account và dữ liệu khác phải giữ nguyên.</p></div>
    <div class="foot">Sinh từ app đã deploy bằng Playwright · BL-45 · Không chứa link ảnh ngoài</div>
  </div>
</body>
</html>`
}

async function main() {
  const scenarioArgument = process.argv[2]
  if (!scenarioArgument || ["-h", "--help"].includes(scenarioArgument)) {
    console.log("Usage: ONBOARDING_BASE_URL=https://example.com npm run onboard -- onboarding/feature.mjs")
    console.log("Optional: ONBOARDING_STORAGE_STATE=.auth/onboarding.json ONBOARDING_OUTPUT_DIR=../onboarding-output")
    process.exitCode = scenarioArgument ? 0 : 1
    return
  }

  const baseURL = process.env.ONBOARDING_BASE_URL
  if (!baseURL) throw new Error("ONBOARDING_BASE_URL is required")

  const scenarioPath = path.resolve(scenarioArgument)
  const scenario = (await import(pathToFileURL(scenarioPath).href)).default
  validateScenario(scenario)

  const contextOptions = {
    baseURL,
    viewport: { width: 1440, height: 960 },
  }
  if (process.env.ONBOARDING_STORAGE_STATE) {
    const statePath = path.resolve(process.env.ONBOARDING_STORAGE_STATE)
    await readFile(statePath)
    contextOptions.storageState = statePath
  }

  const browser = await launchOnboardingBrowser({ headless: process.env.ONBOARDING_HEADLESS !== "false" })
  try {
    const context = await browser.newContext(contextOptions)
    const page = await context.newPage()
    const steps = []
    const safeMode = await installOnboardingSafeMode(context)
    await installScenarioMocks(page, scenario.mocks)
    if (scenario.previewSession) {
      await context.addCookies([{ name: "adlauncher_session", value: "onboarding-preview", url: baseURL }])
    }
    const scenarioPage = createScenarioPage(page)

    await scenario.run({
      page: scenarioPage,
      capture: async (step) => {
        const captured = await captureOnboardingStep(page, step, steps.length + 1)
        steps.push(captured)
        console.log(`Captured step ${steps.length}: ${captured.title} (${captured.redactedCount} regions masked)`)
      },
    })

    if (steps.length === 0) throw new Error("Scenario completed without capturing any onboarding steps")

    const outputDirectory = process.env.ONBOARDING_OUTPUT_DIR
      ? path.resolve(process.env.ONBOARDING_OUTPUT_DIR)
      : DEFAULT_OUTPUT_DIRECTORY
    const outputPath = path.join(outputDirectory, `${scenario.slug}.html`)
    await mkdir(outputDirectory, { recursive: true })
    await writeFile(outputPath, renderOnboardingHtml(scenario, steps), "utf8")
    console.log(`Created ${outputPath}`)
    const blockedMutations = safeMode.blockedMutations()
    console.log(`Safe mode blocked ${blockedMutations} live mutation request${blockedMutations === 1 ? "" : "s"}`)
  } finally {
    await browser.close()
  }
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : ""
if (import.meta.url === invokedPath) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
