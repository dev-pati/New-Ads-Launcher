import assert from "node:assert/strict"
import test from "node:test"

import {
  captureOnboardingStep,
  installOnboardingSafeMode,
  installScenarioMocks,
  launchOnboardingBrowser,
  renderOnboardingHtml,
  validateScenario,
} from "../scripts/generate-onboarding.mjs"

test("validates the scenario interface", () => {
  assert.throws(
    () => validateScenario({ title: "Missing fields" }),
    /slug, title, audience, summary, and run/,
  )

  assert.doesNotThrow(() =>
    validateScenario({
      slug: "asset-filter",
      title: "Asset filter",
      audience: "Creative Producer",
      summary: "Find assets faster.",
      run() {},
    }),
  )
})

test("renders one offline HTML file with escaped copy and embedded screenshots", () => {
  const html = renderOnboardingHtml(
    {
      slug: "asset-filter",
      title: "Use <Asset Filter>",
      audience: "Creative Producer",
      summary: "Filter safely & quickly.",
      run() {},
    },
    [
      {
        title: "Choose <Brand>",
        body: "Click A & B.",
        imageBase64: "cG5n",
        redactedCount: 3,
        annotation: { left: 10, top: 20, width: 30, height: 40 },
      },
    ],
  )

  assert.match(html, /Use &lt;Asset Filter&gt;/)
  assert.match(html, /Click A &amp; B\./)
  assert.match(html, /data:image\/png;base64,cG5n/)
  assert.match(html, /class="shot"/)
  assert.match(html, /left:10\.00%;top:20\.00%/)
})

test("automatically masks common sensitive DOM values before capture", async () => {
  const browser = await launchOnboardingBrowser()
  try {
    const page = await browser.newPage({ viewport: { width: 900, height: 600 } })
    await page.setContent(`
      <style>#secret-input { position: absolute; left: 100px; top: 100px; width: 200px; height: 50px; }</style>
      <main>
        <h1 id="target">Invite teammate</h1>
        <input id="secret-input" value="secret input value">
        <p>buyer@patigroup.com</p>
        <p>0912345678</p>
        <p>+1 (415) 555-2671</p>
        <p>act_123456789012345</p>
        <p>EAAabcdefghijklmnopqrstuvwxyz123456</p>
        <p>opaqueTokenABC123456789xyz987654</p>
        <p data-onboarding-redact>Account Alpha</p>
      </main>
    `)

    const result = await captureOnboardingStep(page, {
      target: "#target",
      title: "Invite a teammate",
      body: "Use the invite action.",
    }, 1)

    assert.ok(result.imageBase64.length > 100)
    assert.ok(result.redactedCount >= 8)
    assert.equal(result.redactionOverlaysApplied, result.redactedCount)

    const imagePage = await browser.newPage({ viewport: { width: 900, height: 600 } })
    await imagePage.setContent(`<img id="shot" src="data:image/png;base64,${result.imageBase64}">`)
    const pixel = await imagePage.evaluate(async () => {
      const image = document.getElementById("shot")
      await image.decode()
      const canvas = document.createElement("canvas")
      canvas.width = image.naturalWidth
      canvas.height = image.naturalHeight
      const context = canvas.getContext("2d")
      context.drawImage(image, 0, 0)
      return [...context.getImageData(200, 125, 1, 1).data]
    })
    assert.deepEqual(pixel, [107, 114, 128, 255])
  } finally {
    await browser.close()
  }
})

test("safe mode blocks mutations and scenario mocks are GET-only", async () => {
  const browser = await launchOnboardingBrowser()
  try {
    const context = await browser.newContext()
    const page = await context.newPage()
    const safeMode = await installOnboardingSafeMode(context)

    await page.route("https://example.test/", (route) => route.fulfill({ body: "<main>safe mode</main>", contentType: "text/html" }))
    await installScenarioMocks(page, [{ url: "https://example.test/mocked", body: { ok: true } }])
    await page.goto("https://example.test/")

    const mockedStatus = await page.evaluate(async () => (await fetch("/mocked")).status)
    const mockedMutationBlocked = await page.evaluate(async () => fetch("/mocked", { method: "POST" }).then(() => false, () => true))
    const liveBlocked = await page.evaluate(async () => fetch("/live", { method: "POST" }).then(() => false, () => true))

    assert.equal(mockedStatus, 200)
    assert.equal(mockedMutationBlocked, true)
    assert.equal(liveBlocked, true)
    assert.equal(safeMode.blockedMutations(), 1)
    await assert.rejects(() => installScenarioMocks(page, [{ url: "**/unsafe", method: "POST", body: {} }]), /GET requests/)
  } finally {
    await browser.close()
  }
})
