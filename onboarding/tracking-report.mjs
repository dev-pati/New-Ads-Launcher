const activityTypes = [
  { key: "launch.submitted", label: "Launch submitted", class: "produce", status: "live", surface: "Launch", count: 12 },
  { key: "creative.uploaded", label: "Creative uploaded", class: "produce", status: "live", surface: "Assets", count: 18 },
  { key: "portal_media.assigned", label: "Portal media assigned", class: "produce", status: "live", surface: "Assets", count: 9 },
  { key: "template.created", label: "Ad copy template created", class: "reuse", status: "live", surface: "Templates", count: 6 },
  { key: "campaign.updated", label: "Campaign edited", class: "govern", status: "live", surface: "Ads Manager", count: 5 },
  { key: "page.comment", label: "Comment handled", class: "collaborate", status: "live", surface: "Page Manager", count: 4 },
  { key: "preset.applied", label: "Preset used in a launch", class: "reuse", status: "not_instrumented", surface: "Launch", count: 0 },
]

const teamMembers = [
  { userId: "user-kevin", name: "Kevin Demo", batches: 5, fullSuccess: 5, nonSuccess: 0, adsCreated: 24, averageSessionDurationMs: 78000 },
  { userId: "user-seth", name: "Seth Demo", batches: 4, fullSuccess: 3, nonSuccess: 1, adsCreated: 18, averageSessionDurationMs: 91000 },
  { userId: "user-bella", name: "Bella Demo", batches: 3, fullSuccess: 3, nonSuccess: 0, adsCreated: 12, averageSessionDurationMs: 84000 },
]

const teamActivityMembers = [
  { userId: "user-kevin", name: "Kevin Demo", actions: 22, activeDays: 5, breadth: 5, byClass: { produce: 12, reuse: 5, govern: 3, collaborate: 2 } },
  { userId: "user-seth", name: "Seth Demo", actions: 18, activeDays: 4, breadth: 4, byClass: { produce: 8, reuse: 2, govern: 6, collaborate: 2 } },
  { userId: "user-bella", name: "Bella Demo", actions: 14, activeDays: 4, breadth: 4, byClass: { produce: 7, reuse: 2, govern: 3, collaborate: 2 } },
]

const teamActivity = {
  total: 54,
  byClass: { produce: 27, reuse: 9, govern: 12, collaborate: 6 },
  byType: activityTypes,
  byMember: teamActivityMembers,
  activeMembers: 3,
  activeDays: 6,
  unused: [],
  notInstrumented: activityTypes.filter(item => item.status === "not_instrumented"),
  leverageRatio: 0.5,
  estimatedHoursSaved: 7.4,
}

