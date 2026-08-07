import trackingScenario from "./tracking-report.mjs"
import automateRulesScenario from "./automate-rules.mjs"

const account = {
  id: "act_demo_001",
  account_id: "act_demo_001",
  name: "Demo Commerce Account",
  account_status: 1,
  currency: "USD",
  amount_spent: "128450",
  balance: "0",
  spend_cap: "500000",
  timezone_name: "Asia/Ho_Chi_Minh",
  ownership: "own",
  owner_business: { id: "business-demo", name: "Demo Business" },
}

const insight = (spend, purchases, impressions, clicks, value) => ({
  spend: String(spend),
  impressions: String(impressions),
  clicks: String(clicks),
  reach: String(Math.round(impressions * 0.76)),
  actions: [{ action_type: "omni_purchase", value: String(purchases) }],
  action_values: [{ action_type: "omni_purchase", value: String(value) }],
  cost_per_action_type: [{ action_type: "omni_purchase", value: String(Number(spend) / purchases) }],
})

const campaigns = [
  {
    id: "campaign_demo_alpha",
    name: "Always-on Prospecting | Demo",
    status: "ACTIVE",
    effective_status: "ACTIVE",
    objective: "OUTCOME_SALES",
    daily_budget: "8500",
    budget_remaining: "31200",
    created_time: "2026-08-07T06:15:00.000Z",
    insights: { data: [insight("428.40", 31, 82400, 2480, "2460.00")] },
  },
  {
    id: "campaign_demo_beta",
    name: "Retargeting | Cart Recovery",
    status: "ACTIVE",
    effective_status: "ACTIVE",
    objective: "OUTCOME_SALES",
    daily_budget: "5500",
    budget_remaining: "18400",
    created_time: "2026-08-06T05:45:00.000Z",
    insights: { data: [insight("296.20", 24, 47100, 1860, "1910.00")] },
  },
  {
    id: "campaign_demo_gamma",
    name: "Creative Test | Week 32",
    status: "ACTIVE",
    effective_status: "ACTIVE",
    objective: "OUTCOME_SALES",
    daily_budget: "4000",
    budget_remaining: "12600",
    created_time: "2026-08-05T04:20:00.000Z",
    insights: { data: [insight("184.75", 11, 35200, 1120, "820.00")] },
  },
]

const notifications = [
  {
    id: "notice-demo-1",
    type: "campaign.updated",
    title: "Campaign budget updated",
    body: "Always-on Prospecting now has an unpublished budget draft ready for review.",
    link: "/ads-manager",
    actor_name: "Demo Operator",
    is_read: false,
    created_at: "2026-08-07T08:45:00.000Z",
  },
  {
    id: "notice-demo-2",
    type: "creative.created",
    title: "New creatives are ready",
    body: "8 uploaded assets finished processing and can now be assigned or launched.",
    link: "/assets",
    actor_name: "Demo Operator",
    is_read: false,
    created_at: "2026-08-06T09:20:00.000Z",
  },
  {
    id: "notice-demo-3",
    type: "member.role_changed",
    title: "Workspace role changed",
    body: "A teammate received Media Buyer access for the active organization.",
    link: "/settings/team",
    actor_name: "Demo Admin",
    is_read: true,
    created_at: "2026-08-04T03:30:00.000Z",
  },
]

