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
        body: "Click A & B.\nAgain.\nhttps://github.com/dev-pati/New-Ads-Launcher/commit/3458073",
        imageBase64: "cG5n",
        redactedCount: 3,
        annotation: { left: 10, top: 20, width: 30, height: 40 },
      },
    ],
  )

  assert.match(html, /Use &lt;Asset Filter&gt;/)
  assert.match(html, /Click A &amp; B\.<br>Again\./)
  assert.match(html, /href="https:\/\/github\.com\/dev-pati\/New-Ads-Launcher\/commit\/3458073"/)
  assert.match(html, /data:image\/png;base64,cG5n/)
  assert.match(html, /class="shot"/)
  assert.match(html, /left:10\.00%;top:20\.00%/)
  assert.doesNotMatch(html, /9999px/)
})

test("masks member info, spent amounts, and non-account IDs without covering modals", async () => {
  const browser = await launchOnboardingBrowser()
  try {
    const page = await browser.newPage({ viewport: { width: 900, height: 600 } })
    await page.setContent(`
      <style>
        #member-email { position: absolute; left: 100px; top: 100px; width: 200px; height: 50px; }
        #rule-name { position: absolute; left: 400px; top: 100px; width: 200px; height: 50px; }
        #account { position: absolute; left: 100px; top: 200px; width: 250px; height: 40px; }
        #metric { position: absolute; left: 100px; top: 300px; width: 220px; height: 40px; }
        #operator { position: absolute; left: 340px; top: 300px; width: 80px; height: 40px; }
        #spent-value { position: absolute; left: 440px; top: 300px; width: 100px; height: 40px; }
        #covered-id { position: fixed; left: 100px; top: 400px; width: 200px; height: 50px; }
        #modal-cover { position: fixed; left: 100px; top: 400px; width: 200px; height: 50px; background: rgb(1, 2, 3); z-index: 10; }
      </style>
      <main>
        <h1 id="target">Invite teammate</h1>
        <input id="member-email" aria-label="Member email" value="buyer@patigroup.com">
        <input id="rule-name" aria-label="Rule name" value="Pause underperformers">
        <select id="account" aria-label="Ad Account"><option selected value="act_123456789012345">Demo Ad Account (act_123456789012345)</option></select>
        <div><select id="metric"><option selected>Amount spent</option></select><select id="operator"><option selected>&gt;</option></select><input id="spent-value" value="27"></div>
        <p>buyer@patigroup.com</p>
        <p>0912345678</p>
        <p>+1 (415) 555-2671</p>
        <p>act_123456789012345</p>
        <p>Amount spent: $27</p>
        <table><thead><tr><th>Rule</th><th>ID</th></tr></thead><tbody><tr><td>Pause ads</td><td>demo-rule</td></tr></tbody></table>
        <p>ROAS below 1</p>
        <div id="covered-id">rule_hidden_123</div><div id="modal-cover"></div>
      </main>
    `)

    const result = await captureOnboardingStep(page, {
      target: "#target",
      title: "Invite a teammate",
      body: "Use the invite action.",
    }, 1)

    assert.ok(result.imageBase64.length > 100)
    assert.ok(result.redactedCount > 0)
    assert.equal(result.redactionOverlaysApplied, result.redactedCount)

    const imagePage = await browser.newPage({ viewport: { width: 900, height: 600 } })
    await imagePage.setContent(`<img id="shot" src="data:image/png;base64,${result.imageBase64}">`)
    const pixels = await imagePage.evaluate(async () => {
      const image = document.getElementById("shot")
      await image.decode()
      const canvas = document.createElement("canvas")
      canvas.width = image.naturalWidth
      canvas.height = image.naturalHeight
      const context = canvas.getContext("2d")
      context.drawImage(image, 0, 0)
      return {
        member: [...context.getImageData(200, 125, 1, 1).data],
        ruleName: [...context.getImageData(500, 125, 1, 1).data],
        account: [...context.getImageData(225, 220, 1, 1).data],
        metric: [...context.getImageData(210, 320, 1, 1).data],
        spentValue: [...context.getImageData(490, 320, 1, 1).data],
        modalCover: [...context.getImageData(200, 425, 1, 1).data],
      }
    })
    assert.deepEqual(pixels.member, [107, 114, 128, 255])
    assert.notDeepEqual(pixels.ruleName, [107, 114, 128, 255])
    assert.notDeepEqual(pixels.account, [107, 114, 128, 255])
    assert.notDeepEqual(pixels.metric, [107, 114, 128, 255])
    assert.notDeepEqual(pixels.spentValue, [107, 114, 128, 255])
    assert.deepEqual(pixels.modalCover, [1, 2, 3, 255])
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
