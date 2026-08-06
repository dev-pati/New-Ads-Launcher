const scenario = {
  slug: "automate-rules",
  title: "Tạo Automated Rule trong AdLauncher",
  audience: "Media Buyer · Org Admin",
  summary: "Chọn ad account, tạo rule, đặt điều kiện và kiểm tra rule đang thực sự chạy trên Meta.",
  previewSession: true,
  mocks: [
    { url: "**/api/orgs", body: { orgs: [{ id: "org-demo", name: "PATI Demo", slug: "pati-demo", role: "admin" }] } },
    { url: "**/api/auth/me", body: { user: { id: "user-demo", email: "buyer@example.com", full_name: "Demo Buyer" } } },
    {
      url: "**/api/facebook/ad-accounts",
      body: { adAccounts: [{ id: "account-demo", account_id: "act_demo_001", name: "Demo Ad Account", currency: "USD" }] },
    },
    {
      url: "**/api/facebook/rules?*",
      body: {
        rules: [{
          id: "rule_demo_001",
          name: "Pause ad sets after spend without purchase",
          status: "ENABLED",
          enabled: true,
          hasIssues: false,
          entityType: "ADSET",
          timeRange: "LIFETIME",
          scheduleType: "DAILY",
          actionLabel: "Turn off ad sets",
          conditionText: "Spent > $27 and Purchases < 1",
          appliedTo: "All active ad sets",
          createdTime: "2026-08-06T08:00:00.000Z",
        }],
      },
    },
    {
      url: "**/api/facebook/rules/history?*",
      body: {
        rules: [],
        summary: { rule_demo_001: { executions: 3, entitiesAffected: 2, lastRun: "2026-08-06T09:30:00.000Z" } },
      },
    },
    { url: "**/api/meta/connection-status", body: { connected: true, status: "connected" } },
    { url: "**/api/notifications**", body: { notifications: [], unreadCount: 0 } },
  ],

  async run({ page, capture }) {
    await page.goto("/automate/rules", { waitUntil: "commit" })
    await page.getByRole("heading", { name: "Rules", exact: true }).waitFor()

    await capture({
      target: "select",
      title: "Chọn đúng Ad Account",
      body: "Rule thuộc Meta ad account đang chọn. Kiểm tra account trước khi tạo hoặc sửa rule.",
    })

    await capture({
      target: "text=3 runs",
      title: "Kiểm tra rule có thực sự chạy",
      body: "Đọc Status, Rule results và When rule runs. Active chưa đủ nếu Meta báo Has issues hoặc rule không được kiểm tra.",
    })

    const createButton = page.getByRole("button", { name: "Create Rule" })
    await capture({
      target: "button:has-text('Create Rule')",
      title: "Mở trình tạo rule",
      body: "Bấm Create Rule để tạo rule mới. Rule lưu và chạy trực tiếp trên Meta.",
    })
    await createButton.click()

    await capture({
      target: "h2:has-text('Create a custom rule')",
      title: "Chọn đối tượng và hành động",
      body: "Chọn Campaign, Ad Set hoặc Ad; sau đó chọn hành động như Pause, Activate hoặc đổi budget.",
    })

    await capture({
      target: "text=Conditions",
      title: "Đặt điều kiện và lịch kiểm tra",
      body: "Các điều kiện dùng quan hệ AND. Kiểm tra time range, schedule và cảnh báo trước khi lưu.",
    })
  },
}

export default scenario
