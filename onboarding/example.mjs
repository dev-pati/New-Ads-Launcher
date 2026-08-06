const scenario = {
  slug: "feature-name",
  title: "Feature name",
  audience: "Media Buyer",
  summary: "What changed and why it helps.",
  previewSession: false,
  mocks: [],

  async run({ page, capture }) {
    await page.goto("/launch")

    await capture({
      target: "[data-onboarding='feature-entry']",
      title: "Open the feature",
      body: "Explain the user action and expected result.",
      redact: ["[data-account-name]"],
    })
  },
}

export default scenario