const scenario = {
  slug: "weekly-ship",
  title: "Weekly ship",
  audience: "Media Buyer · Org Admin · Team Lead",
  summary: "Tổng hợp 8 feature đã ship: Tracking, Automated Rules, bulk edit drafts, quick budget, Ads Manager analytics, Ad Account Overview, Notification Inbox và Account Health.",
  previewSession: true,
  mocks: [
    ...trackingScenario.mocks,
    ...automateRulesScenario.mocks,
    { url: "**/api/facebook/ad-accounts", body: { adAccounts: [account], syncedAt: "2026-08-07T09:00:00.000Z" } },
    { url: "**/api/ads-manager/workspace-access", body: { enabled: true, canMutate: true, role: "admin" } },
    { url: "**/api/launch-history?*", body: { batches: [] } },
    { url: "**/api/facebook/campaigns?*", body: { campaigns, paging: { hasNext: false } } },
    { url: "**/api/facebook/adsets?*", body: { adSets: [], paging: { hasNext: false } } },
    { url: "**/api/facebook/ads?*", body: { ads: [], paging: { hasNext: false } } },
    { url: "**/api/facebook/breakdown-insights?*", body: { data: [] } },
    { url: "**/api/facebook/opportunity-score?*", body: { available: true, score: 84, weight: 0.73 } },
    {
      url: "**/api/insights/account-summary?*",
      body: {
        summary: {
          spend: "909.35",
          impressions: "164700",
          clicks: "5460",
          reach: "118200",
          actions: [{ action_type: "omni_purchase", value: "66" }],
          action_values: [{ action_type: "omni_purchase", value: "5190.00" }],
        },
      },
    },
    { url: "**/api/insights/report-trends?*", body: { series: [] } },
    {
      url: "**/api/facebook/ad-account-metrics?*",
      body: {
        snapshots: [{
          id: "snapshot-demo-1",
          fb_ad_account_id: "act_demo_001",
          fb_account_id: "act_demo_001",
          name: account.name,
          account_status: 1,
          currency: "USD",
          timezone_name: account.timezone_name,
          spend_cap_minor: 500000,
          remaining_minor: 371550,
          amount_spent_minor: 128450,
          ownership: "own",
          owner_business_name: "Demo Business",
          synced_at: "2026-08-07T09:00:00.000Z",
        }],
      },
    },
    {
      url: "**/api/facebook/account-health?*",
      body: {
        available: true,
        account: {
          id: "act_demo_001",
          name: account.name,
          statusCode: 1,
          status: "Active",
          disableReasonCode: 0,
          disableReason: "",
          metaNotificationsEnabled: true,
          healthy: true,
        },
      },
    },
    {
      url: "**/api/insights/activities?*",
      body: {
        available: true,
        events: [
          { time: "2026-08-07T08:00:00.000Z", type: "campaign.updated", actor: "Demo Operator", objectName: "Always-on Prospecting", summary: "Campaign budget updated" },
          { time: "2026-08-06T07:30:00.000Z", type: "adset.updated", actor: "Demo Operator", objectName: "Broad | Purchase", summary: "Ad set delivery turned on" },
        ],
      },
    },
    { url: "**/api/notifications**", body: { notifications, unreadCount: 2 } },
    { url: "**/api/notification-preferences", body: { preferences: { business: true, ads: true, profiles: true, apps: true } } },
    { url: "**/api/team-stats?*", body: { ads: 54, batches: 12, templates: 6 } },
  ],

  async run({ page, capture }) {
    page.setDefaultNavigationTimeout(60_000)
    await page.goto("/tracking", { waitUntil: "commit" })
    await page.getByRole("heading", { name: "Tracking System" }).waitFor()

    await capture({
      target: "main",
      title: "1. Tracking System — đọc usage toàn team",
      body: "Shape focus: bắt đầu ở Team usage để đọc delivery, valuable actions, active days và feature breadth trên cùng reporting period. Đây là bằng chứng sử dụng app, không phải điểm đánh giá nhân sự.\nCommits:\nhttps://github.com/dev-pati/New-Ads-Launcher/commit/3458073\nhttps://github.com/dev-pati/New-Ads-Launcher/commit/181390b",
      redact: ["table tbody td:first-child"],
    })

    await capture({
      target: "section:has(h2:has-text('Usage by member'))",
      title: "Đọc team usage theo từng thành viên",
      body: "Shape focus: đối chiếu Ads launched, Batches, App actions, Active days và Features used. Số liệu launch lấy từ launch history; App actions chỉ tính event có bằng chứng bền vững.",
      redact: ["table tbody td:first-child"],
    })

    const myUsage = page.getByRole("button", { name: "My usage" })
    await capture({
      target: "button:has-text('My usage')",
      title: "Mở My usage để check-in KR cá nhân",
      body: "Pointer: chuyển từ số liệu team sang bằng chứng của chính bạn. Mọi fallback, data mismatch và painpoint được ghi theo tuần.",
    })
    await myUsage.click()
    await page.getByRole("heading", { name: "Weekly check-in" }).waitFor()

    await capture({
      target: "section:has(h2:has-text('Weekly check-in'))",
      title: "Ghi fallback, data mismatch và painpoint",
      body: "Shape focus:\n1) Launch +1 hoặc Control +1 khi AdLauncher không hoàn tất và phải quay sang Meta.\n2) Nhập Data mismatch count khi số app không khớp Ads Manager.\n3) Mô tả painpoint, tác động, workaround.\n4) Save all changes để lưu count và mô tả. Guide không bấm lưu thay bạn.",
    })

    await page.getByRole("button", { name: "Team usage" }).click()
    await capture({
      target: "button:has-text('Report')",
      title: "Mở Period Report",
      body: "Pointer: Report dùng đúng scope và reporting period đang chọn. Mở preview trước khi copy hoặc gửi.",
    })
    await page.getByRole("button", { name: "Report" }).click()
    await page.getByRole("dialog").waitFor()

    await capture({
      target: "div[role='dialog']",
      title: "Kiểm tra report trước khi chia sẻ",
      body: "Shape focus: report gom delivery, KR points, fallback aggregate, data mismatch, team usage và app activity. Icon Copy đủ để lấy Markdown; email luôn qua preview gate trước khi gửi.",
      redact: ["div[role='dialog'] table tbody td:first-child"],
    })

    await page.goto("/automate/rules", { waitUntil: "commit" })
    await page.getByRole("heading", { name: "Rules", exact: true }).waitFor()

    await capture({
      target: "button[aria-label='Select ad account']",
      title: "2. Automated Rules — chọn đúng Ad Account",
      body: "Pointer: rule thuộc account đang chọn. Xác nhận account trước khi đọc, tạo hoặc sửa rule.\nCommits:\nhttps://github.com/dev-pati/New-Ads-Launcher/commit/53abe4e\nhttps://github.com/dev-pati/New-Ads-Launcher/commit/71a6948",
    })

    await capture({
      target: "main",
      title: "Đọc trạng thái và lịch sử chạy rule",
      body: "Shape focus: kiểm tra Status, điều kiện, action, schedule, số runs và số entity bị tác động. Active chưa đủ nếu Meta báo issue hoặc rule không phát sinh run.",
    })

    await capture({
      target: "button:has-text('Create Rule')",
      title: "Mở form Create Rule",
      body: "Pointer: mở form để cấu hình. Bước này chưa tạo rule trên Meta.",
    })
    await page.getByRole("button", { name: "Create Rule" }).click()

    await capture({
      target: "div.fixed.inset-0.z-50 > div",
      title: "Hoàn tất rule từ điều kiện đến lịch chạy",
      body: "Shape focus:\n1) Rule name.\n2) Campaign, Ad Set hoặc Ad và Active only.\n3) Action.\n4) Conditions — các dòng dùng AND.\n5) Time range.\n6) Schedule.\n7) Notification.\n8) Kiểm tra lại account và cảnh báo. Chỉ bấm Create sau khi tự duyệt tác động; guide không submit.",
    })

    await page.goto("/ads-manager", { waitUntil: "commit" })
    await page.getByRole("heading", { name: "Campaigns", exact: true }).waitFor()
    await page.locator("table[data-sticky-grid] tbody tr").first().waitFor()

    await capture({
      target: "button[aria-label='Select ad account']",
      title: "3. Bulk Edit Drafts — xác nhận workspace",
      body: "Pointer: Ads Manager luôn làm việc trên Ad Account đang chọn. Kiểm tra account, Opportunity score, date range và tab Campaigns/Ad sets/Ads trước khi chọn hàng.\nCommit:\nhttps://github.com/dev-pati/New-Ads-Launcher/commit/6680ea8",
    })

    await capture({
      target: "table[data-sticky-grid]",
      title: "Chọn nhiều object cần chỉnh",
      body: "Shape focus: tick nhiều campaign, ad set hoặc ad. Toolbar hiển thị số lượng selection; draft chỉ stage thay đổi, chưa publish sang Meta.",
    })

    const rowChecks = page.locator("table[data-sticky-grid] tbody input[type='checkbox']")
    await rowChecks.nth(0).click()
    await rowChecks.nth(1).click()
    await capture({
      target: "button:has-text('Edit (2)')",
      title: "Mở bulk editor cho selection",
      body: "Pointer: Edit mở workspace chỉnh hàng loạt. Dropdown cạnh Edit chọn field cụ thể; feature hiện hỗ trợ field có thể stage an toàn.",
    })
    await page.getByRole("button", { name: "Edit (2)", exact: true }).click()
    await page.getByRole("dialog").waitFor()

    await capture({
      target: "div[role='dialog']",
      title: "Soát hierarchy và từng giá trị trước khi lưu draft",
      body: "Shape focus: cột trái giữ hierarchy, cột giữa chọn field, vùng chính cho phép chỉnh tất cả hoặc từng object. Save to draft chỉ tạo unpublished edits; guide không bấm Save hoặc Publish.",
    })
    await page.getByRole("button", { name: "Close bulk editor" }).click()

    await page.locator("table[data-sticky-grid] tbody tr").first().hover()
    await capture({
      target: "button[aria-label='Edit budget']",
      title: "4. Inline Budget Quick Edit — mở ngay từ cell",
      body: "Pointer: rê vào Budget rồi bấm pencil. Không cần mở editor đầy đủ khi chỉ cần điều chỉnh ngân sách.\nCommit:\nhttps://github.com/dev-pati/New-Ads-Launcher/commit/93f64ff",
    })
    await page.locator("button[aria-label='Edit budget']").first().click()
    await page.getByText("Daily budget", { exact: true }).last().waitFor()

    await capture({
      target: "div[data-radix-popper-content-wrapper]",
      title: "Kiểm tra budget guardrail trước khi stage",
      body: "Shape focus: nhập budget mới, đọc mức chi tối đa theo ngày/tuần, sau đó chọn Save to draft hoặc Publish now. Guide chỉ minh họa popup, không thay đổi ngân sách.",
    })
    await page.keyboard.press("Escape")

    await capture({
      target: "table[data-sticky-grid] thead th:has-text('Results')",
      title: "5. Ads Manager Analytics — sort theo Results",
      body: "Pointer: bấm header Results để xếp hạng object theo outcome của objective. Đọc kèm Amount spent và Cost per result, không nhìn mỗi volume.\nCommit:\nhttps://github.com/dev-pati/New-Ads-Launcher/commit/9e8d94b",
    })
    await page.locator("table[data-sticky-grid] thead th:has-text('Results')").first().click()

    await capture({
      target: "table[data-sticky-grid]",
      title: "Phân tích performance trên cùng bảng quản trị",
      body: "Shape focus: bảng kết hợp delivery, spend, results, cost per result và budget. Date range, attribution, filter chips và selected rows cùng quyết định scope phân tích.",
    })

    await page.getByRole("button", { name: "Breakdown", exact: true }).click()
    await capture({
      target: "div.relative:has(> button:has-text('Breakdown'))",
      title: "Breakdown và Columns để đổi góc nhìn",
      body: "Pointer + menu: Breakdown tách theo time, audience, delivery hoặc geography. Columns đổi preset Performance, ECOM, Engagement hoặc customize. Chọn góc nhìn trước, rồi mới so sánh và export.",
    })
    await page.keyboard.press("Escape")

    await page.goto("/ad-accounts", { waitUntil: "commit" })
    await page.getByRole("heading", { name: "Ad Accounts", exact: true }).first().waitFor()

    await capture({
      target: "table[data-table='comfortable']",
      title: "6. Ad Account Overview — rà soát account và hạn mức",
      body: "Shape focus: Ad Accounts hiển thị ownership, status, currency, timezone, spend cap, remaining và spent. Dùng search/filter để tìm account; Sync Meta là mutation nên guide không bấm.\nCommit:\nhttps://github.com/dev-pati/New-Ads-Launcher/commit/d049801",
    })

    await capture({
      target: "button:has-text('Account Overview')",
      title: "Chuyển sang Account Overview",
      body: "Pointer: tab Overview gom sức khỏe, kết quả và ngân sách của một account thành một trang đọc nhanh.",
    })
    await page.getByRole("button", { name: "Account Overview", exact: true }).click()
    await page.getByRole("heading", { name: "Account Overview", exact: true }).waitFor()
    await page.getByText("Opportunity score", { exact: true }).first().waitFor()

    await capture({
      target: "div.space-y-4:has-text('Opportunity score')",
      title: "Đọc health, weekly results và budget remaining",
      body: "Shape focus: hero giữ account ID và trạng thái; cards cho Opportunity score, purchases, cost per purchase, campaign trends, next step, billing và Account Spending Limit. Toàn bộ số liệu trong guide là dữ liệu demo; budget và act_* ID giữ nguyên.",
    })

    await page.goto("/notifications", { waitUntil: "commit" })
    await page.getByRole("heading", { name: "Notifications", exact: true }).waitFor()

    await capture({
      target: "div.max-w-4xl",
      title: "7. Notification Inbox — đọc update theo thời gian",
      body: "Shape focus: inbox nhóm Today, Yesterday, Earlier; unread badge và category giúp ưu tiên Business, Ads, Profiles, Apps. Mở notification mới đánh dấu read và có thể deep-link tới object liên quan.\nCommits:\nhttps://github.com/dev-pati/New-Ads-Launcher/commit/4789c4e\nhttps://github.com/dev-pati/New-Ads-Launcher/commit/10f74e7",
    })

    await capture({
      target: "button:has([class*='tabler-icon-settings'])",
      title: "Mở Notification preferences",
      body: "Pointer: gear mở cấu hình category. Guide không mark read, archive, delete hoặc đổi toggle.",
    })
    await page.getByRole("button", { name: "Notification preferences" }).click()
    await page.getByRole("heading", { name: "Notification preferences" }).waitFor()

    await capture({
      target: "div.max-w-3xl",
      title: "Chọn category xuất hiện trong inbox",
      body: "Shape focus: mỗi toggle điều khiển một nhóm in-app alert. Business, Ads, Profiles và Apps tách riêng để giảm noise mà không mất những update quan trọng.",
    })

    await page.goto("/notifications", { waitUntil: "commit" })
    await page.getByRole("heading", { name: "Notifications", exact: true }).waitFor()
    const healthButton = page.getByRole("button", { name: "Account health" })

    await capture({
      target: "button[aria-label='Account health']",
      title: "8. Account Health Panel — mở từ sidebar",
      body: "Pointer: Account health luôn sẵn ở footer sidebar và đọc account đang được chọn toàn app.\nCommit:\nhttps://github.com/dev-pati/New-Ads-Launcher/commit/10f74e7",
    })
    await healthButton.click()
    await page.getByRole("dialog", { name: "Account health" }).waitFor()

    await capture({
      target: "div[role='dialog'][aria-label='Account health']",
      title: "Kiểm tra trạng thái Meta và activity gần đây",
      body: "Shape focus: panel read-only cho biết status code, disable reason, Meta notifications và recent account activity. Nếu cần xử lý sâu hơn, mở Ad Accounts; guide không refresh hoặc mutation.",
    })
  },
}

export default scenario