const scenario = {
  slug: "tracking-report",
  title: "Tracking và gửi Weekly Report",
  audience: "Media Buyer · Org Admin",
  summary: "Đọc usage theo team, ghi nhận fallback và data mismatch, sau đó xem Report trước khi copy hoặc gửi email.",
  previewSession: true,
  mocks: [
    { url: "**/api/orgs", body: { orgs: [{ id: "org-demo", name: "PATI Demo", slug: "pati-demo", role: "admin" }] } },
    { url: "**/api/auth/me", body: { user: { id: "user-raymond", email: "raymond.demo@example.com", full_name: "Raymond Demo" } } },
    { url: "**/api/notifications**", body: { notifications: [], unreadCount: 0 } },
    {
      url: "**/api/tracking?*",
      body: {
        days: 7,
        generatedAt: "2026-08-07T09:00:00.000Z",
        role: "admin",
        currentUserId: "user-raymond",
        admin: { batches: 12, fullSuccess: 11, nonSuccess: 1, adsCreated: 54, successRate: 92, averageSessionDurationMs: 84000, team: teamMembers },
        adminTimeSeries: [
          { bucket: "2026-08-01", batches: 1, fullSuccess: 1, nonSuccess: 0, adsCreated: 5, avgDurationMs: 80000 },
          { bucket: "2026-08-03", batches: 3, fullSuccess: 3, nonSuccess: 0, adsCreated: 14, avgDurationMs: 76000 },
          { bucket: "2026-08-05", batches: 4, fullSuccess: 3, nonSuccess: 1, adsCreated: 16, avgDurationMs: 96000 },
          { bucket: "2026-08-07", batches: 4, fullSuccess: 4, nonSuccess: 0, adsCreated: 19, avgDurationMs: 82000 },
        ],
        teamStreaks: { "user-kevin": 5, "user-seth": 3, "user-bella": 4 },
        failureReasons: [{ label: "Meta creative review timeout", count: 1 }],
        mine: { batches: 2, fullSuccess: 2, nonSuccess: 0, adsCreated: 8, successRate: 100, averageSessionDurationMs: 72000, team: [] },
        myBatches: [],
        myStreak: 2,
        myFailureReasons: [],
        creative: { ready: 72, launched: 54, unlaunched: 18, launchRate: 75 },
        creatorDataStatus: "awaiting_portal",
        painpoint: "Budget remaining occasionally differed from Meta after a late refresh.",
        previous: { batches: 10, adsCreated: 43, successRate: 90, deltaBatches: 20, deltaAdsCreated: 26, deltaSuccessRate: 2, deltaActivity: 17, deltaActiveMembers: 0, deltaAutomationRuns: 25 },
        activity: {
          available: true,
          instrumentedSince: "2026-06-19T05:22:34.000Z",
          unavailableReason: null,
          truncated: false,
          automationRuns: 8,
          automationCoverage: 40,
          mine: { ...teamActivity, total: 10, byClass: { produce: 5, reuse: 2, govern: 2, collaborate: 1 }, byMember: [], activeMembers: 1, activeDays: 4, estimatedHoursSaved: 1.5 },
          team: teamActivity,
        },
      },
    },
    {
      url: "**/api/tracking/probation",
      body: {
        monthStart: "2026-08-01",
        monthEnd: "2026-09-01",
        currentWeek: "2026-08-03",
        fallbackAvailable: true,
        fallbackUnavailableReason: null,
        controlAvailable: true,
        controlUnavailableReason: null,
        weeks: [{ week: "2026-08-03", index: 2, isCurrent: true, launchers: [{ name: "Raymond Demo", batches: 2 }], controlActors: [{ name: "Raymond Demo", actions: 3 }], fallbacks: [{ id: "101", kind: "launch", occurredAt: "2026-08-06T08:00:00.000Z" }] }],
      },
    },
    {
      url: "**/api/tracking/painpoint",
      body: {
        note: "Budget remaining was stale after changing date range. Workaround: refresh Meta Ads Manager and compare the same attribution window.",
        weekStart: "2026-08-03",
        updatedAt: "2026-08-07T08:30:00.000Z",
        creativeAggregate: null,
        dataMismatchCount: 2,
      },
    },
    {
      url: "**/api/tracking/weekly-report",
      body: {
        to: ["kevin@example.com", "seth@example.com"],
        cc: "pati-bom@example.com",
        scheduleAvailable: true,
        schedule: { enabled: true, weekday: 5, send_time: "16:00", timezone: "Asia/Ho_Chi_Minh", pending_review: true, last_due_local_date: "2026-08-07", last_sent_at: null },
      },
    },
  ],

  async run({ page, capture }) {
    await page.goto("/tracking", { waitUntil: "commit" })
    await page.getByRole("heading", { name: "Tracking System" }).waitFor()

    await capture({
      target: "main",
      title: "Chọn đúng scope và kỳ báo cáo",
      body: "1) Team usage: xem delivery và app activity của cả team.\n2) My usage: xem KR evidence và weekly check-in của bạn.\n3) Reporting period: đổi 7, 30 hoặc 90 ngày; mọi metric trên trang và Report dùng cùng kỳ này.",
      redact: ["table tbody td:first-child"],
    })

    await capture({
      target: "section:has(h2:has-text('Usage by member'))",
      title: "Đọc Team usage theo kết quả và hành động",
      body: "Ads launched và Batches lấy từ launch history. App actions chỉ đếm hành động có bản ghi bền vững: upload, assign, template, edit, automation, page work. Active days và Features used cho biết tần suất và độ rộng sử dụng; đây không phải điểm hiệu suất nhân sự.",
      redact: ["table tbody td:first-child"],
    })

    await capture({
      target: "section:has(h2:has-text('App activity'))",
      title: "Phân tích app activity",
      body: "1) Valuable actions: tổng hành động đo được.\n2) Active members: người có ít nhất một hành động.\n3) Automation coverage: mức thay thế thao tác govern thủ công.\n4) Est. hours saved: ước tính, không phải thời gian đo trực tiếp.\nMở Breakdown để xem Produce, Reuse, Govern và Collaborate gồm những action nào.",
      redact: ["table tbody td:first-child"],
    })

    await page.getByRole("button", { name: "My usage" }).click()
    await page.getByRole("heading", { name: "Weekly check-in" }).waitFor()
    await capture({
      target: "section:has(h2:has-text('Weekly check-in'))",
      title: "Ghi nhận fallback, data mismatch và painpoint",
      body: "1) Launch +1 / Control +1: bấm ngay sau khi AdLauncher không làm xong và bạn phải sang Meta Ads Manager; mỗi tap được lưu ngay.\n2) Data mismatch count: tự nhập số lần dữ liệu trong app không khớp Meta Ads Manager.\n3) Painpoint description: ghi rõ vấn đề, tác động và workaround.\n4) Save all changes: lưu mismatch count và mô tả; guide không bấm Save thay bạn.",
    })

    await page.getByRole("button", { name: "Team usage" }).click()
    await page.getByRole("button", { name: "Report" }).click()
    await page.getByRole("dialog").waitFor()
    await capture({
      target: "div[role='dialog']",
      title: "Đọc Period report trước khi chia sẻ",
      body: "Report gồm delivery, KR tracking, executive readout, team usage và app activity trên cùng một nguồn dữ liệu với dashboard. Icon Copy ở góc trên sao chép Markdown; không cần hiện text zone dài trên màn hình.",
      redact: ["div[role='dialog'] table tbody td:first-child"],
    })

    const weeklyEmail = page.getByRole("heading", { name: "Weekly email" })
    await weeklyEmail.scrollIntoViewIfNeeded()
    await capture({
      target: "section:has(h3:has-text('Weekly email'))",
      title: "Preview là gate bắt buộc trước khi gửi email",
      body: "1) Kiểm tra To và CC đã cấu hình.\n2) Bấm Preview email để xem subject, recipients và nội dung render.\n3) Chỉ bấm Send email trong popup sau khi duyệt xong.\n4) Weekly schedule chỉ tạo pending review; không tự gửi email. Guide không bấm Preview, Save schedule hoặc Send.",
      redact: ["div[role='dialog'] table tbody td:first-child"],
    })
  },
}

export default scenario
